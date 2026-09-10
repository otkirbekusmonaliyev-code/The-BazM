// EMAIL YUBORISH.
//
// Hozircha bitta ish uchun kerak: ariza tasdiqlangach, muassasa egasiga
// kirish ma'lumotlarini yuborish. Avval bu qo'lda bo'lardi — panel parolni
// ekranga chiqarardi va platforma egasi uni o'zi ko'chirib yuborishi kerak
// edi. Amalda bu ikki muammo tug'dirardi: parol unutilib qolardi, va u
// Telegram yoki SMS orqali qo'ldan-qo'lga o'tardi.
//
// IKKI QOIDA:
//
//   1) EMAIL JO'NAMASA HAM ARIZA TASDIQLANADI. Pochta serveri yiqilgani
//      uchun muassasa yaratilmay qolishi mumkin emas — bu eng noto'g'ri
//      bog'liqlik bo'lardi. Xato ushlanadi va javobga `emailed: false`
//      bo'lib qaytadi, panel esa parolni ekranda ko'rsatishda davom etadi.
//
//   2) SOZLANMAGAN BO'LSA — JIMGINA O'TKAZIB YUBORAMIZ. Development'da
//      SMTP yo'q; server har safar xato bilan to'lib ketmasligi kerak.
//      Buning o'rniga bir marta ogohlantirish yoziladi.

const nodemailer = require('nodemailer');

let transport = null;
let warned = false;

function config() {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  return {
    host,
    port,
    // 465 — implicit TLS, qolganlari STARTTLS
    secure: port === 465,
    auth: { user, pass },
    from: (process.env.MAIL_FROM || '').trim() || `Bazm <${user}>`,
  };
}

function isConfigured() {
  return config() !== null;
}

function getTransport() {
  if (transport) return transport;
  const cfg = config();
  if (!cfg) return null;
  transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  });
  return transport;
}

/**
 * Xat yuboradi. HECH QACHON xato tashlamaydi — chaqiruvchi kod uchun
 * email yuborilishi asosiy ish emas, qo'shimcha.
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
async function send({ to, subject, text, html }) {
  const cfg = config();
  if (!cfg) {
    if (!warned) {
      warned = true;
      console.log('   Email: SMTP sozlanmagan (.env dagi SMTP_HOST/USER/PASS) — xatlar yuborilmaydi');
    }
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  }
  if (!to) return { sent: false, reason: 'NO_RECIPIENT' };

  try {
    await getTransport().sendMail({ from: cfg.from, to, subject, text, html });
    console.log(`   Email yuborildi: ${to} — ${subject}`);
    return { sent: true };
  } catch (err) {
    console.error(`   Email yuborilmadi (${to}): ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

// ============================================================
//  XAT SHABLONLARI
// ============================================================

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Ariza tasdiqlangach egasiga ketadigan xat.
// Parol xat ichida ochiq turadi — boshqa iloji yo'q, chunki u bir martalik
// va biz uni saqlamaymiz. Shuning uchun xatda uni ALMASHTIRISH so'raladi.
function welcomeEmail({ placeName, loginUrl, phone, password }) {
  const subject = `${placeName} — Bazm tizimiga kirish ma'lumotlari`;

  const text = [
    `Assalomu alaykum!`,
    ``,
    `"${placeName}" uchun Bazm tizimida joy ochildi. Kirish ma'lumotlari:`,
    ``,
    `  Manzil:   ${loginUrl}`,
    `  Telefon:  ${phone}`,
    `  Parol:    ${password}`,
    ``,
    `Birinchi kirishdan keyin parolni almashtiring — bu xat pochtangizda qoladi.`,
    ``,
    `Nima qilish mumkin:`,
    `  • Menyu va taomlarni kiritish`,
    `  • Stollar yaratish va ular uchun QR kod chop etish`,
    `  • Oshpaz va ofitsiantlarni taklif qilish`,
    `  • Buyurtmalar va kunlik savdoni kuzatish`,
    ``,
    `Savol bo'lsa shu xatga javob yozing.`,
    ``,
    `Bazm`,
  ].join('\n');

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#1b1a17;max-width:560px">
  <p>Assalomu alaykum!</p>
  <p><b>«${esc(placeName)}»</b> uchun Bazm tizimida joy ochildi.</p>

  <table style="border-collapse:collapse;margin:18px 0;background:#faf8f4;border:1px solid #e6e0d5;border-radius:10px">
    <tr><td style="padding:10px 14px;color:#6b6558">Manzil</td>
        <td style="padding:10px 14px"><a href="${esc(loginUrl)}">${esc(loginUrl)}</a></td></tr>
    <tr><td style="padding:10px 14px;color:#6b6558">Telefon</td>
        <td style="padding:10px 14px"><b>${esc(phone)}</b></td></tr>
    <tr><td style="padding:10px 14px;color:#6b6558">Parol</td>
        <td style="padding:10px 14px"><b style="font-family:ui-monospace,Menlo,Consolas,monospace">${esc(password)}</b></td></tr>
  </table>

  <p style="background:#fff6e0;border-left:3px solid #c6a05c;padding:10px 14px;margin:18px 0">
    Birinchi kirishdan keyin parolni almashtiring — bu xat pochtangizda qoladi.
  </p>

  <p style="margin-bottom:6px">Nima qilish mumkin:</p>
  <ul style="margin-top:0;padding-left:20px;color:#3c3830">
    <li>Menyu va taomlarni kiritish</li>
    <li>Stollar yaratish va ular uchun QR kod chop etish</li>
    <li>Oshpaz va ofitsiantlarni taklif qilish</li>
    <li>Buyurtmalar va kunlik savdoni kuzatish</li>
  </ul>

  <p style="color:#6b6558;font-size:13px;margin-top:24px">
    Savol bo'lsa shu xatga javob yozing.<br>Bazm
  </p>
</div>`.trim();

  return { subject, text, html };
}

module.exports = { send, isConfigured, welcomeEmail };
