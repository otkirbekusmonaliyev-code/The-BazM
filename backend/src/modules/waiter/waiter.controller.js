const { z } = require('zod');
const realtime = require('../../realtime/io');
const { isTransitionAllowed, ACTIVE_ASSIGNMENT_STATUSES } = require('../../utils/orderStatus');
const { releaseTableIfIdle } = require('../../services/tables');

const ORDER_INCLUDE = {
  items: { include: { menuItem: true } },
  table: true,
  assignedWaiter: { select: { id: true, fullName: true } },
};

// Ofitsiant faqat O'ZIGA tayinlangan buyurtmalarni ko'radi.
// (Admin ham shu panelga kirsa — barcha tayinlangan buyurtmalarni ko'radi.)
async function listMyOrders(req, res, next) {
  try {
    const { role, userId } = req.staffUser;
    const where = {
      assignmentStatus: { in: ACTIVE_ASSIGNMENT_STATUSES },
      status: { notIn: ['delivered', 'paid', 'cancelled'] },
      ...(role === 'waiter' ? { assignedWaiterId: userId } : { assignedWaiterId: { not: null } }),
    };

    const orders = await req.tenantDb.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { updatedAt: 'asc' },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

const respondSchema = z.object({ accept: z.boolean() });

// Oshpaz yuborgan taklifga javob berish.
//   accept:true  -> assignmentStatus=accepted, status=picked_up
//   accept:false -> assignmentStatus=none, assignedWaiterId=null
//                   (buyurtma oshpazning "tayinlanmagan" ro'yxatiga qaytadi)
async function respondToAssignment(req, res, next) {
  try {
    const { accept } = respondSchema.parse(req.body);
    const tenantDb = req.tenantDb;
    const { role, userId } = req.staffUser;

    const order = await tenantDb.order.findUnique({
      where: { id: req.params.id },
      include: { assignedWaiter: { select: { id: true, fullName: true } }, table: true },
    });
    if (!order) {
      return res.status(404).json({ error: 'Buyurtma topilmadi' });
    }
    if (role === 'waiter' && order.assignedWaiterId !== userId) {
      return res.status(403).json({ error: 'Bu buyurtma sizga tayinlanmagan' });
    }
    if (order.assignmentStatus !== 'pending') {
      return res.status(409).json({
        error:
          order.assignmentStatus === 'accepted'
            ? 'Bu taklif allaqachon qabul qilingan'
            : 'Bu taklif endi kuchda emas',
      });
    }

    const waiterId = order.assignedWaiterId;
    const waiterName = order.assignedWaiter ? order.assignedWaiter.fullName : 'Ofitsiant';

    const updated = accept
      ? await tenantDb.order.update({
          where: { id: order.id },
          data: {
            assignmentStatus: 'accepted',
            status: 'picked_up',
            statusLog: { create: { status: 'picked_up', changedByUser: waiterId } },
          },
          include: ORDER_INCLUDE,
        })
      : await tenantDb.order.update({
          where: { id: order.id },
          data: { assignmentStatus: 'none', assignedWaiterId: null },
          include: ORDER_INCLUDE,
        });

    // Oshpaz ekrani: qabul qilinsa kartochka chiqib ketadi, rad etilsa qaytadi
    realtime.emitWaiterResponse(req.restaurantSlug, {
      orderId: order.id,
      waiterId,
      waiterName,
      accepted: accept,
      order: updated,
    });
    realtime.emitWaiterStatusChanged(req.restaurantSlug, {
      waiterId,
      status: accept ? 'busy' : 'free',
      assignmentStatus: accept ? 'accepted' : 'none',
      orderId: accept ? order.id : null,
      tableNumber: order.table ? order.table.tableNumber : null,
    });

    if (accept) {
      // Mijoz ekranidagi progress "Tayyor" -> "Olib ketildi"ga o'tadi
      realtime.emitOrderStatusChanged(req.restaurantSlug, updated);
    }

    res.json(updated);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

const statusSchema = z.object({
  status: z.enum(['delivered', 'cancelled']),
});

async function updateOrderStatus(req, res, next) {
  try {
    const { status: nextStatus } = statusSchema.parse(req.body);
    const tenantDb = req.tenantDb;
    const { role, userId } = req.staffUser;

    const order = await tenantDb.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      return res.status(404).json({ error: 'Buyurtma topilmadi' });
    }
    if (role === 'waiter' && order.assignedWaiterId !== userId) {
      return res.status(403).json({ error: 'Bu buyurtma sizga tayinlanmagan' });
    }
    if (!isTransitionAllowed(role, order.status, nextStatus)) {
      return res.status(409).json({
        error: `"${order.status}" holatidan "${nextStatus}" holatiga o'tish mumkin emas`,
      });
    }

    const updated = await tenantDb.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        // Yetkazilgach ofitsiant "bo'sh"ga qaytadi
        assignedWaiterId: null,
        assignmentStatus: 'none',
        statusLog: { create: { status: nextStatus, changedByUser: userId } },
      },
      include: ORDER_INCLUDE,
    });

    // Stolda boshqa faol buyurtma qolmasa — stol bo'shaydi
    await releaseTableIfIdle(tenantDb, order.tableId, req.restaurantSlug);

    realtime.emitOrderStatusChanged(req.restaurantSlug, updated);
    realtime.emitWaiterStatusChanged(req.restaurantSlug, {
      waiterId: order.assignedWaiterId,
      status: 'free',
      assignmentStatus: 'none',
    });

    res.json(updated);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

module.exports = { listMyOrders, respondToAssignment, updateOrderStatus };
