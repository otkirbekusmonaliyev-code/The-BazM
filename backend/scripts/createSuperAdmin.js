// Birinchi (va odatda yagona) Super Admin'ni yaratish uchun.
// Ishlatish (PowerShell'da):
//   node scripts/createSuperAdmin.js --name "Sizning Ismingiz" --phone +998901234567 --password kuchliParol123

require('dotenv').config();
const bcrypt = require('bcrypt');
const masterPrisma = require('../src/config/masterDb');

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
  const { name, phone, password } = parseArgs();
  if (!name || !phone || !password) {
    throw new Error('--name, --phone, --password argumentlari majburiy');
  }
  if (password.length < 6) {
    throw new Error('Parol kamida 6 belgidan iborat bo\'lishi kerak');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await masterPrisma.superAdmin.create({
    data: { fullName: name, phone, passwordHash },
  });

  console.log(`\n✔ Super Admin yaratildi: ${admin.phone} (id: ${admin.id})\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Xatolik:', err.message);
    process.exit(1);
  });
