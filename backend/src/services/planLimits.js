// TARIF CHEGARALARI.
//
// Sayt allaqachon "Basic — 10 tagacha stol", "Standard — 40 tagacha stol"
// deb va'da berardi, lekin kodda BU CHEGARALAR UMUMAN YO'Q edi: Basic
// tarifdagi muassasa 500 ta stol yaratsa ham hech kim to'xtatmasdi.
// Ya'ni sayt bir narsani aytardi, tizim boshqacha ishlardi.
//
// Endi chegara bitta joyda — shu faylda — turadi va uni HAM sayt (tarif
// ro'yxati), HAM backend (yaratish paytida tekshiruv) o'qiydi. Shu bilan
// ular bir-biridan uzoqlashib keta olmaydi.
//
// IKKI QOIDA:
//
//   1) CHEGARA FAQAT YANGI QO'SHISHDA ishlaydi. Allaqachon mavjud stol yoki
//      xodim hech qachon "noqonuniy" bo'lib qolmaydi. Aks holda tarifni
//      pasaytirgan muassasaning ishlab turgan zali birdan buzilardi —
//      bu mijozga qilinadigan eng yomon ish.
//
//   2) XATO TUSHUNARLI BO'LISHI SHART. "Ruxsat yo'q" emas, aynan nima
//      chegaraga tegib turgani va nima qilish kerakligi aytiladi.

const masterPrisma = require('../config/masterDb');

// null = cheksiz.
//
// TARIFLAR HAJM BO'YICHA AJRATILADI, funksiya bo'yicha emas.
//
// Sabab: QR menyu, Telegram bot, oshxona ekrani, ofitsiantlar boshqaruvi,
// bron — bularning hammasi mahsulotning O'ZAGI. Ularni Basic'dan olib
// tashlash arzon tarifni "kesilgan" qilib qo'yardi va mijoz mahsulotni
// yomon holatda ko'rardi. Kichik kafe ham, katta restoran ham bir xil
// tizimni oladi — faqat hajmi boshqacha.
//
// Yagona istisno — BREND (logo va rang). U ishga ta'sir qilmaydi, ya'ni
// uni yuqori tarifga qoldirish hech kimning ishini buzmaydi.
//
// Xodim chegaralari ataylab keng: 10 stolli kafeda admin + 2 oshpaz +
// 4 ofitsiant — oddiy holat, chegaraga yaqin ham kelmasligi kerak.
const PLAN_LIMITS = {
  basic: { maxTables: 10, maxStaff: 8, maxMenuItems: 60, branding: false },
  standard: { maxTables: 40, maxStaff: 25, maxMenuItems: 250, branding: false },
  pro: { maxTables: null, maxStaff: null, maxMenuItems: null, branding: true },
};

const PLAN_NAMES = { basic: 'Basic', standard: 'Standard', pro: 'Pro' };

// Tarif har so'rovda master bazadan o'qilmasin — u kunlab o'zgarmaydi.
// Kesh `invalidate()` orqali tozalanadi (tarif almashtirilganda).
const cache = new Map(); // slug -> { plan, at }
const TTL_MS = 5 * 60 * 1000;

function invalidate(slug) {
  cache.delete(slug);
}

async function planOf(slug) {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.plan;

  const restaurant = await masterPrisma.restaurant.findUnique({
    where: { slug },
    select: { subscriptionPlan: true },
  });
  // Topilmasa eng keng tarifni beramiz: bu yerda to'sib qo'yish
  // noto'g'ri bo'lardi — muassasa yo'qligini boshqa qatlam aytadi
  const plan = (restaurant && restaurant.subscriptionPlan) || 'pro';
  cache.set(slug, { plan, at: Date.now() });
  return plan;
}

function limitsOf(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.pro;
}

function limitError(message) {
  const err = new Error(message);
  err.statusCode = 403;
  err.code = 'PLAN_LIMIT';
  return err;
}

/**
 * Yangi stol(lar) qo'shish mumkinmi?
 * @param {string} slug
 * @param {object} tenantDb
 * @param {number} adding  nechta qo'shilmoqchi
 */
async function assertCanAddTables(slug, tenantDb, adding = 1) {
  const plan = await planOf(slug);
  const { maxTables } = limitsOf(plan);
  if (maxTables === null) return;

  const current = await tenantDb.restaurantTable.count();
  if (current + adding <= maxTables) return;

  const left = Math.max(0, maxTables - current);
  throw limitError(
    `${PLAN_NAMES[plan]} tarifida ${maxTables} tagacha stol bo'ladi. `
    + `Hozir ${current} ta bor${left > 0 ? `, yana ${left} ta qo'sha olasiz` : ''}. `
    + 'Ko\'proq kerak bo\'lsa tarifni ko\'taring.'
  );
}

/**
 * Yangi xodim qo'shish mumkinmi? Admin ham hisobga kiradi.
 */
async function assertCanAddStaff(slug, tenantDb, adding = 1) {
  const plan = await planOf(slug);
  const { maxStaff } = limitsOf(plan);
  if (maxStaff === null) return;

  // Faol xodimlar + hali kutayotgan takliflar. Taklif yuborilgan odam ham
  // joy egallaydi, aks holda chegarani o'nlab taklif yuborib chetlab
  // o'tsa bo'lardi. Muddati o'tgan taklif esa hisobga olinmaydi.
  const [users, invites] = await Promise.all([
    tenantDb.user.count({ where: { isActive: true } }),
    tenantDb.staffInvite.count({ where: { isUsed: false, expiresAt: { gt: new Date() } } }),
  ]);
  const current = users + invites;
  if (current + adding <= maxStaff) return;

  throw limitError(
    `${PLAN_NAMES[plan]} tarifida ${maxStaff} tagacha xodim bo'ladi `
    + `(hozir ${current} ta, kutayotgan takliflar bilan). `
    + 'Ko\'proq kerak bo\'lsa tarifni ko\'taring.'
  );
}

/**
 * Menyuga yangi taom qo'shish mumkinmi?
 */
async function assertCanAddMenuItems(slug, tenantDb, adding = 1) {
  const plan = await planOf(slug);
  const { maxMenuItems } = limitsOf(plan);
  if (maxMenuItems === null) return;

  const current = await tenantDb.menuItem.count();
  if (current + adding <= maxMenuItems) return;

  throw limitError(
    `${PLAN_NAMES[plan]} tarifida ${maxMenuItems} tagacha taom bo'ladi `
    + `(hozir ${current} ta). Ko'proq kerak bo'lsa tarifni ko'taring.`
  );
}

// Brend (logo va rang) shu tarifda mumkinmi?
async function canBrand(slug) {
  return limitsOf(await planOf(slug)).branding === true;
}

async function assertCanBrand(slug) {
  if (await canBrand(slug)) return;
  const plan = await planOf(slug);
  throw limitError(
    `Logo va rangni tanlash Pro tarifida mumkin. Hozirgi tarifingiz — ${PLAN_NAMES[plan]}.`
  );
}

module.exports = {
  PLAN_LIMITS,
  PLAN_NAMES,
  planOf,
  limitsOf,
  invalidate,
  assertCanAddTables,
  assertCanAddStaff,
  assertCanAddMenuItems,
  canBrand,
  assertCanBrand,
};
