// ICHKI (XIZMATCHI) MUASSASALAR.
//
// Server o'zini o'zi tekshirish uchun vaqtinchalik "kanareyka" muassasa
// yaratadi (`src/jobs/selfTestJob.js`). U haqiqiy muassasa emas va hech
// kimga ko'rinmasligi kerak: na super admin panelida, na hisobotlarda,
// na kirish sahifasidagi qidiruvda.
//
// Buni bitta joydan boshqarish uchun prefiks va tayyor Prisma shartlari
// shu yerda turadi. Yangi ro'yxat qo'shilganda `notInternal` ni qo'shish
// kifoya — prefiksni qidirib yurish shart emas.
//
// Prefiks `zz-` bilan boshlanadi: alifbo bo'yicha saralashda ham oxirida
// qoladi, ya'ni filtr biror joyda unutilsa ham ko'zga tashlanmaydi.

const INTERNAL_PREFIX = 'zz-ichki-sinov-';

// Prisma `where` ichiga qo'shiladigan shart: ichki muassasalar chiqmaydi
const notInternal = { slug: { not: { startsWith: INTERNAL_PREFIX } } };

// Prisma orqali o'tmaydigan joylar uchun (masalan xotiradagi ro'yxat)
function isInternalSlug(slug) {
  return typeof slug === 'string' && slug.startsWith(INTERNAL_PREFIX);
}

module.exports = { INTERNAL_PREFIX, notInternal, isInternalSlug };
