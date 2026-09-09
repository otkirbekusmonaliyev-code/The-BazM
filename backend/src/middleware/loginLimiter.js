// KIRISHNI PAROL TANLASHDAN HIMOYA QILISH.
//
// Avval bitta chegara bor edi: bitta IP dan 15 daqiqada 30 ta so'rov,
// va MUVAFFAQIYATLI kirishlar ham hisoblanardi. Bu ikki tomondan xato:
//
//   1) Haqiqiy foydalanuvchilarni jazolaydi. Smena almashganda restoranning
//      10-15 xodimi ketma-ket kiradi; O'zbekistonda operatorlar ko'pincha
//      umumiy NAT ishlatadi, ya'ni bir nechta muassasa bitta tashqi IP
//      ortida bo'lishi mumkin. 31-chi odam kira olmay qolardi.
//      (Bu 10 ta muassasa bilan o'tkazilgan sinovda aynan yuz berdi.)
//
//   2) Parol tanlashni yaxshi to'xtatmaydi. Hujumchi bitta hisobga emas,
//      minglab hisobga bittadan urinsa, IP chegarasi tez to'lib qolardi —
//      lekin aynan shu paytda oddiy xodimlar ham bloklanardi.
//
// To'g'ri yechim — ikki qatlam va faqat MUVAFFAQIYATSIZ urinishlarni sanash:
//
//   Hisob bo'yicha  — bitta telefon raqamiga 15 daqiqada 10 ta xato urinish.
//                     Parol tanlashni aynan shu to'xtatadi.
//   IP bo'yicha     — bitta manzildan 15 daqiqada 120 ta xato urinish.
//                     Ko'p hisobni ketma-ket sinab ko'rishga qarshi, lekin
//                     oddiy ishga xalaqit bermaydigan darajada baland.
//
// Muvaffaqiyatli kirish hech qaysi hisobga tushmaydi: normal ish hech qachon
// chegaraga yetmaydi.

const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;

const MESSAGE = {
  error: 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urinib ko\'ring.',
};

// So'rov tanasidagi telefon raqami. Turli joylarda turlicha yozilishi
// mumkin (bo'sh joy, qavs), shuning uchun faqat raqamlarni qoldiramiz.
function phoneKey(req) {
  const raw = req.body && typeof req.body.phone === 'string' ? req.body.phone : '';
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 ? digits : null;
}

const perAccount = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  // Raqam berilmagan bo'lsa (buzuq so'rov) — IP bo'yicha sanaymiz
  keyGenerator: (req) => {
    const phone = phoneKey(req);
    return phone ? `acc:${phone}` : `ip:${req.ip}`;
  },
  message: MESSAGE,
});

const perIp = rateLimit({
  windowMs: WINDOW_MS,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: MESSAGE,
});

// Kirish yo'llariga shu ikkisi birga qo'yiladi
const loginLimiters = [perIp, perAccount];

module.exports = { loginLimiters, perAccount, perIp };
