// Yangi restoran uchun: baza yaratadi, jadvallarni quradi, Master DB'ga
// yozadi va birinchi admin foydalanuvchini ochadi.
//
// Ishlatish (PowerShell'da, backend papkasida):
//   node scripts/provisionTenant.js --name "Delish" --slug delish --plan basic --adminPhone +998901112233 --adminPassword Parol123

require('dotenv').config();
const { provisionRestaurant } = require('../src/services/provisioning');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    result[args[i].replace(/^--/, '')] = args[i + 1];
  }
  return result;
}

async function main() {
  const args = parseArgs();
  const { restaurant, adminCredentials } = await provisionRestaurant({
    name: args.name,
    slug: args.slug,
    plan: args.plan,
    adminName: args.adminName,
    adminPhone: args.adminPhone,
    adminPassword: args.adminPassword,
  });

  console.log('\n✔ Restoran ishga tushdi');
  console.log(`   Nomi:  ${restaurant.name}`);
  console.log(`   Slug:  ${restaurant.slug}`);
  console.log(`   Baza:  ${restaurant.dbName}`);
  if (adminCredentials) {
    console.log('\n   Admin kirish ma\'lumotlari (restoran egasiga bering):');
    console.log(`   Telefon: ${adminCredentials.phone}`);
    console.log(`   Parol:   ${adminCredentials.password}`);
  } else {
    console.log('\n   Admin yaratilmadi — --adminPhone bering yoki createRestaurantAdmin.js ishlating');
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Xatolik:', err.message);
    process.exit(1);
  });
