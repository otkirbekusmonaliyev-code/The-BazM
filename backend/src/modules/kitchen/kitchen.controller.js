const { z } = require('zod');
const realtime = require('../../realtime/io');
const { isTransitionAllowed, ACTIVE_KITCHEN_STATUSES } = require('../../utils/orderStatus');
const { listWaitersWithStatus, isWaiterBusy } = require('../../services/waiters');
const { releaseTableIfIdle } = require('../../services/tables');

const ORDER_INCLUDE = {
  items: { include: { menuItem: true } },
  table: true,
  assignedWaiter: { select: { id: true, fullName: true } },
};

// Oshxona taxtasida ko'rinishi kerak bo'lgan buyurtmalar:
//   - hali tugallanmagan (new / accepted / preparing), YOKI
//   - tayyor, lekin hali hech qaysi ofitsiantga topshirilmagan
//     (ready + assignmentStatus=none) — oshpaz ofitsiant tanlashi uchun
// Eng eskisi birinchi.
async function listActiveOrders(req, res, next) {
  try {
    const orders = await req.tenantDb.order.findMany({
      where: {
        OR: [
          { status: { in: ACTIVE_KITCHEN_STATUSES } },
          { status: 'ready', assignmentStatus: { in: ['none', 'pending', 'declined'] } },
        ],
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

const statusSchema = z.object({
  status: z.enum(['accepted', 'preparing', 'ready', 'cancelled']),
});

async function updateOrderStatus(req, res, next) {
  try {
    const { status: nextStatus } = statusSchema.parse(req.body);
    const tenantDb = req.tenantDb;

    const order = await tenantDb.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      return res.status(404).json({ error: 'Buyurtma topilmadi' });
    }

    const role = req.staffUser.role; // 'kitchen' yoki 'admin'
    if (!isTransitionAllowed(role, order.status, nextStatus)) {
      return res.status(409).json({
        error: `"${order.status}" holatidan "${nextStatus}" holatiga o'tish mumkin emas`,
      });
    }

    const updated = await tenantDb.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        statusLog: { create: { status: nextStatus, changedByUser: req.staffUser.userId } },
      },
      include: ORDER_INCLUDE,
    });

    realtime.emitOrderStatusChanged(req.restaurantSlug, updated);
    if (nextStatus === 'ready') {
      realtime.emitOrderReady(req.restaurantSlug, updated);
    }
    if (nextStatus === 'cancelled') {
      await releaseTableIfIdle(tenantDb, updated.tableId, req.restaurantSlug);
    }

    res.json(updated);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

// ---- Ofitsiantlar paneli ----
async function listWaiters(req, res, next) {
  try {
    res.json(await listWaitersWithStatus(req.tenantDb));
  } catch (err) {
    next(err);
  }
}

const assignSchema = z.object({ waiterId: z.string().uuid() });

// Oshpaz tayyor buyurtmani bo'sh ofitsiantlardan biriga topshiradi.
// Status O'ZGARMAYDI (ready bo'lib qoladi) — faqat assignmentStatus=pending bo'ladi.
async function assignWaiter(req, res, next) {
  try {
    const { waiterId } = assignSchema.parse(req.body);
    const tenantDb = req.tenantDb;

    const order = await tenantDb.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      return res.status(404).json({ error: 'Buyurtma topilmadi' });
    }
    if (order.status !== 'ready') {
      return res.status(409).json({
        error: 'Faqat "tayyor" holatidagi buyurtmani ofitsiantga topshirish mumkin',
      });
    }
    if (order.assignmentStatus === 'accepted') {
      return res.status(409).json({ error: 'Bu buyurtmani ofitsiant allaqachon qabul qilgan' });
    }

    const waiter = await tenantDb.user.findUnique({ where: { id: waiterId } });
    if (!waiter || waiter.role !== 'waiter' || !waiter.isActive) {
      return res.status(404).json({ error: 'Ofitsiant topilmadi' });
    }
    if (await isWaiterBusy(tenantDb, waiterId)) {
      return res.status(409).json({ error: `${waiter.fullName} hozir band` });
    }

    // Agar avval boshqa ofitsiantga taklif yuborilgan bo'lsa (pending) —
    // uning ekranidagi modalni yopish uchun xabar beramiz
    const previousWaiterId = order.assignedWaiterId;
    if (previousWaiterId && previousWaiterId !== waiterId && order.assignmentStatus === 'pending') {
      realtime.emitAssignmentRevoked(req.restaurantSlug, previousWaiterId, order.id);
    }

    const updated = await tenantDb.order.update({
      where: { id: order.id },
      data: { assignedWaiterId: waiterId, assignmentStatus: 'pending' },
      include: ORDER_INCLUDE,
    });

    realtime.emitOrderAssigned(req.restaurantSlug, waiterId, updated);
    realtime.emitWaiterStatusChanged(req.restaurantSlug, {
      waiterId,
      status: 'busy',
      assignmentStatus: 'pending',
      orderId: updated.id,
      tableNumber: updated.table ? updated.table.tableNumber : null,
    });
    if (previousWaiterId && previousWaiterId !== waiterId) {
      realtime.emitWaiterStatusChanged(req.restaurantSlug, {
        waiterId: previousWaiterId,
        status: 'free',
        assignmentStatus: 'none',
      });
    }

    res.json(updated);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

// ---- Bronlar (admin ham shu endpointlardan foydalanadi) ----
async function listReservations(req, res, next) {
  try {
    const { scope } = req.query; // 'today' | 'upcoming' (default) | 'all'
    let where = {};
    const now = new Date();

    if (scope === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      where = { reservationDate: { gte: start, lt: end } };
    } else if (scope !== 'all') {
      // Kechagi bronlar ro'yxatni to'ldirmasligi uchun 2 soat orqaga chegara
      where = { reservationDate: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } };
    }

    const reservations = await req.tenantDb.tableReservation.findMany({
      where,
      include: { table: { select: { id: true, tableNumber: true } } },
      orderBy: { reservationDate: 'asc' },
    });
    res.json(reservations);
  } catch (err) {
    next(err);
  }
}

const reservationUpdateSchema = z.object({
  status: z.enum(['confirmed', 'cancelled', 'completed']),
  tableId: z.string().uuid().nullable().optional(),
});

async function updateReservation(req, res, next) {
  try {
    const { status, tableId } = reservationUpdateSchema.parse(req.body);
    const tenantDb = req.tenantDb;

    const existing = await tenantDb.tableReservation.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Bron topilmadi' });
    }

    if (status === 'confirmed' && tableId) {
      const table = await tenantDb.restaurantTable.findUnique({ where: { id: tableId } });
      if (!table) {
        return res.status(404).json({ error: 'Stol topilmadi' });
      }
    }

    const reservation = await tenantDb.tableReservation.update({
      where: { id: existing.id },
      data: {
        status,
        ...(tableId !== undefined ? { tableId } : {}),
      },
      include: { table: { select: { id: true, tableNumber: true } } },
    });

    realtime.emitReservationUpdated(req.restaurantSlug, reservation);
    res.json(reservation);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

module.exports = {
  listActiveOrders,
  updateOrderStatus,
  listWaiters,
  assignWaiter,
  listReservations,
  updateReservation,
};
