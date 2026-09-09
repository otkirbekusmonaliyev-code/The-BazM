const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const healthRoutes = require('./modules/health.routes');
const publicRoutes = require('./modules/public/public.routes');
const loginRoutes = require('./modules/login/login.routes');
const superAdminRoutes = require('./modules/super-admin/superAdmin.routes');
const authRoutes = require('./modules/auth/auth.routes');
const staffRoutes = require('./modules/staff/staff.routes');
const menuRoutes = require('./modules/menu/menu.routes');
const tablesRoutes = require('./modules/tables/tables.routes');
const clientRoutes = require('./modules/client/client.routes');
const kitchenRoutes = require('./modules/kitchen/kitchen.routes');
const waiterRoutes = require('./modules/waiter/waiter.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const uploadsRoutes = require('./modules/uploads/uploads.routes');
const tenantResolver = require('./middleware/tenantResolver');

const app = express();

app.set('trust proxy', 1);
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '1mb' }));

// Umumiy rate limit — haddan tashqari so'rovlardan himoya.
// Oshxona/ofitsiant panellari tez-tez so'rov yuborgani uchun chegara baland.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Juda ko\'p so\'rov yuborildi, birozdan keyin urinib ko\'ring' },
  })
);

// Marketing saytidagi forma — alohida, qattiqroq chegara bilan
const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Juda ko\'p so\'rov yuborildi. Bir soatdan keyin urinib ko\'ring.' },
});

// Yuklangan taom rasmlari
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads'), { maxAge: '7d' }));

// Health check (server ishlayotganini tekshirish uchun)
app.use('/api/health', healthRoutes);

// Marketing sayti uchun ochiq endpointlar (login talab qilmaydi)
app.use('/api/public/apply', applyLimiter);
app.use('/api/public', publicRoutes);

// Yagona kirish nuqtasi — restoran slug'i kerak emas, tizim o'zi aniqlaydi
app.use('/api/login', loginRoutes);

// Super Admin (Master DB bilan ishlaydigan) yo'nalishlar
app.use('/api/super-admin', superAdminRoutes);

// Tenant (restoran) yo'nalishlari — har biri tenantResolver orqali
// avval qaysi restoranga tegishli ekanini aniqlab, keyin ishga tushadi
app.use('/api/auth', tenantResolver, authRoutes);
app.use('/api/staff', tenantResolver, staffRoutes);
app.use('/api/menu', tenantResolver, menuRoutes);
app.use('/api/tables', tenantResolver, tablesRoutes);
app.use('/api/client', tenantResolver, clientRoutes);
app.use('/api/kitchen', tenantResolver, kitchenRoutes);
app.use('/api/waiter', tenantResolver, waiterRoutes);
app.use('/api/admin', tenantResolver, adminRoutes);
app.use('/api/uploads', tenantResolver, uploadsRoutes);

// Topilmagan API yo'llari
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Bunday yo'l yo'q: ${req.method} ${req.originalUrl}` });
});

// Umumiy xato ushlagich.
//
// Kutilgan xatolar (statusCode qo'yilganlar) foydalanuvchiga o'z matni bilan
// qaytadi. Kutilmagan xatolar esa — masalan Prisma'ning ichki xabari —
// mijozga UMUMAN yuborilmaydi: ular fayl yo'llari va so'rov tuzilishini
// oshkor qiladi. Ular faqat server jurnaliga yoziladi.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: 'Server xatoligi. Birozdan keyin qayta urinib ko\'ring.' });
  }

  return res.status(status).json({ error: err.message || 'So\'rov bajarilmadi' });
});

module.exports = app;
