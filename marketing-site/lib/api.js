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

const FALLBACK_PLANS = [
  {
    key: 'basic',
    name: 'Basic',
    price: 299000,
    features: ['1 ta oshxona ekrani', '10 tagacha stol', 'QR menyu va buyurtma', 'Telegram bot'],
  },
  {
    key: 'standard',
    name: 'Standard',
    price: 599000,
    popular: true,
    features: [
      'Cheksiz oshxona ekrani',
      '40 tagacha stol',
      'Ofitsiantlar boshqaruvi',
      'Stol bron qilish',
      'Kunlik savdo hisoboti',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 1199000,
    features: [
      'Cheksiz stol va xodim',
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
