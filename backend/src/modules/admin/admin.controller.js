// Restoran Admin paneli uchun umumlashtirilgan ma'lumotlar:
// dashboard KPI'lari, jonli buyurtmalar, buyurtmalar tarixi.

const { z } = require('zod');
const masterPrisma = require('../../config/masterDb');
const brand = require('../../utils/brand');
const planLimits = require('../../services/planLimits');
const billing = require('../../services/billing');
const realtime = require('../../realtime/io');
const { isTransitionAllowed, CLOSED_STATUSES } = require('../../utils/orderStatus');
const { releaseTableIfIdle } = require('../../services/tables');
const { listWaitersWithStatus } = require('../../services/waiters');

const ORDER_INCLUDE = {
  items: { include: { menuItem: true } },
  table: true,
  assignedWaiter: { select: { id: true, fullName: true } },
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getDashboard(req, res, next) {
  try {
    const tenantDb = req.tenantDb;
    const today = startOfToday();
    const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [
      ordersToday,
      revenueToday,
      activeOrders,
      tables,
      occupiedTables,
      staffCount,
      pendingReservations,
      recentOrders,
      weekOrders,
    ] = await Promise.all([
      tenantDb.order.count({ where: { createdAt: { gte: today } } }),
      tenantDb.order.aggregate({
        _sum: { totalPrice: true },
        where: { createdAt: { gte: today }, status: { notIn: ['cancelled'] } },
      }),
      tenantDb.order.count({ where: { status: { notIn: CLOSED_STATUSES } } }),
      tenantDb.restaurantTable.count(),
      tenantDb.restaurantTable.count({ where: { isOccupied: true } }),
      tenantDb.user.count({ where: { isActive: true } }),
      tenantDb.tableReservation.count({ where: { status: 'pending' } }),
      tenantDb.order.findMany({
        where: { status: { notIn: CLOSED_STATUSES } },
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      tenantDb.order.findMany({
        where: { createdAt: { gte: weekAgo }, status: { notIn: ['cancelled'] } },
        select: { createdAt: true, totalPrice: true },
      }),
    ]);

    // Oxirgi 7 kunlik savdo grafigi
    const byDay = new Map();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(weekAgo.getTime() + i * 24 * 60 * 60 * 1000);
      byDay.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10), total: 0, count: 0 });
    }
    for (const o of weekOrders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const row = byDay.get(key);
      if (row) {
        row.total += Number(o.totalPrice);
        row.count += 1;
      }
    }

    // Bugungi eng ko'p sotilgan taomlar
    const topItemsRaw = await tenantDb.orderItem.groupBy({
      by: ['menuItemId'],
      _sum: { quantity: true },
      where: { order: { createdAt: { gte: today }, status: { notIn: ['cancelled'] } } },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });
    const topMenuItems = await tenantDb.menuItem.findMany({
      where: { id: { in: topItemsRaw.map((r) => r.menuItemId) } },
      select: { id: true, name: true, price: true },
    });
    const topItems = topItemsRaw.map((r) => {
      const item = topMenuItems.find((m) => m.id === r.menuItemId);
      return {
        id: r.menuItemId,
        name: item ? item.name : '—',
        quantity: r._sum.quantity,
      };
    });

    res.json({
      kpi: {
        ordersToday,
        revenueToday: Number(revenueToday._sum.totalPrice || 0),
        activeOrders,
        tables,
        occupiedTables,
        staffCount,
        pendingReservations,
      },
      salesChart: [...byDay.values()],
      topItems,
      recentOrders,
      waiters: await listWaitersWithStatus(tenantDb),
    });
  } catch (err) {
    next(err);
  }
}

// Buyurtmalar tarixi — filtr va sahifalash bilan
async function listOrders(req, res, next) {
  try {
    const { status, from, to } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 25);

    const where = {};
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [total, orders] = await Promise.all([
      req.tenantDb.order.count({ where }),
      req.tenantDb.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({ total, page, pageSize, orders });
  } catch (err) {
    next(err);
  }
}

const adminStatusSchema = z.object({
  status: z.enum(['accepted', 'preparing', 'ready', 'delivered', 'paid', 'cancelled']),
});

// Admin buyurtma statusini o'zgartiradi (asosan: bekor qilish va "to'landi")
async function updateOrderStatus(req, res, next) {
  try {
    const { status: nextStatus } = adminStatusSchema.parse(req.body);
    const tenantDb = req.tenantDb;

    const order = await tenantDb.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      return res.status(404).json({ error: 'Buyurtma topilmadi' });
    }
    if (!isTransitionAllowed('admin', order.status, nextStatus)) {
      return res.status(409).json({
        error: `"${order.status}" holatidan "${nextStatus}" holatiga o'tish mumkin emas`,
      });
    }

    const updated = await tenantDb.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        ...(CLOSED_STATUSES.includes(nextStatus)
          ? { assignedWaiterId: null, assignmentStatus: 'none' }
          : {}),
        statusLog: { create: { status: nextStatus, changedByUser: req.staffUser.userId } },
      },
      include: ORDER_INCLUDE,
    });

    if (CLOSED_STATUSES.includes(nextStatus)) {
      await releaseTableIfIdle(tenantDb, order.tableId, req.restaurantSlug);
      if (order.assignedWaiterId) {
        // Ofitsiant ekranida bu buyurtma ochiq turgan bo'lishi mumkin —
        // taklif modalini yopish yoki kartochkani olib tashlash uchun xabar beramiz
        realtime.emitAssignmentRevoked(req.restaurantSlug, order.assignedWaiterId, order.id);
        realtime.emitWaiterStatusChanged(req.restaurantSlug, {
          waiterId: order.assignedWaiterId,
          status: 'free',
          assignmentStatus: 'none',
        });
      }
    }
    realtime.emitOrderStatusChanged(req.restaurantSlug, updated);

    res.json(updated);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

// Restoranning o'z ma'lumotlari (nomi, tarifi, obuna holati) — header'da ko'rsatiladi
async function getRestaurantProfile(req, res, next) {
  try {
    const restaurant = await masterPrisma.restaurant.findUnique({
      where: { slug: req.restaurantSlug },
      select: {
        name: true,
        slug: true,
        logoUrl: true,
        brandColor: true,
        brandSurface: true,
        brandDisplayFont: true,
        brandBodyFont: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        nextBillingDate: true,
        monthlyFee: true,
      },
    });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restoran topilmadi' });
    }
    // Panel "Brend" bo'limini ko'rsatish-ko'rsatmaslikni shu bayroqqa
    // qarab hal qiladi — tarif nomini o'zi tekshirib yurmaydi
    res.json({
      ...restaurant,
      canBrand: planLimits.limitsOf(restaurant.subscriptionPlan).branding === true,
    });
  } catch (err) {
    next(err);
  }
}

// BREND SOZLAMALARI — logo va urg'u rangi.
//
// Rang ERKIN emas: faqat tayyor ro'yxatdagi kalitlar qabul qilinadi
// (qarang: utils/brand.js). Erkin tanlovda och rang oq fonda o'qilmay
// qoladi va mijoz o'z ilovasini buzib qo'yardi.
const BRAND_KEYS = ['brandColor', 'brandSurface', 'brandDisplayFont', 'brandBodyFont'];

const brandSchema = z.object({
  logoUrl: z.string().max(500).nullable().optional(),
  brandColor: z.string().max(40).nullable().optional(),
  brandSurface: z.string().max(40).nullable().optional(),
  brandDisplayFont: z.string().max(40).nullable().optional(),
  brandBodyFont: z.string().max(40).nullable().optional(),
});

async function updateBranding(req, res, next) {
  try {
    const data = brandSchema.parse(req.body);
    await planLimits.assertCanBrand(req.restaurantSlug);

    const patch = {};
    if (data.logoUrl !== undefined) patch.logoUrl = data.logoUrl || null;

    // Har bir tanlov TEKSHIRILADI. Ro'yxatda yo'q kalit qabul qilinmaydi —
    // aks holda bazaga ixtiyoriy qiymat tushib, ilova buzilardi.
    for (const key of BRAND_KEYS) {
      if (data[key] === undefined) continue;
      if (data[key] && !brand.validators[key](data[key])) {
        return res.status(400).json({ error: 'Bunday tanlov yo\'q' });
      }
      patch[key] = data[key] || null;
    }

    const restaurant = await masterPrisma.restaurant.update({
      where: { slug: req.restaurantSlug },
      data: patch,
      select: { logoUrl: true, ...Object.fromEntries(BRAND_KEYS.map((k) => [k, true])) },
    });

    return res.json({ ...restaurant, brand: brand.themeOf(restaurant) });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri' });
    }
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    return next(err);
  }
}

// Tanlash mumkin bo'lgan hamma variant — panel shu ro'yxatlarni chizadi
function listBrandOptions(req, res) {
  res.json(brand.options());
}

// TO'LOV HOLATI.
//
// Panel banneri va to'lov sahifasi shu javobdan chiziladi. Yo'l ataylab
// `/billing` bilan boshlanadi: `tenantResolver` aynan shu prefiksni
// xizmat to'xtatilganda ham o'tkazadi.
async function getBilling(req, res, next) {
  try {
    res.json(await billing.statusOf(req.restaurantSlug));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    return next(err);
  }
  return undefined;
}

module.exports = {
  getDashboard,
  listOrders,
  updateOrderStatus,
  getRestaurantProfile,
  updateBranding,
  listBrandOptions,
  getBilling,
};
