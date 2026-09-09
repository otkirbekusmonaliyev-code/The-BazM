// Mijoz botda (yoki QR orqali) stolni band qiladi, lekin hech narsa
// buyurtma qilmaydi — stol abadiy "band" bo'lib qolmasligi kerak.
// Bu job har daqiqada barcha restoranlarni tekshiradi va 15 daqiqadan beri
// buyurtmasiz turgan stollarni avtomatik bo'shatadi.

const { listRunningRestaurants, getClientForRestaurant } = require('../config/tenantDb');
const realtime = require('../realtime/io');
const { CLOSED_STATUSES } = require('../utils/orderStatus');

const IDLE_MINUTES = 15;
const INTERVAL_MS = 60 * 1000;

async function releaseIdleTablesFor(restaurant) {
  const tenantDb = getClientForRestaurant(restaurant);
  const cutoff = new Date(Date.now() - IDLE_MINUTES * 60 * 1000);

  const candidates = await tenantDb.restaurantTable.findMany({
    where: { isOccupied: true, occupiedAt: { lt: cutoff } },
    select: { id: true, tableNumber: true },
  });
  if (candidates.length === 0) return 0;

  // Faol buyurtmasi bor stollarni chetlab o'tamiz — mijoz allaqachon
  // ovqat kutayotgan bo'lishi mumkin
  const busy = await tenantDb.order.findMany({
    where: {
      tableId: { in: candidates.map((t) => t.id) },
      status: { notIn: CLOSED_STATUSES },
    },
    select: { tableId: true },
    distinct: ['tableId'],
  });
  const busyIds = new Set(busy.map((o) => o.tableId));
  const toRelease = candidates.filter((t) => !busyIds.has(t.id));
  if (toRelease.length === 0) return 0;

  await tenantDb.restaurantTable.updateMany({
    where: { id: { in: toRelease.map((t) => t.id) } },
    data: { isOccupied: false, occupiedAt: null },
  });

  for (const t of toRelease) {
    realtime.emitTableReleased(restaurant.slug, { tableId: t.id, tableNumber: t.tableNumber, auto: true });
  }
  return toRelease.length;
}

async function tick() {
  try {
    const restaurants = await listRunningRestaurants();
    for (const restaurant of restaurants) {
      try {
        const n = await releaseIdleTablesFor(restaurant);
        if (n > 0) {
          console.log(`   [cron] ${restaurant.slug}: ${n} ta stol avtomatik bo'shatildi`);
        }
      } catch (err) {
        console.error(`   [cron] ${restaurant.slug} xatosi:`, err.message);
      }
    }
  } catch (err) {
    console.error('   [cron] restoranlar ro\'yxatini olishda xato:', err.message);
  }
}

let timer = null;

function startTableReleaseJob() {
  if (timer) return timer;
  timer = setInterval(tick, INTERVAL_MS);
  // Node jarayoni faqat shu taymer sababli tirik qolib ketmasin
  if (timer.unref) timer.unref();
  console.log(`   Cron: bo'sh stollarni tozalash (har ${INTERVAL_MS / 1000}s, ${IDLE_MINUTES} daqiqa chegara)`);
  return timer;
}

function stopTableReleaseJob() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startTableReleaseJob, stopTableReleaseJob, releaseIdleTablesFor, IDLE_MINUTES };
