// Yangi restoran "provision" qilish — ya'ni:
//   1. Unga alohida PostgreSQL bazasi yaratish (masalan delish_db)
//   2. Tenant sxemasi asosida jadvallarni qurish
//   3. Master DB'ga Restaurant yozuvini (shifrlangan parol bilan) qo'shish
//   4. Restoranning birinchi admin foydalanuvchisini yaratish
//
// Bu mantiq HAM CLI skriptidan (scripts/provisionTenant.js), HAM Super Admin
// panelidagi "Yangi restoran" tugmasidan chaqiriladi — shuning uchun alohida
// servis sifatida ajratilgan.

const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const masterPrisma = require('../config/masterDb');
const { encrypt } = require('../utils/crypto');
const { getTenantClient, invalidateTenantClient } = require('../config/tenantDb');
const staffDirectory = require('./staffDirectory');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const TENANT_SCHEMA = 'prisma/tenant-template/schema.prisma';

// Tarif rejalari va oylik narxi (so'mda). Marketing saytidagi jadval ham
// shu qiymatlarga tayanadi — bitta manba, ikki joyda ishlatiladi.
const PLAN_PRICES = {
  basic: 299000,
  standard: 599000,
  pro: 1199000,
};

// slug faqat kichik lotin harflari, raqam va tire bo'lishi kerak —
// chunki u ham subdomain, ham PostgreSQL baza nomining bir qismi
function normalizeSlug(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// Nomdan avtomatik slug yasash (masalan "Delish Cafe" -> "delish-cafe").
// Band bo'lsa oxiriga raqam qo'shiladi.
async function generateUniqueSlug(name) {
  const base = normalizeSlug(name) || 'restoran';
  let candidate = base;
  let i = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await masterPrisma.restaurant.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}

// PostgreSQL baza nomi tire qabul qilmaydi (qo'shtirnoqsiz), shuning uchun
// slugdagi tirelarni pastki chiziqqa almashtiramiz
function dbNameFromSlug(slug) {
  return `${slug.replace(/-/g, '_')}_db`;
}

function pgAdminConfig() {
  return {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_ADMIN_USER || 'postgres',
    password: process.env.PG_ADMIN_PASSWORD,
  };
}

async function createDatabase(dbName) {
  const cfg = pgAdminConfig();
  const admin = new Client({ ...cfg, database: 'postgres' });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount > 0) {
      const err = new Error(`"${dbName}" bazasi allaqachon mavjud`);
      err.statusCode = 409;
      throw err;
    }
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }
}

async function dropDatabase(dbName) {
  const cfg = pgAdminConfig();
  const admin = new Client({ ...cfg, database: 'postgres' });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
      [dbName]
    );
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } finally {
    await admin.end();
  }
}

// Tenant sxemasini bazaga "push" qilish. Migratsiya fayllari o'rniga
// `db push` ishlatiladi, chunki tenant bazalar bir xil shablondan
// yaratiladi — ular uchun alohida migratsiya tarixi yuritish shart emas.
function pushTenantSchema(connectionUrl) {
  // Windows'da `npx` — bu .cmd fayl. Node 22 uni to'g'ridan-to'g'ri
  // spawn qilolmaydi (EINVAL), shuning uchun shell orqali chaqiramiz.
  execSync(`npx prisma db push --schema=${TENANT_SCHEMA} --skip-generate`, {
    cwd: BACKEND_ROOT,
    env: { ...process.env, TENANT_DATABASE_URL: connectionUrl },
    stdio: 'inherit',
  });
}

/**
 * Yangi restoranni to'liq ishga tushiradi.
 * @param {object} input
 * @param {string} input.name        Restoran nomi
 * @param {string} [input.slug]      Ixtiyoriy — berilmasa nomdan yasaladi
 * @param {string} [input.plan]      basic | standard | pro
 * @param {string} [input.adminName] Birinchi admin ismi
 * @param {string} [input.adminPhone] Birinchi admin telefoni (login)
 * @param {string} [input.adminPassword] Berilmasa avtomatik yasaladi
 */
async function provisionRestaurant(input) {
  const name = String(input.name || '').trim();
  if (!name) {
    const err = new Error('Restoran nomi majburiy');
    err.statusCode = 400;
    throw err;
  }

  const slug = input.slug ? normalizeSlug(input.slug) : await generateUniqueSlug(name);
  if (!slug) {
    const err = new Error('Slug noto\'g\'ri');
    err.statusCode = 400;
    throw err;
  }

  const existing = await masterPrisma.restaurant.findUnique({ where: { slug } });
  if (existing) {
    const err = new Error(`"${slug}" slug'i band`);
    err.statusCode = 409;
    throw err;
  }

  // Yagona login raqamga qarab ishlaydi: shu raqam boshqa muassasada
  // band bo'lsa, tizim keyin qaysi bazaga kiritishni bilmay qolardi
  if (input.adminPhone) {
    const takenBy = await staffDirectory.find(String(input.adminPhone).trim());
    if (takenBy) {
      const err = new Error(
        'Bu telefon raqami boshqa muassasada band. Boshqa raqam kiriting.'
      );
      err.statusCode = 409;
      throw err;
    }
  }

  const plan = PLAN_PRICES[input.plan] ? input.plan : 'basic';
  const dbName = dbNameFromSlug(slug);
  const cfg = pgAdminConfig();

  // Hozircha tenant bazaga ham shu admin foydalanuvchi bilan ulanamiz.
  // (Production'da har bir tenant uchun alohida cheklangan DB user
  //  yaratish xavfsizlikni yanada oshiradi — TODO)
  const tenantDbPassword = cfg.password;
  const connectionUrl = `postgresql://${cfg.user}:${encodeURIComponent(tenantDbPassword)}@${cfg.host}:${cfg.port}/${dbName}`;

  let restaurant = null;
  try {
    await createDatabase(dbName);
    pushTenantSchema(connectionUrl);

    restaurant = await masterPrisma.restaurant.create({
      data: {
        name,
        slug,
        dbName,
        dbHost: cfg.host,
        dbPort: cfg.port,
        dbUser: cfg.user,
        dbPasswordEncrypted: encrypt(tenantDbPassword),
        businessType: input.businessType === 'cafe' ? 'cafe' : 'restaurant',
        subscriptionPlan: plan,
        subscriptionStatus: 'trial',
        monthlyFee: PLAN_PRICES[plan],
        // Sinov muddati — 14 kun
        nextBillingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        telegramBotToken: input.telegramBotToken || null,
      },
    });
  } catch (err) {
    // Yarim yo'lda to'xtab qolsak — ortimizdan yaratilgan bazani tozalaymiz,
    // aks holda keyingi urinishda "baza allaqachon mavjud" xatosi chiqadi
    if (!restaurant) {
      try {
        await dropDatabase(dbName);
      } catch (_) {
        /* tozalash muvaffaqiyatsiz bo'lsa ham asosiy xatoni qaytaramiz */
      }
    }
    throw err;
  }

  // Birinchi admin foydalanuvchi
  let adminCredentials = null;
  if (input.adminPhone) {
    const password = input.adminPassword || `bazm${Math.floor(100000 + Math.random() * 900000)}`;
    const tenantDb = await getTenantClient(slug);
    await tenantDb.user.create({
      data: {
        fullName: input.adminName || `${name} admin`,
        phone: String(input.adminPhone).trim(),
        passwordHash: await bcrypt.hash(password, 10),
        role: 'admin',
      },
    });
    adminCredentials = { phone: String(input.adminPhone).trim(), password };

    // Yagona login shu indeks orqali ishlaydi
    await staffDirectory.upsert({
      phone: adminCredentials.phone,
      restaurantSlug: slug,
      role: 'admin',
      isActive: true,
    });
  }

  // Master yozuvida shifrlangan baza paroli bor — u API javobiga
  // hech qachon tushmasligi kerak
  const { dbPasswordEncrypted, dbUser, dbPort, ...safeRestaurant } = restaurant;

  return { restaurant: safeRestaurant, adminCredentials };
}

// Restoranni butunlay o'chirish (bazasi bilan birga). Faqat Super Admin uchun.
async function deleteRestaurant(id) {
  const restaurant = await masterPrisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) {
    const err = new Error('Restoran topilmadi');
    err.statusCode = 404;
    throw err;
  }
  invalidateTenantClient(restaurant.slug);
  // Global xodim indeksida bu restoranning yozuvlari qolib ketmasin —
  // aks holda o'chirilgan restoran xodimi login qilishga urinaverardi
  await staffDirectory.removeByRestaurant(restaurant.slug);
  await masterPrisma.billingRecord.deleteMany({ where: { restaurantId: id } });
  await masterPrisma.restaurant.delete({ where: { id } });
  await dropDatabase(restaurant.dbName);
  return restaurant;
}

module.exports = {
  provisionRestaurant,
  deleteRestaurant,
  pushTenantSchema,
  normalizeSlug,
  generateUniqueSlug,
  dbNameFromSlug,
  PLAN_PRICES,
};
