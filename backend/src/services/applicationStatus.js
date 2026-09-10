// ARIZA JAVOBI — SAYTNING O'ZIDA.
//
// Avval javob faqat ikki yo'l bilan yetardi: platforma egasi qo'lda
// bog'lanardi, yoki (SMTP sozlangan bo'lsa) xat ketardi. Ikkalasi ham
// ariza yuborgan odamni KUTISHGA majbur qilardi va u "javob keldimi?"
// deb bilolmasdi.
//
// Endi javobni o'zi kelib ko'radi: saytga Google hisobi bilan kiradi va
// arizasining holatini ko'radi. Tasdiqlangan bo'lsa — kirish ma'lumotlari
// shu yerda, rad etilgan bo'lsa — sabab.
//
// NEGA AYNAN GOOGLE. Kirish ma'lumotlari orasida parol bor, ya'ni uni
// istalgan odamga ko'rsatib bo'lmaydi. Telefon raqami yetarli emas —
// uni bilish oson. Google esa pochtaning HAQIQATAN shu odamniki ekanini
// isbotlaydi, ya'ni xat yuborish bilan bir xil ishonch darajasi.
//
// PAROL BIR MARTA KO'RSATILADI va shu zahoti bazadan o'chadi. Uzoq
// yotgan parol — kutilmagan joydan chiqadigan xavf.

const { OAuth2Client } = require('google-auth-library');
const masterPrisma = require('../config/masterDb');
const { encrypt, decrypt } = require('../utils/crypto');
const { appUrl } = require('../utils/links');

function clientId() {
  return (process.env.GOOGLE_CLIENT_ID || '').trim();
}

function isConfigured() {
  return clientId().length > 0;
}

let verifier = null;
function getVerifier() {
  if (!verifier) verifier = new OAuth2Client(clientId());
  return verifier;
}

/**
 * Google bergan ID tokenni tekshiradi va TASDIQLANGAN pochtani qaytaradi.
 * Token o'zimizning ilovamiz uchun berilganini (audience) va pochta
 * tasdiqlanganini ham tekshiradi — aks holda kimdir boshqa saytda olingan
 * token bilan kirib kelardi.
 */
async function emailFromGoogle(credential) {
  if (!isConfigured()) {
    const err = new Error('Google kirishi sozlanmagan');
    err.statusCode = 503;
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }

  let payload;
  try {
    const ticket = await getVerifier().verifyIdToken({
      idToken: credential,
      audience: clientId(),
    });
    payload = ticket.getPayload();
  } catch (_) {
    const err = new Error('Google kirishi tasdiqlanmadi. Qaytadan urinib ko\'ring.');
    err.statusCode = 401;
    throw err;
  }

  if (!payload || !payload.email) {
    const err = new Error('Google hisobidan pochta olinmadi');
    err.statusCode = 401;
    throw err;
  }
  if (payload.email_verified === false) {
    const err = new Error('Bu Google hisobida pochta tasdiqlanmagan');
    err.statusCode = 401;
    throw err;
  }

  return { email: String(payload.email).toLowerCase(), name: payload.name || null };
}

// Tasdiqlash paytida bir martalik parolni saqlash (shifrlangan)
function sealPassword(password) {
  if (!password) return null;
  try {
    return encrypt(password);
  } catch (_) {
    // Shifrlash ishlamasa parolni OCHIQ saqlamaymiz — shunchaki saqlamaymiz.
    // Egasi uni super admin panelidan oladi.
    return null;
  }
}

/**
 * Shu pochtaga tegishli oxirgi arizaning holati.
 * Qaytadigan `state`:
 *   'not_found' | 'pending' | 'approved' | 'rejected'
 */
async function statusFor(email) {
  const application = await masterPrisma.restaurantApplication.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
  });

  if (!application) return { state: 'not_found' };

  const base = {
    placeName: application.name,
    businessType: application.businessType,
    submittedAt: application.createdAt,
    reviewedAt: application.reviewedAt,
  };

  if (application.status === 'pending') return { ...base, state: 'pending' };

  if (application.status === 'rejected') {
    return { ...base, state: 'rejected', note: application.reviewNote || null };
  }

  // ---- Tasdiqlangan ----
  let restaurant = null;
  if (application.restaurantId) {
    restaurant = await masterPrisma.restaurant.findUnique({
      where: { id: application.restaurantId },
      select: { slug: true, name: true },
    });
  }

  let password = null;
  if (application.adminPasswordEnc) {
    try {
      password = decrypt(application.adminPasswordEnc);
    } catch (_) {
      password = null;
    }
    // Bir marta ko'rsatdik — endi bazada saqlab turishning hojati yo'q
    await masterPrisma.restaurantApplication.update({
      where: { id: application.id },
      data: { adminPasswordEnc: null, credentialsSeenAt: new Date() },
    });
  }

  return {
    ...base,
    state: 'approved',
    placeName: (restaurant && restaurant.name) || application.name,
    slug: restaurant ? restaurant.slug : null,
    // Kirish manzili SERVERDAN keladi: sayt uni o'zi yasashga urinsa,
    // domen o'zgarganda ikki joyni tuzatish kerak bo'lardi
    appUrl: appUrl(),
    phone: application.phone,
    // Parol FAQAT birinchi murojaatda keladi. Keyingi safar `null` —
    // va sahifa "parolni allaqachon ko'rgansiz" deb aytadi.
    password,
    passwordSeenAt: application.credentialsSeenAt,
  };
}

module.exports = { isConfigured, clientId, emailFromGoogle, statusFor, sealPassword };
