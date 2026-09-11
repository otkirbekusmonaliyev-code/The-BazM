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
const { createPlatformBot } = require('../src/bot/restaurantBot');
const masterPrisma = require('../src/config/masterDb');
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
  // Bitta bot butun platformaga — muassasa suhbat ichida tanlanadi
  const bot = createPlatformBot({ token: '1:FAKE' });
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
  await pickPlace(bot, who);
}

// JOY TANLASH: viloyat -> (shahar) -> tur -> muassasa.
//
// Sinov muassasasi (delish) Toshkent shahrida — u yerda shahar qadami
// O'TKAZIB YUBORILADI, shuning uchun viloyatdan keyin darhol tur keladi.
async function pickPlace(bot, who, placeName = 'Delish') {
  const regions = lastScreen();
  const region = regions.buttons.find(
    (x) => x.data && x.data.startsWith('pl_r_') && x.text.includes('Toshkent shahri')
  );
  if (!region) throw new Error('Toshkent shahri tugmasi topilmadi: ' + regions.text);
  await bot.handleUpdate(callbackUpdate(who, region.data));

  await bot.handleUpdate(callbackUpdate(who, 'pl_t_restaurant'));

  const list = lastScreen();
  const place = list.buttons.find(
    (x) => x.data && x.data.startsWith('pl_p_') && x.text.includes(placeName)
  );
  if (!place) throw new Error('Muassasa topilmadi: ' + list.text);
  await bot.handleUpdate(callbackUpdate(who, place.data));
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
    check('bosh menyu HALI ko\'rsatilmadi', !btn(m, 'call_waiter'));
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
    await bot.handleUpdate(callbackUpdate(me, 'call_waiter'));
    check('ro\'yxatsiz ofitsiant chaqirib bo\'lmadi', lastScreen().text.includes('tanishib olamiz'));
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
    check('ro\'yxat to\'liq (3 ta imkoniyat)', ['Menyuni ochib', 'Ofitsiantni chaqirish', 'bron qilish'].every((x) => congrats.payload.text.includes(x)));
    check('kontakt klaviaturasi olib tashlandi', !!(congrats.payload.reply_markup || {}).remove_keyboard);

    // Ro'yxatdan o'tgach endi JOY so'raladi — bitta bot o'nlab
    // muassasaga xizmat qiladi, qaysi biri ekanini bilish shart
    const picker = lastScreen();
    check('joy tanlash taklif qilindi', picker.text.includes('Viloyatni tanlang'), firstLine(picker.text));
    check(
      'faqat muassasasi BOR viloyatlar',
      picker.buttons.filter((x) => x.data && x.data.startsWith('pl_r_')).length > 0
        && picker.buttons.every((x) => !x.text.includes('Xorazm')),
      picker.buttons.map((x) => x.text).join(', ')
    );

    await pickPlace(bot, me);
    const home = lastScreen();
    check('muassasa tanlangach bosh menyu', !!btn(home, 'call_waiter') && !!btn(home, 'reserve'));
    check('ilovani ochish tugmasi bor', !!btn(home, 'open_app'));
    check('joyni almashtirish tugmasi bor', !!btn(home, 'place_start'));
    check('til tugmasi bor', !!btn(home, 'lang'));

    const saved = await masterPrisma.telegramCustomer.findUnique({ where: { telegramId: String(me.user.id) } });
    check('mijoz bazaga yozildi', !!saved, saved && saved.phone);
    check('raqam to\'g\'ri saqlandi', !!saved && saved.phone === '+998901234500');

    // Qayta /start — endi qaytadan so'ramaydi
    await bot.handleUpdate(textUpdate(me, '/start'));
    const again = lastScreen();
    check('ikkinchi marta raqam so\'ralmadi', !again.text.includes('tanishib olamiz'), firstLine(again.text));
    check('ism bilan kutib olindi', again.text.includes('Xush kelibsiz'));
  }

  // ---------- 5) Joy tanlash ----------
  //
  // Bitta bot butun platformaga xizmat qiladi, shuning uchun eng muhim
  // savol: mijoz o'z muassasasini topa oladimi va FAQAT mavjudlari
  // ko'rsatiladimi?
  console.log('\n5) Joy tanlash: viloyat -> shahar -> tur -> muassasa');
  {
    const guest = newUser();
    await bot.handleUpdate(textUpdate(guest, '/start'));
    await bot.handleUpdate(callbackUpdate(guest, 'set_lang_uz'));
    await bot.handleUpdate(contactUpdate(guest, '+998901234560'));
    registeredIds.push(String(guest.user.id));

    // --- Viloyatlar ---
    const regions = lastScreen();
    check('viloyatlar ro\'yxati chiqdi', regions.text.includes('Viloyatni tanlang'), firstLine(regions.text));
    const regionBtns = regions.buttons.filter((x) => x.data && x.data.startsWith('pl_r_'));
    check('viloyat tugmalari bor', regionBtns.length > 0, `${regionBtns.length} ta`);
    check(
      'FAQAT muassasasi bor viloyatlar',
      regionBtns.length < 14,
      `${regionBtns.length} ta (jami 14 tadan)`
    );
    check(
      'muassasasi yo\'q viloyat ko\'rinmadi',
      !regionBtns.some((x) => /Xorazm|Navoiy|Jizzax/.test(x.text)),
      regionBtns.map((x) => x.text).join(', ')
    );

    // --- Toshkent SHAHRI: shahar qadami o'tkazib yuboriladi ---
    const tosh = regionBtns.find((x) => x.text.includes('Toshkent shahri'));
    await bot.handleUpdate(callbackUpdate(guest, tosh.data));
    const afterCity = lastScreen();
    check(
      'Toshkent shahrida shahar SO\'RALMADI',
      !afterCity.text.includes('Shaharni tanlang'),
      firstLine(afterCity.text)
    );
    check('darhol tur so\'raldi', afterCity.text.includes('Restoran kerakmi'), firstLine(afterCity.text));

    // --- Bo'sh tur ko'rsatilmaydi ---
    check(
      'Toshkent shahrida kafe yo\'q — tugmasi ham yo\'q',
      !btn(afterCity, 'pl_t_cafe'),
      afterCity.buttons.map((x) => x.data).join(', ')
    );

    // --- Muassasalar ---
    await bot.handleUpdate(callbackUpdate(guest, 'pl_t_restaurant'));
    const list = lastScreen();
    const placeBtns = list.buttons.filter((x) => x.data && x.data.startsWith('pl_p_'));
    check('muassasalar ro\'yxati chiqdi', placeBtns.length > 0, placeBtns.map((x) => x.text).join(', '));
    check('Delish ro\'yxatda', placeBtns.some((x) => x.text.includes('Delish')));

    await bot.handleUpdate(callbackUpdate(guest, placeBtns.find((x) => x.text.includes('Delish')).data));
    const chosen = lastScreen();
    check('tanlangani tasdiqlandi', chosen.text.includes('Delish tanlandi'), firstLine(chosen.text));
    check('bosh menyu ochildi', !!btn(chosen, 'call_waiter') && !!btn(chosen, 'reserve'));

    // --- Boshqa viloyat: shahar SO'RALADI ---
    await bot.handleUpdate(callbackUpdate(guest, 'place_start'));
    const r2 = lastScreen().buttons.find((x) => x.data && x.data.startsWith('pl_r_') && x.text.includes('Toshkent viloyati'));
    check('Toshkent viloyati ham bor', !!r2);
    await bot.handleUpdate(callbackUpdate(guest, r2.data));
    const cityScreen = lastScreen();
    check('viloyatda shahar so\'raldi', cityScreen.text.includes('Shaharni tanlang'), firstLine(cityScreen.text));
    const cityBtns = cityScreen.buttons.filter((x) => x.data && x.data.startsWith('pl_c_'));
    check('shahar tugmalari bor', cityBtns.length > 0, cityBtns.map((x) => x.text).join(', '));

    await bot.handleUpdate(callbackUpdate(guest, cityBtns[0].data));
    const types = lastScreen();
    check('Olmaliqda kafe bor', !!btn(types, 'pl_t_cafe'), types.buttons.map((x) => x.data).join(', '));
    check('Olmaliqda restoran YO\'Q', !btn(types, 'pl_t_restaurant'));

    // --- Joy tanlamasdan amal bajarib bo'lmaydi ---
    const noPlace = newUser();
    await bot.handleUpdate(textUpdate(noPlace, '/start'));
    await bot.handleUpdate(callbackUpdate(noPlace, 'set_lang_uz'));
    await bot.handleUpdate(contactUpdate(noPlace, '+998901234561'));
    registeredIds.push(String(noPlace.user.id));
    await bot.handleUpdate(callbackUpdate(noPlace, 'call_waiter'));
    check(
      'joysiz ofitsiant chaqirib bo\'lmadi',
      lastScreen().text.includes('Viloyatni tanlang') || lastScreen().text.includes('Qaysi muassasa'),
      firstLine(lastScreen().text)
    );
  }

  // ---------- 6) Ruscha ----------
  console.log('\n6) Til almashtirish (ruscha)');
  {
    const ru = newUser();
    await bot.handleUpdate(textUpdate(ru, '/start'));
    await bot.handleUpdate(callbackUpdate(ru, 'set_lang_ru'));
    const s = lastScreen();
    check('ruschaga o\'tdi', s.text.includes('познакомимся') || s.text.includes('русский'), firstLine(s.text));
    check('ruscha kontakt tugmasi', s.keyboard.some((k) => k.includes('Отправить мой номер')), s.keyboard.join(' | '));

    await bot.handleUpdate(contactUpdate(ru, '+998901234501'));
    registeredIds.push(String(ru.user.id));
    check('ruscha joy tanlash', lastScreen().text.includes('Выберите область'), firstLine(lastScreen().text));

    await pickPlace(bot, ru);
    const home = lastScreen();
    check('ruscha bosh menyu', home.buttons.some((b) => b.text.includes('стол') || b.text.includes('меню')));
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
    // Havolada endi SLUG ham bor — bitta bot hamma muassasaga xizmat
    // qiladi va stol tokeni qaysi bazada izlanishini bilishi kerak
    await bot.handleUpdate(textUpdate(qrUser, `/start t_${SLUG}_${table.qrToken}`));
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
    check('boshi berk ko\'chada qoldirmadi', !!btn(s, 'call_waiter'));
  }

  // ---------- 9) Ofitsiant chaqirish ----------
  //
  // Bot endi shu ish uchun. Ikki qadam: qaysi stol -> qaysi ofitsiant.
  // Eng muhimi: xabar HAMMAGA emas, AYNAN tanlangan ofitsiantga borishi
  // kerak — buni socket xonasi nomidan tekshiramiz.
  console.log('\n9) Ofitsiant chaqirish — aynan bitta odamga');
  {
    const caller = newUser();
    await register(bot, caller, '+998901234540');

    // Socketga chiqqan hamma narsani ushlab qolamiz
    const realtime = require('../src/realtime/io');
    const emitted = [];
    const realEmitTo = realtime.emitTo;
    realtime.emitTo = (room, event, payload) => {
      emitted.push({ room, event, payload });
      return realEmitTo(room, event, payload);
    };

    try {
      await bot.handleUpdate(callbackUpdate(caller, 'call_waiter'));
      const step1 = lastScreen();
      check('qaysi stol deb so\'raldi', step1.text.includes('Qaysi stolda'), firstLine(step1.text));
      const tableBtns = step1.buttons.filter((b) => b.data && b.data.startsWith('cw_t_'));
      check('stol tugmalari chiqdi', tableBtns.length > 0, `${tableBtns.length} ta`);

      await bot.handleUpdate(callbackUpdate(caller, tableBtns[0].data));
      const step2 = lastScreen();
      const waiterBtns = step2.buttons.filter((b) => b.data && b.data.startsWith('cw_w_'));
      check('ofitsiantlar ro\'yxati chiqdi', waiterBtns.length > 0, `${waiterBtns.length} ta`);
      check('"farqi yo\'q" tugmasi bor', !!btn(step2, 'cw_any'));
      check('boshqa stolga o\'tish mumkin', !!btn(step2, 'cw_change'));
      check('tanlangan stol ko\'rsatilgan', /\d+-stol/.test(step2.text), firstLine(step2.text));

      // ---- Aniq ofitsiantni tanlaymiz ----
      emitted.length = 0;
      const chosenId = waiterBtns[0].data.replace('cw_w_', '');
      const chosenName = waiterBtns[0].text;
      await bot.handleUpdate(callbackUpdate(caller, waiterBtns[0].data));
      const done = lastScreen();
      check('chaqiruv yuborildi', done.text.includes('Chaqiruv yuborildi'), firstLine(done.text));
      check('kim borishi aytildi', done.text.includes(chosenName), chosenName);

      const personal = emitted.filter((e) => e.room === `${SLUG}_waiter_${chosenId}`);
      check('xabar AYNAN o\'sha ofitsiantga ketdi', personal.length === 1, `${personal.length} ta`);
      check('xabarda stol raqami bor', personal.length > 0 && !!personal[0].payload.tableNumber);
      check(
        'umumiy xonaga YUBORILMADI (takror bo\'lmasin)',
        emitted.every((e) => e.room !== `${SLUG}_waiters`)
      );
      check(
        'oshxona ham ko\'rdi',
        emitted.some((e) => e.room === `${SLUG}_kitchen` && e.event === 'waiter_called')
      );

      // ---- "Farqi yo'q" — tavakkaliga tanlansin ----
      //
      // Yangi oqim sifatida: chaqiruv yuborilgach tanlov o\'chadi, shuning
      // uchun stol qaytadan tanlanadi.
      emitted.length = 0;
      await bot.handleUpdate(callbackUpdate(caller, 'call_waiter'));
      const anyStep = lastScreen().buttons.filter((b) => b.data && b.data.startsWith('cw_t_'));
      await bot.handleUpdate(callbackUpdate(caller, anyStep[0].data));
      await bot.handleUpdate(callbackUpdate(caller, 'cw_any'));
      check('tavakkaliga chaqiruv ham ishladi', lastScreen().text.includes('Chaqiruv yuborildi'));
      const anyPersonal = emitted.filter((e) => e.event === 'waiter_called' && /_waiter_/.test(e.room));
      check('bittasi tanlandi', anyPersonal.length === 1, `${anyPersonal.length} ta`);

      // ---- Chaqiruv yuborilgach eski ekran "osilib" qolmaydi ----
      //
      // Odam suhbatni yuqoriga aylantirib, eski "kimni chaqiray?" xabaridagi
      // tugmani bosishi mumkin. O\'shanda eski stolga chaqiruv ketmasligi,
      // balki stol qaytadan so\'ralishi kerak.
      emitted.length = 0;
      await bot.handleUpdate(callbackUpdate(caller, 'cw_any'));
      check(
        'eski tugma bosilsa stol qayta so\'raldi',
        lastScreen().text.includes('Qaysi stolda'),
        firstLine(lastScreen().text)
      );
      check(
        'eski stolga chaqiruv KETMADI',
        emitted.filter((e) => e.event === 'waiter_called').length === 0
      );

      // ---- Stol ESLAB QOLINMAYDI ----
      //
      // Odam ertaga boshqa stolga o\'tiradi. Bir marta tanlangan stolni
      // keyingi safar ham ishlatish — ofitsiantni ataylab noto\'g\'ri stolga
      // yuborish degani, va mijoz buni chaqiruv ketgandan keyin biladi.
      await bot.handleUpdate(callbackUpdate(caller, 'home'));
      await bot.handleUpdate(callbackUpdate(caller, 'call_waiter'));
      const again = lastScreen();
      check(
        'ikkinchi marta stol QAYTA so\'raldi',
        again.text.includes('Qaysi stolda'),
        firstLine(again.text)
      );
      check(
        'ofitsiantlar ro\'yxatiga sakrab o\'tilmadi',
        !again.buttons.some((b) => b.data && b.data.startsWith('cw_w_'))
      );

      // Endi BOSHQA stolni tanlaymiz — chaqiruv aynan o\'shanga ketishi kerak
      const otherBtns = again.buttons.filter((b) => b.data && b.data.startsWith('cw_t_'));
      const second = otherBtns[1] || otherBtns[0];
      const wantNumber = Number(second.text.replace(/\D/g, ''));
      emitted.length = 0;
      await bot.handleUpdate(callbackUpdate(caller, second.data));
      await bot.handleUpdate(callbackUpdate(caller, 'cw_any'));
      const secondCall = emitted.find((e) => e.event === 'waiter_called' && /_waiter_/.test(e.room));
      check(
        'chaqiruv YANGI tanlangan stolga ketdi',
        !!secondCall && secondCall.payload.tableNumber === wantNumber,
        secondCall ? `${secondCall.payload.tableNumber}-stol (kutilgan: ${wantNumber})` : 'chaqiruv yo\'q'
      );

      // ---- "Boshqa stol" tugmasi ----
      await bot.handleUpdate(callbackUpdate(caller, 'call_waiter'));
      await bot.handleUpdate(callbackUpdate(caller, tableBtns[0].data));
      await bot.handleUpdate(callbackUpdate(caller, 'cw_change'));
      check('boshqa stolga o\'tish ishladi', lastScreen().text.includes('Qaysi stolda'));

      // ---- QR bilan kelgan odamdan ham stol so\'raladi ----
      //
      // QR bir soat oldin skanerlangan bo\'lishi mumkin, odam esa
      // allaqachon boshqa stolga ko\'chib o\'tirgan bo\'ladi.
      const qrGuest = newUser();
      const someTable = await db.restaurantTable.findFirst({ orderBy: { tableNumber: 'asc' } });
      await bot.handleUpdate(textUpdate(qrGuest, `/start t_${SLUG}_${someTable.qrToken}`));
      await bot.handleUpdate(callbackUpdate(qrGuest, 'set_lang_uz'));
      await bot.handleUpdate(contactUpdate(qrGuest, '+998901234541'));
      registeredIds.push(String(qrGuest.user.id));
      await bot.handleUpdate(callbackUpdate(qrGuest, 'call_waiter'));
      check(
        'QR bilan kelganda ham stol so\'raldi',
        lastScreen().text.includes('Qaysi stolda'),
        firstLine(lastScreen().text)
      );
    } finally {
      realtime.emitTo = realEmitTo;
    }
  }

  // ---------- 10) Olib tashlangan bo'limlar ----------
  //
  // Bot ataylab kichraytirildi. Eski tugmalar QAYTIB KELMASLIGI kerak —
  // aks holda mijoz botda ham, ilovada ham bir xil ishni qiladi va ikkalasi
  // sekin-asta bir-biridan uzoqlashadi.
  console.log('\n10) Ortiqcha bo\'limlar olib tashlangan');
  {
    await bot.handleUpdate(callbackUpdate(me, 'home'));
    const home = lastScreen();
    const labels = home.buttons.map((b) => b.data);
    check('bosh menyuda ATIGI 5 ta tugma', home.buttons.length === 5, labels.join(', '));
    check('menyu varaqlash yo\'q', !labels.includes('menu'));
    check('stol band qilish yo\'q', !labels.includes('pick_table'));
    check('"buyurtmam qayerda" yo\'q', !labels.includes('my_order'));
    check('qolgani: ilova, chaqiruv, bron, joy, til',
      ['open_app', 'call_waiter', 'reserve', 'place_start', 'lang'].every((d) => labels.includes(d)));

    // Eski tugma bosilsa ham bot yiqilmasligi kerak (eski xabarlar qoladi)
    await bot.handleUpdate(callbackUpdate(me, 'my_order'));
    check('eski tugma bosilsa bot yiqilmadi', true);
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
    check('bosh menyuga qaytdi', !!btn(s, 'call_waiter'));

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
    check('avval ro\'yxatda edi', !!(await masterPrisma.telegramCustomer.findUnique({ where: { telegramId: String(q.user.id) } })));

    await bot.handleUpdate(textUpdate(q, '/stop'));
    const removed = await masterPrisma.telegramCustomer.findUnique({ where: { telegramId: String(q.user.id) } });
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
  await masterPrisma.telegramCustomer.deleteMany({ where: { telegramId: { in: registeredIds } } });
  const left = await masterPrisma.telegramCustomer.count({ where: { telegramId: { in: registeredIds } } });
  console.log(`\n  ✔ tozalandi — ${registeredIds.length} ta sinov mijozi o'chirildi${left ? ` (${left} ta qoldi!)` : ''}`);
  if (left) failures += 1;

  console.log(`\n=== Natija: ${failures === 0 ? 'HAMMASI O\'TDI ✔' : `${failures} ta xato ✘`} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Sinov to\'xtadi:', err);
  process.exit(1);
});
