// Barcha tashqi havolalar (QR kod manzili, xodim taklif havolasi, bot
// ichidagi Mini App tugmasi) bitta joydan yasaladi — shu bilan domen
// o'zgarganda faqat .env dagi APP_URL ni almashtirish kifoya.

const os = require('os');
const { getBotUsername } = require('../bot/registry');

// Bitta platforma boti registryda shu kalit bilan turadi
const PLATFORM_KEY = '_platform';

// ============================================================
//  MANZILNI ANIQLASH
// ============================================================
//
// QR KOD QANDAY ISHLAYDI: kod ichida oddiy havola turadi. Mijoz uni
// telefonining kamerasi bilan skanerlaydi va telefon o'sha havolani ochadi.
// Demak havola MIJOZNING TELEFONI yeta oladigan manzil bo'lishi shart.
//
// `localhost` — bu har bir qurilma uchun O'ZI. Mijozning telefonida
// `localhost:5173` deganda u o'z telefonidagi 5173-portni qidiradi va
// hech narsa topmaydi. Shuning uchun localhost'li QR HECH QACHON ishlamaydi.
//
// Uch daraja bor:
//
//   local  — localhost. Faqat shu kompyuterda ochiladi, QR ishlamaydi.
//   lan    — kompyuterning tarmoqdagi manzili (192.168.x.x). Bir xil
//            Wi-Fi'dagi telefonlar ochadi. Restoran ichida sinash uchun
//            YETARLI, domen shart emas.
//   public — haqiqiy domen. Har qanday internetdan ochiladi. Telegram
//            Mini App ham faqat shu darajada (https bilan) ishlaydi.
//
// Sozlanmagan bo'lsa, biz o'zimiz `lan` darajasiga ko'taramiz: APP_URL
// localhost bo'lsa, uni kompyuterning Wi-Fi manzili bilan almashtiramiz.
// Shu bilan QR kodlar hech qanday qo'shimcha sozlashsiz ishlaydi.

const VIRTUAL_HINTS = [
  'vpn',
  'virtualbox',
  'vmware',
  'hyper-v',
  'docker',
  'warp',
  'loopback',
  'bluetooth',
  'tailscale',
  'zerotier',
];

function isPrivate(ip) {
  return (
    /^192\.168\./.test(ip) ||
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

// Eng ishonchli tarmoq manzilini tanlaymiz.
// 192.168.* birinchi navbatda: uy va restoran Wi-Fi'lari deyarli har doim shunday.
function detectLanIp() {
  const candidates = [];

  for (const [name, addresses] of Object.entries(os.networkInterfaces() || {})) {
    const lower = name.toLowerCase();
    // VPN va virtual adapterlar telefon uchun ochilmaydi — ularni chetlaymiz
    const virtual = VIRTUAL_HINTS.some((hint) => lower.includes(hint));
    for (const a of addresses || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (!isPrivate(a.address)) continue;
      let rank = 3;
      if (/^192\.168\./.test(a.address)) rank = 0;
      else if (/^10\./.test(a.address)) rank = 1;
      else rank = 2;
      if (virtual) rank += 10;
      candidates.push({ ip: a.address, rank });
    }
  }

  candidates.sort((a, b) => a.rank - b.rank);
  return candidates.length > 0 ? candidates[0].ip : null;
}

function isLocalHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

// Natijani keshlaymiz: tarmoq manzili har so'rovda o'zgarmaydi
let cached = null;

function resolveBase() {
  if (cached) return cached;

  // Aniq ko'rsatilgan bo'lsa — hech nima o'ylamaymiz.
  // Tunnel (ngrok, cloudflared) ishlatilganda aynan shu qulay.
  const override = (process.env.QR_BASE_URL || '').trim().replace(/\/+$/, '');
  if (override) {
    cached = { url: override, kind: hostKind(override) };
    return cached;
  }

  const raw = (
    process.env.APP_URL || `http://${process.env.PUBLIC_APP_DOMAIN || 'localhost:5173'}`
  ).replace(/\/+$/, '');

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    cached = { url: raw, kind: 'local' };
    return cached;
  }

  if (!isLocalHost(parsed.hostname)) {
    cached = { url: raw, kind: hostKind(raw) };
    return cached;
  }

  // localhost — telefon uchun yaroqsiz. Tarmoq manzili bilan almashtiramiz.
  const lan = detectLanIp();
  if (lan) {
    parsed.hostname = lan;
    cached = { url: parsed.toString().replace(/\/+$/, ''), kind: 'lan' };
    return cached;
  }

  cached = { url: raw, kind: 'local' };
  return cached;
}

function hostKind(url) {
  try {
    const h = new URL(url).hostname;
    if (isLocalHost(h)) return 'local';
    if (isPrivate(h)) return 'lan';
    return 'public';
  } catch (_) {
    return 'local';
  }
}

function appUrl() {
  return resolveBase().url;
}

// Manzil qanchalik "yetib boradigan" — admin panelida ogohlantirish uchun
function appUrlInfo() {
  const { url, kind } = resolveBase();
  return {
    baseUrl: url,
    kind, // 'local' | 'lan' | 'public'
    https: url.startsWith('https://'),
  };
}

// Sinovlar uchun: keshni tozalash
function resetUrlCache() {
  cached = null;
}

// ============================================================
//  HAVOLALAR
// ============================================================

// Stol QR kodi mijozni qayerga olib borishi:
//   QR_TARGET=web      (standart) — to'g'ridan-to'g'ri veb-ilovaga.
//                       Har qanday kamera ilovasi ochadi, Telegram shart emas.
//   QR_TARGET=telegram — bot deep-link'iga (t.me/<bot>?start=t_<qrToken>).
//                       Mini App sifatida ochiladi, lekin Telegram talab qilinadi.
// Telegram tanlangan bo'lsa-yu, restoranning boti ishga tushmagan bo'lsa —
// jimgina veb-havolaga qaytamiz, aks holda QR umuman ishlamay qolardi.
function tableUrl(slug, qrToken) {
  if ((process.env.QR_TARGET || 'web').toLowerCase() === 'telegram') {
    const username = getBotUsername(PLATFORM_KEY);
    // Havolada SLUG ham bor. Avval har bir restoranga alohida bot
    // to'g'ri kelardi va bot o'zi qaysi muassasa ekanini bilardi; endi
    // bitta bot hammasiga xizmat qiladi va stol tokeni qaysi bazada
    // izlanishini faqat havoladan bilish mumkin.
    if (username) return `https://t.me/${username}?start=t_${slug}_${qrToken}`;
  }
  return `${appUrl()}/t/${slug}/${qrToken}`;
}

// Stolga bog'lanmagan kirish (bot orqali "o'zim stol tanlayman" oqimi)
const tablePickerUrl = (slug) => `${appUrl()}/m/${slug}`;

// NAMUNA MENYU — hech qanday muassasaga bog'lanmagan.
// Bot ro'yxatdan o'tmagan odamni haqiqiy restoranning menyusiga emas,
// aynan shu yerga yuboradi: begona odam ishlayotgan muassasaning ichiga
// kirmasin, va ko'rgan narsasi o'sha kungi menyuga bog'liq bo'lmasin.
const demoUrl = () => `${appUrl()}/demo`;

// Mijoz ilovasining stol sahifasi — bot Mini App tugmasi shuni ochadi
const tableWebUrl = (slug, qrToken) => `${appUrl()}/t/${slug}/${qrToken}`;

// Xodim taklif havolasi
const inviteUrl = (slug, token) => `${appUrl()}/${slug}/accept-invite/${token}`;

module.exports = {
  appUrl,
  appUrlInfo,
  resetUrlCache,
  detectLanIp,
  tableUrl,
  tableWebUrl,
  tablePickerUrl,
  demoUrl,
  inviteUrl,
};
