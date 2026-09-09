// PLATFORMANI TOZALASH.
//
// Barcha muassasalarni (restoran va kafelarni) BAZASI BILAN BIRGA o'chiradi,
// arizalar, xodim indeksi va to'lov tarixini tozalaydi. Faqat bitta Super
// Admin qoladi — platforma egasi.
//
// Bu amal QAYTARIB BO'LMAYDI. Shuning uchun tasdiqlash bayrog'i talab
// qilinadi va o'chirishdan oldin nima o'chishi ro'yxat qilib ko'rsatiladi.
//
//   node scripts/resetPlatform.js                 -> faqat ko'rsatadi
//   node scripts/resetPlatform.js --yes           -> haqiqatan o'chiradi
//   node scripts/resetPlatform.js --yes --keep +998941093350
//
// Saqlanadigan Super Admin raqami `--keep` bilan beriladi; berilmasa
// quyidagi standart raqam ishlatiladi.

require('dotenv').config();
const bcrypt = require('bcrypt');
const { Client } = require('pg');
const masterPrisma = require('../src/config/masterDb');
const { invalidateTenantClient } = require('../src/config/tenantDb');

const KEEP_PHONE_DEFAULT = '+998941093350';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const CONFIRMED = process.argv.includes('--yes');
const KEEP_PHONE = arg('--keep', KEEP_PHONE_DEFAULT);
const NEW_PASSWORD = arg('--password', null);

function pgAdminConfig() {
  return {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_ADMIN_USER || 'postgres',
    password: process.env.PG_ADMIN_PASSWORD,
  };
}

// Bazani o'chirish. Unga ochiq ulanishlar bo'lsa PostgreSQL ruxsat bermaydi,
// shuning uchun avval ular uziladi.
async function dropDatabase(dbName) {
  const admin = new Client({ ...pgAdminConfig(), database: 'postgres' });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName]
    );
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } finally {
    await admin.end();
  }
}

async function main() {
  const restaurants = await masterPrisma.restaurant.findMany({
    select: { id: true, slug: true, name: true, businessType: true, dbName: true },
    orderBy: { createdAt: 'asc' },
  });
  const admins = await masterPrisma.superAdmin.findMany({
    select: { id: true, phone: true, fullName: true },
  });
  const [applications, lookups, billing] = await Promise.all([
    masterPrisma.restaurantApplication.count(),
    masterPrisma.staffLookup.count(),
    masterPrisma.billingRecord.count(),
  ]);

  const keeper = admins.find((a) => a.phone === KEEP_PHONE);

  console.log('\n=== O\'CHIRILADI ===\n');
  console.log(`Muassasalar: ${restaurants.length} ta (bazalari bilan birga)`);
  restaurants.forEach((r) =>
    console.log(`   ${r.slug.padEnd(24)} ${r.businessType.padEnd(11)} ${r.dbName}`)
  );
  console.log(`\nArizalar: ${applications} ta`);
  console.log(`Xodim indeksi (StaffLookup): ${lookups} ta`);
  console.log(`To'lov yozuvlari: ${billing} ta`);

  const dropAdmins = admins.filter((a) => a.phone !== KEEP_PHONE);
  console.log(`\nSuper adminlar: ${dropAdmins.length} ta o'chiriladi`);
  dropAdmins.forEach((a) => console.log(`   ${a.phone} — ${a.fullName}`));

  console.log('\n=== QOLADI ===\n');
  if (keeper) {
    console.log(`   ${keeper.phone} — ${keeper.fullName}`);
  } else {
    console.log(`   ${KEEP_PHONE} — yo'q edi, YARATILADI`);
    if (!NEW_PASSWORD) {
      console.error(
        '\n❌ Bu raqamli super admin yo\'q. Uni yaratish uchun parol kerak:\n' +
          '   --password "PAROL"\n'
      );
      process.exit(1);
    }
  }

  if (!CONFIRMED) {
    console.log('\n(Bu faqat ko\'rsatish edi. Haqiqatan o\'chirish uchun: --yes)\n');
    process.exit(0);
  }

  console.log('\n=== BAJARILMOQDA ===\n');

  // 1) Har bir muassasaning bazasini o'chiramiz
  for (const r of restaurants) {
    invalidateTenantClient(r.slug);
    try {
      // eslint-disable-next-line no-await-in-loop
      await dropDatabase(r.dbName);
      console.log(`   ✔ baza o'chirildi: ${r.dbName}`);
    } catch (err) {
      console.error(`   ✘ ${r.dbName}: ${err.message}`);
    }
  }

  // 2) Master bazadagi yozuvlar. Tartib muhim: avval bog'liqlari.
  const b = await masterPrisma.billingRecord.deleteMany({});
  const app = await masterPrisma.restaurantApplication.deleteMany({});
  const look = await masterPrisma.staffLookup.deleteMany({});
  const rest = await masterPrisma.restaurant.deleteMany({});
  console.log(`   ✔ to'lovlar: ${b.count}`);
  console.log(`   ✔ arizalar: ${app.count}`);
  console.log(`   ✔ xodim indeksi: ${look.count}`);
  console.log(`   ✔ muassasa yozuvlari: ${rest.count}`);

  // 3) Ortiqcha super adminlar
  if (dropAdmins.length > 0) {
    const a = await masterPrisma.superAdmin.deleteMany({
      where: { phone: { not: KEEP_PHONE } },
    });
    console.log(`   ✔ super adminlar: ${a.count}`);
  }

  // 4) Qoladigan super admin (kerak bo'lsa yaratiladi / paroli yangilanadi)
  if (!keeper) {
    await masterPrisma.superAdmin.create({
      data: {
        phone: KEEP_PHONE,
        fullName: 'Bosh administrator',
        passwordHash: await bcrypt.hash(NEW_PASSWORD, 10),
      },
    });
    console.log(`   ✔ super admin yaratildi: ${KEEP_PHONE}`);
  } else if (NEW_PASSWORD) {
    await masterPrisma.superAdmin.update({
      where: { phone: KEEP_PHONE },
      data: { passwordHash: await bcrypt.hash(NEW_PASSWORD, 10) },
    });
    console.log(`   ✔ paroli yangilandi: ${KEEP_PHONE}`);
  }

  const left = await masterPrisma.superAdmin.findMany({ select: { phone: true, fullName: true } });
  console.log('\n=== NATIJA ===\n');
  console.log(`Muassasalar: ${await masterPrisma.restaurant.count()}`);
  console.log(`Super adminlar: ${left.length}`);
  left.forEach((a) => console.log(`   ${a.phone} — ${a.fullName}`));
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Tozalash to\'xtadi:', err);
  process.exit(1);
});
