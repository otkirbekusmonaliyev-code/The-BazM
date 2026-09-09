// Global xodim indeksi (Master DB'dagi StaffLookup jadvali).
//
// Nima uchun kerak: xodimlar har bir restoranning O'Z bazasida saqlanadi.
// Yagona login sahifasida esa foydalanuvchi faqat telefon va parol kiritadi —
// tizim "bu telefon qaysi restoranniki?" degan savolga javob berishi kerak.
// Bu indeks shu savolga bitta so'rovda javob beradi.
//
// Indeks o'z-o'zini tuzatadi: agar telefon indeksda topilmasa, login barcha
// bazalarni bir marta ko'rib chiqadi va topsa — indeksga yozib qo'yadi.
// Shuning uchun eski ma'lumotlar uchun alohida migratsiya shart emas.

const masterPrisma = require('../config/masterDb');
const { listRunningRestaurants, getClientForRestaurant } = require('../config/tenantDb');

// Xodim yaratilganda yoki o'zgarganda indeksni yangilash
async function upsert({ phone, restaurantSlug, role, isActive = true }) {
  if (!phone) return null;
  return masterPrisma.staffLookup.upsert({
    where: { phone },
    create: { phone, restaurantSlug, role, isActive },
    update: { restaurantSlug, role, isActive },
  });
}

async function remove(phone) {
  if (!phone) return;
  await masterPrisma.staffLookup.deleteMany({ where: { phone } });
}

async function removeByRestaurant(restaurantSlug) {
  await masterPrisma.staffLookup.deleteMany({ where: { restaurantSlug } });
}

// Telefon bo'yicha qaysi restoran ekanini topish
async function find(phone) {
  return masterPrisma.staffLookup.findUnique({ where: { phone } });
}

// Indeksda yo'q bo'lsa — barcha bazalarni ko'rib chiqamiz.
// Bu faqat bir marta (birinchi loginda) sodir bo'ladi, keyin indeksga tushadi.
async function findByScanning(phone) {
  const restaurants = await listRunningRestaurants();
  for (const restaurant of restaurants) {
    try {
      const db = getClientForRestaurant(restaurant);
      // eslint-disable-next-line no-await-in-loop
      const user = await db.user.findUnique({ where: { phone } });
      if (user) {
        // eslint-disable-next-line no-await-in-loop
        await upsert({
          phone,
          restaurantSlug: restaurant.slug,
          role: user.role,
          isActive: user.isActive,
        });
        return { phone, restaurantSlug: restaurant.slug, role: user.role, isActive: user.isActive };
      }
    } catch (_) {
      /* bitta baza ochilmasa, qolganlarini davom ettiramiz */
    }
  }
  return null;
}

// Telefon boshqa restoranda band emasligini tekshirish.
// Yagona login uchun telefon global unikal bo'lishi SHART — aks holda tizim
// qaysi restoranga kiritishni bilmaydi.
async function isTakenElsewhere(phone, restaurantSlug) {
  const found = await find(phone);
  if (found && found.restaurantSlug !== restaurantSlug) return found;
  return null;
}

module.exports = { upsert, remove, removeByRestaurant, find, findByScanning, isTakenElsewhere };
