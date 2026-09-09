// Telegram botini HAQIQIY Telegramsiz sinash.
//
// Telegraf'ning `bot.handleUpdate()` metodiga soxta "update" obyektlari
// beriladi, Telegram'ga chiqadigan chaqiruvlar esa ushlab qolinadi —
// shu bilan bot qanday javob yuborishini va qaysi tugmalarni chizishini
// tekshira olamiz. Bot serverning HTTP API'siga murojaat qiladi,
// shuning uchun server ishlab turgan bo'lishi kerak.
//
//   node scripts/botTest.js

require('dotenv').config();
const { requireTenant } = require('./lib/requireTenant');
const { Telegram } = require('telegraf');
const { createRestaurantBot } = require('../src/bot/restaurantBot');
const { getTenantClient } = require('../src/config/tenantDb');

const SLUG = process.env.TELEGRAM_DEV_SLUG || 'delish';
const PORT = process.env.PORT || 4000;

let failures = 0;
let updateId = 1;
let messageId = 100;

function check(label, ok, extra = '') {
  console.log(`${ok ? '  ✔' : '  ✘'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
}

// DIQQAT: Telegraf har bir update uchun YANGI `Telegram` obyektini yaratadi
// (webhook-reply'ni qo'llab-quvvatlash uchun), shuning uchun bitta instansiyani
// almashtirish yetarli emas — prototipdagi callApi'ni ushlab qolamiz.
let sink = [];
Telegram.prototype.callApi = async function stubbedCallApi(method, payload = {}) {
  sink.push({ method, payload });
  if (method === 'sendMessage' || method === 'editMessageText') {
    return { message_id: (messageId += 1), text: payload.text };
  }
  return true;
};

// Har bir sinov o'z foydalanuvchisi bilan ishlaydi — sessiyalar aralashmasin
let seq = 0;
function newUser() {
  seq += 1;
  return {
    chat: { id: 555000 + seq, type: 'private' },
    user: { id: 666000 + seq, is_bot: false, first_name: 'Dilnoza', username: 'dilnoza_test' },
  };
}

function makeBot() {
  sink = [];
  const bot = createRestaurantBot({ token: '1:FAKE', slug: SLUG, name: 'Delish' });
  // Telegraf getMe chaqirmasligi uchun bot ma'lumotini oldindan beramiz
  bot.botInfo = { id: 1, is_bot: true, first_name: 'Test', username: 'test_bot' };
  return bot;
}

const textUpdate = (who, text) => ({
  update_id: (updateId += 1),
  message: {
    message_id: (messageId += 1),
    date: Math.floor(Date.now() / 1000),
    chat: who.chat,
    from: who.user,
    text,
    ...(text.startsWith('/')
      ? { entities: [{ offset: 0, length: text.split(' ')[0].length, type: 'bot_command' }] }
      : {}),
  },
});

const contactUpdate = (who, phone) => ({
  update_id: (updateId += 1),
  message: {
    message_id: (messageId += 1),
    date: Math.floor(Date.now() / 1000),
    chat: who.chat,
    from: who.user,
    contact: { phone_number: phone, first_name: who.user.first_name, user_id: who.user.id },
  },
});

const callbackUpdate = (who, data) => ({
  update_id: (updateId += 1),
  callback_query: {
    id: String(updateId),
    from: who.user,
    chat_instance: 'test',
    data,
    message: {
      message_id: (messageId += 1),
      date: Math.floor(Date.now() / 1000),
      chat: who.chat,
      from: { id: 1, is_bot: true, first_name: 'Test' },
      text: '…',
    },
  },
});

// Oxirgi ko'rsatilgan ekran. Bot tugma bosilganda YANGI xabar yubormay,
// mavjudini tahrirlaydi — shuning uchun ikkala metod ham hisobga olinadi.
function lastScreen() {
  const shown = sink.filter((s) => s.method === 'sendMessage' || s.method === 'editMessageText');
  const last = shown[shown.length - 1];
  if (!last) return { text: '', buttons: [], keyboard: [] };
  const markup = last.payload.reply_markup || {};
  const rows = markup.inline_keyboard || [];
  return {
    text: last.payload.text || '',
    buttons: rows.flat().map((b) => ({
      text: b.text,
      data: b.callback_data,
      url: b.url || (b.web_app && b.web_app.url),
    })),
    keyboard: (markup.keyboard || []).flat().map((b) => (typeof b === 'string' ? b : b.text)),
  };
}

const firstLine = (s) => (s || '').split('\n')[0];
const btn = (screen, data) => screen.buttons.find((b) => b.data === data);

// Sinov yaratgan mijozlar — oxirida tozalanadi
const registeredIds = [];

// Bot endi ishlashdan oldin kontakt so'raydi. Ko'p sinovlar aynan
// ro'yxatdan o'tgan mijozni tekshiradi, shuning uchun butun yo'l
// (start -> til -> kontakt) bitta yordamchiga yig'ildi.
async function register(bot, who, phone) {
  await bot.handleUpdate(textUpdate(who, '/start'));
  await bot.handleUpdate(callbackUpdate(who, 'set_lang_uz'));
  await bot.handleUpdate(contactUpdate(who, phone || `+99890${String(who.user.id).slice(-7)}`));
  registeredIds.push(String(who.user.id));
}

async function main() {
  await requireTenant(SLUG);

  console.log(`\n=== Telegram bot sinovi (${SLUG}) ===\n`);

  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    if (!res.ok) throw new Error('health ' + res.status);
  } catch (_) {
    console.error('❌ Backend server ishlamayapti. Avval `npm run dev` bilan ishga tushiring.\n');
    process.exit(1);
  }

  const db = await getTenantClient(SLUG);

  // ---------- 1) Birinchi /start — til, so'ng ro'yxatdan o'tish ----------
  console.log('1) /start — til so\'raladi, so\'ng kontakt');
  const me = newUser();
  const bot = makeBot();
  {
    await bot.handleUpdate(textUpdate(me, '/start'));
    const s = lastScreen();
    check('salomlashdi', s.text.includes('xush kelibsiz'), firstLine(s.text));
    check('til tanlovi taklif qilindi', !!btn(s, 'set_lang_uz') && !!btn(s, 'set_lang_ru'));

    await bot.handleUpdate(callbackUpdate(me, 'set_lang_uz'));
    const m = lastScreen();
    check('til tanlangach kontakt so\'raldi', m.text.includes('tanishib olamiz'), firstLine(m.text));
    check('kontakt tugmasi berildi', m.keyboard.some((k) => k.includes('Raqamimni yuborish')), m.keyboard.join(' | '));
    check('namuna menyu tugmasi ham bor', m.keyboard.some((k) => k.includes('Namuna')));
    check('"nega kerak" tugmasi bor', m.keyboard.some((k) => k.includes('Nega')));
    check('bosh menyu HALI ko\'rsatilmadi', !btn(m, 'pick_table'));
  }

  // ---------- 2) Raqam bermaganda nima bo'ladi ----------
  console.log('\n2) Raqam bermaganda — tushuntiriladi, boshi berk ko\'cha yo\'q');
  {
    // Oddiy matn — bot jim qolmaydi, qayta so'raydi
    await bot.handleUpdate(textUpdate(me, 'salom'));
    check('javobsiz qolmadi', lastScreen().text.includes('tanishib olamiz'), firstLine(lastScreen().text));

    // "Nega kerak?"
    await bot.handleUpdate(textUpdate(me, '❓  Nega raqam kerak?'));
    const why = lastScreen();
    check('sabab tushuntirildi', why.text.includes('nima uchun kerak'), firstLine(why.text));
    check('o\'chirish mumkinligi aytildi', why.text.includes('/stop'));
    check('kontakt tugmasi saqlanib qoldi', why.keyboard.some((k) => k.includes('Raqamimni')));

    // Raqamni qo'lda yozish — tugma kerakligi aytiladi
    await bot.handleUpdate(textUpdate(me, '+998901112233'));
    check('qo\'lda yozilgan raqam qabul qilinmadi', lastScreen().text.includes('qo‘lda yozish kerak emas'));

    // Begona kontakt (user_id boshqa odamniki)
    await bot.handleUpdate({
      update_id: (updateId += 1),
      message: {
        message_id: (messageId += 1),
        date: Math.floor(Date.now() / 1000),
        chat: me.chat,
        from: me.user,
        contact: { phone_number: '+998900000000', first_name: 'Begona', user_id: 999999999 },
      },
    });
    check('begona kontakt rad etildi', lastScreen().text.includes('boshqa odamning raqami'));

    // Ro'yxatdan o'tmasdan tugma bosishga urinish
    await bot.handleUpdate(callbackUpdate(me, 'pick_table'));
    check('ro\'yxatsiz stol tanlab bo\'lmadi', lastScreen().text.includes('tanishib olamiz'));
  }

  // ---------- 3) Namuna menyu — ro'yxatdan o'tmasdan ----------
  console.log('\n3) Namuna menyu ro\'yxatdan o\'tmasdan ochiladi');
  {
    await bot.handleUpdate(textUpdate(me, '🧪  Namuna menyu'));
    const s = lastScreen();
    check('namuna taklif qilindi', s.text.includes('NAMUNA menyu'), firstLine(s.text));
    check('haqiqiy buyurtma ketmasligi aytildi', s.text.includes('hech qayerga bormaydi'));

    const link = (s.buttons.find((b) => b.url) || {}).url || s.text;
    check('namuna havolasi berildi', link.includes('/demo'), link.includes('/demo') ? '/demo' : link.slice(0, 60));
    check('haqiqiy muassasa menyusiga OLIB BORMADI', !link.includes(`/m/${SLUG}`));

    // /demo buyrug'i ham ishlaydi
    await bot.handleUpdate(textUpdate(me, '/demo'));
    check('/demo buyrug\'i ishladi', lastScreen().text.includes('NAMUNA menyu'));
  }

  // ---------- 4) Kontakt ulashildi ----------
  console.log('\n4) Kontakt ulashilgach ro\'yxatdan o\'tadi');
  {
    await bot.handleUpdate(contactUpdate(me, '+998901234500'));
    registeredIds.push(String(me.user.id));

    // Ikki xabar: tabrik + bosh menyu
    const shown = sink.filter((x) => x.method === 'sendMessage');
    const congrats = shown[shown.length - 2];
    check('ro\'yxatdan o\'tgani tasdiqlandi', congrats.payload.text.includes('Ro‘yxatdan o‘tdingiz'), firstLine(congrats.payload.text));
    check('endi nimalar qilish mumkinligi aytildi', congrats.payload.text.includes('Endi nimalar qila olasiz'));
    check('ro\'yxat to\'liq (5 ta imkoniyat)', ['Menyuni ochib', 'bo‘sh stolni', 'bron qilish', 'kuzatish', 'chaqirish'].every((x) => congrats.payload.text.includes(x)));
    check('kontakt klaviaturasi olib tashlandi', !!(congrats.payload.reply_markup || {}).remove_keyboard);

    const home = lastScreen();
    check('bosh menyu ochildi', !!btn(home, 'pick_table') && !!btn(home, 'reserve'));
    check('menyuni ko\'rish tugmasi bor', !!btn(home, 'menu'));
    check('yordam va til tugmalari bor', !!btn(home, 'help') && !!btn(home, 'lang'));

    const saved = await db.telegramCustomer.findUnique({ where: { telegramId: String(me.user.id) } });
    check('mijoz bazaga yozildi', !!saved, saved && saved.phone);
    check('raqam to\'g\'ri saqlandi', !!saved && saved.phone === '+998901234500');

    // Qayta /start — endi qaytadan so'ramaydi
    await bot.handleUpdate(textUpdate(me, '/start'));
    const again = lastScreen();
    check('ikkinchi marta raqam so\'ralmadi', !again.text.includes('tanishib olamiz'), firstLine(again.text));
    check('ism bilan kutib olindi', again.text.includes('Xush kelibsiz'));
  }

  // ---------- 5) Ruscha ----------
  console.log('\n5) Til almashtirish (ruscha)');
  {
    const ru = newUser();
    await bot.handleUpdate(textUpdate(ru, '/start'));
    await bot.handleUpdate(callbackUpdate(ru, 'set_lang_ru'));
    const s = lastScreen();
    check('ruschaga o\'tdi', s.text.includes('познакомимся') || s.text.includes('русский'), firstLine(s.text));
    check('ruscha kontakt tugmasi', s.keyboard.some((k) => k.includes('Отправить мой номер')), s.keyboard.join(' | '));

    await bot.handleUpdate(contactUpdate(ru, '+998901234501'));
    registeredIds.push(String(ru.user.id));
    const home = lastScreen();
    check('ruscha bosh menyu', home.buttons.some((b) => b.text.includes('стол') || b.text.includes('меню')));
  }

  // ---------- 6) Menyuni bot ichida ko'rish ----------
  console.log('\n6) Menyuni bot ichida ko\'rish');
  {
    await bot.handleUpdate(callbackUpdate(me, 'menu'));
    const s = lastScreen();
    const cats = s.buttons.filter((b) => b.data && b.data.startsWith('cat_'));
    check('kategoriyalar ro\'yxati chiqdi', cats.length > 0, `${cats.length} ta bo'lim`);

    if (cats.length > 0) {
      await bot.handleUpdate(callbackUpdate(me, cats[0].data));
      const items = lastScreen();
      check('taomlar narxi bilan ko\'rsatildi', items.text.includes("so'm"), firstLine(items.text));
      check('orqaga qaytish tugmasi bor', !!btn(items, 'home'));
    }
  }

  // ---------- 7) QR deep link ----------
  //
  // Eng nozik joy: QR kod bilan kelgan odam ro'yxatdan o'tish oralig'ida
  // YO'QOLMASLIGI kerak. Kod eslab qolinadi va kontakt berilgach odam
  // to'g'ri o'z stoliga tushadi.
  console.log('\n7) QR deep link (/start t_<qrToken>) — ro\'yxatdan keyin ham eslanadi');
  {
    const table = await db.restaurantTable.findFirst({ orderBy: { tableNumber: 'asc' } });
    const qrUser = newUser();
    await bot.handleUpdate(textUpdate(qrUser, `/start t_${table.qrToken}`));
    await bot.handleUpdate(callbackUpdate(qrUser, 'set_lang_uz'));
    check('QR bilan kelganda ham avval kontakt so\'raldi', lastScreen().text.includes('tanishib olamiz'));

    await bot.handleUpdate(contactUpdate(qrUser, '+998901234502'));
    registeredIds.push(String(qrUser.user.id));

    const s = lastScreen();
    check('stol raqami aytildi', s.text.includes(`${table.tableNumber}-stol`), firstLine(s.text));

    // Telegram localhost manzilini tugma qilib qabul qilmaydi, shuning uchun
    // development'da havola matnda keladi. Ikkala holat ham to'g'ri.
    const open = s.buttons.find((b) => b.url);
    const link = (open && open.url) || s.text;
    check('menyu havolasi berildi', !!link, open ? `tugma: ${open.text}` : 'matnda');
    check('havola o\'sha stolga ishora qiladi', link.includes(table.qrToken));
  }

  // ---------- 8) Yaroqsiz QR ----------
  console.log('\n8) Yaroqsiz QR kod');
  {
    const badUser = newUser();
    await bot.handleUpdate(textUpdate(badUser, '/start t_bunday_token_yoq_12345'));
    await bot.handleUpdate(callbackUpdate(badUser, 'set_lang_uz'));
    await bot.handleUpdate(contactUpdate(badUser, '+998901234503'));
    registeredIds.push(String(badUser.user.id));
    const s = lastScreen();
    check('yaroqsiz kod aniqlandi', s.text.includes('ishlamayapti'), firstLine(s.text));
    check('boshi berk ko\'chada qoldirmadi', !!btn(s, 'pick_table'));
  }

  // ---------- 10) Bo'sh stol tanlash ----------
  console.log('\n10) Bo\'sh stolni tanlash va band qilish');
  {
    await bot.handleUpdate(callbackUpdate(me, 'pick_table'));
    const list = lastScreen();
    check('bo\'sh stollar ro\'yxati chiqdi', list.text.includes('bo‘sh stollar'), firstLine(list.text));

    const tableButtons = list.buttons.filter((b) => b.data && b.data.startsWith('claim_'));
    check('stol tugmalari bor', tableButtons.length > 0, `${tableButtons.length} ta`);

    if (tableButtons.length > 0) {
      await bot.handleUpdate(callbackUpdate(me, tableButtons[0].data));
      const claimed = lastScreen();
      check('stol band qilindi', claimed.text.includes('band qilindi'), firstLine(claimed.text));
      check('15 daqiqa haqida ogohlantirish bor', claimed.text.includes('15 daqiqa'));

      // Tugma bo'lsa — undagi havola; localhost bo'lsa — matndagi havola
      const url = (claimed.buttons[0] && claimed.buttons[0].url) || claimed.text;
      check('Mini App havolasida sessiya tokeni bor', !!(url && url.includes('token=')));
      check('xato o\'rniga tasdiq ko\'rsatildi', !claimed.text.includes('noto‘g‘ri ketdi'));

      // Endi bosh menyuda "buyurtmam" va "ofitsiant" tugmalari paydo bo'lishi kerak
      await bot.handleUpdate(callbackUpdate(me, 'home'));
      const home = lastScreen();
      check('stolga o\'tirgach yangi tugmalar chiqdi', !!btn(home, 'my_order') && !!btn(home, 'call_waiter'));

      // Buyurtma holati
      await bot.handleUpdate(callbackUpdate(me, 'my_order'));
      const orders = lastScreen();
      check(
        'buyurtma holati so\'raldi',
        orders.text.includes('buyurtma') || orders.text.includes('holati'),
        firstLine(orders.text)
      );

      // Boshqa mijoz o'sha stolni olmoqchi bo'lsa — rad etiladi
      const rival = newUser();
      await register(bot, rival, '+998901234510');
      await bot.handleUpdate(callbackUpdate(rival, tableButtons[0].data));
      check('band stolni qayta olishga urinish rad etildi', lastScreen().text.includes('band qilishdi'));

      // Havola tugmada ham, matn ichida ham bo'lishi mumkin — ikkalasidan
      // ham stol id'sini shu tarzda ajratib olamiz
      const tableId = (url.match(/[?&]table=([0-9a-f-]{36})/) || [])[1];
      if (tableId) {
        await db.restaurantTable.update({
          where: { id: tableId },
          data: { isOccupied: false, occupiedAt: null },
        });
      }
    }
  }

  // ---------- 11) Bron qilish ----------
  console.log('\n11) Bosqichma-bosqich bron qilish');
  {
    const guest = newUser();
    await register(bot, guest, '+998901234567');

    await bot.handleUpdate(callbackUpdate(guest, 'reserve'));
    const nameStep = lastScreen();
    check('ism so\'raldi', nameStep.text.includes('Ismingizni'), firstLine(nameStep.text));
    check('"mening ismim" tugmasi taklif qilindi', !!btn(nameStep, 'r_myname'));

    // RO'YXATDAN O'TISHNING KO'RINADIGAN FOYDASI: raqam allaqachon bor,
    // shuning uchun bron qilayotganda u QAYTA so'ralmaydi
    await bot.handleUpdate(textUpdate(guest, 'Dilnoza Karimova'));
    const partyStep = lastScreen();
    check('telefon qayta SO\'RALMADI', !partyStep.text.includes('Telefon raqamingizni'), firstLine(partyStep.text));

    const phoneShown = sink
      .filter((x) => x.method === 'sendMessage')
      .map((x) => x.payload.text)
      .some((tx) => tx && tx.includes('+998901234567'));
    check('ro\'yxatdagi raqam o\'zi qo\'yildi', phoneShown);
    check('kontakt qabul qilindi va kishilar soni so\'raldi', partyStep.text.includes('Necha kishi'), firstLine(partyStep.text));
    check('son tugmalari bor', partyStep.buttons.filter((b) => b.data && b.data.startsWith('r_party_')).length >= 8);

    await bot.handleUpdate(callbackUpdate(guest, 'r_party_4'));
    const dateStep = lastScreen();
    check('sana so\'raldi', dateStep.text.includes('Qaysi kunga'), firstLine(dateStep.text));
    check('"Bugun/Ertaga" tugmalari bor', dateStep.buttons.some((b) => b.text === 'Ertaga'));

    // Qo'lda kiritish yo'li ham ishlaydi
    await bot.handleUpdate(callbackUpdate(guest, 'r_date_other'));
    await bot.handleUpdate(textUpdate(guest, 'kecha'));
    check('noto\'g\'ri sana rad etildi', lastScreen().text.includes('Sana noto‘g‘ri'));

    await bot.handleUpdate(textUpdate(guest, '01.01.2020'));
    check('o\'tgan sana rad etildi', lastScreen().text.includes('o‘tib ketgan'));

    // Tugma orqali "indinga"
    await bot.handleUpdate(callbackUpdate(guest, 'r_date_2'));
    const timeStep = lastScreen();
    check('vaqt so\'raldi', timeStep.text.includes('Soat nechada'), firstLine(timeStep.text));
    check('vaqt tugmalari bor', timeStep.buttons.filter((b) => b.data && b.data.startsWith('r_time_')).length > 5);

    await bot.handleUpdate(callbackUpdate(guest, 'r_time_19_30'));
    const confirm = lastScreen();
    check('tasdiqlash ekrani chiqdi', confirm.text.includes('to‘g‘rimi'), firstLine(confirm.text));
    check('barcha ma\'lumot ko\'rsatildi', confirm.text.includes('Dilnoza Karimova') && confirm.text.includes('4 kishi') && confirm.text.includes('19:30'));
    check('tasdiqlash tugmasi bor', !!btn(confirm, 'r_confirm'));

    await bot.handleUpdate(callbackUpdate(guest, 'r_confirm'));
    const done = lastScreen();
    check('bron yaratildi', done.text.includes('yuborildi'), firstLine(done.text));

    const saved = await db.tableReservation.findFirst({
      where: { clientName: 'Dilnoza Karimova' },
      orderBy: { createdAt: 'desc' },
    });
    check('bron bazaga yozildi', !!saved, saved && `${saved.partySize} kishi`);
    check('telefon to\'g\'ri saqlandi', !!saved && saved.phone === '+998901234567', saved && saved.phone);

    await db.tableReservation.deleteMany({ where: { clientName: 'Dilnoza Karimova' } });
  }

  // ---------- 12) Skanersiz Mini App ----------
  console.log('\n12) QR kodsiz menyuni ochish');
  {
    const q = newUser();
    await register(bot, q, '+998901234520');
    const home = lastScreen();
    check('bosh menyuda "Menyuni ochish" bor', !!btn(home, 'open_app'), home.buttons[0] && home.buttons[0].text);

    await bot.handleUpdate(callbackUpdate(q, 'open_app'));
    const app = lastScreen();
    check('QR kod shart emasligi aytildi', app.text.includes('QR kod shart emas'), firstLine(app.text));

    // Development'da APP_URL localhost bo'ladi — Telegram bunday manzilni
    // tugma qilib qabul qilmaydi, shuning uchun havola MATNDA berilishi kerak
    const isLocal = /localhost|127\.0\.0\.1/.test(process.env.APP_URL || 'http://localhost:5173');
    if (isLocal) {
      check('localhost havolasi tugma qilinmadi', !app.buttons.some((b) => b.url));
      check('havola matnda berildi', app.text.includes('/m/'), app.text.split('\n').pop());
    } else {
      check('ilova tugmasi berildi', app.buttons.some((b) => b.url));
    }
  }

  // ---------- 13) Bekor qilish ----------
  console.log('\n13) Oqimni bekor qilish');
  {
    const q = newUser();
    await register(bot, q, '+998901234521');
    await bot.handleUpdate(callbackUpdate(q, 'reserve'));
    await bot.handleUpdate(textUpdate(q, 'Kimdir'));
    await bot.handleUpdate(textUpdate(q, '/bekor'));
    const s = lastScreen();
    check('bron bekor qilindi', s.text.includes('bekor qilindi'), firstLine(s.text));
    check('bosh menyuga qaytdi', !!btn(s, 'pick_table'));

    // Bekor qilingandan keyin matn yozilsa — bron davom etmasligi kerak
    await bot.handleUpdate(textUpdate(q, 'yana nimadir'));
    check('bekor qilingach eski oqim davom etmadi', !!btn(lastScreen(), 'reserve'));
  }

  // ---------- 14) Raqamni o'chirish (/stop) ----------
  //
  // Matnda "xohlagan paytda /stop yozib o'chirtirishingiz mumkin" deyilgan.
  // Va'da berilgan narsa HAQIQATAN ishlashi kerak.
  console.log('\n14) /stop — raqamni o\'chirish');
  {
    const q = newUser();
    await register(bot, q, '+998901234530');
    check('avval ro\'yxatda edi', !!(await db.telegramCustomer.findUnique({ where: { telegramId: String(q.user.id) } })));

    await bot.handleUpdate(textUpdate(q, '/stop'));
    const removed = await db.telegramCustomer.findUnique({ where: { telegramId: String(q.user.id) } });
    check('bazadan o\'chirildi', !removed);

    const s = lastScreen();
    check('qayta ro\'yxatdan o\'tish taklif qilindi', s.text.includes('tanishib olamiz'), firstLine(s.text));
    check('kontakt tugmasi qaytdi', s.keyboard.some((k) => k.includes('Raqamimni')));

    // Endi tugmalar yana yopiq bo'lishi kerak
    await bot.handleUpdate(callbackUpdate(q, 'reserve'));
    check('o\'chirgandan keyin bron yopildi', lastScreen().text.includes('tanishib olamiz'));
  }

  // ---------- Tozalash ----------
  // Sinov yaratgan mijozlar haqiqiy bazada qolib ketmasin
  await db.telegramCustomer.deleteMany({ where: { telegramId: { in: registeredIds } } });
  const left = await db.telegramCustomer.count({ where: { telegramId: { in: registeredIds } } });
  console.log(`\n  ✔ tozalandi — ${registeredIds.length} ta sinov mijozi o'chirildi${left ? ` (${left} ta qoldi!)` : ''}`);
  if (left) failures += 1;

  console.log(`\n=== Natija: ${failures === 0 ? 'HAMMASI O\'TDI ✔' : `${failures} ta xato ✘`} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Sinov to\'xtadi:', err);
  process.exit(1);
});
