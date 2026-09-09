// Sinov uchun namunaviy ma'lumot: kategoriyalar, taomlar, stollar va xodimlar.
// Butun oqimni (mijoz -> oshxona -> ofitsiant) darhol tekshirib ko'rish uchun.
//
// Ishlatish:
//   node scripts/seedTenant.js --slug delish

require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getTenantClient } = require('../src/config/tenantDb');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    result[args[i].replace(/^--/, '')] = args[i + 1];
  }
  return result;
}

const MENU = [
  {
    name: 'Salatlar',
    sortOrder: 1,
    items: [
      ['Achichuk', 'Pomidor, piyoz, achchiq qalampir', 18000],
      ['Sezar tovuq bilan', 'Romen salati, parmezan, kruton, tovuq filesi', 45000],
      ['Olivye', 'Klassik retsept, uy mayonezi bilan', 32000],
      ['Yunon salati', 'Feta, zaytun, bodring, pomidor', 42000],
    ],
  },
  {
    name: 'Issiq taomlar',
    sortOrder: 2,
    items: [
      ['Osh (to\'y palov)', 'Devzira guruch, qazi va bedana tuxumi bilan', 55000],
      ['Qozon kabob', 'Qo\'y go\'shti, kartoshka, piyoz halqalari', 68000],
      ['Beshbarmoq', 'Qo\'lda yoyilgan xamir, mol go\'shti', 62000],
      ['Lag\'mon (bo\'g\'irlama)', 'Qo\'lda tortilgan xamir, sabzavot va go\'sht', 42000],
      ['Tovuq tabaka', 'Sarimsoqli sous va yangi ko\'katlar bilan', 58000],
    ],
  },
  {
    name: 'Kabob va grill',
    sortOrder: 3,
    items: [
      ['Qo\'y kabob (1 sixcha)', 'Ko\'mirda pishirilgan, piyoz bilan', 32000],
      ['Tovuq kabob', 'Marinadlangan tovuq filesi', 26000],
      ['Lyulya kabob', 'Qiyma go\'sht, ziravorlar bilan', 30000],
      ['Grill sabzavot', 'Baqlajon, qalampir, sherry pomidor', 28000],
    ],
  },
  {
    name: 'Ichimliklar',
    sortOrder: 4,
    items: [
      ['Ko\'k choy', 'Choynak, 1 litr', 12000],
      ['Qora choy limon bilan', 'Choynak, 1 litr', 14000],
      ['Ayron', 'Uy ayroni, 0.3 l', 10000],
      ['Yangi siqilgan apelsin sharbati', '0.3 l', 28000],
      ['Suv (gazsiz)', '0.5 l', 6000],
    ],
  },
  {
    name: 'Shirinliklar',
    sortOrder: 5,
    items: [
      ['Chak-chak', 'Asal bilan, 150 g', 22000],
      ['Napoleon torti', 'Bir bo\'lak', 26000],
      ['Muzqaymoq', 'Uch sharcha, mevali sous bilan', 24000],
    ],
  },
];

const STAFF = [
  { fullName: 'Aziz Karimov', phone: '+998907778899', role: 'kitchen', password: 'oshpaz123' },
  { fullName: 'Malika Yusupova', phone: '+998909998877', role: 'waiter', password: 'ofitsiant123' },
  { fullName: 'Jasur Toshmatov', phone: '+998909998866', role: 'waiter', password: 'ofitsiant123' },
  { fullName: 'Nodira Rahimova', phone: '+998909998855', role: 'waiter', password: 'ofitsiant123' },
];

async function main() {
  const { slug = 'delish', tables = '12' } = parseArgs();
  const db = await getTenantClient(slug);

  // --- Menyu ---
  let categoriesAdded = 0;
  let itemsAdded = 0;
  for (const cat of MENU) {
    let category = await db.menuCategory.findFirst({ where: { name: cat.name } });
    if (!category) {
      category = await db.menuCategory.create({
        data: { name: cat.name, sortOrder: cat.sortOrder },
      });
      categoriesAdded += 1;
    }
    for (const [name, description, price] of cat.items) {
      const exists = await db.menuItem.findFirst({ where: { name, categoryId: category.id } });
      if (!exists) {
        await db.menuItem.create({
          data: { categoryId: category.id, name, description, price },
        });
        itemsAdded += 1;
      }
    }
  }

  // --- Stollar ---
  const tableCount = Number(tables);
  const existingTables = await db.restaurantTable.findMany({ select: { tableNumber: true } });
  const taken = new Set(existingTables.map((t) => t.tableNumber));
  const newTables = [];
  for (let n = 1; n <= tableCount; n += 1) {
    if (!taken.has(n)) {
      newTables.push({ tableNumber: n, qrToken: crypto.randomBytes(16).toString('hex') });
    }
  }
  if (newTables.length) await db.restaurantTable.createMany({ data: newTables });

  // --- Xodimlar ---
  let staffAdded = 0;
  for (const s of STAFF) {
    const exists = await db.user.findUnique({ where: { phone: s.phone } });
    if (!exists) {
      await db.user.create({
        data: {
          fullName: s.fullName,
          phone: s.phone,
          role: s.role,
          passwordHash: await bcrypt.hash(s.password, 10),
        },
      });
      staffAdded += 1;
    }
  }

  console.log(`\n✔ "${slug}" to'ldirildi:`);
  console.log(`   Kategoriya: +${categoriesAdded}, Taom: +${itemsAdded}`);
  console.log(`   Stol: +${newTables.length} (jami ${taken.size + newTables.length})`);
  console.log(`   Xodim: +${staffAdded}`);
  if (staffAdded > 0) {
    console.log('\n   Sinov uchun parollar:');
    for (const s of STAFF) console.log(`   ${s.role.padEnd(8)} ${s.phone}  ${s.password}`);
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Xatolik:', err.message);
    process.exit(1);
  });
