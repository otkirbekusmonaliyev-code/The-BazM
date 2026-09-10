// ARIZA JAVOBI SAYTDA — sinov.
//
// Google bilan kirishning O'ZINI bu yerda sinab bo'lmaydi (u haqiqiy
// Google hisobini talab qiladi), lekin undan KEYINGI hamma narsani
// sinash mumkin va aynan o'sha yerda mantiq bor:
//
//   - kutilayotgan ariza "ko'rib chiqilmoqda" deb qaytadimi
//   - rad etilgani sababi bilan qaytadimi
//   - tasdiqlangani kirish ma'lumotlari bilan qaytadimi
//   - PAROL FAQAT BIR MARTA ko'rsatiladimi va bazadan o'chadimi
//   - begona pochta hech narsa ko'rmaydimi
//
//   node scripts/statusTest.js

require('dotenv').config();
const masterPrisma = require('../src/config/masterDb');
const provisioning = require('../src/services/provisioning');
const status = require('../src/services/applicationStatus');
const controller = require('../src/modules/super-admin/superAdmin.controller');

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
};

const MARK = `zz-holat-${Date.now().toString(36)}`;
const created = { applications: [], restaurants: [] };

async function makeApplication(email, name) {
  const app = await masterPrisma.restaurantApplication.create({
    data: {
      name,
      businessType: 'cafe',
      phone: `+99893${String(Date.now() + created.applications.length).slice(-7)}`,
      email,
      region: 'Toshkent shahri',
      city: 'Yunusobod',
      plan: 'basic',
    },
  });
  created.applications.push(app.id);
  return app;
}

// Controller'ni to'g'ridan-to'g'ri chaqirish uchun soxta javob obyekti
function fakeRes() {
  const out = { status: 0, body: null };
  return {
    out,
    status(code) {
      out.status = code;
      return this;
    },
    json(body) {
      out.body = body;
      return this;
    },
  };
}

async function main() {
  console.log('\n=== Ariza javobi (saytda) sinovi ===\n');

  // ---------- 1) Begona pochta ----------
  console.log('1) Begona pochta hech narsa ko\'rmaydi');
  {
    const r = await status.statusFor(`${MARK}-yoq@example.com`);
    check('holat: not_found', r.state === 'not_found', r.state);
    check('hech qanday ma\'lumot chiqmadi', !r.phone && !r.password && !r.placeName);
  }

  // ---------- 2) Kutilayotgan ariza ----------
  console.log('\n2) Ko\'rib chiqilmoqda');
  {
    const email = `${MARK}-kutmoqda@example.com`;
    await makeApplication(email, 'Kutayotgan Kafe');
    const r = await status.statusFor(email);
    check('holat: pending', r.state === 'pending', r.state);
    check('muassasa nomi ko\'rinadi', r.placeName === 'Kutayotgan Kafe');
    check('parol berilmadi', !r.password);
  }

  // ---------- 3) Rad etilgan ariza ----------
  console.log('\n3) Rad etilgan — sababi bilan');
  {
    const email = `${MARK}-rad@example.com`;
    const app = await makeApplication(email, 'Rad Etilgan Kafe');

    const res = fakeRes();
    await controller.rejectApplication(
      { params: { id: app.id }, body: { note: 'Hozircha bu shaharda ishlamaymiz' } },
      res,
      (err) => { throw err; }
    );
    check('rad etildi', res.out.status === 0 || res.out.status === 200);

    const r = await status.statusFor(email);
    check('holat: rejected', r.state === 'rejected', r.state);
    check('sabab yetkazildi', r.note === 'Hozircha bu shaharda ishlamaymiz', r.note);
    check('parol berilmadi', !r.password);
  }

  // ---------- 4) Sababsiz rad etish ----------
  console.log('\n4) Sabab yozilmasa ham ishlaydi');
  {
    const email = `${MARK}-rad2@example.com`;
    const app = await makeApplication(email, 'Sababsiz Kafe');
    await controller.rejectApplication({ params: { id: app.id }, body: {} }, fakeRes(), (e) => { throw e; });
    const r = await status.statusFor(email);
    check('holat: rejected', r.state === 'rejected');
    check('sabab bo\'sh (sahifa umumiy matn ko\'rsatadi)', r.note === null, String(r.note));
  }

  // ---------- 5) Tasdiqlangan ariza ----------
  console.log('\n5) Tasdiqlangan — kirish ma\'lumotlari bilan');
  {
    const email = `${MARK}-ok@example.com`;
    const app = await makeApplication(email, 'Tasdiqlangan Kafe');

    const res = fakeRes();
    await controller.approveApplication(
      { params: { id: app.id }, body: { slug: MARK } },
      res,
      (err) => { throw err; }
    );
    check('tasdiqlandi', res.out.status === 201, `HTTP ${res.out.status}`);
    created.restaurants.push(res.out.body.restaurant.id);
    const realPassword = res.out.body.adminCredentials.password;

    const r = await status.statusFor(email);
    check('holat: approved', r.state === 'approved', r.state);
    check('muassasa nomi', r.placeName === 'Tasdiqlangan Kafe', r.placeName);
    check('slug berildi', r.slug === MARK, r.slug);
    check('kirish manzili berildi', !!r.appUrl && /^https?:\/\//.test(r.appUrl), r.appUrl);
    check('telefon berildi', r.phone === app.phone);
    check('PAROL AYNAN o\'sha', r.password === realPassword, r.password ? 'mos' : 'yo\'q');

    // ---- Ikkinchi marta parol KO'RSATILMAYDI ----
    //
    // Parol bazada abadiy yotib qolmasligi kerak: bir marta olingach o'chadi.
    const again = await status.statusFor(email);
    check('ikkinchi safar ham holat ko\'rinadi', again.state === 'approved');
    check('lekin PAROL boshqa berilmaydi', !again.password, again.password ? 'hali ham bor!' : 'o\'chirilgan');
    check('qachon ko\'rilgani yozildi', !!again.passwordSeenAt);

    const row = await masterPrisma.restaurantApplication.findUnique({ where: { id: app.id } });
    check('bazada ham parol qolmadi', row.adminPasswordEnc === null);
  }

  // ---------- 6) Katta-kichik harf ----------
  console.log('\n6) Pochtadagi katta-kichik harf muhim emas');
  {
    const email = `${MARK}-Harf@Example.com`;
    await makeApplication(email, 'Harf Kafe');
    const r = await status.statusFor(email.toLowerCase());
    check('kichik harf bilan ham topildi', r.state === 'pending', r.state);
  }

  // ---------- Tozalash ----------
  for (const id of created.restaurants) {
    try {
      await provisioning.deleteRestaurant(id);
    } catch (_) {
      /* allaqachon o'chgan */
    }
  }
  await masterPrisma.restaurantApplication.deleteMany({ where: { id: { in: created.applications } } });
  const left = await masterPrisma.restaurantApplication.count({
    where: { id: { in: created.applications } },
  });
  console.log(`\n  ✔ tozalandi — ${created.applications.length} ta ariza o'chirildi${left ? ` (${left} ta qoldi!)` : ''}`);
  if (left) failures += 1;

  console.log(`\n=== Natija: ${failures === 0 ? 'HAMMASI O\'TDI ✔' : `${failures} ta xato ✘`} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Sinov to\'xtadi:', err);
  process.exit(1);
});
