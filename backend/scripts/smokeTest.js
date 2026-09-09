// Uchdan-uchgacha sinov: mijoz buyurtma beradi -> oshpaz tayyorlaydi ->
// ofitsiantga topshiradi -> ofitsiant qabul qilib yetkazadi.
// Bir vaqtning o'zida Socket.io hodisalari ham kelayotganini tekshiradi.
//
// Server ishlab turgan holda:  node scripts/smokeTest.js

require('dotenv').config();
const { io } = require('socket.io-client');

const BASE = `http://127.0.0.1:${process.env.PORT || 4000}`;
const SLUG = process.argv.includes('--slug')
  ? process.argv[process.argv.indexOf('--slug') + 1]
  : 'delish';

const events = [];
let failures = 0;

function check(label, ok, extra = '') {
  console.log(`${ok ? '  ✔' : '  ✘'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
}

async function req(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Restaurant-Slug': SLUG,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  return { status: res.status, data };
}

function connectSocket(token, label) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
    socket.on('connected', () => resolve(socket));
    socket.on('connect_error', reject);
    socket.onAny((event, payload) => events.push({ label, event, payload }));
    setTimeout(() => reject(new Error(`${label}: socket ulanmadi`)), 5000);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const seen = (label, event) => events.some((e) => e.label === label && e.event === event);

async function main() {
  console.log(`\n=== Bazm uchdan-uchgacha sinov (${SLUG}) ===\n`);

  console.log('1) Xodimlar login qilmoqda');
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: { phone: '+998901112233', password: 'admin123' },
  });
  check('admin login', adminLogin.status === 200, adminLogin.data && adminLogin.data.error);
  const adminToken = adminLogin.data.token;

  const kitchenLogin = await req('/auth/login', {
    method: 'POST',
    body: { phone: '+998907778899', password: 'oshpaz123' },
  });
  check('oshpaz login', kitchenLogin.status === 200, kitchenLogin.data && kitchenLogin.data.error);
  const kitchenToken = kitchenLogin.data.token;

  const waiterLogin = await req('/auth/login', {
    method: 'POST',
    body: { phone: '+998909998877', password: 'ofitsiant123' },
  });
  check('ofitsiant login', waiterLogin.status === 200, waiterLogin.data && waiterLogin.data.error);
  const waiterToken = waiterLogin.data.token;
  const waiterId = waiterLogin.data.user.id;

  console.log('\n2) Noto\'g\'ri parol rad etiladimi');
  const badLogin = await req('/auth/login', {
    method: 'POST',
    body: { phone: '+998901112233', password: 'notogri' },
  });
  check('noto\'g\'ri parol -> 401', badLogin.status === 401);

  console.log('\n3) Socket.io ulanishlari');
  const kitchenSocket = await connectSocket(kitchenToken, 'kitchen');
  const waiterSocket = await connectSocket(waiterToken, 'waiter');
  check('oshxona soketi ulandi', kitchenSocket.connected);
  check('ofitsiant soketi ulandi', waiterSocket.connected);

  console.log('\n4) Mijoz stol tanlab, sessiya ochmoqda');
  const free = await req('/client/tables/available');
  check('bo\'sh stollar ro\'yxati', free.status === 200 && free.data.length > 0, `${free.data.length} ta`);
  const table = free.data[0];

  const claim = await req(`/client/tables/${table.id}/claim`, {
    method: 'POST',
    body: { clientName: 'Sinov Mijoz' },
  });
  check('stol band qilindi', claim.status === 200, claim.data && claim.data.error);
  const clientToken = claim.data.token;

  const reclaim = await req(`/client/tables/${table.id}/claim`, {
    method: 'POST',
    body: { clientName: 'Ikkinchi' },
  });
  check('band stolni qayta olish -> 409', reclaim.status === 409);

  const clientSocket = await connectSocket(clientToken, 'client');
  check('mijoz soketi ulandi', clientSocket.connected);
  await wait(200);
  check('oshxona "table_claimed" oldi', seen('kitchen', 'table_claimed'));

  console.log('\n5) Buyurtma berilmoqda');
  const menu = await req('/menu');
  check('menyu olindi', menu.status === 200 && menu.data.length > 0, `${menu.data.length} kategoriya`);
  const items = menu.data.flatMap((c) => c.items).filter((i) => i.isAvailable).slice(0, 3);

  const order = await req('/client/orders', {
    method: 'POST',
    token: clientToken,
    body: {
      items: items.map((i, idx) => ({ menuItemId: i.id, quantity: idx + 1, note: idx === 0 ? 'Achchiq bo\'lmasin' : undefined })),
    },
  });
  check('buyurtma yaratildi', order.status === 201, order.data && order.data.error);
  const orderId = order.data.id;

  const expectedTotal = items.reduce((sum, i, idx) => sum + Number(i.price) * (idx + 1), 0);
  check(
    'narx serverda to\'g\'ri hisoblandi',
    Number(order.data.totalPrice) === expectedTotal,
    `${order.data.totalPrice} = ${expectedTotal}`
  );

  await wait(300);
  check('oshxona "new_order" oldi (real-time)', seen('kitchen', 'new_order'));

  console.log('\n6) Status o\'tishlari');
  const skip = await req(`/kitchen/orders/${orderId}/status`, {
    method: 'PATCH',
    token: kitchenToken,
    body: { status: 'ready' },
  });
  check('new -> ready sakrash bloklandi (409)', skip.status === 409, skip.data && skip.data.error);

  for (const status of ['accepted', 'preparing', 'ready']) {
    // eslint-disable-next-line no-await-in-loop
    const r = await req(`/kitchen/orders/${orderId}/status`, {
      method: 'PATCH',
      token: kitchenToken,
      body: { status },
    });
    check(`status -> ${status}`, r.status === 200, r.data && r.data.error);
  }
  await wait(300);
  check('mijoz "order_status_changed" oldi', seen('client', 'order_status_changed'));

  console.log('\n7) Ofitsiant tanlash va rad etish');
  const waiters = await req('/kitchen/waiters', { token: kitchenToken });
  check('ofitsiantlar ro\'yxati', waiters.status === 200 && waiters.data.length > 0, `${waiters.data.length} ta`);
  check(
    'ofitsiant "bo\'sh" ko\'rinadi',
    (waiters.data.find((w) => w.id === waiterId) || {}).status === 'free'
  );

  const assign1 = await req(`/kitchen/orders/${orderId}/assign-waiter`, {
    method: 'PATCH',
    token: kitchenToken,
    body: { waiterId },
  });
  check('ofitsiantga topshirildi', assign1.status === 200, assign1.data && assign1.data.error);
  await wait(300);
  check('ofitsiant "order_assigned" oldi', seen('waiter', 'order_assigned'));

  const waitersBusy = await req('/kitchen/waiters', { token: kitchenToken });
  check(
    'ofitsiant endi "band"',
    (waitersBusy.data.find((w) => w.id === waiterId) || {}).status === 'busy'
  );

  const decline = await req(`/waiter/orders/${orderId}/respond`, {
    method: 'PATCH',
    token: waiterToken,
    body: { accept: false },
  });
  check('ofitsiant rad etdi', decline.status === 200, decline.data && decline.data.error);
  check('buyurtma tayinlanmagan holatga qaytdi', decline.data.assignmentStatus === 'none');
  await wait(200);
  check('oshxona "waiter_response" oldi', seen('kitchen', 'waiter_response'));

  const backInQueue = await req('/kitchen/orders', { token: kitchenToken });
  check(
    'rad etilgan buyurtma oshxona ro\'yxatiga qaytdi',
    backInQueue.data.some((o) => o.id === orderId)
  );

  console.log('\n8) Ofitsiant qabul qilib, yetkazmoqda');
  const assign2 = await req(`/kitchen/orders/${orderId}/assign-waiter`, {
    method: 'PATCH',
    token: kitchenToken,
    body: { waiterId },
  });
  check('qayta topshirildi', assign2.status === 200, assign2.data && assign2.data.error);

  const accept = await req(`/waiter/orders/${orderId}/respond`, {
    method: 'PATCH',
    token: waiterToken,
    body: { accept: true },
  });
  check('ofitsiant qabul qildi', accept.status === 200, accept.data && accept.data.error);
  check('status -> picked_up', accept.data.status === 'picked_up');

  const myOrders = await req('/waiter/orders', { token: waiterToken });
  check('ofitsiant ro\'yxatida ko\'rinadi', myOrders.data.some((o) => o.id === orderId));

  const delivered = await req(`/waiter/orders/${orderId}/status`, {
    method: 'PATCH',
    token: waiterToken,
    body: { status: 'delivered' },
  });
  check('yetkazildi', delivered.status === 200, delivered.data && delivered.data.error);
  check('ofitsiant bo\'shadi', delivered.data.assignedWaiterId === null);

  const tablesNow = await req('/tables/admin', { token: adminToken });
  const thisTable = tablesNow.data.find((t) => t.id === table.id);
  check('stol avtomatik bo\'shadi', thisTable && thisTable.isOccupied === false);

  const waitersFree = await req('/kitchen/waiters', { token: kitchenToken });
  check(
    'ofitsiant yana "bo\'sh"',
    (waitersFree.data.find((w) => w.id === waiterId) || {}).status === 'free'
  );

  console.log('\n9) Bron qilish');
  const reservation = await req('/client/reservations', {
    method: 'POST',
    body: {
      clientName: 'Sinov Bron',
      phone: '+998901234567',
      partySize: 4,
      reservationDate: new Date(Date.now() + 86400000).toISOString(),
      note: 'Deraza yonida',
    },
  });
  check('bron yaratildi', reservation.status === 201, reservation.data && reservation.data.error);
  await wait(200);
  check('oshxona/admin "new_reservation" oldi', seen('kitchen', 'new_reservation'));

  const confirmed = await req(`/kitchen/reservations/${reservation.data.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'confirmed', tableId: table.id },
  });
  check('bron tasdiqlandi va stol tayinlandi', confirmed.status === 200 && confirmed.data.tableId === table.id);

  console.log('\n10) Admin dashboard va ruxsatlar');
  const dashboard = await req('/admin/dashboard', { token: adminToken });
  check('dashboard ma\'lumotlari', dashboard.status === 200 && dashboard.data.kpi, '');

  const forbidden = await req('/admin/dashboard', { token: waiterToken });
  check('ofitsiant admin dashboardga kira olmaydi (403)', forbidden.status === 403);

  const noSlug = await fetch(`${BASE}/api/menu`, { headers: { Host: 'unknown' } });
  check('noma\'lum restoran -> 404', noSlug.status === 404);

  kitchenSocket.close();
  waiterSocket.close();
  clientSocket.close();

  console.log(`\n=== Natija: ${failures === 0 ? 'HAMMASI O\'TDI ✔' : `${failures} ta xato ✘`} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Sinov to\'xtadi:', err);
  process.exit(1);
});
