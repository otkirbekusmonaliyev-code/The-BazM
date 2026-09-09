const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const masterPrisma = require('../../config/masterDb');
const { getTenantClient, invalidateTenantClient } = require('../../config/tenantDb');
const { refreshBot, stopBot } = require('../../bot/botManager');
const provisioning = require('../../services/provisioning');
const { notInternal, isInternalSlug } = require('../../utils/internal');

const loginSchema = z.object({
  phone: z.string().min(9),
  password: z.string().min(6),
});

async function login(req, res, next) {
  try {
    const { phone, password } = loginSchema.parse(req.body);

    const admin = await masterPrisma.superAdmin.findUnique({ where: { phone } });
    if (!admin) {
      return res.status(401).json({ error: 'Telefon raqami yoki parol noto\'g\'ri' });
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Telefon raqami yoki parol noto\'g\'ri' });
    }

    const token = jwt.sign({ adminId: admin.id, role: 'super_admin' }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ token, admin: { id: admin.id, fullName: admin.fullName, phone: admin.phone } });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

const RESTAURANT_FIELDS = {
  id: true,
  name: true,
  slug: true,
  businessType: true,
  logoUrl: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  monthlyFee: true,
  nextBillingDate: true,
  telegramBotToken: true,
  createdAt: true,
};

async function listRestaurants(req, res, next) {
  try {
    // ?type=restaurant | cafe — Super Admin panelidagi ikki alohida bo'lim
    const { type } = req.query;
    // Ichki sinov muassasasi panelda ko'rinmaydi — u haqiqiy mijoz emas
    const where = { ...notInternal };
    if (type === 'cafe' || type === 'restaurant') where.businessType = type;

    const restaurants = await masterPrisma.restaurant.findMany({
      where,
      select: RESTAURANT_FIELDS,
      orderBy: { createdAt: 'desc' },
    });
    res.json(restaurants);
  } catch (err) {
    next(err);
  }
}

// Drawer uchun — restoran + billing tarixi + tenant bazasidan qisqa statistika
async function getRestaurant(req, res, next) {
  try {
    const restaurant = await masterPrisma.restaurant.findUnique({
      where: { id: req.params.id },
      select: { ...RESTAURANT_FIELDS, dbName: true, dbHost: true, billingHistory: true },
    });
    // Ichki sinov muassasasi ro'yxatda yo'q — to'g'ridan-to'g'ri ID bilan
    // ham ochilmasin, aks holda panelda "arvoh" yozuv paydo bo'ladi
    if (!restaurant || isInternalSlug(restaurant.slug)) {
      return res.status(404).json({ error: 'Restoran topilmadi' });
    }

    // Tenant bazasi ochilmasa ham (suspended, o'chirilgan va h.k.) —
    // drawer baribir ochilishi kerak, shuning uchun xato yutiladi
    let stats = null;
    try {
      const tenantDb = await getTenantClient(restaurant.slug);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [staffCount, tableCount, menuItemCount, ordersToday, revenueToday] = await Promise.all([
        tenantDb.user.count(),
        tenantDb.restaurantTable.count(),
        tenantDb.menuItem.count(),
        tenantDb.order.count({ where: { createdAt: { gte: startOfDay } } }),
        tenantDb.order.aggregate({
          _sum: { totalPrice: true },
          where: { createdAt: { gte: startOfDay }, status: { notIn: ['cancelled'] } },
        }),
      ]);
      stats = {
        staffCount,
        tableCount,
        menuItemCount,
        ordersToday,
        revenueToday: Number(revenueToday._sum.totalPrice || 0),
      };
    } catch (_) {
      stats = null;
    }

    res.json({ ...restaurant, stats });
  } catch (err) {
    next(err);
  }
}

const createRestaurantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  plan: z.enum(['basic', 'standard', 'pro']).default('basic'),
  businessType: z.enum(['restaurant', 'cafe']).default('restaurant'),
  adminName: z.string().min(2).optional(),
  adminPhone: z.string().min(9),
  adminPassword: z.string().min(6).optional(),
  telegramBotToken: z.string().optional(),
});

// Yangi restoranni to'liq ishga tushirish: baza + jadvallar + Master yozuvi + admin
async function createRestaurant(req, res, next) {
  try {
    const input = createRestaurantSchema.parse(req.body);
    const { restaurant, adminCredentials } = await provisioning.provisionRestaurant(input);
    // Bot tokeni berilgan bo'lsa — serverni qayta ishga tushirmasdan ko'tariladi
    refreshBot(restaurant.slug);
    res.status(201).json({ restaurant, adminCredentials });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
}

async function suspendRestaurant(req, res, next) {
  try {
    const restaurant = await masterPrisma.restaurant.update({
      where: { id: req.params.id },
      data: { subscriptionStatus: 'suspended' },
      select: RESTAURANT_FIELDS,
    });
    // Obuna to'xtatilgan — boti ham javob bermasligi kerak
    stopBot(restaurant.slug);
    // Keshdagi ulanishni ham yopamiz — aks holda suspend qilingan restoran
    // keshlangan client orqali ishlashda davom etardi
    invalidateTenantClient(restaurant.slug);
    res.json(restaurant);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Restoran topilmadi' });
    next(err);
  }
}

async function activateRestaurant(req, res, next) {
  try {
    const restaurant = await masterPrisma.restaurant.update({
      where: { id: req.params.id },
      data: { subscriptionStatus: 'active' },
      select: RESTAURANT_FIELDS,
    });
    invalidateTenantClient(restaurant.slug);
    refreshBot(restaurant.slug);
    res.json(restaurant);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Restoran topilmadi' });
    next(err);
  }
}

const updateRestaurantSchema = z.object({
  name: z.string().min(2).optional(),
  logoUrl: z.string().optional().nullable(),
  telegramBotToken: z.string().optional().nullable(),
  subscriptionPlan: z.enum(['basic', 'standard', 'pro']).optional(),
  businessType: z.enum(['restaurant', 'cafe']).optional(),
  monthlyFee: z.number().nonnegative().optional(),
});

async function updateRestaurant(req, res, next) {
  try {
    const data = updateRestaurantSchema.parse(req.body);
    if (data.subscriptionPlan && data.monthlyFee === undefined) {
      data.monthlyFee = provisioning.PLAN_PRICES[data.subscriptionPlan];
    }
    const restaurant = await masterPrisma.restaurant.update({
      where: { id: req.params.id },
      data,
      select: RESTAURANT_FIELDS,
    });
    invalidateTenantClient(restaurant.slug);
    // Bot tokeni almashtirilgan bo'lishi mumkin — botni qayta ko'taramiz
    refreshBot(restaurant.slug);
    res.json(restaurant);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    if (err.code === 'P2025') return res.status(404).json({ error: 'Restoran topilmadi' });
    next(err);
  }
}

// Restoranni butunlay o'chirish (bazasi bilan) — qaytarib bo'lmaydi
async function deleteRestaurant(req, res, next) {
  try {
    await provisioning.deleteRestaurant(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

// ---- Dashboard KPI + 3D banner uchun ma'lumot ----
async function getStats(req, res, next) {
  try {
    const [all, applications] = await Promise.all([
      masterPrisma.restaurant.findMany({
        where: notInternal,
        select: { id: true, name: true, subscriptionStatus: true, monthlyFee: true, businessType: true },
      }),
      masterPrisma.restaurantApplication.count({ where: { status: 'pending' } }),
    ]);

    const byStatus = { trial: 0, active: 0, suspended: 0, cancelled: 0 };
    const byType = { restaurant: 0, cafe: 0 };
    let mrr = 0;
    for (const r of all) {
      byStatus[r.subscriptionStatus] = (byStatus[r.subscriptionStatus] || 0) + 1;
      byType[r.businessType] = (byType[r.businessType] || 0) + 1;
      if (r.subscriptionStatus === 'active') mrr += Number(r.monthlyFee || 0);
    }

    res.json({
      totalRestaurants: all.length,
      byStatus,
      byType,
      mrr,
      pendingApplications: applications,
      // 3D banner har bir restoran uchun bitta nuqta chizadi
      nodes: all.map((r) => ({ id: r.id, name: r.name, status: r.subscriptionStatus })),
    });
  } catch (err) {
    next(err);
  }
}

// ---- Marketing saytidan kelgan arizalar ----
async function listApplications(req, res, next) {
  try {
    const { status } = req.query;
    const applications = await masterPrisma.restaurantApplication.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
    res.json(applications);
  } catch (err) {
    next(err);
  }
}

// Arizani tasdiqlash = restoranni provision qilish + admin yaratish.
// Javobda qaytgan parolni Super Admin restoran egasiga uzatadi.
async function approveApplication(req, res, next) {
  try {
    const application = await masterPrisma.restaurantApplication.findUnique({
      where: { id: req.params.id },
    });
    if (!application) {
      return res.status(404).json({ error: 'Ariza topilmadi' });
    }
    if (application.status !== 'pending') {
      return res.status(409).json({ error: 'Bu ariza allaqachon ko\'rib chiqilgan' });
    }

    const { restaurant, adminCredentials } = await provisioning.provisionRestaurant({
      name: application.name,
      slug: req.body.slug,
      plan: application.plan,
      businessType: application.businessType,
      adminName: application.name,
      adminPhone: application.phone,
      adminPassword: req.body.adminPassword,
    });

    await masterPrisma.restaurantApplication.update({
      where: { id: application.id },
      data: { status: 'approved', reviewedAt: new Date(), restaurantId: restaurant.id },
    });

    res.status(201).json({ restaurant, adminCredentials });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function rejectApplication(req, res, next) {
  try {
    const application = await masterPrisma.restaurantApplication.update({
      where: { id: req.params.id },
      data: { status: 'rejected', reviewedAt: new Date() },
    });
    res.json(application);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Ariza topilmadi' });
    next(err);
  }
}

module.exports = {
  login,
  listRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  suspendRestaurant,
  activateRestaurant,
  deleteRestaurant,
  getStats,
  listApplications,
  approveApplication,
  rejectApplication,
};
