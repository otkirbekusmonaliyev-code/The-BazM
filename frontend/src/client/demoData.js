// NAMUNA MENYU — hech qanday haqiqiy muassasaga tegishli emas.
//
// Nima uchun kerak: bot yoki saytdan kelgan odam ro'yxatdan o'tishdan OLDIN
// "bu qanday ko'rinadi?" degan savolga javob olishi kerak. Avval bot uni
// to'g'ridan-to'g'ri haqiqiy restoranning menyusiga olib borardi — bu ikki
// tomondan xato edi: begona odam ishlayotgan muassasaning ichiga kirardi,
// va u ko'rgan narsa o'sha kungi menyuga bog'liq bo'lardi (bo'sh menyu ham
// bo'lishi mumkin).
//
// Shu sababli namuna ma'lumot MIJOZ TOMONIDA turadi: serverga bitta ham
// so'rov ketmaydi, baza yuklanmaydi, va backend o'chgan bo'lsa ham namuna
// ochilaveradi.
//
// Ko'rinish esa haqiqiysining AYNAN O'ZI — bir xil ekranlar, bir xil
// animatsiyalar. Odam ko'rgan narsasini keyin o'z restoranida ham ko'radi.

export const DEMO_PLACE = { name: 'Bazm Demo', slug: 'demo' };

// Namuna taomlarda rasm o'rniga emoji turadi (`DishPlate` shuni chizadi) —
// shu bilan hech qanday fayl yuklanmaydi va menyu bir zumda ochiladi.
export const DEMO_MENU = [
  {
    id: 'demo-cat-1',
    name: 'Salat va yengil taomlar',
    sortOrder: 1,
    items: [
      {
        id: 'demo-1',
        name: 'Achichuk',
        description: 'Pomidor, piyoz, achchiq qalampir va rayhon',
        price: 18000,
        emoji: '🥗',
        isAvailable: true,
      },
      {
        id: 'demo-2',
        name: 'Sezar tovuq bilan',
        description: 'Romen salati, parmezan, kruton, uy sousi',
        price: 42000,
        emoji: '🥙',
        isAvailable: true,
      },
      {
        id: 'demo-3',
        name: 'Mavsumiy sabzavotlar',
        description: 'Bodring, pomidor, ko\'katlar — kunlik yig\'im',
        price: 22000,
        emoji: '🥒',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'demo-cat-2',
    name: 'Issiq taomlar',
    sortOrder: 2,
    items: [
      {
        id: 'demo-4',
        name: 'Toshkent oshi',
        description: 'Devzira guruch, qo\'y go\'shti, sariq sabzi, danak',
        price: 55000,
        emoji: '🍚',
        isAvailable: true,
      },
      {
        id: 'demo-5',
        name: 'Qozon kabob',
        description: 'Kartoshka va go\'sht qozonda, piyoz halqalari bilan',
        price: 68000,
        emoji: '🥘',
        isAvailable: true,
      },
      {
        id: 'demo-6',
        name: 'Bo\'g\'irsoq lag\'mon',
        description: 'Qo\'lda cho\'zilgan xamir, achchiq-chuchuk qayla',
        price: 48000,
        emoji: '🍜',
        isAvailable: true,
      },
      {
        id: 'demo-7',
        name: 'Norin',
        description: 'Qo\'lda kesilgan xamir va qazi',
        price: 52000,
        emoji: '🍲',
        isAvailable: true,
      },
      {
        id: 'demo-8',
        name: 'Mastava',
        description: 'Suyuq osh, qatiq va ko\'kat bilan',
        price: 32000,
        emoji: '🍛',
        isAvailable: false,
      },
    ],
  },
  {
    id: 'demo-cat-3',
    name: 'Panjara (grill)',
    sortOrder: 3,
    items: [
      {
        id: 'demo-9',
        name: 'Qo\'y kabobi',
        description: 'Cho\'g\'da pishirilgan, achchiq piyoz bilan · 2 sixcha',
        price: 46000,
        emoji: '🍢',
        isAvailable: true,
      },
      {
        id: 'demo-10',
        name: 'Tovuq shashlik',
        description: 'Marinadda 12 soat turgan tovuq filesi',
        price: 38000,
        emoji: '🍗',
        isAvailable: true,
      },
      {
        id: 'demo-11',
        name: 'Panjara baliq',
        description: 'Zog\'ora baliq, limon va ko\'kat bilan',
        price: 74000,
        emoji: '🐟',
        isAvailable: true,
      },
      {
        id: 'demo-12',
        name: 'Tandir non',
        description: 'Issiq, tandirdan endi olingan',
        price: 8000,
        emoji: '🫓',
        isAvailable: true,
      },
    ],
  },
  {
    id: 'demo-cat-4',
    name: 'Shirinlik va ichimlik',
    sortOrder: 4,
    items: [
      {
        id: 'demo-13',
        name: 'Chak-chak',
        description: 'Asal sherbatida, yong\'oq bilan',
        price: 24000,
        emoji: '🍯',
        isAvailable: true,
      },
      {
        id: 'demo-14',
        name: 'Uy muzqaymog\'i',
        description: 'Pista, shokolad yoki qulupnay',
        price: 26000,
        emoji: '🍨',
        isAvailable: true,
      },
      {
        id: 'demo-15',
        name: 'Ko\'k choy',
        description: 'Choynak · 1 litr',
        price: 10000,
        emoji: '🍵',
        isAvailable: true,
      },
      {
        id: 'demo-16',
        name: 'Uy kompoti',
        description: 'Olcha va o\'rik, muzli',
        price: 14000,
        emoji: '🥤',
        isAvailable: true,
      },
    ],
  },
];

// Namuna buyurtma qanday bosqichlardan o'tishi. Haqiqiy hayotda bu
// bosqichlarni oshxona va ofitsiant bosadi — bu yerda vaqt bilan
// o'z-o'zidan o'tadi, shunda odam butun yo'lni oxirigacha ko'radi.
export const DEMO_FLOW = [
  { status: 'accepted', afterMs: 2200 },
  { status: 'preparing', afterMs: 3200 },
  { status: 'ready', afterMs: 4200 },
  { status: 'delivered', afterMs: 3600 },
];
