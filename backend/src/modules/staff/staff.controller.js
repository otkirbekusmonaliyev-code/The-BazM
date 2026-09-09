const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const { inviteUrl } = require('../../utils/links');
const staffDirectory = require('../../services/staffDirectory');

const inviteSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(9),
  role: z.enum(['kitchen', 'waiter', 'admin']),
});

// Admin yangi xodim (oshpaz/ofitsiant/boshqa admin) taklif qiladi
async function inviteStaff(req, res, next) {
  try {
    const { fullName, phone, role } = inviteSchema.parse(req.body);
    const tenantDb = req.tenantDb;

    const existing = await tenantDb.user.findUnique({ where: { phone } });
    if (existing) {
      return res.status(409).json({ error: 'Bu telefon raqami bilan xodim allaqachon mavjud' });
    }

    // Yagona login uchun telefon butun platformada unikal bo'lishi shart —
    // aks holda tizim qaysi restoranga kiritishni bilmaydi
    const elsewhere = await staffDirectory.isTakenElsewhere(phone, req.restaurantSlug);
    if (elsewhere) {
      return res.status(409).json({
        error:
          'Bu telefon raqami boshqa muassasada ro\'yxatdan o\'tgan. Boshqa raqam kiriting.',
      });
    }

    // Shu raqamga eski, ishlatilmagan taklif qolgan bo'lsa — uni bekor qilamiz
    await tenantDb.staffInvite.updateMany({
      where: { phone, isUsed: false },
      data: { isUsed: true },
    });

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 kun

    const invite = await tenantDb.staffInvite.create({
      data: { fullName, phone, role, token, expiresAt },
    });

    // Hozircha SMS yubormaymiz — havolani to'g'ridan-to'g'ri qaytaramiz,
    // admin uni xodimga o'zi uzatadi. Keyinroq bu yerga SMS-shlyuz qo'shiladi.
    res.status(201).json({
      message: 'Taklif yaratildi',
      invite: { id: invite.id, fullName, phone, role },
      inviteLink: inviteUrl(req.restaurantSlug, invite.token),
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

// Admin — restorandagi barcha xodimlar ro'yxatini ko'radi
async function listStaff(req, res, next) {
  try {
    const staff = await req.tenantDb.user.findMany({
      select: { id: true, fullName: true, phone: true, role: true, isActive: true, createdAt: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
    res.json(staff);
  } catch (err) {
    next(err);
  }
}

// Hali qabul qilinmagan takliflar
async function listInvites(req, res, next) {
  try {
    const invites = await req.tenantDb.staffInvite.findMany({
      where: { isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      invites.map((i) => ({
        id: i.id,
        fullName: i.fullName,
        phone: i.phone,
        role: i.role,
        expiresAt: i.expiresAt,
        inviteLink: inviteUrl(req.restaurantSlug, i.token),
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function revokeInvite(req, res, next) {
  try {
    await req.tenantDb.staffInvite.update({
      where: { id: req.params.id },
      data: { isUsed: true },
    });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Taklif topilmadi' });
    next(err);
  }
}

const updateStaffSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['kitchen', 'waiter', 'admin']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

async function updateStaff(req, res, next) {
  try {
    const data = updateStaffSchema.parse(req.body);
    const tenantDb = req.tenantDb;

    const target = await tenantDb.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      return res.status(404).json({ error: 'Xodim topilmadi' });
    }
    // Oxirgi faol adminni o'chirib qo'yishning oldini olamiz — aks holda
    // restoranga umuman kirib bo'lmay qoladi
    if (target.role === 'admin' && (data.isActive === false || (data.role && data.role !== 'admin'))) {
      const activeAdmins = await tenantDb.user.count({ where: { role: 'admin', isActive: true } });
      if (activeAdmins <= 1) {
        return res.status(409).json({ error: 'Oxirgi adminni o\'chirib bo\'lmaydi' });
      }
    }

    const { password, ...rest } = data;
    const user = await tenantDb.user.update({
      where: { id: target.id },
      data: {
        ...rest,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
      select: { id: true, fullName: true, phone: true, role: true, isActive: true },
    });

    // Rol yoki faollik o'zgardi — global indeks ham yangilanishi kerak
    await staffDirectory.upsert({
      phone: user.phone,
      restaurantSlug: req.restaurantSlug,
      role: user.role,
      isActive: user.isActive,
    });

    res.json(user);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

module.exports = { inviteStaff, listStaff, listInvites, revokeInvite, updateStaff };
