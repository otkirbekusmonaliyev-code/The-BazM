// Super Admin restoran uchun birinchi Admin foydalanuvchini shu skript orqali yaratadi.
// Bu — restoran egasiga beriladigan kirish ma'lumotlari (telefon + parol).
//
// Ishlatish (PowerShell'da, backend papkasida):
//   node scripts/createRestaurantAdmin.js --slug delish --name "Restoran Egasi" --phone +998901112233 --password kuchliParol123

require('dotenv').config();
const bcrypt = require('bcrypt');
const { getTenantClient } = require('../src/config/tenantDb');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    result[key] = args[i + 1];
  }
  return result;
}

async function main() {
  const { slug, name, phone, password } = parseArgs();
  if (!slug || !name || !phone || !password) {
    throw new Error('--slug, --name, --phone, --password argumentlari majburiy');
  }
  if (password.length < 6) {
    throw new Error('Parol kamida 6 belgidan iborat bo\'lishi kerak');
  }

  const tenantDb = await getTenantClient(slug);
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await tenantDb.user.create({
    data: { fullName: name, phone, passwordHash, role: 'admin' },
  });

  console.log(`\n✔ "${slug}" restorani uchun admin yaratildi:`);
  console.log(`   Ism:     ${admin.fullName}`);
  console.log(`   Telefon: ${admin.phone}`);
  console.log(`   (Bu ma'lumotlarni restoran egasiga bering — u shu bilan tizimga kiradi)\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Xatolik:', err.message);
    process.exit(1);
  });
