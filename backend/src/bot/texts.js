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

  // Bot ataylab UCHTA ishni qiladi, boshqa hech narsani. Menyu, buyurtma
  // va savat — hammasi ilovada; botda ularning takrori yo'q.
  menu: {
    openApp: '🍽  Menyuni ochish',
    callWaiter: '🔔  Ofitsiantni chaqirish',
    reserve: '📅  Oldindan stol bron qilish',
    lang: '🌐  Til / Язык',
    back: '⬅️  Orqaga',
    cancel: '✖️  Bekor qilish',
  },

  help:
    'Bu bot uchta ish qiladi:\n\n' +
    '🍽  Menyuni ochadi — taom tanlash va buyurtma ilovada bo‘ladi\n' +
    '🔔  Ofitsiantni chaqiradi — o‘zingiz tanlagan ofitsiantga xabar boradi\n' +
    '📅  Kelajakdagi kunga stol bron qiladi\n\n' +
    'Istalgan paytda /bekor buyrug‘i bilan boshidan boshlashingiz mumkin.',

  openMenu: '🍽  Menyuni ochish',
  openDemo: '🧪  Namuna menyuni ko‘rish',
  openLinkFallback:
    'Tugma o‘rniga havola — uni nusxalab brauzerda oching (bu manzil sinov serveriga tegishli, shuning uchun Telegram uni tugma qilib bera olmaydi):',

  // ---------- Ro'yxatdan o'tish ----------
  auth: {
    // Reply-klaviatura tugmalari. Matn handler'i AYNAN shu satrlarni
    // taqqoslaydi, shuning uchun ular o'zgarsa ikkala joyda o'zgaradi.
    shareBtn: '📱  Raqamimni yuborish',
    demoBtn: '🧪  Namuna menyu',
    whyBtn: '❓  Nega raqam kerak?',

    ask:
      'Boshlashdan oldin bir marta tanishib olamiz 👋\n\n' +
      'Pastdagi «📱 Raqamimni yuborish» tugmasini bosing — raqamingiz\n' +
      'Telegram orqali o‘zi yuboriladi, qo‘lda terish shart emas.\n\n' +
      'Shoshmayapsizmi? «🧪 Namuna menyu» tugmasi bilan ilova qanday\n' +
      'ko‘rinishini ro‘yxatdan o‘tmasdan ham ko‘rishingiz mumkin.',

    why:
      'Raqam nima uchun kerak:\n\n' +
      '📅  Bron qilganda uni qayta-qayta so‘ramaymiz\n' +
      '🔔  Ofitsiantni chaqirganingizda kim chaqirganini biladi\n' +
      '🧾  Buyurtmangiz yo‘qolib qolmaydi — telefoningiz almashsa ham topamiz\n\n' +
      'Raqamingiz faqat shu muassasada qoladi va reklama uchun ishlatilmaydi.\n' +
      'Xohlagan paytda /stop yozib o‘chirtirishingiz mumkin.\n\n' +
      'Tayyor bo‘lsangiz — «📱 Raqamimni yuborish» tugmasini bosing.',

    // Tugma o'rniga raqamni qo'lda yozganda
    typed:
      'Raqamni qo‘lda yozish kerak emas — uni tekshira olmaymiz.\n' +
      'Pastdagi «📱 Raqamimni yuborish» tugmasini bosing, xolos.',

    // Boshqa odamning kontakti forward qilinganda
    notYours:
      'Bu boshqa odamning raqami ko‘rinadi 🙂\n' +
      'Iltimos, «📱 Raqamimni yuborish» tugmasi orqali O‘Z raqamingizni yuboring.',

    // Ro'yxatdan o'tmagan holda tugma bosilganda
    needed:
      'Buning uchun avval raqamingizni yuborishingiz kerak.\n' +
      '/start bosing va «📱 Raqamimni yuborish» tugmasini tanlang.',

    done: (name) =>
      `✅ Rahmat${name ? `, ${name}` : ''}! Ro‘yxatdan o‘tdingiz.\n\n` +
      'Endi nimalar qila olasiz:\n\n' +
      '🍽  Menyuni ochib, stolingizdan buyurtma berish\n' +
      '🔔  Ofitsiantni chaqirish — o‘zingiz tanlaysiz yoki bo‘shini beramiz\n' +
      '📅  Kelasi kunga stol bron qilish',

    back: (name) => `Xush kelibsiz${name ? `, ${name}` : ''}!`,

    removed:
      '🗑  Raqamingiz o‘chirildi.\n\n' +
      'Xohlagan paytda qaytadan yuborib, davom etishingiz mumkin.',
  },

  demo: {
    intro:
      '🧪  Bu — NAMUNA menyu.\n\n' +
      'Ichida haqiqiy taomlar emas, ko‘rgazma uchun yozilganlari turadi va\n' +
      'bergan buyurtmangiz hech qayerga bormaydi — oshxona uni ko‘rmaydi.\n\n' +
      'Maqsad bitta: mijoz nimani ko‘rishini o‘z ko‘zingiz bilan ko‘rish.\n' +
      'Buyurtma berib ko‘ring — kuzatuv ekrani o‘zi harakatga keladi.',
    after: 'Ko‘rib chiqdingizmi? Endi haqiqiysini boshlaymiz 👇',
  },

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
      'Ofitsiantga aytsangiz yangisini beradi.',
  },

  // ---------- Ofitsiant chaqirish ----------
  call: {
    // 1-qadam: qaysi stol
    askTable: 'Qaysi stolda o‘tiribsiz?',
    tableLabel: (n) => `${n}-stol`,
    noTables: 'Bu muassasada hali stol qo‘shilmagan. Ofitsiantga og‘zaki ayting.',

    // 2-qadam: qaysi ofitsiant
    pick: (n) => `Hozir bo‘sh ofitsiantlar (${n} ta). Kimni chaqiray?`,
    pickAllBusy:
      'Hozir hamma ofitsiant band 😔\n' +
      'Baribir chaqirsak bo‘ladi — birinchi bo‘shagani keladi. Kimni chaqiray?',
    anyone: '🎲  Farqi yo‘q, kim bo‘sh bo‘lsa',
    none:
      'Bu muassasada hali ofitsiant qo‘shilmagan 😔\n' +
      'Bir ozdan keyin urinib ko‘ring.',

    // 3-qadam: yuborildi
    sent: (waiter, table) =>
      `🔔 Chaqiruv yuborildi!\n\n` +
      `${waiter} — ${table}-stolga.\n` +
      'Hozir yoningizga boradi.',
    changeTable: '🪑  Boshqa stol',
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
    callWaiter: '🔔  Позвать официанта',
    reserve: '📅  Забронировать стол',
    lang: '🌐  Til / Язык',
    back: '⬅️  Назад',
    cancel: '✖️  Отмена',
  },

  help:
    'Этот бот делает три вещи:\n\n' +
    '🍽  Открывает меню — выбор блюд и заказ происходят в приложении\n' +
    '🔔  Зовёт официанта — сообщение уходит именно тому, кого вы выбрали\n' +
    '📅  Бронирует стол на будущую дату\n\n' +
    'В любой момент можно начать заново командой /bekor',

  openMenu: '🍽  Открыть меню',
  openDemo: '🧪  Посмотреть демо-меню',
  openLinkFallback:
    'Вместо кнопки — ссылка. Скопируйте и откройте в браузере (это тестовый адрес, Telegram не делает из него кнопку):',

  // ---------- Регистрация ----------
  auth: {
    shareBtn: '📱  Отправить мой номер',
    demoBtn: '🧪  Демо-меню',
    whyBtn: '❓  Зачем номер?',

    ask:
      'Прежде чем начать, давайте познакомимся 👋\n\n' +
      'Нажмите кнопку «📱 Отправить мой номер» внизу — номер отправится\n' +
      'через Telegram сам, вводить вручную не нужно.\n\n' +
      'Не хотите спешить? Кнопка «🧪 Демо-меню» покажет, как выглядит\n' +
      'приложение, без всякой регистрации.',

    why:
      'Зачем нужен номер:\n\n' +
      '📅  При брони не будем спрашивать его каждый раз\n' +
      '🔔  Официант будет знать, кто его позвал\n' +
      '🧾  Заказ не потеряется — найдём даже при смене телефона\n\n' +
      'Номер остаётся только у этого заведения и не используется для рекламы.\n' +
      'В любой момент можно написать /stop и удалить его.\n\n' +
      'Готовы — нажмите «📱 Отправить мой номер».',

    typed:
      'Вводить номер вручную не нужно — мы не сможем его проверить.\n' +
      'Просто нажмите кнопку «📱 Отправить мой номер» внизу.',

    notYours:
      'Похоже, это чужой номер 🙂\n' +
      'Пожалуйста, отправьте СВОЙ номер кнопкой «📱 Отправить мой номер».',

    needed:
      'Для этого сначала нужно отправить номер.\n' +
      'Нажмите /start и выберите «📱 Отправить мой номер».',

    done: (name) =>
      `✅ Спасибо${name ? `, ${name}` : ''}! Регистрация завершена.\n\n` +
      'Что теперь можно делать:\n\n' +
      '🍽  Открыть меню и заказать прямо со своего стола\n' +
      '🔔  Позвать официанта — выбрать конкретного или любого свободного\n' +
      '📅  Забронировать стол на другой день',

    back: (name) => `С возвращением${name ? `, ${name}` : ''}!`,

    removed:
      '🗑  Ваш номер удалён.\n\n' +
      'В любой момент можно отправить его снова и продолжить.',
  },

  demo: {
    intro:
      '🧪  Это ДЕМО-меню.\n\n' +
      'Внутри не настоящие блюда, а выставочные, и ваш заказ никуда\n' +
      'не уйдёт — кухня его не увидит.\n\n' +
      'Цель одна: своими глазами увидеть, что видит гость.\n' +
      'Попробуйте сделать заказ — экран отслеживания оживёт сам.',
    after: 'Посмотрели? Теперь давайте по-настоящему 👇',
  },

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
      'Попросите официанта дать новый.',
  },

  // ---------- Вызов официанта ----------
  call: {
    askTable: 'За каким столом вы сидите?',
    tableLabel: (n) => `Стол ${n}`,
    noTables: 'В этом заведении ещё не добавлены столы. Обратитесь к официанту.',

    pick: (n) => `Свободных официантов: ${n}. Кого позвать?`,
    pickAllBusy:
      'Сейчас все официанты заняты 😔\n' +
      'Позвать всё равно можно — подойдёт тот, кто освободится первым. Кого позвать?',
    anyone: '🎲  Без разницы, кто свободен',
    none:
      'В этом заведении ещё не добавлены официанты 😔\n' +
      'Попробуйте чуть позже.',

    sent: (waiter, table) =>
      `🔔 Вызов отправлен!\n\n` +
      `${waiter} — к столу №${table}.\n` +
      'Сейчас подойдёт.',
    changeTable: '🪑  Другой стол',
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
