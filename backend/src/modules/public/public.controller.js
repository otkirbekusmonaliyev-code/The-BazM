// Marketing saytiga xizmat qiluvchi ochiq endpointlar.
// Bu yerda hech qanday token tekshirilmaydi — har kim chaqira oladi.

const { z } = require('zod');
const masterPrisma = require('../../config/masterDb');
const { REGIONS } = require('../../data/uzbekistanRegions');
const { PLAN_PRICES } = require('../../services/provisioning');

const applicationSchema = z.object({
  name: z.string().min(2, 'Restoran/kafe nomi kamida 2 belgi'),
  businessType: z.enum(['restaurant', 'cafe']).default('restaurant'),
  phone: z
    .string()
    .min(7)
    .max(20)
    .regex(/^[+0-9\s()-]+$/, 'Telefon raqami noto\'g\'ri'),
  email: z.string().email('Email noto\'g\'ri').optional().or(z.literal('')),
  region: z.string().min(2),
  city: z.string().min(2),
  description: z.string().max(1000).optional().or(z.literal('')),
  plan: z.enum(['basic', 'standard', 'pro']).default('basic'),
});

async function submitApplication(req, res, next) {
  try {
    const data = applicationSchema.parse(req.body);

    // Viloyat/shahar haqiqiy ro'yxatdan ekanini tekshiramiz —
    // forma chetlab o'tilib, ixtiyoriy matn yuborilishining oldini oladi
    const region = REGIONS.find((r) => r.name === data.region);
    if (!region || !region.cities.includes(data.city)) {
      return res.status(400).json({ error: 'Viloyat yoki shahar ro\'yxatdan tanlanmagan' });
    }

    // Bir xil raqamdan ketma-ket bir nechta ariza kelishining oldini olamiz
    const duplicate = await masterPrisma.restaurantApplication.findFirst({
      where: { phone: data.phone, status: 'pending' },
    });
    if (duplicate) {
      return res.status(409).json({
        error: 'Bu telefon raqami bilan so\'rov allaqachon yuborilgan, tez orada bog\'lanamiz.',
      });
    }

    const application = await masterPrisma.restaurantApplication.create({
      data: {
        name: data.name,
        businessType: data.businessType,
        phone: data.phone,
        email: data.email || null,
        region: data.region,
        city: data.city,
        description: data.description || null,
        plan: data.plan,
      },
    });

    res.status(201).json({
      id: application.id,
      message: 'So\'rovingiz qabul qilindi, tez orada siz bilan bog\'lanamiz',
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: err.errors[0] ? err.errors[0].message : 'Ma\'lumotlar noto\'g\'ri',
        details: err.errors,
      });
    }
    next(err);
  }
}

// KIRISH SAHIFASIDAGI QIDIRUV.
//
// Xodim avval "restoran"mi yoki "kafe"mi ekanini tanlaydi, so'ng ish joyining
// nomini yozadi. Bu yerdan faqat OCHIQ ma'lumot qaytadi: nom, slug va turi.
// Obuna holati, telefon, baza nomi kabi narsalar hech qachon chiqmaydi.
//
// Bekor qilingan muassasalar ro'yxatda ko'rinmaydi — ularga kirishning
// ma'nosi yo'q. To'xtatilganlari esa qoladi: xodim "topilmadi" degan
// tushunarsiz javob o'rniga aniq sababni ko'rgani ma'qul.
async function searchPlaces(req, res, next) {
  try {
    const type = req.query.type === 'cafe' || req.query.type === 'restaurant' ? req.query.type : null;
    const term = String(req.query.q || '').trim().slice(0, 60);

    const where = { subscriptionStatus: { in: ['trial', 'active', 'suspended'] } };
    if (type) where.businessType = type;
    if (term) where.name = { contains: term, mode: 'insensitive' };

    const places = await masterPrisma.restaurant.findMany({
      where,
      select: { slug: true, name: true, businessType: true, logoUrl: true },
      orderBy: { name: 'asc' },
      take: 12,
    });

    res.json(places);
  } catch (err) {
    next(err);
  }
}

// "X ta restoran bizga ishonadi" hisoblagichi uchun
async function publicStats(req, res, next) {
  try {
    const restaurantCount = await masterPrisma.restaurant.count({
      where: { subscriptionStatus: { in: ['trial', 'active'] } },
    });
    res.json({ restaurantCount });
  } catch (err) {
    next(err);
  }
}

function listPlans(req, res) {
  res.json([
    {
      key: 'basic',
      name: 'Basic',
      price: PLAN_PRICES.basic,
      features: [
        '1 ta oshxona ekrani',
        '10 tagacha stol',
        'QR menyu va buyurtma',
        'Telegram bot',
        'Email orqali qo\'llab-quvvatlash',
      ],
    },
    {
      key: 'standard',
      name: 'Standard',
      price: PLAN_PRICES.standard,
      popular: true,
      features: [
        'Cheksiz oshxona ekrani',
        '40 tagacha stol',
        'Ofitsiantlar boshqaruvi',
        'Stol bron qilish',
        'Kunlik savdo hisoboti',
        'Telefon orqali qo\'llab-quvvatlash',
      ],
    },
    {
      key: 'pro',
      name: 'Pro',
      price: PLAN_PRICES.pro,
      features: [
        'Cheksiz stol va xodim',
        'Bir nechta filial',
        'O\'z brendingiz va rangingiz',
        'Kengaytirilgan hisobotlar',
        'Shaxsiy menejer',
        '24/7 qo\'llab-quvvatlash',
      ],
    },
  ]);
}

function listRegions(req, res) {
  res.json(REGIONS);
}

module.exports = { submitApplication, searchPlaces, publicStats, listPlans, listRegions };
