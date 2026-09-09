// Stolni bo'shatish mantig'i bir necha joydan chaqiriladi (mijoz bekor qildi,
// oshpaz bekor qildi, ofitsiant yetkazdi, cron 15 daqiqadan keyin) —
// shuning uchun alohida servisda saqlanadi.

const realtime = require('../realtime/io');
const { CLOSED_STATUSES } = require('../utils/orderStatus');

// Stolda faol buyurtma qolmagan bo'lsa — uni bo'sh deb belgilaydi.
// Qaytaradi: bo'shatildimi (true/false)
async function releaseTableIfIdle(tenantDb, tableId, slug) {
  const stillActive = await tenantDb.order.count({
    where: { tableId, status: { notIn: CLOSED_STATUSES } },
  });
  if (stillActive > 0) return false;

  const table = await tenantDb.restaurantTable.update({
    where: { id: tableId },
    data: { isOccupied: false, occupiedAt: null },
  });
  realtime.emitTableReleased(slug, { tableId, tableNumber: table.tableNumber });
  return true;
}

module.exports = { releaseTableIfIdle };
