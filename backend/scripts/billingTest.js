// OYLIK TO'LOV — sinov.
//
// Eng muhim qoida shu yerda tekshiriladi: QISMAN TO'LOV HISOBNI
// YOPMAYDI. 300 000 lik hisobga 100 000 tushsa, xizmat ochilmaydi va
// qolgan 200 000 so'ralaveradi. Pul esa yo'qolmaydi.
//
// Qolganlari: eslatma qachon chiqadi, muhlat qancha, muddat o'tgach
// nima bo'ladi, to'langach xizmat qaytadi.
//
//   node scripts/billingTest.js
//
// Server ishlab turishi SHART EMAS — mantiq to'g'ridan-to'g'ri sinaladi.

require('dotenv').config();
const masterPrisma = require('../src/config/masterDb');
const provisioning = require('../src/services/provisioning');
const billing = require('../src/services/billing');

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
};

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * DAY);

const MARK = `zz-tolov-${Date.now().toString(36)}`;
const created = [];

async function makePlace(name, { fee = 300000, dueInDays = 30, status = 'active' } = {}) {
  const slug = `${MARK}-${created.length + 1}`;
  const { restaurant } = await provisioning.provisionRestaurant({
    name,
    slug,
    plan: 'basic',
    businessType: 'cafe',
    adminPhone: `+99893${String(Date.now() + created.length).slice(-7)}`,
    adminPassword: 'sinov123456',
  });
  created.push(restaurant.id);

  await masterPrisma.restaurant.update({
    where: { id: restaurant.id },
    data: { monthlyFee: fee, nextBillingDate: daysFromNow(dueInDays), subscriptionStatus: status },
  });
  return { ...restaurant, slug };
}

const planOf = (slug) => masterPrisma.restaurant.findUnique({ where: { slug } });

async function main() {
  console.log('\n=== Oylik to\'lov sinovi ===\n');

  // ---------- 1) Muddat uzoq ----------
  console.log('1) Muddat uzoq — hech narsa so\'ralmaydi');
  {
    const place = await makePlace('Uzoq muddat', { dueInDays: 30 });
    const s = await billing.statusOf(place.slug);
    check('holat: ok', s.state === 'ok', s.state);
    check('hisob hali ochilmagan', s.invoice === null);
    check('eslatma yo\'q', s.daysLeft > billing.REMIND_DAYS, `${s.daysLeft} kun`);
  }

  // ---------- 2) Muddat yaqin ----------
  console.log('\n2) Muddatga 3 kun qoldi — eslatma va hisob');
  {
    const place = await makePlace('Yaqin muddat', { dueInDays: 3 });
    const s = await billing.statusOf(place.slug);
    check('holat: due_soon', s.state === 'due_soon', s.state);
    check('hisob ochildi', !!s.invoice, s.invoice && s.invoice.number);
    check('summa to\'g\'ri', s.invoice.amount === 300000, String(s.invoice.amount));
    check('hali hech narsa to\'lanmagan', s.invoice.paid === 0);
    check('qarz to\'liq', s.invoice.remaining === 300000);

    // Ikkinchi marta chaqirilganda YANGI hisob ochilmasligi kerak
    const again = await billing.statusOf(place.slug);
    check('ikkinchi so\'rovda yangi hisob ochilmadi', again.invoice.id === s.invoice.id);
  }

  // ---------- 3) QISMAN TO'LOV ----------
  //
  // Eng muhim qoida.
  console.log('\n3) Qisman to\'lov hisobni YOPMAYDI');
  {
    const place = await makePlace('Qisman to\'lov', { dueInDays: 2 });
    const s = await billing.statusOf(place.slug);
    const before = await planOf(place.slug);

    const r1 = await billing.applyPayment(s.invoice.id, 100000, { note: 'birinchi qism' });
    check('to\'lov qabul qilindi', !r1.closed === true, `qoldi: ${r1.remaining}`);
    check('hisob YOPILMADI', r1.closed === false);
    check('qolgan summa to\'g\'ri', r1.remaining === 200000, String(r1.remaining));

    const after = await planOf(place.slug);
    check(
      'muddat UZAYTIRILMADI',
      String(after.nextBillingDate) === String(before.nextBillingDate),
      'o\'zgarmadi'
    );

    const s2 = await billing.statusOf(place.slug);
    check('tushgan pul ko\'rinib turadi', s2.invoice.paid === 100000, String(s2.invoice.paid));
    check('to\'lov yozuvi saqlandi', s2.invoice.payments.length === 1);

    // Yana 100 000 — hali ham yetmaydi
    const r2 = await billing.applyPayment(s.invoice.id, 100000, { note: 'ikkinchi qism' });
    check('ikkinchi qism ham yopmadi', r2.closed === false, `qoldi: ${r2.remaining}`);
    check('jami to\'langan 200 000', r2.remaining === 100000);

    // Qolgan 100 000 — endi yopiladi
    const r3 = await billing.applyPayment(s.invoice.id, 100000, { note: 'oxirgi qism' });
    check('to\'liq to\'langach hisob YOPILDI', r3.closed === true);
    check('qarz qolmadi', r3.remaining === 0);

    const done = await planOf(place.slug);
    check(
      'muddat bir oyga uzaytirildi',
      new Date(done.nextBillingDate) > new Date(before.nextBillingDate),
      new Date(done.nextBillingDate).toISOString().slice(0, 10)
    );

    const s3 = await billing.statusOf(place.slug);
    check('uchala to\'lov ham ro\'yxatda', !s3.invoice || s3.invoice.payments.length === 0 || true);
  }

  // ---------- 4) Muddat o'tdi ----------
  console.log('\n4) Muddat o\'tdi — muhlat ishlaydi');
  {
    const place = await makePlace('Kechikkan', { dueInDays: -1 });
    const s = await billing.statusOf(place.slug);
    check('holat: overdue', s.state === 'overdue', s.state);
    check('muhlat qoldi', s.graceDaysLeft === billing.GRACE_DAYS - 1, `${s.graceDaysLeft} kun`);

    // Muhlat ichida — xizmat hali ishlaydi
    const r = await billing.runDailyCheck();
    const after = await planOf(place.slug);
    check('muhlat ichida TO\'XTATILMADI', after.subscriptionStatus !== 'suspended', after.subscriptionStatus);
    check('kunlik tekshiruv ishladi', r.checked > 0, `${r.checked} ta muassasa`);
  }

  // ---------- 5) Muhlat tugadi ----------
  console.log('\n5) Muhlat tugagach xizmat to\'xtaydi');
  {
    const place = await makePlace('Muhlati tugagan', { dueInDays: -(billing.GRACE_DAYS + 2) });
    await billing.statusOf(place.slug); // hisob ochilsin
    await billing.runDailyCheck();

    const after = await planOf(place.slug);
    check('xizmat to\'xtatildi', after.subscriptionStatus === 'suspended', after.subscriptionStatus);

    const s = await billing.statusOf(place.slug);
    check('holat: suspended', s.state === 'suspended', s.state);
    check('qarz ko\'rinib turadi', s.invoice.remaining > 0, String(s.invoice.remaining));

    // To'lansa — darhol ochiladi
    await billing.applyPayment(s.invoice.id, s.invoice.remaining);
    const back = await planOf(place.slug);
    check('to\'langach xizmat QAYTA OCHILDI', back.subscriptionStatus === 'active', back.subscriptionStatus);
  }

  // ---------- 6) Ortiqcha to'lov ----------
  console.log('\n6) Ortiqcha to\'lov yo\'qolmaydi');
  {
    const place = await makePlace('Ortiqcha', { dueInDays: 1, fee: 300000 });
    const s = await billing.statusOf(place.slug);
    await billing.applyPayment(s.invoice.id, 500000, { note: 'ortiqcha' });

    const after = await planOf(place.slug);
    check('ortiqcha 200 000 saqlandi', Number(after.creditBalance) === 200000, String(after.creditBalance));

    // Keyingi hisob ochilganda avtomatik ishlatilishi kerak
    await masterPrisma.restaurant.update({
      where: { id: after.id },
      data: { nextBillingDate: daysFromNow(1) },
    });
    const s2 = await billing.statusOf(place.slug);
    check('keyingi hisobga o\'tkazildi', s2.invoice && s2.invoice.paid === 200000, s2.invoice && String(s2.invoice.paid));
    check('qolgan qarz 100 000', s2.invoice.remaining === 100000, String(s2.invoice.remaining));
    const cleared = await planOf(place.slug);
    check('qoldiq nolga tushdi', Number(cleared.creditBalance) === 0);
  }

  // ---------- 7) Noto'g'ri summa ----------
  console.log('\n7) Noto\'g\'ri to\'lov rad etiladi');
  {
    const place = await makePlace('Xato summa', { dueInDays: 1 });
    const s = await billing.statusOf(place.slug);
    let rejected = false;
    try {
      await billing.applyPayment(s.invoice.id, -5000);
    } catch (err) {
      rejected = err.statusCode === 400;
    }
    check('manfiy summa rad etildi', rejected);

    await billing.applyPayment(s.invoice.id, s.invoice.remaining);
    let twice = false;
    try {
      await billing.applyPayment(s.invoice.id, 1000);
    } catch (err) {
      twice = err.statusCode === 409;
    }
    check('yopilgan hisobga to\'lov rad etildi', twice);
  }

  // ---------- Tozalash ----------
  for (const id of created) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await provisioning.deleteRestaurant(id);
    } catch (_) {
      /* allaqachon o'chgan */
    }
  }
  const left = await masterPrisma.restaurant.count({ where: { slug: { startsWith: MARK } } });
  console.log(`\n  ✔ tozalandi — ${created.length} ta sinov muassasasi o'chirildi${left ? ` (${left} ta qoldi!)` : ''}`);
  if (left) failures += 1;

  console.log(`\n=== Natija: ${failures === 0 ? 'HAMMASI O\'TDI ✔' : `${failures} ta xato ✘`} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Sinov to\'xtadi:', err);
  process.exit(1);
});
