// Marketing sayti backend'ning ochiq (`/api/public/...`) endpointlaridan
// foydalanadi. Narxlar va hisoblagich SERVER tomonida olinadi — shu bilan
// sahifa HTML'ida ular tayyor holda bo'ladi va qidiruv tizimlari ko'radi.

const SERVER_API = process.env.API_URL || 'http://127.0.0.1:4000';
export const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Backend ishlamayotgan bo'lsa ham sayt ochilishi kerak — shuning uchun
// har bir so'rovda zaxira (fallback) qiymat beriladi.
async function safeFetch(path, fallback, revalidate = 300) {
  try {
    const res = await fetch(`${SERVER_API}/api/public${path}`, {
      next: { revalidate },
    });
    if (!res.ok) return fallback;
    return await res.json();
  } catch (_) {
    return fallback;
  }
}

// ZAXIRA TARIFLAR — faqat backend javob bermaganda ishlatiladi.
//
// Haqiqiy ro'yxat backend'da (`/api/public/plans`), stol va xodim
// chegaralari esa `services/planLimits.js` da. Bu yerdagi nusxa o'sha
// bilan bir xil bo'lishi kerak; farq qilsa, sayt backend o'chgan paytda
// boshqa narsa va'da qilib qo'yadi.
const FALLBACK_PLANS = [
  {
    key: 'basic',
    name: 'Basic',
    price: 299000,
    limits: { maxTables: 10, maxStaff: 10 },
    features: [
      '10 tagacha stol · 10 tagacha xodim',
      'QR menyu — kamera bilan ochiladi, ilova shart emas',
      'Telegram bot va Mini App',
      'Oshxona ekrani — buyurtmalar jonli tushadi',
      'Har bir stol uchun QR kod (PNG va SVG)',
    ],
  },
  {
    key: 'standard',
    name: 'Standard',
    price: 599000,
    popular: true,
    limits: { maxTables: 40, maxStaff: 30 },
    features: [
      '40 tagacha stol · 30 tagacha xodim',
      'Basic’dagi hammasi',
      'Ofitsiantlar boshqaruvi',
      'Botdan ofitsiant chaqirish',
      'Oldindan stol bron qilish',
      'Kunlik savdo hisoboti',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 1199000,
    limits: { maxTables: null, maxStaff: null },
    features: [
      'Cheksiz stol va xodim',
      'Standard’dagi hammasi',
      'Bir nechta filial',
      'O\'z brendingiz va rangingiz',
      'Kengaytirilgan hisobotlar',
      '24/7 qo\'llab-quvvatlash',
    ],
  },
];

export const getPlans = () => safeFetch('/plans', FALLBACK_PLANS, 3600);
export const getRegions = () => safeFetch('/regions', [], 86400);
export const getStats = () => safeFetch('/stats', { restaurantCount: 0 }, 300);
