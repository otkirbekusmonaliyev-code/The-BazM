# Bazm — restoranlar uchun multi-tenant SaaS buyurtma platformasi

Mijoz stoldagi QR kodni skanerlaydi → menyudan tanlaydi → buyurtma beradi →
oshxona real vaqtda ko'radi → tayyor bo'lgach oshpaz bo'sh ofitsiantlardan
birini tanlab unga topshiradi → ofitsiant qabul qilib stolga yetkazadi.

Har bir restoran **o'zining alohida PostgreSQL bazasida** yashaydi
(database-per-tenant), platforma egasi esa ularni bitta Super Admin panelidan
boshqaradi.

---

## Loyiha tarkibi

| Papka | Nima | Port |
|---|---|---|
| `backend/` | Express API + Socket.io + Telegram bot + cron | 4000 |
| `frontend/` | React (Vite) — 5 ta panel bitta ilovada | 5173 |
| `marketing-site/` | Next.js — ochiq, SEO'ga tayyor sayt | 3001 |

### Nega frontend bitta ilova?

Beshta panel (Super Admin, Restoran Admin, Mijoz, Oshpaz, Ofitsiant) — beshta
**alohida dizayn tizimi**, lekin bitta backend, bitta API qatlami va bitta
Socket.io mijozi. Ularni beshta alohida loyihaga bo'lish har bir o'zgarishda
beshta `npm install` va beshta build degani bo'lardi. Shuning uchun ular bitta
Vite ilovasida, marshrut bo'yicha ajratilgan va har biri o'z CSS fayliga ega
(`src/styles/*.css`). Marketing sayti esa **haqiqatan alohida** — chunki unga
SEO uchun server-side rendering kerak (Next.js).

### Marshrutlar

```
/                              YAGONA kirish sahifasi (barcha rollar uchun)
/super-admin                   platforma egasi paneli
/:slug/accept-invite/:token    taklif havolasi — parol o'rnatish
/:slug/admin                   restoran admin paneli
/:slug/kitchen                 oshxona ekrani (planshet)
/:slug/waiter                  ofitsiant paneli (telefon)
/t/:slug/:qrToken              mijoz — QR skanerlagan
/m/:slug                       mijoz — bot orqali, stolni o'zi tanlaydi
```

---

## O'rnatish (Windows / PowerShell)

### 0. Talablar

- Node.js 18+ (sinovdan o'tgan: v22)
- PostgreSQL 14+ ishlab turgan bo'lsin

### 1. Paketlarni o'rnatish

```bash
npm run install:all
```

### 2. Backend sozlamalari

`backend/.env.example` faylini `backend/.env` nomiga ko'chiring va to'ldiring:

```bash
cd backend ; Copy-Item .env.example .env
```

Kalitlarni generatsiya qilish:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Muhim maydonlar:

| O'zgaruvchi | Nima uchun |
|---|---|
| `MASTER_DB_URL` | Platforma bazasi (`platform_master_db`) |
| `PG_ADMIN_USER` / `PG_ADMIN_PASSWORD` | Yangi tenant bazalarini yaratish uchun |
| `JWT_SECRET` | Tokenlarni imzolash (64 hex) |
| `ENCRYPTION_KEY` | Tenant DB parollarini AES-256-GCM bilan shifrlash (**aynan 64 hex belgi**) |
| `APP_URL` | Panellar manzili — QR kod va taklif havolalari shunga ishora qiladi |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_DEV_SLUG` | Dev uchun bitta bot (ixtiyoriy) |
| `QR_TARGET` | `web` (standart) yoki `telegram` — QR mijozni qayerga olib borsin |

### 3. Master bazani tayyorlash

```bash
psql -U postgres -c "CREATE DATABASE platform_master_db;"
```

```bash
cd backend ; npm run db:generate ; npm run master:migrate
```

### 4. Super Admin yaratish

```bash
cd backend ; node scripts/createSuperAdmin.js --name "Ismingiz" --phone +998900000000 --password KuchliParol123
```

### 5. Birinchi restoranni ishga tushirish

```bash
cd backend ; npm run provision -- --name "Delish" --slug delish --adminPhone +998901112233 --adminPassword admin123
```

Bu bitta buyruq: yangi PostgreSQL bazasini yaratadi → barcha jadvallarni
quradi → Master DB'ga yozadi → restoran adminini ochadi.

Sinov ma'lumotlari (menyu, 12 ta stol, oshpaz va 3 ta ofitsiant):

```bash
cd backend ; npm run seed -- --slug delish
```

### 6. Ishga tushirish

Uchta alohida terminalda:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

```bash
npm run dev:marketing
```

Ochish: <http://localhost:5173> (panellar), <http://localhost:3001> (sayt).

---

## Kirish ma'lumotlari

Login sahifalarida **`+998` doimiy prefiks** sifatida maydon ichida turadi —
faqat 9 ta raqamni terasiz (masalan `94 109 33 50`).

| Rol | Telefon (terilishi) | Parol | Manzil |
|---|---|---|---|
| Super Admin | `94 109 33 50` | `admin!!@@` | `/super-admin` |
| Restoran admin | `90 111 22 33` | `admin123` | `/delish/admin` |
| Oshpaz | `90 777 88 99` | `oshpaz123` | `/delish/kitchen` |
| Ofitsiant (Malika) | `90 999 88 77` | `ofitsiant123` | `/delish/waiter` |
| Ofitsiant (Jasur) | `90 999 88 66` | `ofitsiant123` | `/delish/waiter` |
| Ofitsiant (Nodira) | `90 999 88 55` | `ofitsiant123` | `/delish/waiter` |
| Mijoz | parol yo'q — QR yoki bot orqali | — | `/t/delish/<qrToken>` yoki `/m/delish` |

Butun platformada **bitta kirish sahifasi** bor — `/`. Alohida "xodim
kirishi" sahifasi yo'q va rol tanlanmaydi: telefon raqami kimga tegishli
ekanini server o'zi aniqlab, kerakli panelga yo'naltiradi.

Kirish sahifasining chap tomonida ish joyini tanlash mumkin: avval turi
(restoran yoki kafe), so'ng nomi bo'yicha qidiruv. Tanlansa, kirish o'sha
muassasa doirasida tekshiriladi. Tanlanmasa ham bo'ladi — u holda tizim
raqamdan kelib chiqib o'zi topadi (platforma egasi shu yo'ldan kiradi).

Parolni unutsangiz:

```bash
cd backend ; npm run set-password -- --slug delish --phone +998901112233 --password YangiParol
```

---

## Avtomatik sinovlar

Server ishlab turgan holda:

```bash
cd backend ; npm test
```

Uchta to'plam ishlaydi:

1. **`test:flow`** — uchdan-uchgacha oqim: mijoz stol tanlaydi → buyurtma beradi →
   oshxona bosqichma-bosqich tayyorlaydi → ofitsiantga topshiradi → ofitsiant
   rad etadi → qaytadan topshiriladi → qabul qiladi → yetkazadi. Har bir
   qadamda Socket.io hodisalari ham tekshiriladi.
2. **`test:edge`** — chekka holatlar: taklif havolasi, tugagan taom, 15 daqiqalik
   avtomatik stol bo'shatish, ofitsiantlar o'rtasidagi chegara, obuna
   to'xtatilganda 403.
3. **`test:bot`** — Telegram bot: soxta `update` obyektlari bilan butun suhbat
   (bosh menyu, QR deep link, stol band qilish, bosqichma-bosqich bron)
   haqiqiy Telegramsiz sinaladi.

`test:edge` ichida ruxsatlar chegarasi ham tekshiriladi: super admin tokeni
tenant yo'lida, mijoz tokeni admin yo'lida, bir restoran tokeni boshqasida —
hammasi `403` bilan rad etilishi shart. Shuningdek ma'lumot yaxlitligi:
sotilgan taomni yoki buyurtmasi bor stolni o'chirib bo'lmasligi.

---

## Arxitektura

### Database-per-tenant

```
platform_master_db          delish_db              boshqa_restoran_db
├─ SuperAdmin               ├─ User                ├─ User
├─ RestaurantApplication    ├─ RestaurantTable     ├─ RestaurantTable
├─ Restaurant  ────────────►├─ MenuCategory        ├─ MenuCategory
│  (ulanish ma'lumoti,      ├─ MenuItem            ├─ MenuItem
│   parol shifrlangan)      ├─ Order               ├─ Order
└─ BillingRecord            └─ TableReservation    └─ TableReservation
```

Har bir so'rovda `X-Restaurant-Slug` header (yoki production'da subdomain)
orqali qaysi restoran ekanligi aniqlanadi → Master DB'dan ulanish ma'lumoti
olinadi → tegishli Prisma client (xotirada `Map<slug, PrismaClient>` sifatida
keshlangan) orqali so'rov bajariladi. Tenant jadvallarida `restaurant_id`
ustuni **yo'q** — baza o'zi allaqachon bitta restoranga tegishli.

Obuna `suspended` bo'lsa, `tenantResolver` barcha so'rovlarni `403` bilan
rad etadi va keshdagi ulanish yopiladi.

### Buyurtma holatlari

```
kitchen:  new → accepted → preparing → ready
          ready + assign-waiter → assignmentStatus=pending (status o'zgarmaydi)
waiter:   pending → (qabul) → assignmentStatus=accepted + status=picked_up
          pending → (rad)   → assignmentStatus=none, assignedWaiterId=null
          picked_up → delivered
admin:    istalgan bosqichdan → cancelled;  delivered → paid
```

Ruxsat etilmagan o'tish `409 Conflict` bilan **backend darajasida** bloklanadi
(`src/utils/orderStatus.js`), frontend esa joriy holatga mos faqat bitta
keyingi tugmani chizadi — orqaga qaytish tugmasi umuman yo'q.

Ofitsiantning "band / bo'sh" holati hech qayerda saqlanmaydi — u har doim
buyurtmalardan hisoblab chiqariladi (`src/services/waiters.js`), shuning uchun
server qayta ishga tushsa ham holat hech qachon haqiqatdan chetlab qolmaydi.

### Real-time xonalar (Socket.io)

| Xona | Kim | Nimani oladi |
|---|---|---|
| `{slug}_kitchen` | oshpaz, admin | `new_order`, `order_ready`, `waiter_response`, `waiter_status_changed`, `new_reservation`, `table_claimed` |
| `{slug}_waiters` | ofitsiantlar, admin | `table_claimed`, `waiter_called` |
| `{slug}_waiter_{userId}` | bitta ofitsiant | `order_assigned`, `assignment_revoked` |
| `{slug}_table_{tableId}` | mijoz | `order_status_changed` |

Aloqa uzilganda Socket.io o'zi qayta ulanadi, ulangach har bir panel
ro'yxatini to'liq qayta yuklaydi — o'tkazib yuborilgan hodisalar shu bilan
qoplanadi.

### Fon vazifalari

`src/jobs/tableReleaseJob.js` har daqiqada barcha restoranlarni tekshiradi:
15 daqiqadan beri band, lekin **hech qanday faol buyurtmasi yo'q** stollarni
avtomatik bo'shatadi va real-time xabar yuboradi.

### Telegram bot

Har bir restoran o'z botiga ega bo'lishi mumkin (`Restaurant.telegramBotToken`).
Server ishga tushganda `botManager` barcha tokenlarni yig'ib, har biri uchun
alohida Telegraf instansiyasini ko'taradi. Token bo'lmasa — bu qism umuman
ishga tushmaydi, server bemalol ishlaydi.

Bot bazaga to'g'ridan-to'g'ri emas, o'z backend'imizning HTTP API'si orqali
murojaat qiladi — shu bilan barcha tekshiruvlar bitta joyda, controller'larda
qoladi.

Bot o'zbekcha va ruscha ishlaydi (til birinchi kirishda tanlanadi), menyuni
o'zi ko'rsata oladi, bo'sh stolni band qiladi, buyurtma holatini aytadi va
bron qilishni bosqichma-bosqich — tugmalar va "kontaktni ulashish" orqali —
o'tkazadi.

**MUHIM:** Telegram Mini App tugmasi FAQAT `https` manzil bilan ishlaydi va
`localhost` manzilini umuman qabul qilmaydi (`Wrong HTTP URL`). Shuning uchun
development'da bot havolani tugma emas, **matn** ko'rinishida beradi — bu
kutilgan xatti-harakat. Haqiqiy tugma uchun `APP_URL` ni https manzilga
qo'ying (domen olguningizcha `ngrok http 5173` yoki `cloudflared tunnel`
yetarli).

---

## Dizayn tizimlari

Har bir interfeys **ataylab boshqacha**, chunki har birining muhiti boshqacha:

| Panel | Uslub | CSS |
|---|---|---|
| Super Admin | "Bazm Control" — sovuq, texnik, zich | `styles/bazm.css` |
| Restoran Admin | "Delish Admin" — iliq, oltin, CRM tuzilishida | `styles/delish-admin.css` |
| Mijoz | "Delish Menu" — elegant, fine-dining, Fraunces | `styles/client.css` |
| Oshpaz | "Kitchen Display" — sof qora, 64px+ tugmalar, katta shrift | `styles/kitchen.css` |
| Ofitsiant | "Waiter Mobile" — bitta ustun, katta stol raqami | `styles/waiter.css` |

Umumiy `.btn`, `.field`, `.status-badge` klasslari faqat CSS o'zgaruvchilarga
tayanadi, shuning uchun har bir panel o'z palitrasini e'lon qilishi kifoya.

**Tungi/kunduzgi rejim** barcha panellarda bor (`localStorage`da saqlanadi).
**Oshpaz paneli bundan mustasno — u doim qorong'i**: bu funksional talab,
oshxonada yorqin fon ko'zni charchatadi va kontrastni pasaytiradi.

Kunduzgi rejimda aksent ranglar ataylab to'qlashadi (`--gold` `#c6a05c` →
`#8a6420`): yorqin oltin oq fonda 2.5:1 kontrast beradi, ya'ni o'qib
bo'lmaydi. Aksent bilan to'ldirilgan tugmalar ustidagi matn esa
`--on-accent` orqali qorong'idan oqqa o'tadi. Shu sababli har bir mavzu
faqat shu ikki o'zgaruvchini qayta e'lon qiladi — qolgan CSS o'zgarmaydi.

**3D elementlar** (Three.js): Super Admin dashboardida restoranlar tarmog'i,
Restoran Admin dashboardida aylanuvchi taom shakllari, marketing hero'sida
ikosaedrlar klasteri. Hammasi past-poly, dekorativ (`pointer-events: none`),
ekrandan chiqqanda animatsiya to'xtaydi, WebGL bo'lmasa gradient fon bilan
almashadi. Three.js alohida bo'lakka ajratilgan — mijozning Mini App'i uni
umuman yuklab olmaydi (asosiy paket 95 KB gzip).

---

## Marketing sayti

Alohida Next.js loyihasi, **login talab qilmaydi**. Barcha matn server
tomonida render qilinadi — JavaScript o'chirilgan holatda ham sarlavhalar,
narxlar va FAQ javoblari HTML'da bo'ladi.

- `/` — o'zbekcha, `/ru` — ruscha (alohida marshrutlar, `hreflang` bilan)
- `/sorov` — qo'shilish so'rovi formasi (`?plan=standard` bilan tarif oldindan tanlanadi)
- `sitemap.xml`, `robots.txt`, JSON-LD (SoftwareApplication + FAQPage)

Forma `POST /api/public/apply` ga yuboradi → Master DB'dagi
`RestaurantApplication` yozuvi yaratiladi → Super Admin panelida ko'rinadi →
**Tasdiqlash** bosilganda restoran avtomatik provision qilinadi (baza +
jadvallar + admin hisobi) va kirish ma'lumotlari ekranda ko'rsatiladi.

Viloyat/shahar ro'yxati backend'dan (`GET /api/public/regions`) olinadi —
bitta manba, ikki joyda ishlatilmaydi.

---

## API xulosasi

| Prefiks | Kim | Muhim endpointlar |
|---|---|---|
| `/api/public` | hamma | `POST /apply`, `GET /plans`, `GET /regions`, `GET /stats` |
| `/api/super-admin` | super_admin | `POST /login`, `GET/POST /restaurants`, `PATCH /:id/suspend\|activate`, `GET /applications`, `POST /applications/:id/approve` |
| `/api/auth` | tenant | `POST /login`, `POST /accept-invite/:token` |
| `/api/admin` | admin | `GET /dashboard`, `GET /orders`, `PATCH /orders/:id/status` |
| `/api/staff` | admin | `POST /invite`, `GET /`, `GET /invites`, `PATCH /:id` |
| `/api/menu` | ochiq / admin | `GET /`, `GET /admin`, kategoriya va taom CRUD, `PATCH /admin/items/:id/toggle-availability` |
| `/api/tables` | xodimlar | `GET /admin`, `POST /admin`, `POST /admin/bulk`, `GET /admin/:id/qr-code`, `PATCH /admin/:id/release` |
| `/api/client` | mijoz | `POST /session`, `GET /tables/available`, `POST /tables/:id/claim`, `POST /orders`, `GET /orders`, `PATCH /orders/:id/cancel`, `POST /call-waiter`, `POST /reservations` |
| `/api/kitchen` | oshpaz, admin | `GET /orders`, `PATCH /orders/:id/status`, `GET /waiters`, `PATCH /orders/:id/assign-waiter`, `GET/PATCH /reservations` |
| `/api/waiter` | ofitsiant, admin | `GET /orders`, `PATCH /orders/:id/respond`, `PATCH /orders/:id/status` |
| `/api/uploads` | admin | `POST /image` (taom rasmi, 5 MB) |

Tenant endpointlari `X-Restaurant-Slug` header talab qiladi (production'da
subdomain ham ishlaydi).

---

## Foydali buyruqlar

```bash
cd backend ; npm run tenant:sync
```
Tenant sxemasi o'zgargach, uni **barcha** mavjud restoran bazalariga yoyadi.

```bash
cd backend ; npm run provision -- --name "Yangi Kafe" --adminPhone +998911112233
```
Yangi restoran (slug nomdan avtomatik yasaladi, parol avtomatik generatsiya
qilinadi).

```bash
cd backend ; npm run seed -- --slug yangi-kafe --tables 20
```

---

## Production'ga chiqarish (qisqacha)

1. VPS'da PostgreSQL va Node.js o'rnating
2. `backend/.env` da `APP_URL` va `MARKETING_URL` ni haqiqiy domenlarga o'zgartiring
3. `npm --prefix frontend run build` → `frontend/dist` ni Nginx orqali tarqating
   (SPA fallback: barcha yo'llar `index.html` ga)
4. `npm --prefix marketing-site run build` → `npm --prefix marketing-site start`
5. Backend'ni `pm2` yoki `systemd` bilan doimiy ishlatib turing
6. Nginx: `bazm.uz` → marketing sayti, `app.bazm.uz` → frontend,
   `api.bazm.uz` → backend (yoki `/api` ni proxy qiling); `/socket.io` uchun
   WebSocket upgrade sarlavhalarini o'tkazing
7. `QR_TARGET=telegram` qo'ysangiz, QR kodlar bot deep-link'iga ishora qiladi
   (Mini App faqat HTTPS bilan ishlaydi)

---

## MVP doirasidan tashqarida (ataylab qilinmagan)

- To'lov integratsiyasi (Click/Payme) — kod ichida joy qoldirilgan
  (`BillingRecord` modeli, tarif narxlari `services/provisioning.js` da)
- SMS-shlyuz — taklif havolasi hozircha adminga qaytariladi, u xodimga o'zi uzatadi
- Mijoz hisob tarixi, xodimlar smenasi, murakkab analitika, mobil native ilova
- Google Places API — so'rov formasida hozircha oddiy matn maydoni
