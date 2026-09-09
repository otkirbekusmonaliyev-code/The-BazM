// Har bir restoran (tenant) o'z alohida bazasiga ega.
// Har bir so'rov uchun yangidan ulanmaslik uchun, Prisma client'lar
// xotirada (Map) keshlab saqlanadi: { restaurantSlug -> PrismaClient }
//
// Diqqat: bu oddiy in-memory kesh — bitta server instansiyasi uchun ishlaydi.
// Agar kelajakda bir nechta server (horizontal scaling) ishlatilsa,
// bu qismni Redis-asoslangan connection-registry'ga o'tkazish kerak bo'ladi.

const { PrismaClient } = require('../../node_modules/.prisma/tenant-client');
const masterPrisma = require('./masterDb');
const { decrypt } = require('../utils/crypto');

const tenantClientCache = new Map();

function buildUrl(restaurant) {
  const dbPassword = decrypt(restaurant.dbPasswordEncrypted);
  return `postgresql://${restaurant.dbUser}:${encodeURIComponent(dbPassword)}@${restaurant.dbHost}:${restaurant.dbPort}/${restaurant.dbName}`;
}

// Restoran yozuvi allaqachon qo'lda bo'lsa (masalan cron barcha tenantlar
// bo'ylab yurganda) — Master DB'ga qayta so'rov yubormasdan client olish
function getClientForRestaurant(restaurant) {
  if (tenantClientCache.has(restaurant.slug)) {
    return tenantClientCache.get(restaurant.slug);
  }
  const client = new PrismaClient({
    datasources: { db: { url: buildUrl(restaurant) } },
  });
  tenantClientCache.set(restaurant.slug, client);
  return client;
}

async function getTenantClient(restaurantSlug) {
  if (tenantClientCache.has(restaurantSlug)) {
    return tenantClientCache.get(restaurantSlug);
  }

  const restaurant = await masterPrisma.restaurant.findUnique({
    where: { slug: restaurantSlug },
  });

  if (!restaurant) {
    const err = new Error('Restoran topilmadi');
    err.statusCode = 404;
    throw err;
  }

  if (restaurant.subscriptionStatus === 'suspended') {
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

module.exports = {
  getTenantClient,
  getClientForRestaurant,
  invalidateTenantClient,
  listRunningRestaurants,
};
