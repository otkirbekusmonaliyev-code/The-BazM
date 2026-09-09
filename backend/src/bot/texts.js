// BOT MATNLARI — o'zbekcha va ruscha.
//
// Sayt ikki tilda ishlaydi, lekin bot faqat o'zbekcha edi. Endi mijoz
// birinchi kirishda tilni tanlaydi va butun suhbat o'sha tilda ketadi.
//
// Har bir matn yo satr, yo funksiya. Funksiya bo'lsa — unga o'rin
// almashtiriladigan qiymatlar beriladi.

const uz = {
  code: 'uz',
  name: "O'zbekcha",

  chooseLang: 'Tilni tanlang / Выберите язык',
  langSet: 'Til o‘zbekchaga o‘zgartirildi.',

  welcome: (place) => `${place}ga xush kelibsiz!`,
  whatNext: 'Nima qilmoqchisiz?',

  menu: {
    openApp: '🍽  Menyuni ochish',
    browse: '📖  Taomlar ro‘yxati',
    pickTable: '🪑  Hozir keldim — stol tanlash',
    reserve: '📅  Oldindan stol bron qilish',
    myOrder: '🧾  Buyurtmam qayerda?',
    callWaiter: '🔔  Ofitsiantni chaqirish',
    lang: '🌐  Til / Язык',
    help: 'ℹ️  Bu qanday ishlaydi?',
    back: '⬅️  Orqaga',
    cancel: '✖️  Bekor qilish',
  },

  help:
    'Ishlash tartibi juda oddiy:\n\n' +
    '1️⃣  Stolingizdagi QR kodni skanerlaysiz (yoki shu yerdan bo‘sh stolni tanlaysiz)\n' +
    '2️⃣  Menyudan taomlarni tanlab, buyurtma berasiz\n' +
    '3️⃣  Oshxona buyurtmani darhol ko‘radi\n' +
    '4️⃣  Tayyor bo‘lgach ofitsiant stolingizga olib keladi\n\n' +
    'Kelajakdagi sana uchun stol ham bron qila olasiz.\n\n' +
    'Istalgan paytda /bekor buyrug‘i bilan boshidan boshlashingiz mumkin.',

  openMenu: '🍽  Menyuni ochish',
  openLinkFallback:
    'Tugma o‘rniga havola — uni nusxalab brauzerda oching (bu manzil sinov serveriga tegishli, shuning uchun Telegram uni tugma qilib bera olmaydi):',

  app: {
    noTable:
      'Menyu ilovada ochiladi — QR kod shart emas.\n' +
      'Ilova ichida stolingizni tanlaysiz, so‘ng buyurtma berasiz.',
    withTable: (n) => `${n}-stol uchun menyu ochiladi.`,
  },


  qr: {
    valid: (n) => `Bu ${n}-stol. Menyuni ochish uchun quyidagi tugmani bosing 👇`,
    invalid:
      'Bu QR kod ishlamayapti — eskirgan yoki boshqa muassasaniki bo‘lishi mumkin.\n' +
      'Ofitsiantga aytsangiz yangisini beradi. Yoki quyidan bo‘sh stol tanlang.',
  },

  tables: {
    none:
      'Afsuski hozir bo‘sh stol yo‘q 😔\nBir ozdan keyin urinib ko‘ring yoki oldindan bron qiling.',
    pick: (n) => `Hozir bo‘sh stollar (${n} ta). Qaysi biriga o‘tirasiz?`,
    label: (n) => `${n}-stol`,
    claimed: (n) =>
      `✅ ${n}-stol siz uchun band qilindi.\n\n` +
      '⏳ Diqqat: 15 daqiqa ichida buyurtma bermasangiz, stol avtomatik bo‘shatiladi.',
    taken: 'Bu stolni sizdan oldin band qilishdi 😔 Boshqasini tanlang.',
    already: (n) => `Siz allaqachon ${n}-stoldasiz.`,
  },

  menuView: {
    empty: 'Menyu hali to‘ldirilmagan.',
    title: 'Menyu',
    pickCategory: 'Qaysi bo‘limni ko‘rasiz?',
    soldOut: 'tugagan',
    orderHint: 'Buyurtma berish uchun stolda o‘tirib QR kodni skanerlang yoki stol tanlang.',
  },

  order: {
    none: 'Sizda hozircha faol buyurtma yo‘q.',
    needTable: 'Buning uchun avval stolga o‘tirishingiz kerak — QR kodni skanerlang yoki stol tanlang.',
    title: 'Buyurtmangiz holati:',
    statuses: {
      new: '🆕  Qabul qilindi',
      accepted: '👍  Oshxona qabul qildi',
      preparing: '👨‍🍳  Tayyorlanmoqda',
      ready: '✅  Tayyor — ofitsiant olib kelmoqda',
      picked_up: '🚶  Ofitsiant olib kelmoqda',
      delivered: '🍽  Yetkazildi. Yoqimli ishtaha!',
      paid: '💳  To‘langan. Rahmat!',
      cancelled: '❌  Bekor qilindi',
    },
    waiterCalled: '🔔 Ofitsiant chaqirildi — hozir keladi.',
  },

  reserve: {
    start: 'Bron qilamiz. Ismingizni yozing:',
    useMyName: (n) => `👤  ${n}`,
    askPhone: 'Telefon raqamingizni yuboring — tugmani bossangiz avtomatik yuboriladi:',
    sharePhone: '📱  Raqamimni yuborish',
    badPhone: 'Raqam noto‘g‘ri ko‘rinadi. Qaytadan yozing (masalan +998901234567):',
    askParty: 'Necha kishisiz?',
    morePeople: 'Ko‘proq…',
    askPartyManual: '1 dan 50 gacha raqam yozing:',
    askDate: 'Qaysi kunga?',
    today: 'Bugun',
    tomorrow: 'Ertaga',
    dayAfter: 'Indinga',
    otherDate: '📆  Boshqa kun',
    askDateManual: 'Sanani shu ko‘rinishda yozing: 25.12.2026',
    badDate: 'Sana noto‘g‘ri. Masalan: 25.12.2026',
    pastDate: 'Bu kun o‘tib ketgan. Kelajakdagi sanani tanlang.',
    askTime: 'Soat nechada?',
    otherTime: '🕐  Boshqa vaqt',
    askTimeManual: 'Vaqtni shu ko‘rinishda yozing: 19:30',
    badTime: 'Vaqt noto‘g‘ri. Masalan: 19:30',
    pastTime: 'Bu vaqt o‘tib ketgan. Boshqa vaqtni tanlang.',
    confirmTitle: 'Hammasi to‘g‘rimi?',
    confirm: '✅  Ha, yuborish',
    edit: '✏️  Qaytadan',
    sent: '✅ So‘rovingiz yuborildi!',
    afterSent: 'Muassasa tasdiqlagach siz bilan bog‘lanamiz.',
    failed: 'Bron yaratilmadi',
    cancelled: 'Bron bekor qilindi.',
  },

  fields: { name: '👤', phone: '📞', party: '👥', when: '🕐', people: 'kishi' },

  errors: {
    generic: 'Nimadir noto‘g‘ri ketdi. Birozdan keyin qayta urinib ko‘ring.',
    offline: 'Hozir tizimga ulanib bo‘lmadi. Birozdan keyin urinib ko‘ring.',
    suspended: 'Bu muassasa xizmati vaqtincha to‘xtatilgan.',
  },
};

const ru = {
  code: 'ru',
  name: 'Русский',

  chooseLang: 'Tilni tanlang / Выберите язык',
  langSet: 'Язык изменён на русский.',

  welcome: (place) => `Добро пожаловать в «${place}»!`,
  whatNext: 'Что хотите сделать?',

  menu: {
    openApp: '🍽  Открыть меню',
    browse: '📖  Список блюд',
    pickTable: '🪑  Я уже здесь — выбрать стол',
    reserve: '📅  Забронировать стол',
    myOrder: '🧾  Где мой заказ?',
    callWaiter: '🔔  Позвать официанта',
    lang: '🌐  Til / Язык',
    help: 'ℹ️  Как это работает?',
    back: '⬅️  Назад',
    cancel: '✖️  Отмена',
  },

  help:
    'Всё очень просто:\n\n' +
    '1️⃣  Сканируете QR-код на своём столе (или выбираете свободный стол здесь)\n' +
    '2️⃣  Выбираете блюда в меню и оформляете заказ\n' +
    '3️⃣  Кухня сразу видит заказ\n' +
    '4️⃣  Когда всё готово, официант приносит его вам\n\n' +
    'Также можно забронировать стол на будущую дату.\n\n' +
    'В любой момент можно начать заново командой /bekor',

  openMenu: '🍽  Открыть меню',
  openLinkFallback:
    'Вместо кнопки — ссылка. Скопируйте и откройте в браузере (это тестовый адрес, Telegram не делает из него кнопку):',

  app: {
    noTable:
      'Меню откроется в приложении — QR-код не нужен.\n' +
      'Внутри выберете свой стол и сделаете заказ.',
    withTable: (n) => `Меню для стола №${n}.`,
  },


  qr: {
    valid: (n) => `Это стол №${n}. Нажмите кнопку ниже, чтобы открыть меню 👇`,
    invalid:
      'Этот QR-код не работает — возможно, он устарел или от другого заведения.\n' +
      'Попросите официанта дать новый. Или выберите свободный стол ниже.',
  },

  tables: {
    none: 'К сожалению, сейчас нет свободных столов 😔\nПопробуйте позже или забронируйте заранее.',
    pick: (n) => `Свободных столов сейчас: ${n}. За какой сядете?`,
    label: (n) => `Стол ${n}`,
    claimed: (n) =>
      `✅ Стол №${n} закреплён за вами.\n\n` +
      '⏳ Внимание: если в течение 15 минут не будет заказа, стол освободится автоматически.',
    taken: 'Этот стол заняли раньше вас 😔 Выберите другой.',
    already: (n) => `Вы уже за столом №${n}.`,
  },

  menuView: {
    empty: 'Меню пока не заполнено.',
    title: 'Меню',
    pickCategory: 'Какой раздел показать?',
    soldOut: 'нет в наличии',
    orderHint: 'Чтобы заказать, отсканируйте QR-код за столом или выберите стол.',
  },

  order: {
    none: 'У вас пока нет активных заказов.',
    needTable: 'Для этого сначала нужно сесть за стол — отсканируйте QR-код или выберите стол.',
    title: 'Статус вашего заказа:',
    statuses: {
      new: '🆕  Принят',
      accepted: '👍  Кухня приняла',
      preparing: '👨‍🍳  Готовится',
      ready: '✅  Готово — официант несёт',
      picked_up: '🚶  Официант несёт',
      delivered: '🍽  Подано. Приятного аппетита!',
      paid: '💳  Оплачено. Спасибо!',
      cancelled: '❌  Отменён',
    },
    waiterCalled: '🔔 Официант вызван — сейчас подойдёт.',
  },

  reserve: {
    start: 'Бронируем. Напишите ваше имя:',
    useMyName: (n) => `👤  ${n}`,
    askPhone: 'Отправьте номер телефона — по кнопке он отправится автоматически:',
    sharePhone: '📱  Отправить мой номер',
    badPhone: 'Номер выглядит неверно. Напишите ещё раз (например +998901234567):',
    askParty: 'Сколько вас человек?',
    morePeople: 'Больше…',
    askPartyManual: 'Напишите число от 1 до 50:',
    askDate: 'На какой день?',
    today: 'Сегодня',
    tomorrow: 'Завтра',
    dayAfter: 'Послезавтра',
    otherDate: '📆  Другой день',
    askDateManual: 'Напишите дату в таком виде: 25.12.2026',
    badDate: 'Неверная дата. Например: 25.12.2026',
    pastDate: 'Этот день уже прошёл. Выберите будущую дату.',
    askTime: 'Во сколько?',
    otherTime: '🕐  Другое время',
    askTimeManual: 'Напишите время в таком виде: 19:30',
    badTime: 'Неверное время. Например: 19:30',
    pastTime: 'Это время уже прошло. Выберите другое.',
    confirmTitle: 'Всё верно?',
    confirm: '✅  Да, отправить',
    edit: '✏️  Заново',
    sent: '✅ Заявка отправлена!',
    afterSent: 'Как только заведение подтвердит, мы с вами свяжемся.',
    failed: 'Не удалось создать бронь',
    cancelled: 'Бронирование отменено.',
  },

  fields: { name: '👤', phone: '📞', party: '👥', when: '🕐', people: 'чел.' },

  errors: {
    generic: 'Что-то пошло не так. Попробуйте чуть позже.',
    offline: 'Сейчас не удалось связаться с системой. Попробуйте позже.',
    suspended: 'Обслуживание этого заведения временно приостановлено.',
  },
};

const DICTS = { uz, ru };

// Til tanlanmagan bo'lsa — Telegram profilidagi tilga qaraymiz
function pickLang(session, ctx) {
  if (session && session.lang && DICTS[session.lang]) return session.lang;
  const code = ((ctx && ctx.from && ctx.from.language_code) || '').toLowerCase();
  return code.startsWith('ru') ? 'ru' : 'uz';
}

const t = (lang) => DICTS[lang] || uz;

module.exports = { t, pickLang, LANGS: Object.keys(DICTS), DICTS };
