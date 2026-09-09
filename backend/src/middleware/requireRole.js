const jwt = require('jsonwebtoken');

// Ishlatish: requireRole(['admin']) yoki requireRole(['admin', 'kitchen'])
//
// Token imzosini tekshirish YETARLI EMAS: JWT 7 kun amal qiladi, ya'ni
// ishdan bo'shatilgan xodim yoki roli o'zgartirilgan xodim eski tokeni bilan
// hali ham ishlayverardi. Shuning uchun har bir so'rovda foydalanuvchining
// bazadagi hozirgi holati ham tekshiriladi.
function requireRole(allowedRoles) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token topilmadi' });
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
    }

    // Token boshqa restoran uchun berilgan bo'lsa — rad etamiz
    if (payload.restaurantSlug !== req.restaurantSlug) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    if (!payload.userId || !allowedRoles.includes(payload.role)) {
      return res.status(403).json({ error: 'Bu amal uchun ruxsatingiz yo\'q' });
    }

    try {
      const user = await req.tenantDb.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, role: true, isActive: true, fullName: true },
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          error: 'Hisobingiz o\'chirilgan. Administrator bilan bog\'laning.',
          code: 'ACCOUNT_DISABLED',
        });
      }

      // Rol o'zgargan bo'lsa, eski token bilan eski huquqlarda qolib
      // ketmasin — qaytadan kirishni talab qilamiz
      if (user.role !== payload.role) {
        return res.status(401).json({
          error: 'Rolingiz o\'zgardi. Iltimos, qaytadan kiring.',
          code: 'ROLE_CHANGED',
        });
      }
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Bu amal uchun ruxsatingiz yo\'q' });
      }

      req.staffUser = { ...payload, fullName: user.fullName };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = requireRole;
