// O'Z-O'ZINI TEKSHIRISH.
//
// Server kuniga bir-ikki marta o'zining butun ish oqimini boshidan
// oxirigacha sinab ko'radi: muassasa yaratish, menyu, stol, QR kod,
// xodim taklifi, mijoz buyurtmasi, oshxona oqimi, ofitsiantga topshirish
// va tenantlar orasidagi chegara.
//
// UCH TA QAT'IY QOIDA:
//
//   1) HAQIQIY MUASSASALARGA UMUMAN TEGMAYDI. Sinov o'zining vaqtinchalik
//      "kanareyka" muassasasini yaratadi, ishini unda qiladi va bazasi
//      bilan birga o'chiradi. Hech qanday haqiqiy ma'lumot o'qilmaydi
//      ham, yozilmaydi ham.
//
//   2) PANELDA KO'RINMAYDI. Kanareykaning slug'i maxsus prefiks bilan
//      boshlanadi va u super admin ro'yxatlaridan, statistikadan hamda
//      ochiq qidiruvdan chetlab o'tiladi.
//
//   3) O'ZIDAN KEYIN TOZALAYDI. Sinov yarim yo'lda uzilib qolsa ham,
//      keyingi ishga tushishda eski kanareykalar topib o'chiriladi.
//
// Natija jurnalga yoziladi va xotirada saqlanadi — platforma egasi uni
// `GET /api/health/selftest` orqali ko'ra oladi.

const provisioning = require('../services/provisioning');
const masterPrisma = require('../config/masterDb');
const { invalidateTenantClient } = require('../config/tenantDb');

// Kanareyka shu prefiks bilan boshlanadi — hamma joyda shunga qarab
// filtrlanadi. `INTERNAL_PREFIX` bitta joyda turadi, chunki uni
// controller'lar ham ishlatadi.
const { INTERNAL_PREFIX } = require('../utils/internal');

const DEFAULT_INTERVAL_HOURS = 12;
// Server ko'tarilishi bilan emas, biroz tinchlanib olgach — bot ulanishi
// va birinchi so'rovlar bilan bir vaqtda bazani band qilmasin
const DEFAULT_FIRST_DELAY_SEC = 90;

let timer = null;
let running = false;
const history = []; // oxirgi natijalar (eng yangisi boshida)
const HISTORY_LIMIT = 10;

function baseUrl() {
  return `http://127.0.0.1:${process.env.PORT || 4000}/api`;
}

async function api(path, { method = 'GET', body, token, slug, raw } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (slug) headers['X-Restaurant-Slug'] = slug;

  const res = await fetch(baseUrl() + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()) };
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  return { status: res.status, data };
}

// Yarim yo'lda uzilib qolgan eski kanareykalarni tozalash
async function sweepLeftovers() {
  const stale = await masterPrisma.restaurant.findMany({
    where: { slug: { startsWith: INTERNAL_PREFIX } },
    select: { id: true, slug: true },
  });
  for (const r of stale) {
    try {
      invalidateTenantClient(r.slug);
      // eslint-disable-next-line no-await-in-loop
      await provisioning.deleteRestaurant(r.id);
    } catch (_) {
      /* o'chirilmasa keyingi safar yana urinamiz */
    }
  }
  return stale.length;
}

async function runSelfTest() {
  if (running) return { skipped: 'allaqachon ishlamoqda' };
  running = true;

  const startedAt = new Date();
  const t0 = Date.now();
  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok: !!ok, detail: detail || null });
    return !!ok;
  };

  const slug = `${INTERNAL_PREFIX}${Date.now().toString(36)}`;
  const adminPhone = `+99899${String(Date.now()).slice(-7)}`;
  const adminPassword = `st${Date.now().toString(36)}`;
  let restaurantId = null;

  try {
    await sweepLeftovers();

    // ---- Muassasa yaratish (to'g'ridan-to'g'ri, HTTP siz) ----
    const created = await provisioning.provisionRestaurant({
      name: 'Ichki sinov',
      slug,
      plan: 'basic',
      businessType: 'restaurant',
      adminName: 'Ichki sinov admini',
      adminPhone,
      adminPassword,
    });
    restaurantId = created.restaurant.id;
    check('muassasa yaratildi (o\'z bazasi bilan)', !!restaurantId);

    // ---- Kirish ----
    const login = await api('/login', {
      method: 'POST',
      body: { phone: adminPhone, password: adminPassword, slug },
    });
    check('admin kirishi', login.status === 200 && !!login.data.token, `HTTP ${login.status}`);
    const adminToken = login.data && login.data.token;
    if (!adminToken) throw new Error('admin kira olmadi — keyingi qadamlar ma\'nosiz');

    // ---- Menyu ----
    const cat = await api('/menu/admin/categories', {
      method: 'POST', token: adminToken, slug, body: { name: 'Sinov bo\'limi' },
    });
    check('menyu bo\'limi', cat.status === 201, `HTTP ${cat.status}`);

    const item = await api('/menu/admin/items', {
      method: 'POST', token: adminToken, slug,
      body: { categoryId: cat.data.id, name: 'Sinov taomi', price: 10000 },
    });
    check('taom qo\'shish', item.status === 201, `HTTP ${item.status}`);

    // ---- Stol va QR ----
    const tables = await api('/tables/admin/bulk', {
      method: 'POST', token: adminToken, slug, body: { from: 1, to: 2 },
    });
    check('stol yaratish', tables.status === 201, `HTTP ${tables.status}`);

    const list = await api('/tables/admin', { token: adminToken, slug });
    const table = list.data && list.data[0];
    check('stolda QR kod bor', !!(table && table.qrToken));

    const qr = await api(`/client/tables/by-qr/${table.qrToken}`, { slug });
    check('QR kod stolga olib boradi', qr.status === 200 && qr.data.tableNumber === table.tableNumber);

    const png = await api(`/tables/admin/${table.id}/qr-code`, { token: adminToken, slug, raw: true });
    check('QR rasm yuklab olinadi', png.status === 200 && png.buffer.length > 500);

    // ---- Xodimlar: taklif -> parol -> kirish ----
    const tokens = {};
    let waiterId = null;
    for (const role of ['kitchen', 'waiter']) {
      const staffPhone = `+99898${String(Date.now() + (role === 'kitchen' ? 0 : 1)).slice(-7)}`;
      // eslint-disable-next-line no-await-in-loop
      const invite = await api('/staff/invite', {
        method: 'POST', token: adminToken, slug,
        body: { fullName: `Sinov ${role}`, phone: staffPhone, role },
      });
      if (!check(`${role} taklifi`, invite.status === 201, `HTTP ${invite.status}`)) continue;

      const inviteToken = invite.data.inviteLink.split('/').pop();
      // eslint-disable-next-line no-await-in-loop
      const accepted = await api(`/auth/accept-invite/${inviteToken}`, {
        method: 'POST', slug, body: { password: 'sinov12345' },
      });
      check(`${role} parol o'rnatdi`, accepted.status === 201, `HTTP ${accepted.status}`);

      // eslint-disable-next-line no-await-in-loop
      const staffLogin = await api('/login', {
        method: 'POST', body: { phone: staffPhone, password: 'sinov12345', slug },
      });
      check(`${role} kirishi`, staffLogin.status === 200 && staffLogin.data.user.role === role);
      tokens[role] = staffLogin.data && staffLogin.data.token;
      if (role === 'waiter') waiterId = staffLogin.data && staffLogin.data.user.id;
    }
    const kitchenToken = tokens.kitchen;

    // ---- Mijoz oqimi ----
    const session = await api('/client/session', {
      method: 'POST', slug, body: { qrToken: table.qrToken, clientName: 'Ichki sinov' },
    });
    check('mijoz sessiyasi', session.status === 200 && !!session.data.token);
    const clientToken = session.data && session.data.token;

    const order = await api('/client/orders', {
      method: 'POST', token: clientToken, slug,
      body: { items: [{ menuItemId: item.data.id, quantity: 3 }] },
    });
    check('buyurtma yaratildi', order.status === 201, `HTTP ${order.status}`);
    check('narx serverda hisoblandi', order.data && Number(order.data.totalPrice) === 30000);

    // ---- Oshxona oqimi ----
    const orderId = order.data && order.data.id;
    for (const status of ['accepted', 'preparing', 'ready']) {
      // eslint-disable-next-line no-await-in-loop
      const r = await api(`/kitchen/orders/${orderId}/status`, {
        method: 'PATCH', token: kitchenToken, slug, body: { status },
      });
      check(`oshxona -> ${status}`, r.status === 200, `HTTP ${r.status}`);
    }

    const back = await api(`/kitchen/orders/${orderId}/status`, {
      method: 'PATCH', token: kitchenToken, slug, body: { status: 'accepted' },
    });
    check('orqaga qaytish rad etildi', back.status === 409, `HTTP ${back.status}`);

    const nonsense = await api(`/kitchen/orders/${orderId}/status`, {
      method: 'PATCH', token: kitchenToken, slug, body: { status: 'yo_q_holat' },
    });
    check('mavjud bo\'lmagan holat rad etildi', nonsense.status === 400, `HTTP ${nonsense.status}`);

    // ---- Ofitsiant oqimi ----
    const assign = await api(`/kitchen/orders/${orderId}/assign-waiter`, {
      method: 'PATCH', token: kitchenToken, slug, body: { waiterId },
    });
    check('ofitsiantga topshirildi', assign.status === 200, `HTTP ${assign.status}`);

    const respond = await api(`/waiter/orders/${orderId}/respond`, {
      method: 'PATCH', token: tokens.waiter, slug, body: { accept: true },
    });
    check('ofitsiant qabul qildi', respond.status === 200, `HTTP ${respond.status}`);

    const delivered = await api(`/waiter/orders/${orderId}/status`, {
      method: 'PATCH', token: tokens.waiter, slug, body: { status: 'delivered' },
    });
    check('yetkazildi', delivered.status === 200, `HTTP ${delivered.status}`);

    // ---- Ruxsatlar ----
    const forbidden = await api('/admin/dashboard', { token: kitchenToken, slug });
    check('oshpaz admin bo\'limiga kira olmaydi', forbidden.status === 403, `HTTP ${forbidden.status}`);

    const noToken = await api('/admin/dashboard', { slug });
    check('tokensiz admin bo\'limi yopiq', noToken.status === 401, `HTTP ${noToken.status}`);

    // ---- Hisobot ----
    const dash = await api('/admin/dashboard', { token: adminToken, slug });
    check('boshqaruv paneli', dash.status === 200 && dash.data.kpi && dash.data.kpi.ordersToday >= 1);

    // ---- Ochiq qidiruvda KO'RINMASLIGI kerak ----
    const publicSearch = await api('/public/places');
    const leaked = (publicSearch.data || []).some((p) => p.slug === slug);
    check('kanareyka ochiq qidiruvda ko\'rinmaydi', !leaked);
  } catch (err) {
    check('kutilmagan xato', false, err.message);
  } finally {
    // ---- Har qanday holatda tozalash ----
    if (restaurantId) {
      try {
        invalidateTenantClient(slug);
        await provisioning.deleteRestaurant(restaurantId);
        check('kanareyka o\'chirildi', true);
      } catch (err) {
        check('kanareyka o\'chirildi', false, err.message);
      }
    }
    running = false;
  }

  const failed = checks.filter((c) => !c.ok);
  const result = {
    startedAt: startedAt.toISOString(),
    ms: Date.now() - t0,
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    ok: failed.length === 0,
    failures: failed.map((f) => `${f.name}${f.detail ? ` (${f.detail})` : ''}`),
  };

  history.unshift(result);
  if (history.length > HISTORY_LIMIT) history.pop();

  if (result.ok) {
    console.log(`   [o'z-sinov] ${result.passed}/${result.total} ✔ (${result.ms} ms)`);
  } else {
    console.error(`   [o'z-sinov] ❌ ${result.failed} ta xato (${result.passed}/${result.total}):`);
    result.failures.forEach((f) => console.error(`      ✘ ${f}`));
  }

  return result;
}

function startSelfTestJob() {
  if (String(process.env.SELFTEST_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('   O\'z-sinov: o\'chirilgan (SELFTEST_ENABLED=false)');
    return null;
  }

  const hours = Math.max(1, Number(process.env.SELFTEST_INTERVAL_HOURS) || DEFAULT_INTERVAL_HOURS);
  const intervalMs = hours * 60 * 60 * 1000;

  // Birinchi ishga tushish server tinchlangandan keyin
  const firstDelay = Math.max(5, Number(process.env.SELFTEST_FIRST_DELAY_SEC) || DEFAULT_FIRST_DELAY_SEC);
  const first = setTimeout(() => {
    runSelfTest().catch((err) => console.error('   [o\'z-sinov] to\'xtadi:', err.message));
  }, firstDelay * 1000);
  if (first.unref) first.unref();

  timer = setInterval(() => {
    runSelfTest().catch((err) => console.error('   [o\'z-sinov] to\'xtadi:', err.message));
  }, intervalMs);
  if (timer.unref) timer.unref();

  console.log(`   O'z-sinov: har ${hours} soatda, alohida kanareyka bazasida`);
  return timer;
}

function stopSelfTestJob() {
  if (timer) clearInterval(timer);
  timer = null;
}

function getSelfTestHistory() {
  return { running, history };
}

module.exports = {
  startSelfTestJob,
  stopSelfTestJob,
  runSelfTest,
  getSelfTestHistory,
  sweepLeftovers,
};
