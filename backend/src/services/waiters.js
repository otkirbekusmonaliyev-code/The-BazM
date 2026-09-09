// Ofitsiantning "band / bo'sh" holati hech qayerda ustun sifatida
// SAQLANMAYDI — u har doim buyurtmalardan hisoblab chiqariladi.
// Sabab: saqlangan holat real hayotdan chetlab qolishi mumkin (server
// qayta ishga tushdi, so'rov yarim yo'lda uzildi va h.k.), hisoblangan
// holat esa doim to'g'ri bo'ladi.

const { CLOSED_STATUSES, ACTIVE_ASSIGNMENT_STATUSES } = require('../utils/orderStatus');

// Ofitsiantni band qilib turgan buyurtma (bo'lsa) — aks holda null
async function getBusyOrder(tenantDb, waiterId) {
  return tenantDb.order.findFirst({
    where: {
      assignedWaiterId: waiterId,
      assignmentStatus: { in: ACTIVE_ASSIGNMENT_STATUSES },
      status: { notIn: CLOSED_STATUSES },
    },
    include: { table: true },
    orderBy: { updatedAt: 'desc' },
  });
}

async function isWaiterBusy(tenantDb, waiterId) {
  return (await getBusyOrder(tenantDb, waiterId)) !== null;
}

// Barcha ofitsiantlar + har birining hisoblangan holati.
// Oshpaz panelidagi "ofitsiantlar paneli" shu ma'lumot bilan chiziladi.
async function listWaitersWithStatus(tenantDb) {
  const waiters = await tenantDb.user.findMany({
    where: { role: 'waiter', isActive: true },
    select: { id: true, fullName: true, phone: true },
    orderBy: { fullName: 'asc' },
  });

  const busyOrders = await tenantDb.order.findMany({
    where: {
      assignedWaiterId: { not: null },
      assignmentStatus: { in: ACTIVE_ASSIGNMENT_STATUSES },
      status: { notIn: CLOSED_STATUSES },
    },
    select: {
      assignedWaiterId: true,
      assignmentStatus: true,
      id: true,
      table: { select: { tableNumber: true } },
    },
  });

  const byWaiter = new Map();
  for (const o of busyOrders) byWaiter.set(o.assignedWaiterId, o);

  return waiters.map((w) => {
    const busy = byWaiter.get(w.id);
    return {
      id: w.id,
      fullName: w.fullName,
      phone: w.phone,
      status: busy ? 'busy' : 'free',
      busyWithOrderId: busy ? busy.id : null,
      busyWithTableNumber: busy && busy.table ? busy.table.tableNumber : null,
      assignmentStatus: busy ? busy.assignmentStatus : 'none',
    };
  });
}

module.exports = { getBusyOrder, isWaiterBusy, listWaitersWithStatus };
