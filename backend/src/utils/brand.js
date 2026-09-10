// MUASSASA BRENDI — Pro tarifda mijoz ilovasining ko'rinishi.
//
// Uch narsani almashtirish mumkin: URG'U RANGI, FON OHANGI va SHRIFTLAR.
//
// HECH BIRI ERKIN EMAS — hammasi tayyor ro'yxatdan tanlanadi. Sabab:
// erkin rang tanlagich bersak, birinchi kun kimdir och sariq tanlaydi va
// "Savatga" tugmasi oq fonda o'qilmay qoladi; erkin shrift bersak,
// kirill yozuvi yo'q shrift tanlanadi va menyu buziladi. Bunda mijoz
// emas, BIZ aybdor bo'lamiz.
//
// Ro'yxatdagi har bir qiymat kunduzgi va tungi rejim uchun alohida
// tekshirilgan. Dizayn CSS o'zgaruvchilariga qurilgani uchun tanlov
// butun ilova bo'ylab o'z-o'zidan tarqaladi.

// ============================================================
//  1) URG'U RANGI — tugmalar, narxlar, faol bo'lim
// ============================================================
const BRAND_COLORS = [
  { key: 'gold', name: 'Oltin', dark: '#c6a05c', light: '#8a6420' },
  { key: 'terracotta', name: 'Terrakota', dark: '#c97b52', light: '#9c4f2a' },
  { key: 'olive', name: 'Zaytun', dark: '#8fa860', light: '#5c7331' },
  { key: 'cherry', name: 'Olcha', dark: '#c96b7a', light: '#96304a' },
  { key: 'ocean', name: 'Dengiz', dark: '#6fa3c9', light: '#2f6187' },
  { key: 'plum', name: 'Olxo‘ri', dark: '#a680c4', light: '#6b3f8c' },
  { key: 'copper', name: 'Mis', dark: '#cf8f4a', light: '#96601f' },
  { key: 'teal', name: 'Firuza', dark: '#5eb0a6', light: '#2b7168' },
  { key: 'slate', name: 'Grafit', dark: '#9aa5b1', light: '#4a5560' },
];

// ============================================================
//  2) FON OHANGI — sahifa va kartochkalar
// ============================================================
//
// Bu yerda YORQINLIK o'zgarmaydi, faqat ohang (rang tusi). Shu sababli
// matn kontrasti hech qachon buzilmaydi: to'q fon to'q holicha qoladi,
// och fon och holicha. Almashadigan narsa — xonaning "harorati".
const BRAND_SURFACES = [
  {
    key: 'classic',
    name: 'Klassik',
    dark: { bg: '#171c16', card: '#1f251d', card2: '#252c22' },
    light: { bg: '#fdfbf6', card: '#ffffff', card2: '#f4f1e8' },
  },
  {
    key: 'charcoal',
    name: 'Ko‘mir',
    dark: { bg: '#161616', card: '#1e1e1e', card2: '#262626' },
    light: { bg: '#fafafa', card: '#ffffff', card2: '#f0f0f0' },
  },
  {
    key: 'espresso',
    name: 'Espresso',
    dark: { bg: '#1a1512', card: '#231d18', card2: '#2b241e' },
    light: { bg: '#fdf9f4', card: '#ffffff', card2: '#f4ede4' },
  },
  {
    key: 'midnight',
    name: 'Yarim tun',
    dark: { bg: '#12161f', card: '#1a2029', card2: '#212832' },
    light: { bg: '#f8fafd', card: '#ffffff', card2: '#eef2f8' },
  },
  {
    key: 'forest',
    name: 'O‘rmon',
    dark: { bg: '#121a16', card: '#1a231e', card2: '#212b25' },
    light: { bg: '#f7fbf8', card: '#ffffff', card2: '#ecf3ee' },
  },
  {
    key: 'wine',
    name: 'Vino',
    dark: { bg: '#1a1316', card: '#231a1e', card2: '#2b2126' },
    light: { bg: '#fdf8fa', card: '#ffffff', card2: '#f5ecef' },
  },
];

// ============================================================
//  3) SHRIFTLAR
// ============================================================
//
// Hammasi Google Fonts'dan va hammasi `index.html` da OLDINDAN
// yuklangan — tanlov o'zgarganda hech narsa kutilmaydi.
//
// `stack` — to'liq CSS qiymati, zaxira shriftlari bilan. Shrift
// yuklanmasa ham matn o'qilishi kerak.

// Sarlavhalar uchun (taom nomi, muassasa nomi, ekran sarlavhalari)
const DISPLAY_FONTS = [
  { key: 'fraunces', name: 'Fraunces', note: 'Hozirgi — issiq, zamonaviy serif', stack: "'Fraunces', Georgia, serif" },
  { key: 'playfair', name: 'Playfair Display', note: 'Klassik restoran ko‘rinishi', stack: "'Playfair Display', Georgia, serif" },
  { key: 'cormorant', name: 'Cormorant', note: 'Nozik, qimmatbaho', stack: "'Cormorant Garamond', Georgia, serif" },
  { key: 'marcellus', name: 'Marcellus', note: 'Tinch, rim uslubi', stack: "'Marcellus', Georgia, serif" },
  { key: 'unbounded', name: 'Unbounded', note: 'Dadil, zamonaviy', stack: "'Unbounded', 'Space Grotesk', sans-serif" },
  { key: 'bricolage', name: 'Bricolage', note: 'Erkin, xarakterli', stack: "'Bricolage Grotesque', 'Inter', sans-serif" },
  { key: 'space', name: 'Space Grotesk', note: 'Texnik, aniq', stack: "'Space Grotesk', 'Inter', sans-serif" },
];

// Asosiy matn uchun (tavsif, tugmalar, ro'yxatlar)
const BODY_FONTS = [
  { key: 'inter', name: 'Inter', note: 'Hozirgi — ekranda eng o‘qishli', stack: "'Inter', system-ui, sans-serif" },
  { key: 'manrope', name: 'Manrope', note: 'Yumaloq, do‘stona', stack: "'Manrope', 'Inter', sans-serif" },
  { key: 'dmsans', name: 'DM Sans', note: 'Sokin, toza', stack: "'DM Sans', 'Inter', sans-serif" },
  { key: 'lora', name: 'Lora', note: 'Serif — kitobiy, iliq', stack: "'Lora', Georgia, serif" },
  { key: 'space', name: 'Space Grotesk', note: 'Zamonaviy, biroz texnik', stack: "'Space Grotesk', 'Inter', sans-serif" },
];

const DEFAULTS = {
  color: 'gold',
  surface: 'classic',
  displayFont: 'fraunces',
  bodyFont: 'inter',
};

const pick = (list, key, fallback) =>
  list.find((x) => x.key === key) || list.find((x) => x.key === fallback);

const has = (list, key) => list.some((x) => x.key === key);

// Nomaʼlum yoki bo'sh kalit kelsa — standart qiymat. Tekshirilmagan
// qiymat hech qachon ilovaga o'tmaydi.
const colorOf = (key) => pick(BRAND_COLORS, key, DEFAULTS.color);
const surfaceOf = (key) => pick(BRAND_SURFACES, key, DEFAULTS.surface);
const displayFontOf = (key) => pick(DISPLAY_FONTS, key, DEFAULTS.displayFont);
const bodyFontOf = (key) => pick(BODY_FONTS, key, DEFAULTS.bodyFont);

// Muassasa yozuvidan ilovaga uzatiladigan to'liq brend
function themeOf({ brandColor, brandSurface, brandDisplayFont, brandBodyFont } = {}) {
  return {
    color: colorOf(brandColor),
    surface: surfaceOf(brandSurface),
    displayFont: displayFontOf(brandDisplayFont),
    bodyFont: bodyFontOf(brandBodyFont),
  };
}

// Panel tanlov ro'yxatlarini shu yerdan oladi
function options() {
  return {
    colors: BRAND_COLORS,
    surfaces: BRAND_SURFACES,
    displayFonts: DISPLAY_FONTS,
    bodyFonts: BODY_FONTS,
    defaults: DEFAULTS,
  };
}

const validators = {
  brandColor: (k) => has(BRAND_COLORS, k),
  brandSurface: (k) => has(BRAND_SURFACES, k),
  brandDisplayFont: (k) => has(DISPLAY_FONTS, k),
  brandBodyFont: (k) => has(BODY_FONTS, k),
};

module.exports = {
  BRAND_COLORS,
  BRAND_SURFACES,
  DISPLAY_FONTS,
  BODY_FONTS,
  DEFAULTS,
  colorOf,
  surfaceOf,
  displayFontOf,
  bodyFontOf,
  themeOf,
  options,
  validators,
};
