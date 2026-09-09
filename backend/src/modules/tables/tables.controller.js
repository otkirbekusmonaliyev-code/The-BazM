const crypto = require('crypto');
const QRCode = require('qrcode');
const { z } = require('zod');
const { tableUrl, appUrlInfo } = require('../../utils/links');
const realtime = require('../../realtime/io');
const { CLOSED_STATUSES } = require('../../utils/orderStatus');

const createTableSchema = z.object({
  tableNumber: z.number().int().positive(),
});

// Yangi stol yaratish — QR token avtomatik generatsiya qilinadi
async function createTable(req, res, next) {
  try {
    const { tableNumber } = createTableSchema.parse(req.body);
    const qrToken = crypto.randomBytes(16).toString('hex');

    const table = await req.tenantDb.restaurantTable.create({
      data: { tableNumber, qrToken },
    });

    res.status(201).json({ ...table, qrUrl: tableUrl(req.restaurantSlug, table.qrToken) });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Bu raqamli stol allaqachon mavjud' });
    }
    next(err);
  }
}

// Bir necha stolni birdan yaratish (masalan 1..20) — yangi restoran uchun qulay
const bulkSchema = z.object({
  from: z.number().int().positive(),
  to: z.number().int().positive(),
});

async function createTablesBulk(req, res, next) {
  try {
    const { from, to } = bulkSchema.parse(req.body);
    if (to < from || to - from > 199) {
      return res.status(400).json({ error: 'Oraliq noto\'g\'ri (maksimum 200 ta stol)' });
    }

    const existing = await req.tenantDb.restaurantTable.findMany({
      where: { tableNumber: { gte: from, lte: to } },
      select: { tableNumber: true },
    });
    const taken = new Set(existing.map((t) => t.tableNumber));

    const rows = [];
    for (let n = from; n <= to; n += 1) {
      if (!taken.has(n)) {
        rows.push({ tableNumber: n, qrToken: crypto.randomBytes(16).toString('hex') });
      }
    }
    if (rows.length > 0) {
      await req.tenantDb.restaurantTable.createMany({ data: rows });
    }

    res.status(201).json({ created: rows.length, skipped: taken.size });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

// Barcha stollar + har birining joriy holati (admin paneldagi "stol xaritasi")
async function listTables(req, res, next) {
  try {
    const tables = await req.tenantDb.restaurantTable.findMany({
      orderBy: { tableNumber: 'asc' },
      include: {
        orders: {
          where: { status: { notIn: CLOSED_STATUSES } },
          select: { id: true, status: true, clientName: true, totalPrice: true },
        },
      },
    });

    res.json(
      tables.map((t) => ({
        id: t.id,
        tableNumber: t.tableNumber,
        qrToken: t.qrToken,
        isOccupied: t.isOccupied,
        occupiedAt: t.occupiedAt,
        createdAt: t.createdAt,
        activeOrders: t.orders,
        qrUrl: tableUrl(req.restaurantSlug, t.qrToken),
      }))
    );
  } catch (err) {
    next(err);
  }
}

// Bitta stolning QR kodini rasm sifatida qaytaradi.
//
//   ?download=1  — brauzer faylni ko'rsatmasdan darhol yuklab oladi
//   ?format=svg  — chop etish uchun vektor (istalgan o'lchamda aniq chiqadi)
//   ?size=NNN    — PNG kengligi (200..2000 px), katta bosma uchun
async function getTableQrImage(req, res, next) {
  try {
    const table = await req.tenantDb.restaurantTable.findUnique({ where: { id: req.params.id } });
    if (!table) {
      return res.status(404).json({ error: 'Stol topilmadi' });
    }

    const link = tableUrl(req.restaurantSlug, table.qrToken);
    const svg = String(req.query.format || '').toLowerCase() === 'svg';
    const download = req.query.download === '1' || req.query.download === 'true';

    // Bosma uchun kattaroq o'lcham kerak bo'lishi mumkin, lekin cheksiz emas
    const requested = Number(req.query.size);
    const width = Number.isFinite(requested) ? Math.min(Math.max(requested, 200), 2000) : 600;

    const options = {
      width,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#171C16', light: '#FFFFFF' },
    };

    const fileName = `${req.restaurantSlug}-stol-${table.tableNumber}.${svg ? 'svg' : 'png'}`;
    const disposition = download ? 'attachment' : 'inline';

    if (svg) {
      const markup = await QRCode.toString(link, { ...options, type: 'svg' });
      res.set('Content-Type', 'image/svg+xml');
      res.set('Content-Disposition', `${disposition}; filename="${fileName}"`);
      return res.send(markup);
    }

    const qrBuffer = await QRCode.toBuffer(link, options);
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `${disposition}; filename="${fileName}"`);
    return res.send(qrBuffer);
  } catch (err) {
    return next(err);
  }
}

// Barcha stollarning QR kodlari bitta ro'yxatda (data URL ko'rinishida).
// Admin panelidagi "hammasini chop etish" varag'i shu ma'lumotdan yasaladi —
// har bir kod uchun alohida so'rov yuborilmaydi.
async function listTableQrCodes(req, res, next) {
  try {
    const tables = await req.tenantDb.restaurantTable.findMany({
      orderBy: { tableNumber: 'asc' },
      select: { id: true, tableNumber: true, qrToken: true },
    });

    const codes = await Promise.all(
      tables.map(async (t) => {
        const link = tableUrl(req.restaurantSlug, t.qrToken);
        return {
          id: t.id,
          tableNumber: t.tableNumber,
          url: link,
          dataUrl: await QRCode.toDataURL(link, {
            width: 320,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#171C16', light: '#FFFFFF' },
          }),
        };
      })
    );

    res.json(codes);
  } catch (err) {
    next(err);
  }
}

// QR kodlardagi manzil mijozning telefoniga yetib boradimi?
//
// Admin buni BILISHI kerak: localhost'li QR hech qachon ishlamaydi, lekin
// buni faqat kodni chop etib, telefonda skanerlab ko'rgandagina bilardi.
// Endi panelning o'zi aytadi.
async function getQrInfo(req, res) {
  res.json(appUrlInfo());
}

// QR tokenni qaytadan yaratish — eski chop etilgan kod ishlamay qoladi.
// Kod tarqab ketgan yoki stol boshqa joyga ko'chirilgan bo'lsa kerak bo'ladi.
async function regenerateTableQr(req, res, next) {
  try {
    const table = await req.tenantDb.restaurantTable.update({
      where: { id: req.params.id },
      data: { qrToken: crypto.randomBytes(16).toString('hex') },
    });
    res.json({ ...table, qrUrl: tableUrl(req.restaurantSlug, table.qrToken) });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Stol topilmadi' });
    next(err);
  }
}

// Admin stolni qo'lda bo'shatishi (mijoz ketib qolgan, lekin tizimda band turibdi)
async function releaseTable(req, res, next) {
  try {
    const table = await req.tenantDb.restaurantTable.update({
      where: { id: req.params.id },
      data: { isOccupied: false, occupiedAt: null },
    });
    realtime.emitTableReleased(req.restaurantSlug, {
      tableId: table.id,
      tableNumber: table.tableNumber,
    });
    res.json(table);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Stol topilmadi' });
    next(err);
  }
}

async function deleteTable(req, res, next) {
  try {
    const [orderCount, reservationCount] = await Promise.all([
      req.tenantDb.order.count({ where: { tableId: req.params.id } }),
      // Kelgusidagi bronlar: stol o'chirilsa ular jimgina "stolsiz" qolib
      // ketardi (tableId null bo'ladi) — buni admin bilishi kerak
      req.tenantDb.tableReservation.count({
        where: {
          tableId: req.params.id,
          status: { in: ['pending', 'confirmed'] },
          reservationDate: { gte: new Date() },
        },
      }),
    ]);

    if (orderCount > 0) {
      return res.status(409).json({
        error: `Bu stolda ${orderCount} ta buyurtma tarixi bor — o'chirib bo'lmaydi.`,
      });
    }
    if (reservationCount > 0) {
      return res.status(409).json({
        error: `Bu stolga ${reservationCount} ta kelgusi bron bog'langan. Avval ularni boshqa stolga o'tkazing yoki bekor qiling.`,
      });
    }

    await req.tenantDb.restaurantTable.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Stol topilmadi' });
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Bu stol ishlatilmoqda — o\'chirib bo\'lmaydi' });
    }
    next(err);
  }
}

module.exports = {
  createTable,
  createTablesBulk,
  listTables,
  getTableQrImage,
  listTableQrCodes,
  getQrInfo,
  regenerateTableQr,
  releaseTable,
  deleteTable,
};
