const jwt = require('jsonwebtoken');
const { z } = require('zod');
const masterPrisma = require('../../config/masterDb');
const brand = require('../../utils/brand');
const planLimits = require('../../services/planLimits');
const realtime = require('../../realtime/io');
const { releaseTableIfIdle } = require('../../services/tables');

const SESSION_TTL = '3h';

function issueClientToken(table, clientName, restaurantSlug) {
  return jwt.sign(
    {
      role: 'client',
      tableId: table.id,
      tableNumber: table.tableNumber,
      clientName,
      restaurantSlug,
    },
    process.env.JWT_SECRET,
    { expiresIn: SESSION_TTL }
  );
}

// ============ 1) QR skan qilingach — session yaratish ============
const sessionSchema = z.object({
  qrToken: z.string().min(10),
  clientName: z.string().min(1).max(60),
});

async function createSession(req, res, next) {
  try {
    const { qrToken, clientName } = sessionSchema.parse(req.body);

    const table = await req.tenantDb.restaurantTable.findUnique({ where: { qrToken } });
    if (!table) {
      return res.status(404).json({ error: 'Stol topilmadi. QR kod noto\'g\'ri bo\'lishi mumkin.' });
    }

    // QR skanerlangan zahoti stol band deb belgilanadi — shu bilan bot orqali
    // "bo'sh stollar" ro'yxatida u ko'rinmay qoladi. Agar 15 daqiqada
    // buyurtma bo'lmasa, background job uni avtomatik bo'shatadi.
    if (!table.isOccupied) {
      await req.tenantDb.restaurantTable.update({
        where: { id: table.id },
        data: { isOccupied: true, occupiedAt: new Date() },
      });
      realtime.emitTableClaimed(req.restaurantSlug, {
        tableId: table.id,
        tableNumber: table.tableNumber,
        clientName,
      });
    }

    res.json({
      token: issueClientToken(table, clientName, req.restaurantSlug),
      table: { id: table.id, tableNumber: table.tableNumber },
      clientName,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

// ============ 0) Muassasa nomi (mijoz ilovasi sarlavhasi uchun) ============
//
// Mijoz ilovasi shu paytgacha sarlavhada slug'ni ("delish") ko'rsatardi —
// mijoz uchun bu hech narsani anglatmaydi. Endi haqiqiy nom olinadi.
// Ochiq endpoint: bu ma'lumot QR kodni skanerlagan har qanday odam uchun.
async function getPlace(req, res, next) {
  try {
    const place = await masterPrisma.restaurant.findUnique({
      where: { slug: req.restaurantSlug },
      select: {
        slug: true,
        name: true,
        businessType: true,
        logoUrl: true,
        brandColor: true,
        brandSurface: true,
        brandDisplayFont: true,
        brandBodyFont: true,
        subscriptionPlan: true,
      },
    });
    if (!place) return res.status(404).json({ error: 'Muassasa topilmadi' });

    // BREND FAQAT PRO TARIFDA. Tekshiruv aynan SHU YERDA turishi muhim:
    // muassasa Pro'dan tushib qolsa, ilova o'z-o'zidan standart ko'rinishga
    // qaytadi — bazadagi eski qiymat "yopishib" qolmaydi.
    const branded = planLimits.limitsOf(place.subscriptionPlan).branding === true;
    return res.json({
      slug: place.slug,
      name: place.name,
      businessType: place.businessType,
      logoUrl: branded ? place.logoUrl : null,
      brand: brand.themeOf(branded ? place : {}),
    });
  } catch (err) {
    return next(err);
  }
}

// ============ 1b) QR tokenni tekshirish (stolni band qilmasdan) ============
//
// Telegram bot QR havolasidan kelgan odamga tugma ko'rsatishdan OLDIN
// kodning haqiqiyligini bilishi kerak. Bu yerda stol band qilinmaydi —
// band qilish faqat mijoz menyuni ochganda, `createSession` ichida bo'ladi.
async function checkQrToken(req, res, next) {
  try {
    const table = await req.tenantDb.restaurantTable.findUnique({
      where: { qrToken: req.params.qrToken },
      select: { id: true, tableNumber: true, isOccupied: true },
    });
    if (!table) {
      return res.status(404).json({ error: 'Stol topilmadi. QR kod eskirgan bo\'lishi mumkin.' });
    }
    return res.json(table);
  } catch (err) {
    return next(err);
  }
}

// ============ 2) Hozir bo'sh stollar (bot orqali "o'zim o'tiraman" oqimi) ============
async function listAvailableTables(req, res, next) {
  try {
    const tables = await req.tenantDb.restaurantTable.findMany({
      where: { isOccupied: false },
      select: { id: true, tableNumber: true },
      orderBy: { tableNumber: 'asc' },
    });
    res.json(tables);
  } catch (err) {
    next(err);
  }
}

const claimSchema = z.object({
  clientName: z.string().min(1).max(60),
});

// Mijoz bo'sh stolni o'zi tanlaydi — stol darhol band bo'ladi va
// unga xuddi QR skanerlagandek sessiya tokeni beriladi
async function claimTable(req, res, next) {
  try {
    const { clientName } = claimSchema.parse(req.body);
    const tenantDb = req.tenantDb;

    const table = await tenantDb.restaurantTable.findUnique({ where: { id: req.params.id } });
    if (!table) {
      return res.status(404).json({ error: 'Stol topilmadi' });
    }
    if (table.isOccupied) {
      return res.status(409).json({ error: 'Bu stol allaqachon band. Boshqasini tanlang.' });
    }

    // updateMany + isOccupied:false sharti — ikki mijoz bir vaqtda bir stolni
    // bosib yuborsa, faqat bittasi yutadi (poyga holatidan himoya)
    const claimed = await tenantDb.restaurantTable.updateMany({
      where: { id: table.id, isOccupied: false },
      data: { isOccupied: true, occupiedAt: new Date() },
    });
    if (claimed.count === 0) {
      return res.status(409).json({ error: 'Bu stol allaqachon band. Boshqasini tanlang.' });
    }

    realtime.emitTableClaimed(req.restaurantSlug, {
      tableId: table.id,
      tableNumber: table.tableNumber,
      clientName,
    });

    res.json({
      token: issueClientToken(table, clientName, req.restaurantSlug),
      table: { id: table.id, tableNumber: table.tableNumber },
      clientName,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

// ============ 3) Buyurtma yaratish ============
const orderItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  note: z.string().max(200).optional(),
});
const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
});

async function createOrder(req, res, next) {
  try {
    const { items } = createOrderSchema.parse(req.body);
    const tenantDb = req.tenantDb;
    const { tableId, clientName } = req.clientSession;

    // Har bir taomni bazadan tekshiramiz — narxni frontend'dan emas,
    // har doim SERVERDAGI haqiqiy narxdan olamiz (firibgarlikning oldini olish uchun)
    const menuItemIds = [...new Set(items.map((i) => i.menuItemId))];
    const menuItems = await tenantDb.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: 'Ba\'zi taomlar topilmadi' });
    }
    const unavailable = menuItems.filter((m) => !m.isAvailable);
    if (unavailable.length > 0) {
      return res.status(409).json({
        error: `Quyidagi taomlar hozir mavjud emas: ${unavailable.map((m) => m.name).join(', ')}`,
        unavailableItems: unavailable.map((m) => ({ id: m.id, name: m.name })),
      });
    }

    let totalPrice = 0;
    const orderItemsData = items.map((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId);
      totalPrice += Number(menuItem.price) * item.quantity;
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        note: item.note || null,
        priceAtOrderTime: menuItem.price,
      };
    });

    const order = await tenantDb.order.create({
      data: {
        tableId,
        clientName,
        totalPrice,
        status: 'new',
        items: { create: orderItemsData },
        statusLog: { create: { status: 'new' } },
      },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    await tenantDb.restaurantTable.update({
      where: { id: tableId },
      data: { isOccupied: true, occupiedAt: new Date() },
    });

    // Oshxona ekranida sahifani yangilamasdan darhol paydo bo'lishi uchun
    realtime.emitNewOrder(req.restaurantSlug, order);

    res.status(201).json(order);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

// ============ 4) Buyurtma holatini kuzatish ============
async function getOrderStatus(req, res, next) {
  try {
    const order = await req.tenantDb.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    if (!order || order.tableId !== req.clientSession.tableId) {
      return res.status(404).json({ error: 'Buyurtma topilmadi' });
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
}

// Shu stoldagi joriy sessiyaning barcha buyurtmalari (sahifa yangilangach tiklash uchun)
async function listMyOrders(req, res, next) {
  try {
    const orders = await req.tenantDb.order.findMany({
      where: {
        tableId: req.clientSession.tableId,
        clientName: req.clientSession.clientName,
        status: { notIn: ['cancelled'] },
      },
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

// Mijoz o'zi bekor qilishi — faqat "new" holatida
async function cancelOrder(req, res, next) {
  try {
    const tenantDb = req.tenantDb;
    const order = await tenantDb.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.tableId !== req.clientSession.tableId) {
      return res.status(404).json({ error: 'Buyurtma topilmadi' });
    }
    if (order.status !== 'new') {
      return res.status(409).json({
        error:
          'Bu buyurtma allaqachon qabul qilingan, endi mijoz uni bekor qila olmaydi. Ofitsiantga murojaat qiling.',
      });
    }

    const updated = await tenantDb.order.update({
      where: { id: order.id },
      data: { status: 'cancelled', statusLog: { create: { status: 'cancelled' } } },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    await releaseTableIfIdle(tenantDb, order.tableId, req.restaurantSlug);
    realtime.emitOrderStatusChanged(req.restaurantSlug, updated);

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// Ofitsiantni chaqirish — hozircha faqat real-time signal (bazada saqlanmaydi)
async function callWaiter(req, res, next) {
  try {
    const { tableId, tableNumber, clientName } = req.clientSession;
    const payload = { tableId, tableNumber, clientName, at: new Date().toISOString() };
    realtime.emitTo(`${req.restaurantSlug}_waiters`, 'waiter_called', payload);
    realtime.emitTo(`${req.restaurantSlug}_kitchen`, 'waiter_called', payload);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ============ 5) Kelajakka bron ============
const reservationSchema = z.object({
  clientName: z.string().min(2).max(60),
  phone: z.string().min(7).max(20),
  partySize: z.number().int().positive().max(50).default(2),
  reservationDate: z.string().min(8),
  note: z.string().max(300).optional(),
});

async function createReservation(req, res, next) {
  try {
    const data = reservationSchema.parse(req.body);
    const when = new Date(data.reservationDate);
    if (Number.isNaN(when.getTime())) {
      return res.status(400).json({ error: 'Sana/vaqt noto\'g\'ri' });
    }
    if (when.getTime() < Date.now() - 60 * 1000) {
      return res.status(400).json({ error: 'O\'tgan vaqtga bron qilib bo\'lmaydi' });
    }

    const reservation = await req.tenantDb.tableReservation.create({
      data: {
        clientName: data.clientName,
        phone: data.phone,
        partySize: data.partySize,
        reservationDate: when,
        note: data.note || null,
        status: 'pending',
      },
    });

    realtime.emitNewReservation(req.restaurantSlug, reservation);
    res.status(201).json(reservation);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

module.exports = {
  getPlace,
  createSession,
  checkQrToken,
  listAvailableTables,
  claimTable,
  createOrder,
  getOrderStatus,
  listMyOrders,
  cancelOrder,
  callWaiter,
  createReservation,
};
