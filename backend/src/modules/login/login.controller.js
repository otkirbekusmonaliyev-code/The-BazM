// YAGONA KIRISH NUQTASI.
//
// Butun platformada bitta login sahifasi bor. Foydalanuvchi faqat telefon va
// parol kiritadi — restoran nomini yoki "men kimman" degan tanlovni undan
// so'ramaymiz. Tizim o'zi aniqlaydi:
//
//   1) Bu raqam Super Admin'nikimi?
//   2) Yo'q bo'lsa — global indeksdan qaysi restoranniki ekanini topamiz
//   3) Indeksda ham yo'q bo'lsa — bazalarni bir marta ko'rib chiqamiz
//      (topilsa indeksga yoziladi, keyingi safar tez bo'ladi)
//
// Javobda rol va restoran slug'i qaytadi — frontend shunga qarab kerakli
// panelga o'tkazadi.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const masterPrisma = require('../../config/masterDb');
const { getTenantClient } = require('../../config/tenantDb');
const staffDirectory = require('../../services/staffDirectory');

const loginSchema = z.object({
  phone: z.string().min(9).max(20),
  password: z.string().min(1),
  // Kirish sahifasida ish joyi tanlangan bo'lsa — shu yerga keladi.
  // Ixtiyoriy: berilmasa tizim raqamdan kelib chiqib o'zi topadi.
  slug: z.string().min(1).max(80).optional(),
});

// Xato xabari ataylab bir xil: "bu raqam bor, lekin parol noto'g'ri" degan
// ma'lumot tashqariga chiqmasligi kerak
const WRONG = 'Telefon raqami yoki parol noto\'g\'ri';

async function login(req, res, next) {
  try {
    const { phone: rawPhone, password, slug } = loginSchema.parse(req.body);
    const phone = rawPhone.trim();

    // ---------- 1) Super Admin ----------
    const admin = await masterPrisma.superAdmin.findUnique({ where: { phone } });
    if (admin) {
      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) return res.status(401).json({ error: WRONG });

      const token = jwt.sign({ adminId: admin.id, role: 'super_admin' }, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });
      return res.json({
        token,
        role: 'super_admin',
        user: { id: admin.id, fullName: admin.fullName, phone: admin.phone },
      });
    }

    // ---------- 2) Muassasa xodimi ----------
    //
    // Ish joyi tanlangan bo'lsa — o'sha bazadan qidiramiz. Tanlanmagan bo'lsa
    // global indeksga tayanamiz (eski, "faqat raqam" oqimi ham ishlashda
    // davom etadi — masalan taklif havolasidan keyin qaytganda).
    let restaurant = null;

    if (slug) {
      restaurant = await masterPrisma.restaurant.findUnique({
        where: { slug: slug.trim().toLowerCase() },
        select: { slug: true, name: true, businessType: true, subscriptionStatus: true, logoUrl: true },
      });
      if (!restaurant) {
        return res.status(404).json({ error: 'Bunday muassasa topilmadi' });
      }
    } else {
      let entry = await staffDirectory.find(phone);
      if (!entry) entry = await staffDirectory.findByScanning(phone);
      if (!entry) return res.status(401).json({ error: WRONG });

      restaurant = await masterPrisma.restaurant.findUnique({
        where: { slug: entry.restaurantSlug },
        select: { slug: true, name: true, businessType: true, subscriptionStatus: true, logoUrl: true },
      });
      if (!restaurant) {
        await staffDirectory.remove(phone);
        return res.status(401).json({ error: WRONG });
      }
    }
    if (restaurant.subscriptionStatus === 'suspended') {
      return res.status(403).json({
        error: 'SUBSCRIPTION_SUSPENDED',
        message: 'Xizmat vaqtincha to\'xtatilgan. Administratsiya bilan bog\'laning.',
      });
    }

    const tenantDb = await getTenantClient(restaurant.slug);
    const user = await tenantDb.user.findUnique({ where: { phone } });

    if (!user) {
      // Ish joyi tanlangan bo'lsa, indeksga tegmaymiz: bu raqam boshqa
      // muassasaga tegishli bo'lishi mumkin va uni o'chirib yuborsak,
      // o'sha odam o'z joyiga ham kira olmay qolardi
      if (!slug) await staffDirectory.remove(phone);
      return res.status(401).json({ error: WRONG });
    }
    if (!user.isActive) {
      await staffDirectory.upsert({
        phone,
        restaurantSlug: restaurant.slug,
        role: user.role,
        isActive: false,
      });
      return res.status(403).json({
        error: 'Hisobingiz o\'chirilgan. Administrator bilan bog\'laning.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: WRONG });

    // Indeksni har loginda yangilab turamiz — rol o'zgargan bo'lsa ham to'g'ri qoladi
    await staffDirectory.upsert({
      phone,
      restaurantSlug: restaurant.slug,
      role: user.role,
      isActive: true,
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role, restaurantSlug: restaurant.slug },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      role: user.role,
      user: { id: user.id, fullName: user.fullName, phone: user.phone, role: user.role },
      restaurant: {
        slug: restaurant.slug,
        name: restaurant.name,
        businessType: restaurant.businessType,
        logoUrl: restaurant.logoUrl,
      },
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Telefon va parolni to\'liq kiriting' });
    }
    return next(err);
  }
}

module.exports = { login };
