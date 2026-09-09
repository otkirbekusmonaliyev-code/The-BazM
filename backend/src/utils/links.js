// Barcha tashqi havolalar (QR kod manzili, xodim taklif havolasi, bot ichidagi
// Mini App tugmasi) bitta joydan yasaladi — shu bilan domen o'zgarganda
// faqat .env dagi APP_URL ni almashtirish kifoya.

const { getBotUsername } = require('../bot/registry');

function appUrl() {
  const raw = process.env.APP_URL || `http://${process.env.PUBLIC_APP_DOMAIN || 'localhost:5173'}`;
  return raw.replace(/\/+$/, '');
}

// Stol QR kodi mijozni qayerga olib borishi:
//   QR_TARGET=web      (standart) — to'g'ridan-to'g'ri veb-ilovaga.
//                       Har qanday kamera ilovasi ochadi, Telegram shart emas.
//   QR_TARGET=telegram — bot deep-link'iga (t.me/<bot>?start=t_<qrToken>).
//                       Mini App sifatida ochiladi, lekin Telegram talab qilinadi.
// Telegram tanlangan bo'lsa-yu, restoranning boti ishga tushmagan bo'lsa —
// jimgina veb-havolaga qaytamiz, aks holda QR umuman ishlamay qolardi.
function tableUrl(slug, qrToken) {
  if ((process.env.QR_TARGET || 'web').toLowerCase() === 'telegram') {
    const username = getBotUsername(slug);
    if (username) return `https://t.me/${username}?start=t_${qrToken}`;
  }
  return `${appUrl()}/t/${slug}/${qrToken}`;
}

// Stolga bog'lanmagan kirish (bot orqali "o'zim stol tanlayman" oqimi)
const tablePickerUrl = (slug) => `${appUrl()}/m/${slug}`;

// Mijoz ilovasining stol sahifasi — bot Mini App tugmasi shuni ochadi
// (deep-link emas, chunki bot allaqachon Telegram ichida)
const tableWebUrl = (slug, qrToken) => `${appUrl()}/t/${slug}/${qrToken}`;

// Xodim taklif havolasi
const inviteUrl = (slug, token) => `${appUrl()}/${slug}/accept-invite/${token}`;

// Xodim panellari
const staffLoginUrl = (slug) => `${appUrl()}/${slug}/login`;

module.exports = { appUrl, tableUrl, tableWebUrl, tablePickerUrl, inviteUrl, staffLoginUrl };
