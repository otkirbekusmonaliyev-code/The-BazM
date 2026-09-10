// OFITSIANT CHAQIRISH — MANZILLI.
//
// Avval chaqiruv HAMMA ofitsiantga birdan ketardi (`{slug}_waiters` xonasi).
// Amalda bu yomon ishlaydi: yo hamma birdan boradi, yo "meni emas, boshqasi
// boradi" deb hech kim bormaydi. Endi chaqiruv AYNAN BITTA ofitsiantga
// yuboriladi — mijoz o'zi tanlaydi yoki bo'shlaridan biri tavakkaliga olinadi.
//
// "Bo'sh" holati hech qayerda saqlanmaydi, u buyurtmalardan hisoblanadi
// (qarang: services/waiters.js). Shu sababli bu yerda ham eskirgan ma'lumot
// bo'lishi mumkin emas.

const realtime = require('../realtime/io');
const { listWaitersWithStatus } = require('./waiters');

// Mijoz "men qaysi stoldaman?" degan savolga javob berishi uchun.
// Band-bo'shligiga qaramaymiz: odam band stolda o'tirgan bo'lishi ham
// mumkin (masalan do'sti allaqachon buyurtma bergan).
async function listTables(tenantDb) {
  return tenantDb.restaurantTable.findMany({
    select: { id: true, tableNumber: true, isOccupied: true },
    orderBy: { tableNumber: 'asc' },
  });
}

async function listFreeWaiters(tenantDb) {
  const all = await listWaitersWithStatus(tenantDb);
  return all.filter((w) => w.status === 'free').map((w) => ({ id: w.id, fullName: w.fullName }));
}

// Hech kim bo'sh bo'lmasa ham chaqiruv yo'qolmasligi kerak — shuning uchun
// bo'sh ofitsiant topilmaganda BARCHASINI qaytaramiz. Mijoz uchun "hozir
// hech kim yo'q" degan javob eng foydasiz javob.
async function listCallableWaiters(tenantDb) {
  const all = await listWaitersWithStatus(tenantDb);
  const free = all.filter((w) => w.status === 'free');
  const pool = free.length > 0 ? free : all;
  return {
    waiters: pool.map((w) => ({ id: w.id, fullName: w.fullName, status: w.status })),
    allBusy: free.length === 0 && all.length > 0,
  };
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Chaqiruvni yuboradi.
 * @param {string} slug
 * @param {object} tenantDb
 * @param {object} input
 * @param {string} input.tableId
 * @param {string} [input.waiterId]  Berilmasa — bo'shlaridan biri tanlanadi
 * @param {string} [input.clientName]
 * @returns {Promise<{waiter: object, tableNumber: number}>}
 */
async function call(slug, tenantDb, { tableId, waiterId, clientName }) {
  const table = await tenantDb.restaurantTable.findUnique({
    where: { id: tableId },
    select: { id: true, tableNumber: true },
  });
  if (!table) {
    const err = new Error('Stol topilmadi');
    err.code = 'TABLE_NOT_FOUND';
    throw err;
  }

  const { waiters } = await listCallableWaiters(tenantDb);
  if (waiters.length === 0) {
    const err = new Error('Bu muassasada ofitsiant yo\'q');
    err.code = 'NO_WAITERS';
    throw err;
  }

  // Tanlangan ofitsiant shu orada ishdan bo'shatilgan bo'lishi mumkin —
  // unda chaqiruvni yo'qotmasdan boshqasiga o'tkazamiz
  const chosen = (waiterId && waiters.find((w) => w.id === waiterId)) || pickRandom(waiters);

  const payload = {
    tableId: table.id,
    tableNumber: table.tableNumber,
    clientName: clientName || 'Mehmon',
    waiterId: chosen.id,
    waiterName: chosen.fullName,
    at: new Date().toISOString(),
  };

  // Faqat SHAXSIY xonaga — aks holda tanlangan ofitsiant xabarni ikki marta
  // olardi (u umumiy xonada ham turadi)
  realtime.emitTo(`${slug}_waiter_${chosen.id}`, 'waiter_called', payload);
  // Oshxona taxtasi zalda nima bo'layotganini ko'rib tursin
  realtime.emitTo(`${slug}_kitchen`, 'waiter_called', payload);

  return { waiter: chosen, tableNumber: table.tableNumber };
}

module.exports = { listTables, listFreeWaiters, listCallableWaiters, call };
