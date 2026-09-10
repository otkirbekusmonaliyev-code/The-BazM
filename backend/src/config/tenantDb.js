// Har bir restoran (tenant) o'z alohida bazasiga ega.
// Har bir so'rov uchun yangidan ulanmaslik uchun, Prisma client'lar
// xotirada keshlab saqlanadi: { restaurantSlug -> PrismaClient }
//
// Diqqat: bu oddiy in-memory kesh — bitta server instansiyasi uchun ishlaydi.
// Agar kelajakda bir nechta server (horizontal scaling) ishlatilsa,
// bu qismni Redis-asoslangan connection-registry'ga o'tkazish kerak bo'ladi.
//
// ============================================================
//  ULANISHLAR SONI — database-per-tenant'ning asosiy xavfi
// ============================================================
//
// Har bir PrismaClient O'Z ulanishlar hovuzini ochadi va standart hajmi
// protsessor yadrolari soniga bog'liq (num_cpus * 2 + 1) — ya'ni bitta
// muassasa 17 va undan ko'p ulanish egallashi mumkin. PostgreSQL'da esa
// `max_connections` odatda 100.
//
// Ya'ni sozlanmagan holda platforma 5-6 muassasadan keyin yiqilardi:
// "Too many database connections opened". Bu 10 ta muassasa bilan
// o'tkazilgan sinovda aynan yuz berdi — oxirgi uchtasining boshqaruv
// paneli 500 qaytardi.
//
// Ikki qatlamli himoya:
//
//   1) Har bir muassasa hovuzi cheklanadi (`connection_limit`), shuning
//      uchun bitta muassasa hammasini o'ziga olib qo'ymaydi.
//   2) Keshda saqlanadigan client'lar soni cheklanadi: chegaradan oshsa,
//      eng uzoq vaqt ishlatilmagani uziladi (LRU). Muassasalar soni
//      qancha bo'lsa ham, umumiy ulanishlar soni chegarada qoladi.
//
// Yakuniy tom: MAX_CLIENTS * POOL_SIZE ulanish. Standart 20 * 3 = 60,
// ya'ni master baza va boshqa vositalarga ham joy qoladi.

const { PrismaClient } = require('../../node_modules/.prisma/tenant-client');
const masterPrisma = require('./masterDb');
const { decrypt } = require('../utils/crypto');

const POOL_SIZE = Math.max(1, Number(process.env.TENANT_DB_POOL) || 3);
const MAX_CLIENTS = Math.max(2, Number(process.env.TENANT_DB_MAX_CLIENTS) || 20);
const POOL_TIMEOUT = Math.max(5, Number(process.env.TENANT_DB_POOL_TIMEOUT) || 20);

// Map kalitlarni qo'shilish tartibida saqlaydi. Har safar murojaat
// qilinganda kalitni o'chirib qayta qo'yamiz — shunda ro'yxat boshida
// eng uzoq vaqt ishlatilmagani turadi (LRU).
const tenantClientCache = new Map();

function buildUrl(restaurant) {
  const dbPassword = decrypt(restaurant.dbPasswordEncrypted);
  const base = `postgresql://${restaurant.dbUser}:${encodeURIComponent(dbPassword)}@${restaurant.dbHost}:${restaurant.dbPort}/${restaurant.dbName}`;
  return `${base}?connection_limit=${POOL_SIZE}&pool_timeout=${POOL_TIMEOUT}`;
}

function touch(slug) {
  const client = tenantClientCache.get(slug);
  if (client) {
    tenantClientCache.delete(slug);
    tenantClientCache.set(slug, client);
  }
  return client;
}

// Chegaradan oshgan bo'lsa — eng eski client'ni uzamiz.
// Uzilgan muassasa keyingi so'rovda qaytadan ulanadi, faqat birinchi
// so'rov bir oz sekinroq bo'ladi.
function evictIfNeeded() {
  while (tenantClientCache.size > MAX_CLIENTS) {
    const oldest = tenantClientCache.keys().next().value;
    const client = tenantClientCache.get(oldest);
    tenantClientCache.delete(oldest);
    if (client) {
      client.$disconnect().catch(() => {});
    }
  }
}

// Restoran yozuvi allaqachon qo'lda bo'lsa (masalan cron barcha tenantlar
// bo'ylab yurganda) — Master DB'ga qayta so'rov yubormasdan client olish
function getClientForRestaurant(restaurant) {
  const cached = touch(restaurant.slug);
  if (cached) return cached;

  const client = new PrismaClient({
    datasources: { db: { url: buildUrl(restaurant) } },
  });
  tenantClientCache.set(restaurant.slug, client);
  evictIfNeeded();
  return client;
}

// `allowSuspended` — TO'LOV SAHIFASI uchun. Xizmat to'xtatilganda ham
// muassasa qarzini ko'ra olishi va to'lay olishi kerak: aks holda odam
// to'lash uchun ham kira olmay qolardi va bu boshi berk ko'cha bo'lardi.
async function getTenantClient(restaurantSlug, { allowSuspended = false } = {}) {
  const cached = touch(restaurantSlug);
  if (cached) return cached;

  const restaurant = await masterPrisma.restaurant.findUnique({
    where: { slug: restaurantSlug },
  });

  if (!restaurant) {
    const err = new Error('Restoran topilmadi');
    err.statusCode = 404;
    throw err;
  }

  if (restaurant.subscriptionStatus === 'suspended' && !allowSuspended) {
    const err = new Error('Obuna muddati tugagan. Xizmat vaqtincha to\'xtatilgan.');
    err.statusCode = 403;
    err.code = 'SUBSCRIPTION_SUSPENDED';
    throw err;
  }

  return getClientForRestaurant(restaurant);
}

// Restoran suspend qilinganda yoki ma'lumotlari o'zgarganda keshni tozalash
function invalidateTenantClient(restaurantSlug) {
  const client = tenantClientCache.get(restaurantSlug);
  if (client) {
    client.$disconnect().catch(() => {});
    tenantClientCache.delete(restaurantSlug);
  }
}

// Ishlayotgan (suspend qilinmagan) barcha restoranlar — cron job va
// Telegram bot menejeri shu ro'yxat bo'ylab yuradi
async function listRunningRestaurants() {
  return masterPrisma.restaurant.findMany({
    where: { subscriptionStatus: { in: ['trial', 'active'] } },
  });
}

// Diagnostika uchun: hozir nechta muassasa ulangan
function poolStats() {
  return {
    openClients: tenantClientCache.size,
    maxClients: MAX_CLIENTS,
    poolPerClient: POOL_SIZE,
    maxConnections: MAX_CLIENTS * POOL_SIZE,
  };
}

module.exports = {
  getTenantClient,
  getClientForRestaurant,
  invalidateTenantClient,
  listRunningRestaurants,
  poolStats,
};
