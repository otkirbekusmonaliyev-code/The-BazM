// TO'LIQ SINOV — 0 dan 100 gacha.
//
// Bir vaqtning o'zida 10 ta muassasa (restoran va kafe) yaratadi, har birida
// butun ish oqimini boshidan oxirigacha o'tkazadi, tenantlar orasidagi
// chegarani sinaydi va marketing saytiga bir vaqtda o'nlab so'rov yuboradi.
// Oxirida hammasini o'zidan keyin tozalaydi.
//
//   node scripts/fullTest.js
//   node scripts/fullTest.js --places 4      (kamroq muassasa bilan tez sinov)
//   node scripts/fullTest.js --keep          (tozalamaydi — qo'lda ko'rish uchun)
//
// Server ishlab turgan bo'lishi kerak.

require('dotenv').config();
const bcrypt = require('bcrypt');
const masterPrisma = require('../src/config/masterDb');

const PORT = process.env.PORT || 4000;
const BASE = `http://127.0.0.1:${PORT}/api`;
const SITE = process.env.MARKETING_URL || 'http://localhost:3001';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const PLACES = Number(arg('--places', 10));
const KEEP = process.argv.includes('--keep');

// Sinov yaratgan hamma narsa shu belgidan boshlanadi — tozalash aynan
// shunga qarab ishlaydi va HAQIQIY muassasalarga hech qachon tegmaydi.
const MARK = `zz-sinov-${Date.now().toString().slice(-8)}`;

let pass = 0;
let fail = 0;
const failures = [];

const ok = (n, e) => {
  pass += 1;
  console.log(`  ✔ ${n}${e ? ` — ${e}` : ''}`);
};
const bad = (n, e) => {
  fail += 1;
  failures.push(`${n}${e ? ` — ${e}` : ''}`);
  console.log(`  ✘ ${n}${e ? ` — ${e}` : ''}`);
};
const section = (t) => console.log(`\n${t}`);

async function api(path, { method = 'GET', body, token, slug, raw } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (slug) headers['X-Restaurant-Slug'] = slug;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  return { status: res.status, data };
}

// ============================================================

async function main() {
  const startedAt = Date.now();
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  BAZM — TO'LIQ SINOV (${String(PLACES).padStart(2)} ta muassasa)          ║`);
  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log(`   belgi: ${MARK}`);

  try {
    const h = await fetch(`${BASE}/health`);
    if (!h.ok) throw new Error(String(h.status));
  } catch (_) {
    console.error('\n❌ Server ishlamayapti. `npm start` bilan ishga tushiring.\n');
    process.exit(1);
  }

  // ---------- 1) Platforma egasi ----------
  section('1) PLATFORMA EGASI');

  const superPhone = '+998000000009';
  const superPass = `sinov${Date.now()}`;
  await masterPrisma.superAdmin.upsert({
    where: { phone: superPhone },
    update: { passwordHash: await bcrypt.hash(superPass, 10) },
    create: {
      phone: superPhone,
      fullName: 'To\'liq sinov admini',
      passwordHash: await bcrypt.hash(superPass, 10),
    },
  });

  const sa = await api('/login', { method: 'POST', body: { phone: superPhone, password: superPass } });
  if (sa.status === 200 && sa.data.role === 'super_admin') ok('super admin kirdi');
  else {
    bad('super admin kirdi', JSON.stringify(sa.data));
    process.exit(1);
  }
  const superToken = sa.data.token;

  const statsBefore = await api('/super-admin/stats', { token: superToken });
  if (statsBefore.status === 200) ok('statistika ochildi', `${statsBefore.data.totalRestaurants} ta muassasa bor`);
  else bad('statistika ochildi', String(statsBefore.status));

  // ---------- 2) 10 ta muassasa BIR VAQTDA ----------
  section(`2) ${PLACES} TA MUASSASA BIR VAQTDA YARATILMOQDA`);

  const specs = Array.from({ length: PLACES }, (_, i) => ({
    n: i + 1,
    name: `${MARK} ${i % 2 === 0 ? 'Restoran' : 'Kafe'} ${i + 1}`,
    slug: `${MARK}-${i + 1}`,
    businessType: i % 2 === 0 ? 'restaurant' : 'cafe',
    plan: ['basic', 'standard', 'pro'][i % 3],
    adminPhone: `+99890${String(1000000 + i).slice(-7)}`,
    adminPassword: 'sinov123456',
  }));

  const t0 = Date.now();
  const created = await Promise.all(
    specs.map((s) =>
      api('/super-admin/restaurants', {
        method: 'POST',
        token: superToken,
        body: {
          name: s.name,
          slug: s.slug,
          plan: s.plan,
          businessType: s.businessType,
          adminPhone: s.adminPhone,
          adminPassword: s.adminPassword,
        },
      }).then((r) => ({ spec: s, res: r }))
    )
  );
  const elapsed = Date.now() - t0;

  const good = created.filter((c) => c.res.status === 201);
  if (good.length === PLACES) ok(`${PLACES} tasi ham yaratildi`, `${(elapsed / 1000).toFixed(1)} s, har biriga o'z bazasi`);
  else {
    created.filter((c) => c.res.status !== 201).forEach((c) => bad(`${c.spec.slug} yaratilmadi`, JSON.stringify(c.res.data)));
  }

  const places = good.map((c) => ({ ...c.spec, id: c.res.data.restaurant.id }));
  if (places.length === 0) {
    console.error('\n❌ Hech qanday muassasa yaratilmadi.\n');
    process.exit(1);
  }

  // Bazalar haqiqatan alohidami
  const dbNames = await masterPrisma.restaurant.findMany({
    where: { slug: { startsWith: MARK } },
    select: { slug: true, dbName: true },
  });
  const uniqueDbs = new Set(dbNames.map((d) => d.dbName));
  if (uniqueDbs.size === places.length) ok('har biriga alohida baza', `${uniqueDbs.size} ta`);
  else bad('har biriga alohida baza', `${uniqueDbs.size} / ${places.length}`);

  // Turlar bo'yicha filtr
  const rest = await api(`/super-admin/restaurants?type=restaurant`, { token: superToken });
  const cafes = await api(`/super-admin/restaurants?type=cafe`, { token: superToken });
  const myRest = rest.data.filter((r) => r.slug.startsWith(MARK)).length;
  const myCafes = cafes.data.filter((r) => r.slug.startsWith(MARK)).length;
  if (myRest + myCafes === places.length) ok('restoran/kafe bo\'limlari to\'g\'ri', `${myRest} restoran + ${myCafes} kafe`);
  else bad('restoran/kafe bo\'limlari', `${myRest} + ${myCafes} != ${places.length}`);

  // ---------- 3) Har bir muassasada to'liq ish oqimi ----------
  section(`3) HAR BIR MUASSASADA TO'LIQ ISH OQIMI (${places.length} ta, bir vaqtda)`);

  const results = await Promise.all(places.map((p) => runPlace(p)));

  const okPlaces = results.filter((r) => r.errors.length === 0);
  if (okPlaces.length === places.length) {
    ok('barcha muassasada oqim to\'liq ishladi', `${places.length}/${places.length}`);
  } else {
    results
      .filter((r) => r.errors.length > 0)
      .forEach((r) => r.errors.forEach((e) => bad(`[${r.slug}] ${e}`)));
  }

  const steps = results[0] ? Object.keys(results[0].steps) : [];
  steps.forEach((step) => {
    const good2 = results.filter((r) => r.steps[step]).length;
    if (good2 === results.length) ok(`  ${step}`, `${good2}/${results.length}`);
    else bad(`  ${step}`, `${good2}/${results.length}`);
  });

  // ---------- 4) Tenantlar orasidagi chegara ----------
  section('4) TENANTLAR ORASIDAGI CHEGARA (eng muhim qism)');

  if (results.length >= 2) {
    const A = results[0];
    const B = results[1];

    const cross = await api('/staff', { token: A.adminToken, slug: B.slug });
    if (cross.status === 401 || cross.status === 403) ok('A ning admini B ning xodimlarini ko\'rmaydi', `HTTP ${cross.status}`);
    else bad('A ning admini B ning xodimlarini ko\'rmaydi', `HTTP ${cross.status} — SIZIB CHIQDI`);

    const crossMenu = await api('/menu/admin', { token: A.adminToken, slug: B.slug });
    if (crossMenu.status === 401 || crossMenu.status === 403) ok('A ning admini B ning menyusini boshqara olmaydi', `HTTP ${crossMenu.status}`);
    else bad('A ning admini B ning menyusini boshqara olmaydi', `HTTP ${crossMenu.status} — SIZIB CHIQDI`);

    const crossQr = await api(`/client/tables/by-qr/${A.qrToken}`, { slug: B.slug });
    if (crossQr.status === 404) ok('A ning QR kodi B da ochilmaydi');
    else bad('A ning QR kodi B da ochilmaydi', `HTTP ${crossQr.status} — SIZIB CHIQDI`);

    const crossOrder = await api(`/kitchen/orders`, { token: A.kitchenToken, slug: B.slug });
    if (crossOrder.status === 401 || crossOrder.status === 403) ok('A ning oshpazi B ning buyurtmalarini ko\'rmaydi', `HTTP ${crossOrder.status}`);
    else bad('A ning oshpazi B ning buyurtmalarini ko\'rmaydi', `HTTP ${crossOrder.status} — SIZIB CHIQDI`);

    const aMenu = await api('/menu', { slug: A.slug });
    const bMenu = await api('/menu', { slug: B.slug });
    const aNames = JSON.stringify(aMenu.data.map((c) => c.name));
    const bNames = JSON.stringify(bMenu.data.map((c) => c.name));
    if (aMenu.status === 200 && bMenu.status === 200) ok('ikkala menyu ham mustaqil ochiladi');
    else bad('ikkala menyu ham mustaqil ochiladi');

    // Bir xil raqam ikki muassasada bo'la olmaydi
    const dup = await api('/staff/invite', {
      method: 'POST',
      token: B.adminToken,
      slug: B.slug,
      body: { fullName: 'Takror', phone: A.adminPhone, role: 'waiter' },
    });
    if (dup.status === 409) ok('band telefon boshqa muassasada rad etildi');
    else bad('band telefon boshqa muassasada rad etildi', `HTTP ${dup.status}`);
  }

  // ---------- 5) Ruxsatlar ----------
  section('5) RUXSATLAR');

  if (results.length > 0) {
    const A = results[0];
    const checks = [
      ['ofitsiant admin bo\'limiga kira olmaydi', '/admin/dashboard', A.waiterToken, 403],
      ['oshpaz xodimlarni boshqara olmaydi', '/staff', A.kitchenToken, 403],
      ['tokensiz admin bo\'limi', '/admin/dashboard', null, 401],
      ['super admin tokeni tenant yo\'lida', '/staff', superToken, 403],
    ];
    for (const [label, path, token, want] of checks) {
      // eslint-disable-next-line no-await-in-loop
      const r = await api(path, { token, slug: A.slug });
      if (r.status === want) ok(label, `HTTP ${r.status}`);
      else bad(label, `kutilgan ${want}, keldi ${r.status}`);
    }
  }

  // ---------- 6) Obuna to'xtatilganda ----------
  section('6) OBUNA TO\'XTATILGANDA');

  if (results.length > 0) {
    const A = results[0];
    await api(`/super-admin/restaurants/${A.id}/suspend`, { method: 'PATCH', token: superToken });

    const blockedMenu = await api('/menu', { slug: A.slug });
    if (blockedMenu.status === 403) ok('to\'xtatilgan muassasa menyusi yopildi');
    else bad('to\'xtatilgan muassasa menyusi yopildi', `HTTP ${blockedMenu.status}`);

    const blockedLogin = await api('/login', {
      method: 'POST',
      body: { phone: A.adminPhone, password: 'sinov123456' },
    });
    if (blockedLogin.status === 403) ok('to\'xtatilgan muassasa xodimi kira olmaydi');
    else bad('to\'xtatilgan muassasa xodimi kira olmaydi', `HTTP ${blockedLogin.status}`);

    await api(`/super-admin/restaurants/${A.id}/activate`, { method: 'PATCH', token: superToken });
    const restored = await api('/menu', { slug: A.slug });
    if (restored.status === 200) ok('faollashtirgach yana ishlaydi');
    else bad('faollashtirgach yana ishlaydi', `HTTP ${restored.status}`);
  }

  // ---------- 7) Marketing sayti — bir vaqtda o'nlab so'rov ----------
  section('7) MARKETING SAYTI — BIR VAQTDA 30 TA SO\'ROV');

  const paths = ['/', '/ru', '/sorov', '/ru/sorov'];
  const siteReqs = [];
  for (let i = 0; i < 30; i += 1) siteReqs.push(paths[i % paths.length]);

  const st0 = Date.now();
  const siteRes = await Promise.all(
    siteReqs.map((p) =>
      fetch(SITE + p)
        .then((r) => ({ p, status: r.status }))
        .catch((e) => ({ p, status: 0, err: e.message }))
    )
  );
  const siteMs = Date.now() - st0;
  const siteOk = siteRes.filter((r) => r.status === 200).length;

  if (siteOk === siteRes.length) ok(`saytning ${siteRes.length} ta sahifasi javob berdi`, `${siteMs} ms`);
  else {
    const broken = siteRes.filter((r) => r.status !== 200);
    bad('sayt so\'rovlari', `${siteOk}/${siteRes.length} · buzilgan: ${broken.map((b) => `${b.p}=${b.status}`).slice(0, 4).join(', ')}`);
  }

  // Ochiq API ham bir vaqtda
  const apiReqs = [];
  for (let i = 0; i < 20; i += 1) {
    apiReqs.push(api('/public/plans'), api('/public/stats'), api('/public/places?type=cafe'));
  }
  const at0 = Date.now();
  const apiRes = await Promise.all(apiReqs);
  const apiMs = Date.now() - at0;
  const apiOk = apiRes.filter((r) => r.status === 200).length;
  if (apiOk === apiRes.length) ok(`ochiq API — ${apiRes.length} ta so'rov`, `${apiMs} ms`);
  else bad('ochiq API', `${apiOk}/${apiRes.length}`);

  // Ariza yuborish (marketing formasi)
  // Viloyat va shaharni ro'yxatdan olamiz — server ularni tekshiradi
  const regions = await api('/public/regions');
  const region = regions.data[0];

  const appRes = await api('/public/apply', {
    method: 'POST',
    body: {
      name: `${MARK} ariza`,
      businessType: 'cafe',
      phone: '+998900009999',
      region: region.name,
      city: region.cities[0],
      plan: 'basic',
    },
  });
  if (appRes.status === 201) ok('marketing formasidan ariza keldi', `${region.name} · ${region.cities[0]}`);
  else bad('marketing formasidan ariza keldi', JSON.stringify(appRes.data));

  // Ro'yxatdan tashqari shahar rad etilishi kerak — forma chetlab o'tilmasin
  const badApp = await api('/public/apply', {
    method: 'POST',
    body: {
      name: `${MARK} yolgon`,
      businessType: 'cafe',
      phone: '+998900008888',
      region: region.name,
      city: 'Bunday shahar yoq',
      plan: 'basic',
    },
  });
  if (badApp.status === 400) ok('ro\'yxatdan tashqari shahar rad etildi');
  else bad('ro\'yxatdan tashqari shahar rad etildi', `HTTP ${badApp.status}`);

  // ---------- 9) Tarif chegaralari ----------
  //
  // Sayt "Basic — 10 tagacha stol" deb va'da beradi. Avval bu shunchaki
  // matn edi: kodda chegara yo'q edi va Basic tarifdagi muassasa 500 ta
  // stol yaratsa ham hech kim to'xtatmasdi.
  //
  // Ikki narsa tekshiriladi: chegara HAQIQATAN ishlaydimi, va u mavjud
  // ma'lumotni buzmaydimi (tarifi pasaygan muassasaning zali qulab
  // tushmasligi kerak).
  section('9) TARIF CHEGARALARI');
  {
    const basic = places.find((p) => p.plan === 'basic');
    const pro = places.find((p) => p.plan === 'pro');

    if (basic) {
      const b = await api('/login', {
        method: 'POST',
        body: { phone: basic.adminPhone, password: basic.adminPassword, slug: basic.slug },
      });
      const token = b.data.token;

      // Har bir muassasada allaqachon 5 ta stol bor, Basic chegarasi 10 ta
      const upToLimit = await api('/tables/admin/bulk', {
        method: 'POST', token, slug: basic.slug, body: { from: 6, to: 10 },
      });
      if (upToLimit.status === 201) ok('Basic: chegaragacha stol qo\'shildi', '10 ta bo\'ldi');
      else bad('Basic: chegaragacha stol qo\'shildi', `HTTP ${upToLimit.status}`);

      const over = await api('/tables/admin', {
        method: 'POST', token, slug: basic.slug, body: { tableNumber: 11 },
      });
      if (over.status === 403) ok('Basic: 11-stol rad etildi', over.data && over.data.error);
      else bad('Basic: 11-stol rad etildi', `HTTP ${over.status}`);

      if (over.data && /Basic/.test(over.data.error || '') && /tarifni/i.test(over.data.error || '')) {
        ok('xato matni tushunarli (tarif nomi + nima qilish kerak)');
      } else {
        bad('xato matni tushunarli', over.data && over.data.error);
      }

      const overBulk = await api('/tables/admin/bulk', {
        method: 'POST', token, slug: basic.slug, body: { from: 11, to: 30 },
      });
      if (overBulk.status === 403) ok('Basic: ommaviy qo\'shish ham rad etildi');
      else bad('Basic: ommaviy qo\'shish ham rad etildi', `HTTP ${overBulk.status}`);

      // Mavjudlariga TEGILMAYDI — chegara faqat yangisiga
      const still = await api('/tables/admin', { token, slug: basic.slug });
      if (still.status === 200 && still.data.length === 10) {
        ok('mavjud stollar joyida qoldi', `${still.data.length} ta`);
      } else {
        bad('mavjud stollar joyida qoldi', `${still.data && still.data.length} ta`);
      }
    }

    if (pro) {
      const p = await api('/login', {
        method: 'POST',
        body: { phone: pro.adminPhone, password: pro.adminPassword, slug: pro.slug },
      });
      const token = p.data.token;
      const many = await api('/tables/admin/bulk', {
        method: 'POST', token, slug: pro.slug, body: { from: 6, to: 60 },
      });
      if (many.status === 201) ok('Pro: chegara yo\'q', `${many.data.created} ta stol qo'shildi`);
      else bad('Pro: chegara yo\'q', `HTTP ${many.status}`);
    }

    // Saytdagi tariflar bir xil raqamlarni ko'rsatadimi?
    const plans = await api('/public/plans');
    const basicPlan = (plans.data || []).find((x) => x.key === 'basic');
    if (basicPlan && basicPlan.limits && basicPlan.limits.maxTables === 10) {
      ok('saytdagi tarif backend chegarasi bilan bir xil', '10 ta stol');
    } else {
      bad('saytdagi tarif backend chegarasi bilan bir xil', JSON.stringify(basicPlan && basicPlan.limits));
    }
    if (basicPlan && basicPlan.features.some((f) => f.includes('10 tagacha stol'))) {
      ok('tarif tavsifida chegara yozilgan');
    } else {
      bad('tarif tavsifida chegara yozilgan');
    }
  }
  // ---------- 8) Tozalash ----------
  section('10) TOZALASH');

  if (KEEP) {
    console.log('  (--keep berilgan — muassasalar qoldirildi)');
  } else {
    await masterPrisma.restaurantApplication.deleteMany({ where: { name: { startsWith: MARK } } });

    const removed = await Promise.all(
      places.map((p) =>
        api(`/super-admin/restaurants/${p.id}`, { method: 'DELETE', token: superToken })
          .then((r) => r.status === 200 || r.status === 204)
          .catch(() => false)
      )
    );
    const cleaned = removed.filter(Boolean).length;
    if (cleaned === places.length) ok('barcha sinov muassasalari o\'chirildi', `${cleaned} ta, bazalari bilan`);
    else bad('sinov muassasalari o\'chirildi', `${cleaned}/${places.length}`);

    const left = await masterPrisma.restaurant.count({ where: { slug: { startsWith: MARK } } });
    if (left === 0) ok('ortidan hech narsa qolmadi');
    else bad('ortidan hech narsa qolmadi', `${left} ta qoldi`);
  }

  await masterPrisma.superAdmin.deleteMany({ where: { phone: superPhone } });

  // ---------- Natija ----------
  const took = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  if (fail === 0) {
    console.log(`║  HAMMASI O'TDI ✔   ${String(pass).padStart(3)} ta tekshiruv · ${took.padStart(5)} s     ║`);
  } else {
    console.log(`║  ${String(fail).padStart(3)} TA XATO ✘   (${pass} ta o'tdi) · ${took} s        ║`);
  }
  console.log(`╚══════════════════════════════════════════════════╝`);
  if (fail > 0) {
    console.log('\nXatolar:');
    failures.forEach((f) => console.log(`   ✘ ${f}`));
  }
  console.log('');
  process.exit(fail === 0 ? 0 : 1);
}

// ============================================================
//  BITTA MUASSASADAGI TO'LIQ OQIM
// ============================================================

async function runPlace(place) {
  const { slug } = place;
  const errors = [];
  const steps = {};
  const out = { slug, id: place.id, adminPhone: place.adminPhone, errors, steps };

  const step = (name, condition, detail) => {
    steps[name] = !!condition;
    if (!condition) errors.push(`${name}${detail ? ` (${detail})` : ''}`);
    return !!condition;
  };

  try {
    // Admin kirishi
    const login = await api('/login', {
      method: 'POST',
      body: { phone: place.adminPhone, password: place.adminPassword, slug },
    });
    if (!step('admin kirishi', login.status === 200 && login.data.token, `HTTP ${login.status}`)) return out;
    out.adminToken = login.data.token;

    // Menyu
    const cat = await api('/menu/admin/categories', {
      method: 'POST',
      token: out.adminToken,
      slug,
      body: { name: 'Issiq taomlar', sortOrder: 1 },
    });
    step('menyu bo\'limi', cat.status === 201, `HTTP ${cat.status}`);

    const item = await api('/menu/admin/items', {
      method: 'POST',
      token: out.adminToken,
      slug,
      body: { categoryId: cat.data.id, name: 'Osh', price: 45000, description: 'Sinov taomi' },
    });
    step('taom qo\'shish', item.status === 201, `HTTP ${item.status}`);
    out.itemId = item.data && item.data.id;

    // Stollar
    const tables = await api('/tables/admin/bulk', {
      method: 'POST',
      token: out.adminToken,
      slug,
      body: { from: 1, to: 5 },
    });
    step('stollar (5 ta)', tables.status === 201 && tables.data.created === 5, `HTTP ${tables.status}`);

    const tableList = await api('/tables/admin', { token: out.adminToken, slug });
    const table = tableList.data[0];
    step('stollarda QR kod', !!(table && table.qrToken && table.qrUrl));
    out.qrToken = table && table.qrToken;

    // QR rasm
    const png = await api(`/tables/admin/${table.id}/qr-code`, { token: out.adminToken, slug, raw: true });
    step('QR rasm (PNG)', png.status === 200 && png.buffer.length > 500);

    const svg = await api(`/tables/admin/${table.id}/qr-code?format=svg`, { token: out.adminToken, slug, raw: true });
    step('QR rasm (SVG)', svg.status === 200 && svg.buffer.toString('utf8').includes('<svg'));

    // Xodimlar: taklif -> parol o'rnatish -> kirish
    for (const role of ['kitchen', 'waiter']) {
      const phone = `+99891${String(place.n * 100000 + (role === 'kitchen' ? 11 : 22)).slice(-7)}`;
      // eslint-disable-next-line no-await-in-loop
      const inv = await api('/staff/invite', {
        method: 'POST',
        token: out.adminToken,
        slug,
        body: { fullName: role === 'kitchen' ? 'Sinov oshpaz' : 'Sinov ofitsiant', phone, role },
      });
      if (!step(`${role} taklifi`, inv.status === 201, `HTTP ${inv.status}`)) continue;

      const token = inv.data.inviteLink.split('/').pop();
      // eslint-disable-next-line no-await-in-loop
      const info = await api(`/auth/accept-invite/${token}`, { slug });
      step(`${role} taklifi ochiladi`, info.status === 200 && info.data.phone === phone);

      // eslint-disable-next-line no-await-in-loop
      const accepted = await api(`/auth/accept-invite/${token}`, {
        method: 'POST',
        slug,
        body: { password: 'xodim123' },
      });
      step(`${role} parol o'rnatdi`, accepted.status === 201, `HTTP ${accepted.status}`);

      // eslint-disable-next-line no-await-in-loop
      const staffLogin = await api('/login', { method: 'POST', body: { phone, password: 'xodim123', slug } });
      step(`${role} kirishi`, staffLogin.status === 200 && staffLogin.data.user.role === role);
      if (role === 'kitchen') out.kitchenToken = staffLogin.data && staffLogin.data.token;
      else {
        out.waiterToken = staffLogin.data && staffLogin.data.token;
        out.waiterId = staffLogin.data && staffLogin.data.user.id;
      }
    }

    // Mijoz: QR -> sessiya
    const sessionRes = await api('/client/session', {
      method: 'POST',
      slug,
      body: { qrToken: out.qrToken, clientName: 'Sinov mijoz' },
    });
    step('mijoz QR orqali kirdi', sessionRes.status === 200 && sessionRes.data.token);
    const clientToken = sessionRes.data && sessionRes.data.token;

    const publicMenu = await api('/menu', { slug });
    step('mijoz menyuni ko\'rdi', publicMenu.status === 200 && publicMenu.data.length > 0);

    // Buyurtma
    const order = await api('/client/orders', {
      method: 'POST',
      token: clientToken,
      slug,
      body: { items: [{ menuItemId: out.itemId, quantity: 2, note: 'Achchiq bo\'lmasin' }] },
    });
    step('buyurtma berildi', order.status === 201, `HTTP ${order.status}`);
    const orderId = order.data && order.data.id;
    step('narx serverda hisoblandi', order.data && Number(order.data.totalPrice) === 90000);

    // Oshxona oqimi
    const flow = ['accepted', 'preparing', 'ready'];
    for (const status of flow) {
      // eslint-disable-next-line no-await-in-loop
      const r = await api(`/kitchen/orders/${orderId}/status`, {
        method: 'PATCH',
        token: out.kitchenToken,
        slug,
        body: { status },
      });
      step(`oshxona -> ${status}`, r.status === 200, `HTTP ${r.status}`);
    }

    // Holat mashinasi: `ready` dan `accepted` ga orqaga qaytish mumkin emas.
    // (`accepted` — enum'da BOR qiymat, shuning uchun bu aynan o'tishning
    //  o'zi rad etilishini sinaydi, ma'lumot tekshiruvini emas.)
    const illegal = await api(`/kitchen/orders/${orderId}/status`, {
      method: 'PATCH',
      token: out.kitchenToken,
      slug,
      body: { status: 'accepted' },
    });
    step('orqaga qaytish rad etildi', illegal.status === 409, `HTTP ${illegal.status}`);

    // Enum'da umuman yo'q qiymat — bu ma'lumot tekshiruvi, 400 qaytadi
    const nonsense = await api(`/kitchen/orders/${orderId}/status`, {
      method: 'PATCH',
      token: out.kitchenToken,
      slug,
      body: { status: 'yo_q_holat' },
    });
    step('mavjud bo\'lmagan holat rad etildi', nonsense.status === 400, `HTTP ${nonsense.status}`);

    // Ofitsiantga topshirish
    const assign = await api(`/kitchen/orders/${orderId}/assign-waiter`, {
      method: 'PATCH',
      token: out.kitchenToken,
      slug,
      body: { waiterId: out.waiterId },
    });
    step('ofitsiantga topshirildi', assign.status === 200, `HTTP ${assign.status}`);

    const respond = await api(`/waiter/orders/${orderId}/respond`, {
      method: 'PATCH',
      token: out.waiterToken,
      slug,
      body: { accept: true },
    });
    step('ofitsiant qabul qildi', respond.status === 200, `HTTP ${respond.status}`);

    const delivered = await api(`/waiter/orders/${orderId}/status`, {
      method: 'PATCH',
      token: out.waiterToken,
      slug,
      body: { status: 'delivered' },
    });
    step('yetkazildi', delivered.status === 200, `HTTP ${delivered.status}`);

    // Ofitsiant chaqirish
    const call = await api('/client/call-waiter', { method: 'POST', token: clientToken, slug });
    step('ofitsiant chaqirildi', call.status === 200 || call.status === 201, `HTTP ${call.status}`);

    // Bron
    const when = new Date(Date.now() + 3 * 86400000).toISOString();
    const reservation = await api('/client/reservations', {
      method: 'POST',
      slug,
      body: { clientName: 'Sinov bron', phone: '+998901234567', partySize: 4, reservationDate: when },
    });
    step('bron yaratildi', reservation.status === 201, `HTTP ${reservation.status}`);

    const confirmed = await api(`/kitchen/reservations/${reservation.data.id}`, {
      method: 'PATCH',
      token: out.adminToken,
      slug,
      body: { status: 'confirmed' },
    });
    step('bron tasdiqlandi', confirmed.status === 200, `HTTP ${confirmed.status}`);

    // Admin hisobotlari
    const dash = await api('/admin/dashboard', { token: out.adminToken, slug });
    const kpi = dash.data && dash.data.kpi;
    step('admin boshqaruv paneli', dash.status === 200 && kpi && kpi.ordersToday >= 1, `HTTP ${dash.status}`);
    step('savdo grafigi (7 kun)', dash.data && Array.isArray(dash.data.salesChart) && dash.data.salesChart.length === 7);
    step('ofitsiantlar holati', dash.data && Array.isArray(dash.data.waiters) && dash.data.waiters.length >= 1);

    // Ro'yxat sahifalangan: { total, page, pageSize, orders }
    const orders = await api('/admin/orders', { token: out.adminToken, slug });
    step(
      'buyurtmalar ro\'yxati',
      orders.status === 200 && orders.data.orders && orders.data.orders.length >= 1,
      orders.data && `jami ${orders.data.total}`
    );

    const staff = await api('/staff', { token: out.adminToken, slug });
    step('xodimlar ro\'yxati', staff.status === 200 && staff.data.length >= 3, `${staff.data && staff.data.length} ta`);

    // Muassasa nomi (mijoz ilovasi sarlavhasi)
    const info = await api('/client/place', { slug });
    step('muassasa nomi', info.status === 200 && info.data.name === place.name);
  } catch (err) {
    errors.push(`kutilmagan xato: ${err.message}`);
  }

  return out;
}

main().catch((err) => {
  console.error('\n❌ Sinov to\'xtadi:', err);
  process.exit(1);
});
