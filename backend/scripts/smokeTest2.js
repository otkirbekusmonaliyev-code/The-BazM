// Ikkinchi sinov to'plami: chekka holatlar.
//   - obuna to'xtatilganda kirish bloklanadi
//   - 15 daqiqalik avtomatik stol bo'shatish
//   - xodim taklifi -> parol o'rnatish -> login
//   - tugagan taomni buyurtma qilib bo'lmaydi
//   - ofitsiant boshqa ofitsiantning buyurtmasiga tegolmaydi
//
// Server ishlab turgan holda:  node scripts/smokeTest2.js

require('dotenv').config();
const bcrypt = require('bcrypt');
const { requireTenant } = require('./lib/requireTenant');
const masterPrisma = require('../src/config/masterDb');
const { getTenantClient, invalidateTenantClient } = require('../src/config/tenantDb');
const { releaseIdleTablesFor, IDLE_MINUTES } = require('../src/jobs/tableReleaseJob');

const BASE = `http://127.0.0.1:${process.env.PORT || 4000}`;
const SLUG = 'delish';
let failures = 0;

function check(label, ok, extra = '') {
  console.log(`${ok ? '  ✔' : '  ✘'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
}

async function req(path, { method = 'GET', body, token, slug = SLUG } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Restaurant-Slug': slug,
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

async function main() {
  await requireTenant(SLUG);

  console.log('\n=== Chekka holatlar sinovi ===\n');

  const db = await getTenantClient(SLUG);

  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: { phone: '+998901112233', password: 'admin123' },
  });
  check('admin login', adminLogin.status === 200);
  const adminToken = adminLogin.data.token;

  // ---------- 1) Xodim taklifi ----------
  console.log('1) Xodim taklif qilish oqimi');
  const testPhone = '+99890' + Math.floor(1000000 + Math.random() * 8999999);
  const invite = await req('/staff/invite', {
    method: 'POST',
    token: adminToken,
    body: { fullName: 'Sinov Ofitsiant', phone: testPhone, role: 'waiter' },
  });
  check('taklif yaratildi', invite.status === 201, invite.data && invite.data.error);
  const inviteToken = invite.data.inviteLink.split('/').pop();

  const accepted = await req(`/auth/accept-invite/${inviteToken}`, {
    method: 'POST',
    body: { password: 'sinov123' },
  });
  check('taklif qabul qilindi, hisob ochildi', accepted.status === 201 || accepted.status === 200, accepted.data && accepted.data.error);

  const reuse = await req(`/auth/accept-invite/${inviteToken}`, {
    method: 'POST',
    body: { password: 'sinov123' },
  });
  check('bir taklifni ikki marta ishlatib bo\'lmaydi', reuse.status === 400);

  const newLogin = await req('/auth/login', {
    method: 'POST',
    body: { phone: testPhone, password: 'sinov123' },
  });
  check('yangi xodim login qila oladi', newLogin.status === 200, newLogin.data && newLogin.data.error);
  const newWaiterToken = newLogin.data.token;

  // ---------- 2) Tugagan taom ----------
  console.log('\n2) Tugagan taomni buyurtma qilish');
  const menu = await req('/menu');
  const someItem = menu.data[0].items[0];
  await req(`/menu/admin/items/${someItem.id}/toggle-availability`, { method: 'PATCH', token: adminToken });

  const free = await req('/client/tables/available');
  const table = free.data[0];
  const claim = await req(`/client/tables/${table.id}/claim`, {
    method: 'POST',
    body: { clientName: 'Chekka Sinov' },
  });
  const clientToken = claim.data.token;

  const blocked = await req('/client/orders', {
    method: 'POST',
    token: clientToken,
    body: { items: [{ menuItemId: someItem.id, quantity: 1 }] },
  });
  check('tugagan taom -> 409', blocked.status === 409, blocked.data && blocked.data.error);
  check(
    'xato javobida taom nomi bor',
    !!(blocked.data && blocked.data.unavailableItems && blocked.data.unavailableItems.length)
  );

  await req(`/menu/admin/items/${someItem.id}/toggle-availability`, { method: 'PATCH', token: adminToken });

  // ---------- 3) 15 daqiqalik avtomatik bo'shatish ----------
  console.log('\n3) Bo\'sh stolni avtomatik tozalash');
  const before = await db.restaurantTable.findUnique({ where: { id: table.id } });
  check('stol band', before.isOccupied === true);

  // Vaqtni orqaga surib, cron mantiqini darhol sinaymiz
  await db.restaurantTable.update({
    where: { id: table.id },
    data: { occupiedAt: new Date(Date.now() - (IDLE_MINUTES + 1) * 60 * 1000) },
  });
  const restaurant = await masterPrisma.restaurant.findUnique({ where: { slug: SLUG } });
  const releasedCount = await releaseIdleTablesFor(restaurant);
  const after = await db.restaurantTable.findUnique({ where: { id: table.id } });
  check(`${IDLE_MINUTES} daqiqadan keyin stol bo'shadi`, after.isOccupied === false, `${releasedCount} ta`);

  // Faol buyurtmasi bor stol bo'shatilmasligi kerak
  const table2 = (await req('/client/tables/available')).data[0];
  const claim2 = await req(`/client/tables/${table2.id}/claim`, {
    method: 'POST',
    body: { clientName: 'Buyurtmali Mijoz' },
  });
  const menu2 = await req('/menu');
  const item2 = menu2.data[0].items.find((i) => i.isAvailable);
  const order2 = await req('/client/orders', {
    method: 'POST',
    token: claim2.data.token,
    body: { items: [{ menuItemId: item2.id, quantity: 1 }] },
  });
  await db.restaurantTable.update({
    where: { id: table2.id },
    data: { occupiedAt: new Date(Date.now() - (IDLE_MINUTES + 1) * 60 * 1000) },
  });
  await releaseIdleTablesFor(restaurant);
  const table2After = await db.restaurantTable.findUnique({ where: { id: table2.id } });
  check('faol buyurtmali stol bo\'shatilmaydi', table2After.isOccupied === true);

  // ---------- 4) Ofitsiantlar bir-birining buyurtmasiga tegolmaydi ----------
  console.log('\n4) Ofitsiantlar o\'rtasidagi chegara');
  const kitchenLogin = await req('/auth/login', {
    method: 'POST',
    body: { phone: '+998907778899', password: 'oshpaz123' },
  });
  const kitchenToken = kitchenLogin.data.token;
  const orderId = order2.data.id;
  for (const status of ['accepted', 'preparing', 'ready']) {
    // eslint-disable-next-line no-await-in-loop
    await req(`/kitchen/orders/${orderId}/status`, { method: 'PATCH', token: kitchenToken, body: { status } });
  }

  const waiters = await req('/kitchen/waiters', { token: kitchenToken });
  const target = waiters.data.find((w) => w.status === 'free' && w.phone !== testPhone);
  await req(`/kitchen/orders/${orderId}/assign-waiter`, {
    method: 'PATCH',
    token: kitchenToken,
    body: { waiterId: target.id },
  });

  const intruder = await req(`/waiter/orders/${orderId}/respond`, {
    method: 'PATCH',
    token: newWaiterToken,
    body: { accept: true },
  });
  check('begona ofitsiant javob berolmaydi -> 403', intruder.status === 403, intruder.data && intruder.data.error);

  const busyAssign = await req(`/kitchen/orders/${orderId}/assign-waiter`, {
    method: 'PATCH',
    token: kitchenToken,
    body: { waiterId: target.id },
  });
  check('band ofitsiantga qayta topshirish -> 409', busyAssign.status === 409, busyAssign.data && busyAssign.data.error);

  // Tozalash: buyurtmani yopamiz
  await req(`/admin/orders/${orderId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'cancelled' } });

  // ---------- 5) Obuna to'xtatilganda ----------
  console.log('\n5) Obuna to\'xtatilganda kirish bloklanadi');
  // Sinov O'Z super adminini yaratadi va oxirida o'chiradi.
  //
  // Avval bu yerda seed'dagi qat'iy raqam va parol yozilgan edi — platforma
  // tozalanganda o'sha hisob yo'qolib, sinovlar tushunarsiz yiqilardi.
  // Bundan tashqari haqiqiy egasining parolini sinov faylida saqlash
  // (u GitHub'da turadi) to'g'ri emas.
  const TEST_SUPER_PHONE = '+998000000001';
  const TEST_SUPER_PASS = `sinov${Date.now()}`;
  await masterPrisma.superAdmin.upsert({
    where: { phone: TEST_SUPER_PHONE },
    update: { passwordHash: await bcrypt.hash(TEST_SUPER_PASS, 10) },
    create: {
      phone: TEST_SUPER_PHONE,
      fullName: 'Sinov super admin',
      passwordHash: await bcrypt.hash(TEST_SUPER_PASS, 10),
    },
  });

  const superLogin = await req('/super-admin/login', {
    method: 'POST',
    body: { phone: TEST_SUPER_PHONE, password: TEST_SUPER_PASS },
    slug: '',
  });
  const superToken = superLogin.data && superLogin.data.token;
  check('sinov super admini kirdi', !!superToken, superLogin.data && superLogin.data.error);
  const restaurantRow = await masterPrisma.restaurant.findUnique({ where: { slug: SLUG } });

  await req(`/super-admin/restaurants/${restaurantRow.id}/suspend`, { method: 'PATCH', token: superToken });
  const blockedMenu = await req('/menu');
  check('suspended -> menyu 403', blockedMenu.status === 403, blockedMenu.data && blockedMenu.data.error);
  const blockedLogin = await req('/auth/login', {
    method: 'POST',
    body: { phone: '+998901112233', password: 'admin123' },
  });
  check('suspended -> login 403', blockedLogin.status === 403);

  await req(`/super-admin/restaurants/${restaurantRow.id}/activate`, { method: 'PATCH', token: superToken });
  invalidateTenantClient(SLUG);
  const restored = await req('/menu');
  check('faollashtirgach yana ishlaydi', restored.status === 200);

  // ---------- 6) Rollar orasidagi chegaralar ----------
  console.log("");
  console.log("6) Ruxsatlar chegarasi");
  const clientToken2 = claim2.data.token;
  const boundary = [
    ["super admin tokeni tenant yolida", "/staff", superToken, SLUG, 403],
    ["mijoz tokeni admin yolida", "/staff", clientToken2, SLUG, 403],
    ["ofitsiant admin dashboardida", "/admin/dashboard", newWaiterToken, SLUG, 403],
    ["tokensiz admin yoli", "/staff", null, SLUG, 401],
    ["buzilgan token", "/staff", "aaa.bbb.ccc", SLUG, 401],
    ["admin tokeni super-admin yolida", "/super-admin/restaurants", adminToken, SLUG, 403],
    ["admin oz yolida", "/staff", adminToken, SLUG, 200],
  ];
  for (const [label, path, token, slug, want] of boundary) {
    // eslint-disable-next-line no-await-in-loop
    const r = await req(path, { token, slug });
    check(`${label} -> ${want}`, r.status === want, `keldi ${r.status}`);
  }

  // Bir restoran tokeni boshqasida ishlamasligi kerak
  const others = await masterPrisma.restaurant.findMany({
    where: { slug: { not: SLUG }, subscriptionStatus: { in: ["trial", "active"] } },
    take: 1,
  });
  if (others.length > 0) {
    const cross = await req("/staff", { token: adminToken, slug: others[0].slug });
    check("bir restoran tokeni boshqasida -> 403", cross.status === 403, `keldi ${cross.status}`);
  }

  // ---------- 7) Malumot yaxlitligi ----------
  console.log("");
  console.log("7) Malumot yaxlitligini himoya qilish");
  const menuNow = await req("/menu");
  const soldItem = menuNow.data.flatMap((c) => c.items)[0];
  const delSold = await req(`/menu/admin/items/${soldItem.id}`, { method: "DELETE", token: adminToken });
  check(
    "sotilgan taomni ochirib bolmaydi -> 409",
    delSold.status === 409,
    delSold.data && delSold.data.error ? delSold.data.error.slice(0, 45) : ""
  );

  const fresh = await req("/menu/admin/items", {
    method: "POST",
    token: adminToken,
    body: { categoryId: menuNow.data[0].id, name: "Vaqtinchalik taom", price: 5000 },
  });
  const delFresh = await req(`/menu/admin/items/${fresh.data.id}`, { method: "DELETE", token: adminToken });
  check("sotilmagan taom ochadi -> 204", delFresh.status === 204);

  const busyTable = await req(`/tables/admin/${table2.id}`, { method: "DELETE", token: adminToken });
  check("buyurtmasi bor stolni ochirib bolmaydi -> 409", busyTable.status === 409);

  // ---------- 8) Taklif havolasi kimga tegishli ekanini ko'rsatadi ----------
  console.log("");
  console.log("8) Taklif havolasi tafsilotlari");
  const invitePhone = "+99893" + Math.floor(1000000 + Math.random() * 8999999);
  await db.user.deleteMany({ where: { phone: invitePhone } });
  await db.staffInvite.deleteMany({ where: { phone: invitePhone } });

  const inv2 = await req("/staff/invite", {
    method: "POST",
    token: adminToken,
    body: { fullName: "Sinov Oshpaz", phone: invitePhone, role: "kitchen" },
  });
  const inviteToken2 = inv2.data.inviteLink.split("/").pop();

  const peek = await req(`/auth/accept-invite/${inviteToken2}`);
  check("havola tafsilotlari ochiladi", peek.status === 200, `keldi ${peek.status}`);
  check("taklifdagi telefon qaytadi", peek.data && peek.data.phone === invitePhone);
  check("taklifdagi rol qaytadi", peek.data && peek.data.role === "kitchen");

  const badPeek = await req("/auth/accept-invite/yoqbundaytoken");
  check("yaroqsiz havola -> 404", badPeek.status === 404);

  await req(`/auth/accept-invite/${inviteToken2}`, { method: "POST", body: { password: "sinov456" } });
  const usedPeek = await req(`/auth/accept-invite/${inviteToken2}`);
  check("ishlatilgan havola -> 404", usedPeek.status === 404);

  const invitedLogin = await req("/auth/login", {
    method: "POST",
    body: { phone: invitePhone, password: "sinov456" },
  });
  check(
    "taklifdagi raqam bilan login ishlaydi",
    invitedLogin.status === 200 && invitedLogin.data.user.phone === invitePhone,
    invitedLogin.data && invitedLogin.data.error
  );
  const invitedToken = invitedLogin.data.token;
  const invitedId = invitedLogin.data.user.id;

  // ---------- 9) Hisob ochirilsa/roli ozgarsa eski token kuchini yoqotadi ----------
  console.log("");
  console.log("9) Eski tokenni bekor qilish");
  const beforeOff = await req("/kitchen/orders", { token: invitedToken });
  check("oshpaz oz royxatini koradi", beforeOff.status === 200);

  await req(`/staff/${invitedId}`, { method: "PATCH", token: adminToken, body: { isActive: false } });
  const afterOff = await req("/kitchen/orders", { token: invitedToken });
  check("hisob ochirilgach eski token -> 401", afterOff.status === 401, afterOff.data && afterOff.data.code);

  await req(`/staff/${invitedId}`, {
    method: "PATCH",
    token: adminToken,
    body: { isActive: true, role: "waiter" },
  });
  const afterRole = await req("/kitchen/orders", { token: invitedToken });
  check("rol ozgargach eski token -> 401", afterRole.status === 401, afterRole.data && afterRole.data.code);

  await db.user.deleteMany({ where: { phone: invitePhone } });

  // Sinov xodimini o'chirib qo'yamiz — ro'yxatni chulg'amasin
  await db.user.deleteMany({ where: { phone: testPhone } });

  // Sinov super adminini ham ortidan tozalaymiz
  await masterPrisma.superAdmin.deleteMany({ where: { phone: TEST_SUPER_PHONE } });

  console.log(`\n=== Natija: ${failures === 0 ? 'HAMMASI O\'TDI ✔' : `${failures} ta xato ✘`} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Sinov to\'xtadi:', err);
  process.exit(1);
});
