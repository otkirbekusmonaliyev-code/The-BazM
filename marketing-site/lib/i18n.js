// Saytning ikki tildagi matnlari. Har bir til alohida marshrutda
// server tomonida render qilinadi (`/` — o'zbekcha, `/ru` — ruscha),
// shuning uchun Google ikkala versiyani ham to'liq matn bilan indekslaydi.

export const LANGS = ['uz', 'ru'];

export const dict = {
  uz: {
    lang: 'uz',
    htmlLang: 'uz',
    meta: {
      title: 'Bazm — restoran va kafelar uchun QR menyu va buyurtma tizimi',
      description:
        'Mijozlaringiz stoldan turmasdan QR kod orqali buyurtma bersin. Oshxona buyurtmani darhol ko\'radi, ofitsiant qayerga borishini biladi. O\'rnatish 1 kun, oylik obuna.',
      keywords:
        'restoran dasturi, QR menyu, kafe avtomatlashtirish, buyurtma tizimi, oshxona ekrani, Toshkent, O\'zbekiston',
    },
    nav: {
      how: 'Qanday ishlaydi',
      pricing: 'Narxlar',
      faq: 'Savollar',
      apply: 'So\'rov yuborish',
      login: 'Kirish',
    },
    hero: {
      badge: 'Restoran va kafelar uchun',
      title: 'Mijozlaringiz [[stoldan turmasdan]] telefon orqali buyurtma bersin',
      subtitle:
        'QR kodni skanerlaydi, menyuni ko\'radi, buyurtma beradi — hammasi shu yerda tugaydi. Sizga esa: oshxonaga buyurtma avtomatik tushadi, ofitsiant qachon qayerga borishini biladi, va siz kuningizni raqamlarda ko\'rasiz.',
      cta: 'So\'rov yuborish',
      secondary: 'Qanday ishlaydi',
    },
    why: {
      title: 'Nima uchun [[kerak]]',
      points: [
        'Ofitsiantlar soni kamayadi, ammo xizmat tezlashadi',
        'Buyurtmalar adashmaydi — hammasi avtomatik yozib boriladi',
        'Kunlik savdo va eng ko\'p sotilgan taomlarni bir joyda ko\'rasiz',
        'O\'rnatish 1 kun, oylik obuna — istalgan vaqt bekor qilish mumkin',
      ],
      outro:
        'Restoraningiz yoki kafeningiz — kichikmi, kattami — farqi yo\'q. Bizga qo\'shiling, keyin ishlab ko\'ring.',
    },
    how: {
      title: 'Qanday [[ishlaydi]]',
      subtitle: 'To\'rt qadam — buyurtmadan yetkazishgacha',
      steps: [
        { icon: '⧉', title: 'QR skanerlash', text: 'Mijoz stol ustidagi kodni telefoni bilan skanerlaydi' },
        { icon: '☰', title: 'Menyudan tanlash', text: 'Rasmli menyu, izoh qoldirish va savat — hammasi telefonda' },
        { icon: '⚡', title: 'Oshxona darhol ko\'radi', text: 'Buyurtma sahifani yangilamasdan oshxona ekranida paydo bo\'ladi' },
        { icon: '✓', title: 'Ofitsiant yetkazadi', text: 'Oshpaz bo\'sh ofitsiantni tanlaydi, u qabul qilib stolga olib boradi' },
      ],
    },
    pricing: {
      title: '[[Narxlar]]',
      subtitle: 'Har oy to\'lanadi, istalgan vaqt bekor qilinadi',
      month: '/oy',
      popular: 'Eng ommabop',
      cta: 'Shu tarif bilan bog\'lanish',
    },
    trust: {
      title: 'ta restoran va kafe [[bizga ishonadi]]',
      subtitle: 'Har kuni yuzlab buyurtma Bazm orqali o\'tadi',
    },
    faq: {
      title: 'Ko\'p so\'raladigan [[savollar]]',
      items: [
        {
          q: 'Internet uzilib qolsa nima bo\'ladi?',
          a: 'Oshxona va ofitsiant ekranlari aloqa tiklangan zahoti barcha buyurtmalarni avtomatik qayta yuklaydi — hech narsa yo\'qolmaydi. Mijoz esa buyurtma yuborilmaganini darhol ko\'radi va qayta urinishi mumkin.',
        },
        {
          q: 'O\'rnatish qancha vaqt oladi?',
          a: 'Odatda bir kun. Biz menyuni kiritamiz, stollarga QR kod tayyorlaymiz va xodimlaringizni 30 daqiqada o\'rgatamiz. Alohida uskuna sotib olish shart emas — mavjud planshet yoki telefon yetadi.',
        },
        {
          q: 'Bekor qilsam pulim qaytariladimi?',
          a: 'Obuna oylik — bekor qilsangiz, joriy oy oxirigacha xizmat ishlaydi, keyingi oy uchun hisob chiqarilmaydi. Bog\'lanish majburiyati yo\'q.',
        },
        {
          q: 'Ofitsiantlarim ishsiz qolmaydimi?',
          a: 'Yo\'q. Tizim ofitsiantni almashtirmaydi — u faqat buyurtma qabul qilish va yugurishni kamaytiradi. Ofitsiant mehmonga ko\'proq vaqt ajratadi, bitta odam ko\'proq stolga ulguradi.',
        },
        {
          q: 'Mijoz Telegramsiz ham buyurtma bera oladimi?',
          a: 'Ha. QR kod oddiy brauzerda ham ochiladi. Telegram Mini App — bu qulaylik uchun qo\'shimcha imkoniyat, majburiy emas.',
        },
        {
          q: 'Ma\'lumotlarim boshqa restoranlar bilan aralashib ketmaydimi?',
          a: 'Yo\'q. Har bir restoranning ma\'lumotlari butunlay alohida bazada saqlanadi — menyu, buyurtmalar, xodimlar. Bu texnik jihatdan ham, huquqiy jihatdan ham to\'liq ajratilgan.',
        },
      ],
    },
    demo: {
      title: 'Bir marta bosib [[ko\'ring]]',
      subtitle: 'Chapdagi taomni tanlang — o\'ngdagi oshxona ekranida darhol paydo bo\'ladi',
      client: 'Mijoz telefoni',
      kitchen: 'Oshxona ekrani',
      table: 'stol',
      empty: 'Buyurtma kutilmoqda',
      emptyHint: 'Chapdan taom tanlang',
      accept: 'QABUL QILISH',
      preparing: 'TAYYORLANMOQDA',
      ready: 'TAYYOR',
      reset: 'Boshidan',
      note: 'Haqiqiy tizimda ham xuddi shunday — sahifa yangilanmaydi, buyurtma o\'zi paydo bo\'ladi.',
      dishes: [
        { name: 'Qozon kabob', price: 68000 },
        { name: 'Osh (to\'y palov)', price: 55000 },
        { name: 'Lag\'mon', price: 42000 },
        { name: 'Ko\'k choy', price: 12000 },
      ],
    },
    calc: {
      title: 'Qancha [[tejaysiz]]',
      subtitle: 'Surgichni suring — taxminiy hisob darhol o\'zgaradi',
      tables: 'Stollar soni',
      perTable: 'Bir stolga kunlik buyurtma',
      resultTime: 'Ofitsiant kuniga tejaydigan vaqt',
      resultMoney: 'Oyiga taxminiy tejash',
      resultOrders: 'Oyiga qo\'shimcha buyurtma',
      hours: 'soat',
      note: 'Hisob taxminiy: bitta buyurtmani qabul qilish o\'rtacha 3 daqiqa vaqt oladi va tizim buni to\'liq o\'z zimmasiga oladi. Aniq raqam menyu va oqimga bog\'liq.',
      cta: 'Men ham shunday qilmoqchiman',
    },
    form: {
      title: 'Qo\'shilish uchun so\'rov',
      subtitle: 'Formani to\'ldiring — bir ish kuni ichida bog\'lanamiz',
      country: 'Davlat',
      region: 'Viloyat',
      regionPlaceholder: 'Viloyatni tanlang',
      city: 'Shahar / tuman',
      cityPlaceholder: 'Avval viloyatni tanlang',
      businessType: 'Biznes turi',
      restaurant: 'Restoran',
      cafe: 'Kafe',
      name: 'Restoran / kafe nomi',
      namePlaceholder: 'Restoraningiz yoki kafeningiz nomi',
      phone: 'Telefon raqami',
      email: 'Email (ixtiyoriy)',
      plan: 'Qiziqtirgan tarif',
      note: 'Izoh (ixtiyoriy)',
      notePlaceholder: 'Nechta stolingiz bor, qanday savollaringiz bor…',
      submit: 'So\'rov yuborish',
      submitting: 'Yuborilmoqda…',
      successTitle: 'So\'rovingiz qabul qilindi',
      successText: 'Tez orada siz bilan bog\'lanamiz. Odatda bu bir ish kunidan oshmaydi.',
      // Odam formani yuborgach "endi nima bo'ladi?" degan savol bilan
      // qoladi. Javob qayerdan kelishini AYNAN shu yerda aytamiz.
      successWhere:
        'Javobni shu saytning o\'zidan bilib olasiz: so\'rovingiz tasdiqlangani '
        + 'yoki rad etilganini tez orada quyidagi sahifada ko\'rishingiz mumkin.',
      successCheck: 'So\'rov holatini tekshirish',
      back: 'Bosh sahifaga',
      required: 'Majburiy maydon',
    },

    // ---------- So'rov holati sahifasi ----------
    status: {
      title: 'So\'rovingiz holati',
      subtitle:
        'So\'rovda ko\'rsatgan pochtangiz bilan kiring — javobni shu yerda ko\'rasiz.',
      signIn: 'Google hisobi bilan davom etish',
      signingIn: 'Tekshirilmoqda…',
      why: 'Nega Google? Chunki javob ichida kirish paroli bo\'ladi — u faqat pochta egasiga ko\'rinishi kerak.',

      notConfigured:
        'Google bilan kirish hozircha sozlanmagan. Iltimos, biz bilan bog\'laning — javobni to\'g\'ridan-to\'g\'ri aytamiz.',

      notFoundTitle: 'Bu pochta bilan so\'rov topilmadi',
      notFoundText:
        'Boshqa pochta bilan yuborgan bo\'lishingiz mumkin. Aynan so\'rovda yozgan pochtangiz bilan kirib ko\'ring, yoki yangi so\'rov yuboring.',

      pendingTitle: 'So\'rovingiz ko\'rib chiqilmoqda',
      pendingText:
        'Hali javob berilmadi. Odatda bu bir ish kunidan oshmaydi — birozdan keyin shu yerga qaytib qarang.',

      rejectedTitle: 'So\'rovingiz tasdiqlanmadi',
      rejectedText:
        'Afsuski bu safar qo\'sha olmadik. Vaziyat o\'zgargan bo\'lsa yangi so\'rov yuborishingiz mumkin — yoki biz bilan bog\'lansangiz, sababini batafsil aytamiz.',
      rejectedNote: 'Sabab:',

      approvedTitle: 'Tabriklaymiz — so\'rovingiz tasdiqlandi!',
      approvedText: 'Quyidagi ma\'lumotlar bilan tizimga kiring:',
      fieldPlace: 'Muassasa',
      fieldUrl: 'Manzil',
      fieldPhone: 'Telefon',
      fieldPassword: 'Parol',
      passwordOnce:
        'Parol faqat SHU SAFAR ko\'rsatiladi — uni yozib oling. Birinchi kirishdan keyin almashtiring.',
      passwordGone:
        'Parolni allaqachon ko\'rgansiz, shuning uchun u qaytadan ko\'rsatilmaydi. Yo\'qotgan bo\'lsangiz biz bilan bog\'laning.',
      openApp: 'Tizimga kirish',
      signOut: 'Chiqish',
      sentAt: 'Yuborilgan',
      answeredAt: 'Javob berilgan',
      failed: 'Tekshirib bo\'lmadi. Birozdan keyin qayta urinib ko\'ring.',
    },
    footer: {
      tagline: 'Restoran va kafelar uchun buyurtma va boshqaruv platformasi',
      contact: 'Aloqa',
      product: 'Mahsulot',
      rights: 'Barcha huquqlar himoyalangan',
      blogSoon: 'Blog — tez orada',
    },
  },

  ru: {
    lang: 'ru',
    htmlLang: 'ru',
    meta: {
      title: 'Bazm — QR-меню и система заказов для ресторанов и кафе',
      description:
        'Гости заказывают с телефона, не вставая из-за стола. Кухня видит заказ мгновенно, официант знает, куда идти. Запуск за 1 день, помесячная подписка.',
      keywords:
        'программа для ресторана, QR меню, автоматизация кафе, система заказов, кухонный экран, Ташкент, Узбекистан',
    },
    nav: {
      how: 'Как это работает',
      pricing: 'Тарифы',
      faq: 'Вопросы',
      apply: 'Оставить заявку',
      login: 'Войти',
    },
    hero: {
      badge: 'Для ресторанов и кафе',
      title: 'Пусть гости заказывают с телефона, [[не вставая из-за стола]]',
      subtitle:
        'Сканирует QR-код, смотрит меню, делает заказ — и всё. А вы получаете: заказ автоматически уходит на кухню, официант знает, когда и куда идти, а день виден в цифрах.',
      cta: 'Оставить заявку',
      secondary: 'Как это работает',
    },
    why: {
      title: 'Зачем это [[нужно]]',
      points: [
        'Официантов нужно меньше, а обслуживание становится быстрее',
        'Заказы не путаются — всё фиксируется автоматически',
        'Дневная выручка и топ блюд — в одном месте',
        'Запуск за 1 день, помесячная подписка — отменить можно в любой момент',
      ],
      outro:
        'Неважно, маленькое у вас заведение или большое. Присоединяйтесь и попробуйте в деле.',
    },
    how: {
      title: 'Как это [[работает]]',
      subtitle: 'Четыре шага — от заказа до подачи',
      steps: [
        { icon: '⧉', title: 'Сканирование QR', text: 'Гость сканирует код на столе своим телефоном' },
        { icon: '☰', title: 'Выбор из меню', text: 'Меню с фото, комментарии к блюдам и корзина — всё в телефоне' },
        { icon: '⚡', title: 'Кухня видит сразу', text: 'Заказ появляется на кухонном экране без обновления страницы' },
        { icon: '✓', title: 'Официант подаёт', text: 'Повар выбирает свободного официанта, тот принимает и несёт к столу' },
      ],
    },
    pricing: {
      title: '[[Тарифы]]',
      subtitle: 'Оплата помесячно, отмена в любой момент',
      month: '/мес',
      popular: 'Популярный',
      cta: 'Связаться по этому тарифу',
    },
    trust: {
      title: 'ресторанов и кафе [[уже с нами]]',
      subtitle: 'Каждый день через Bazm проходят сотни заказов',
    },
    faq: {
      title: 'Частые [[вопросы]]',
      items: [
        {
          q: 'Что будет, если пропадёт интернет?',
          a: 'Экраны кухни и официанта автоматически подгружают все заказы, как только связь восстановится — ничего не теряется. Гость же сразу видит, что заказ не ушёл, и может повторить отправку.',
        },
        {
          q: 'Сколько занимает запуск?',
          a: 'Обычно один день. Мы заводим меню, готовим QR-коды для столов и обучаем персонал за 30 минут. Покупать оборудование не нужно — подойдёт имеющийся планшет или телефон.',
        },
        {
          q: 'Вернут ли деньги при отмене?',
          a: 'Подписка помесячная: при отмене сервис работает до конца оплаченного месяца, следующий счёт не выставляется. Никаких обязательств по срокам.',
        },
        {
          q: 'Не останутся ли официанты без работы?',
          a: 'Нет. Система не заменяет официанта — она снимает с него приём заказов и лишнюю беготню. Официант больше времени уделяет гостю и успевает обслужить больше столов.',
        },
        {
          q: 'Можно ли заказать без Telegram?',
          a: 'Да. QR-код открывается и в обычном браузере. Telegram Mini App — дополнительное удобство, а не обязательное условие.',
        },
        {
          q: 'Не смешаются ли мои данные с другими заведениями?',
          a: 'Нет. Данные каждого заведения хранятся в отдельной базе — меню, заказы, сотрудники. Разделение полное и на техническом, и на юридическом уровне.',
        },
      ],
    },
    demo: {
      title: 'Нажмите и [[посмотрите]]',
      subtitle: 'Выберите блюдо слева — справа на кухонном экране заказ появится сразу',
      client: 'Телефон гостя',
      kitchen: 'Кухонный экран',
      table: 'стол',
      empty: 'Ожидание заказа',
      emptyHint: 'Выберите блюдо слева',
      accept: 'ПРИНЯТЬ',
      preparing: 'ГОТОВИТСЯ',
      ready: 'ГОТОВО',
      reset: 'Сначала',
      note: 'В реальной системе всё так же — страница не обновляется, заказ появляется сам.',
      dishes: [
        { name: 'Казан-кебаб', price: 68000 },
        { name: 'Плов', price: 55000 },
        { name: 'Лагман', price: 42000 },
        { name: 'Зелёный чай', price: 12000 },
      ],
    },
    calc: {
      title: 'Сколько вы [[сэкономите]]',
      subtitle: 'Двигайте ползунок — расчёт меняется сразу',
      tables: 'Количество столов',
      perTable: 'Заказов в день на стол',
      resultTime: 'Официант экономит в день',
      resultMoney: 'Экономия в месяц',
      resultOrders: 'Дополнительных заказов в месяц',
      hours: 'ч',
      note: 'Расчёт приблизительный: приём одного заказа занимает в среднем 3 минуты, система берёт это на себя. Точная цифра зависит от меню и потока.',
      cta: 'Хочу так же',
    },
    form: {
      title: 'Заявка на подключение',
      subtitle: 'Заполните форму — свяжемся в течение рабочего дня',
      country: 'Страна',
      region: 'Область',
      regionPlaceholder: 'Выберите область',
      city: 'Город / район',
      cityPlaceholder: 'Сначала выберите область',
      businessType: 'Тип заведения',
      restaurant: 'Ресторан',
      cafe: 'Кафе',
      name: 'Название заведения',
      namePlaceholder: 'Название вашего ресторана или кафе',
      phone: 'Номер телефона',
      email: 'Email (необязательно)',
      plan: 'Интересующий тариф',
      note: 'Комментарий (необязательно)',
      notePlaceholder: 'Сколько у вас столов, какие есть вопросы…',
      submit: 'Отправить заявку',
      submitting: 'Отправляем…',
      successTitle: 'Заявка принята',
      successText: 'Мы свяжемся с вами в ближайшее время — обычно в течение рабочего дня.',
      successWhere:
        'Ответ вы узнаете прямо на этом сайте: одобрена ваша заявка или отклонена — '
        + 'можно будет посмотреть на странице ниже.',
      successCheck: 'Проверить статус заявки',
      back: 'На главную',
      required: 'Обязательное поле',
    },
    status: {
      title: 'Статус вашей заявки',
      subtitle: 'Войдите с той почтой, которую указали в заявке — ответ будет здесь.',
      signIn: 'Продолжить с аккаунтом Google',
      signingIn: 'Проверяем…',
      why: 'Почему Google? В ответе есть пароль для входа — его должен видеть только владелец почты.',

      notConfigured:
        'Вход через Google пока не настроен. Пожалуйста, свяжитесь с нами — мы сообщим ответ напрямую.',

      notFoundTitle: 'Заявка с этой почтой не найдена',
      notFoundText:
        'Возможно, вы отправляли её с другой почты. Попробуйте войти с той, что указывали в заявке, или отправьте новую.',

      pendingTitle: 'Заявка на рассмотрении',
      pendingText:
        'Ответа пока нет. Обычно это занимает не больше рабочего дня — загляните сюда чуть позже.',

      rejectedTitle: 'Заявка не одобрена',
      rejectedText:
        'К сожалению, в этот раз не получилось. Если обстоятельства изменились, можно отправить новую заявку — или свяжитесь с нами, и мы расскажем подробнее.',
      rejectedNote: 'Причина:',

      approvedTitle: 'Поздравляем — заявка одобрена!',
      approvedText: 'Войдите в систему с этими данными:',
      fieldPlace: 'Заведение',
      fieldUrl: 'Адрес',
      fieldPhone: 'Телефон',
      fieldPassword: 'Пароль',
      passwordOnce:
        'Пароль показывается ТОЛЬКО СЕЙЧАС — запишите его. После первого входа смените.',
      passwordGone:
        'Вы уже видели пароль, поэтому он больше не показывается. Если потеряли — свяжитесь с нами.',
      openApp: 'Войти в систему',
      signOut: 'Выйти',
      sentAt: 'Отправлена',
      answeredAt: 'Ответ дан',
      failed: 'Не удалось проверить. Попробуйте чуть позже.',
    },

    footer: {
      tagline: 'Платформа заказов и управления для ресторанов и кафе',
      contact: 'Контакты',
      product: 'Продукт',
      rights: 'Все права защищены',
      blogSoon: 'Блог — скоро',
    },
  },
};

export const t = (lang) => dict[lang] || dict.uz;

// Bir tildan ikkinchisiga o'tish uchun manzil
export function altPath(pathname, lang) {
  const clean = pathname.replace(/^\/ru(?=\/|$)/, '') || '/';
  return lang === 'ru' ? (clean === '/' ? '/ru' : `/ru${clean}`) : clean;
}
