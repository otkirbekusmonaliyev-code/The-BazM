// MUASSASALAR KATALOGI — botdagi joy tanlash uchun.
//
// Botda mijoz to'rt qadamda o'z joyini topadi:
//
//   Davlat (O'zbekiston, so'ralmaydi) -> Viloyat -> Shahar -> Restoran/Kafe
//
// IKKI QOIDA:
//
//   1) FAQAT MAVJUD JOYLAR KO'RSATILADI. Ro'yxatda muassasasi yo'q
//      viloyat ham, shahar ham chiqmaydi. Aks holda odam "Xorazm" ni
//      tanlab, keyin "bu yerda hech narsa yo'q" degan javob olardi —
//      to'rt qadam behuda ketardi.
//
//   2) ISHLAMAYOTGAN MUASSASA KO'RINMAYDI. To'xtatilgan (suspended) va
//      bekor qilinganlar ro'yxatga tushmaydi: mijoz ular orqali
//      buyurtma bera olmaydi, demak tanlashning ma'nosi yo'q.
//      (Saytdagi qidiruvda esa to'xtatilganlari KO'RINADI — u yerda
//      xodim kirmoqchi bo'ladi va sababni bilishi kerak. Bu farq
//      ataylab.)

const masterPrisma = require('../config/masterDb');
const { notInternal } = require('../utils/internal');
const { REGIONS } = require('../data/uzbekistanRegions');

// Mijoz buyurtma bera oladigan muassasalar
const SERVING = { in: ['trial', 'active'] };

const baseWhere = () => ({
  ...notInternal,
  subscriptionStatus: SERVING,
  region: { not: null },
  city: { not: null },
});

// Toshkent shahri — viloyat ham, shahar ham. Unda shahar so'ralmaydi:
// odam "Toshkent shahri" deganda allaqachon shaharni aytgan bo'ladi.
const CITY_IS_REGION = new Set(['Toshkent shahri']);

const skipsCityStep = (region) => CITY_IS_REGION.has(region);

/**
 * Muassasasi BOR viloyatlar, har birida nechtaligi bilan.
 * Tartib — O'zbekiston ro'yxatidagidek (Toshkent birinchi).
 */
async function regionsWithPlaces() {
  const rows = await masterPrisma.restaurant.groupBy({
    by: ['region'],
    where: baseWhere(),
    _count: { _all: true },
  });

  const counts = new Map(rows.map((r) => [r.region, r._count._all]));
  return REGIONS.filter((r) => counts.has(r.name)).map((r) => ({
    name: r.name,
    count: counts.get(r.name),
  }));
}

/**
 * Shu viloyatdagi, muassasasi BOR shaharlar.
 */
async function citiesWithPlaces(region) {
  const rows = await masterPrisma.restaurant.groupBy({
    by: ['city'],
    where: { ...baseWhere(), region },
    _count: { _all: true },
  });

  const counts = new Map(rows.map((r) => [r.city, r._count._all]));
  const known = REGIONS.find((r) => r.name === region);
  // Ro'yxatdagi tartibni saqlaymiz; ro'yxatda yo'q shahar bo'lsa —
  // oxiriga qo'shamiz, yo'qotib qo'ymaymiz
  const ordered = known ? known.cities.filter((c) => counts.has(c)) : [];
  const extra = [...counts.keys()].filter((c) => !ordered.includes(c));
  return [...ordered, ...extra].map((name) => ({ name, count: counts.get(name) }));
}

/**
 * Tanlangan joydagi muassasalar.
 * @param {string} region
 * @param {string|null} city  Toshkent shahri uchun null bo'lishi mumkin
 * @param {'restaurant'|'cafe'} businessType
 */
async function placesIn(region, city, businessType) {
  const where = { ...baseWhere(), region, businessType };
  // Toshkent shahrida shahar so'ralmaydi — butun shahar bo'yicha qidiramiz
  if (city && !skipsCityStep(region)) where.city = city;

  return masterPrisma.restaurant.findMany({
    where,
    select: { slug: true, name: true, businessType: true, city: true },
    orderBy: { name: 'asc' },
    take: 60,
  });
}

/**
 * Bitta muassasa — tanlangач sessiyaga yoziladi.
 * Xizmat ko'rsatmayotgani qaytmaydi: mijoz eski tugmani bosgan bo'lishi
 * mumkin va o'shanda unga "bu joy hozir ishlamayapti" deyish kerak.
 */
async function findServing(slug) {
  return masterPrisma.restaurant.findFirst({
    where: { slug, subscriptionStatus: SERVING },
    select: { slug: true, name: true, businessType: true, region: true, city: true },
  });
}

// Shu turdagi muassasa umuman bormi? Tur tugmalarini chizishdan oldin
// tekshiriladi — bo'sh ro'yxatga olib boradigan tugma ko'rsatilmaydi.
async function typesAvailable(region, city) {
  const where = { ...baseWhere(), region };
  if (city && !skipsCityStep(region)) where.city = city;

  const rows = await masterPrisma.restaurant.groupBy({
    by: ['businessType'],
    where,
    _count: { _all: true },
  });
  const map = { restaurant: 0, cafe: 0 };
  for (const r of rows) map[r.businessType] = r._count._all;
  return map;
}

module.exports = {
  regionsWithPlaces,
  citiesWithPlaces,
  placesIn,
  findServing,
  typesAvailable,
  skipsCityStep,
  CITY_IS_REGION,
};
