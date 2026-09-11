// Tenant sxemasi (prisma/tenant-template/schema.prisma) o'zgargach, uni
// MAVJUD barcha restoran bazalariga ham yoyish kerak. Bu skript shuni qiladi.
//
// Ishlatish:
//   node scripts/syncTenants.js            (barcha restoranlar)
//   node scripts/syncTenants.js --slug delish   (faqat bittasi)

require('dotenv').config();
const masterPrisma = require('../src/config/masterDb');
const { decrypt } = require('../src/utils/crypto');
const { pushTenantSchema } = require('../src/services/provisioning');

// Jadval olib tashlanganda Prisma so'roqsiz o'chirmaydi — va bu to'g'ri.
// Ruxsat ATAYLAB alohida bayroq bilan beriladi, shunda tasodifan
// ishlab ketmaydi.
const ACCEPT_LOSS = process.argv.includes('--accept-data-loss');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    result[args[i].replace(/^--/, '')] = args[i + 1];
  }
  return result;
}

async function main() {
  const { slug } = parseArgs();
  const restaurants = await masterPrisma.restaurant.findMany({
    where: slug ? { slug } : {},
    orderBy: { createdAt: 'asc' },
  });

  if (restaurants.length === 0) {
    console.log('Restoran topilmadi.');
    return;
  }

  for (const r of restaurants) {
    const password = decrypt(r.dbPasswordEncrypted);
    const url = `postgresql://${r.dbUser}:${encodeURIComponent(password)}@${r.dbHost}:${r.dbPort}/${r.dbName}`;
    console.log(`\n--- ${r.slug} (${r.dbName}) ---`);
    pushTenantSchema(url, { acceptDataLoss: ACCEPT_LOSS });
  }
  console.log(`\n✔ ${restaurants.length} ta baza yangilandi\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Xatolik:', err.message);
    process.exit(1);
  });
