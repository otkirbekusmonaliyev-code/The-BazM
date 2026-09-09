// Xodim yoki Super Admin parolini qayta o'rnatish (parol unutilganda).
//
//   node scripts/setPassword.js --slug delish --phone +998901112233 --password YangiParol123
//   node scripts/setPassword.js --super --phone +998900000000 --password YangiParol123

require('dotenv').config();
const bcrypt = require('bcrypt');
const masterPrisma = require('../src/config/masterDb');
const { getTenantClient } = require('../src/config/tenantDb');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    const key = args[i].replace(/^--/, '');
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      i += 1;
    }
  }
  return result;
}

async function main() {
  const { slug, phone, password, super: isSuper } = parseArgs();
  if (!phone || !password) throw new Error('--phone va --password majburiy');
  if (String(password).length < 6) throw new Error('Parol kamida 6 belgi bo\'lsin');

  const passwordHash = await bcrypt.hash(String(password), 10);

  if (isSuper) {
    const admin = await masterPrisma.superAdmin.update({ where: { phone }, data: { passwordHash } });
    console.log(`\n✔ Super Admin paroli yangilandi: ${admin.phone}\n`);
    return;
  }

  if (!slug) throw new Error('--slug majburiy (yoki --super ishlating)');
  const db = await getTenantClient(slug);
  const user = await db.user.update({ where: { phone }, data: { passwordHash, isActive: true } });
  console.log(`\n✔ "${slug}" — ${user.fullName} (${user.role}) paroli yangilandi\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Xatolik:', err.message);
    process.exit(1);
  });
