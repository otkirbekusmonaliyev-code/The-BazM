// BOT MIJOZLARINI TENANT BAZALARIDAN MASTER BAZAGA KO'CHIRISH.
//
// Bir martalik skript. Bot tuzilishi o'zgardi: avval har bir restoranning
// O'Z boti bor edi va mijoz o'sha restoranning bazasiga yozilardi. Endi
// butun platformada bitta bot ishlaydi — odam ro'yxatdan o'tadi, muassasani
// keyin tanlaydi. Ya'ni ro'yxat MASTER bazada bo'lishi kerak.
//
// Skript avval ko'chiradi, KEYIN eski jadvalni o'chirishga ruxsat beradi:
// `npm run tenant:sync` ni undan keyin ishlatish kerak.
//
//   node scripts/migrateBotCustomers.js          (ko'chiradi)
//   node scripts/migrateBotCustomers.js --check  (faqat sanaydi)
//
// Bir xil `telegramId` bir nechta restoranda uchrasa — eng OXIRGI
// ko'rilgani olinadi: u eng to'g'ri raqam va ism bo'ladi.

require('dotenv').config();
const { Client } = require('pg');
const masterPrisma = require('./../src/config/masterDb');
const { decrypt } = require('../src/utils/crypto');

const CHECK_ONLY = process.argv.includes('--check');

async function readTenant(restaurant) {
  const password = decrypt(restaurant.dbPasswordEncrypted);
  const client = new Client({
    host: restaurant.dbHost,
    port: restaurant.dbPort,
    user: restaurant.dbUser,
    password,
    database: restaurant.dbName,
  });
  await client.connect();
  try {
    const res = await client.query(
      'SELECT * FROM "TelegramCustomer" ORDER BY "lastSeenAt" ASC'
    );
    return res.rows;
  } catch (_) {
    // Jadval yo'q — bu muassasa hech qachon bot bilan ishlamagan
    return [];
  } finally {
    await client.end();
  }
}

async function main() {
  const restaurants = await masterPrisma.restaurant.findMany();
  console.log(`\n${restaurants.length} ta muassasa tekshirilmoqda...\n`);

  let found = 0;
  let moved = 0;

  for (const r of restaurants) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await readTenant(r);
    if (rows.length === 0) continue;
    found += rows.length;
    console.log(`  ${r.slug}: ${rows.length} ta mijoz`);

    if (CHECK_ONLY) continue;

    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      await masterPrisma.telegramCustomer.upsert({
        where: { telegramId: String(row.telegramId) },
        update: {
          phone: row.phone,
          firstName: row.firstName || null,
          username: row.username || null,
          lang: row.lang === 'ru' ? 'ru' : 'uz',
          lastSlug: r.slug,
        },
        create: {
          telegramId: String(row.telegramId),
          phone: row.phone,
          firstName: row.firstName || null,
          username: row.username || null,
          lang: row.lang === 'ru' ? 'ru' : 'uz',
          lastSlug: r.slug,
          createdAt: row.createdAt || new Date(),
        },
      });
      moved += 1;
    }
  }

  const total = await masterPrisma.telegramCustomer.count();
  console.log(
    `\n  Topildi: ${found} ta${CHECK_ONLY ? '' : ` · ko'chirildi: ${moved} ta`}`
      + `\n  Master bazada hozir: ${total} ta mijoz\n`
  );

  if (!CHECK_ONLY && found > 0) {
    console.log('  Endi eski jadvallarni o\'chirish mumkin:');
    console.log('    node scripts/syncTenants.js --accept-data-loss\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Xatolik:', err.message);
    process.exit(1);
  });
