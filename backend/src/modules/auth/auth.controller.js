const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const staffDirectory = require('../../services/staffDirectory');

const loginSchema = z.object({
  phone: z.string().min(9),
  password: z.string().min(6),
});

// Xodim (admin/kitchen/waiter) login qilishi
async function login(req, res, next) {
  try {
    const { phone, password } = loginSchema.parse(req.body);
    const tenantDb = req.tenantDb;

    const user = await tenantDb.user.findUnique({ where: { phone } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Telefon raqami yoki parol noto\'g\'ri' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Telefon raqami yoki parol noto\'g\'ri' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        restaurantSlug: req.restaurantSlug,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, phone: user.phone, role: user.role },
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

// Taklif havolasi ochilganda: u KIMGA berilganini ko'rsatish uchun.
// Xodim parol o'rnatishdan oldin o'z ismini, raqamini va rolini ko'rishi kerak —
// aks holda u qaysi hisobni faollashtirayotganini bilmaydi va keyin qaysi
// raqam bilan kirishini ham bilmay qoladi.
async function getInvite(req, res, next) {
  try {
    const invite = await req.tenantDb.staffInvite.findUnique({
      where: { token: req.params.token },
    });

    if (!invite || invite.isUsed) {
      return res.status(404).json({
        error: 'Taklif havolasi yaroqsiz yoki allaqachon ishlatilgan',
        code: 'INVITE_INVALID',
      });
    }
    if (invite.expiresAt < new Date()) {
      return res.status(410).json({
        error: 'Taklif havolasining muddati tugagan. Administratordan yangisini so\'rang.',
        code: 'INVITE_EXPIRED',
      });
    }

    res.json({
      fullName: invite.fullName,
      phone: invite.phone,
      role: invite.role,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

const acceptInviteSchema = z.object({
  password: z.string().min(6),
});

// Taklif havolasi orqali kirib, parol o'rnatish va hisob yaratish
async function acceptInvite(req, res, next) {
  try {
    const { token } = req.params;
    const { password } = acceptInviteSchema.parse(req.body);
    const tenantDb = req.tenantDb;

    const invite = await tenantDb.staffInvite.findUnique({ where: { token } });
    if (!invite || invite.isUsed) {
      return res.status(400).json({ error: 'Taklif havolasi yaroqsiz yoki allaqachon ishlatilgan' });
    }
    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Taklif havolasining muddati tugagan' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await tenantDb.user.create({
      data: {
        fullName: invite.fullName,
        phone: invite.phone,
        role: invite.role,
        passwordHash,
      },
    });

    await tenantDb.staffInvite.update({
      where: { id: invite.id },
      data: { isUsed: true },
    });

    // Yagona login shu indeks orqali ishlaydi
    await staffDirectory.upsert({
      phone: user.phone,
      restaurantSlug: req.restaurantSlug,
      role: user.role,
      isActive: true,
    });

    res.status(201).json({
      message: 'Hisob muvaffaqiyatli yaratildi. Endi tizimga kirishingiz mumkin.',
      user: { id: user.id, fullName: user.fullName, phone: user.phone, role: user.role },
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Bu telefon raqami bilan hisob allaqachon mavjud' });
    }
    next(err);
  }
}

module.exports = { login, getInvite, acceptInvite };
