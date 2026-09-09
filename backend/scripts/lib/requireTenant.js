// Sinovlar sinov restoraniga tayanadi. U bo'lmasa — tushunarsiz
// `TypeError: Cannot read properties of undefined` o'rniga nima qilish
// kerakligini aniq aytamiz.

const masterPrisma = require('../../src/config/masterDb');

async function requireTenant(slug) {
  const restaurant = await masterPrisma.restaurant.findUnique({
    where: { slug },
    select: { slug: true, name: true, subscriptionStatus: true },
  });

  if (restaurant) return restaurant;

  console.error(
    `\n❌ "${slug}" muassasasi topilmadi — sinovlar unga tayanadi.\n\n` +
      'Sinov muassasasini yarating:\n\n' +
      `   npm run provision -- --name "Delish" --slug ${slug} \\\n` +
      '     --adminPhone +998901112233 --adminPassword admin123\n' +
      `   npm run seed -- --slug ${slug}\n\n` +
      'Boshqa nom ishlatmoqchi bo\'lsangiz, .env dagi TELEGRAM_DEV_SLUG ni\n' +
      'o\'zgartiring — sinovlar o\'shani oladi.\n'
  );
  process.exit(1);
  return null;
}

module.exports = { requireTenant };
