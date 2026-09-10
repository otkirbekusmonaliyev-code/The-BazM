// Sessiyalarni localStorage'da saqlash.
//
// Butun platformada BITTA login sahifasi bor: foydalanuvchi telefon va parol
// kiritadi, server esa uning kimligini (super admin / admin / oshpaz /
// ofitsiant) va qaysi muassasaga tegishli ekanini o'zi aniqlaydi.
//
// Sessiyalar rol bo'yicha alohida kalitlarda saqlanadi — shu bilan bitta
// qurilmada oshxona ekranini ochib, yonida ofitsiant panelini ham sinash
// mumkin bo'ladi.

const KEY_SUPER = 'bazm.super';
const KEY_LAST = 'bazm.last';
const STAFF_ROLES = ['admin', 'kitchen', 'waiter'];

export const STORAGE_BLOCKED =
  'Brauzer sessiyani saqlay olmadi. Yashirin (incognito) rejimni yoping yoki '
  + 'sayt uchun ma\'lumot saqlashga ruxsat bering — aks holda sahifa yangilanganda '
  + 'tizim sizni chiqarib yuboradi.';

const keyStaff = (slug, role) => `bazm.staff.${slug}.${role}`;
const keyClient = (slug) => `bazm.client.${slug}`;

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

// Yozib bo'lganini QAYTARADI. Avval xato jimgina yutilardi va natijada
// eng chalg'ituvchi holat yuzaga kelardi: kirish muvaffaqiyatli ko'rinadi,
// panel ochiladi, lekin F5 bosilishi bilan hammasi login sahifasiga
// qaytadi — chunki sessiya aslida hech qayerga yozilmagan edi.
// (localStorage private rejimda yoki joy tugaganda yozishga ruxsat bermaydi.)
function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

export const superAuth = {
  get: () => read(KEY_SUPER),
  set: (session) => write(KEY_SUPER, session),
  clear: () => write(KEY_SUPER, null),
};

export const staffAuth = {
  set(slug, session) {
    return write(keyStaff(slug, session.user.role), session);
  },
  get: (slug, role) => read(keyStaff(slug, role)),

  // Panel uchun mos sessiya: oshxona paneli ham `kitchen`, ham `admin`
  // sessiyasi bilan ochilishi mumkin
  getFor(slug, allowedRoles) {
    for (const role of allowedRoles) {
      const session = read(keyStaff(slug, role));
      if (session && session.token) return session;
    }
    return null;
  },

  // Shu muassasada UMUMAN qanday sessiya bor? Panel o'z rolini topmasa,
  // odamni to'g'ridan-to'g'ri login sahifasiga uloqtirmasdan, avval shu
  // yerga qaraymiz: ofitsiant sessiyasi bilan /admin ga kirgan odam
  // "qaytadan kiring" o'rniga o'z paneliga tushgani ma'qul.
  anyFor(slug) {
    for (const role of STAFF_ROLES) {
      const session = read(keyStaff(slug, role));
      if (session && session.token) return session;
    }
    return null;
  },

  clear(slug, role) {
    if (role) write(keyStaff(slug, role), null);
    else STAFF_ROLES.forEach((r) => write(keyStaff(slug, r), null));
    // Sessiya o'chdi — login sahifasi endi "Davom etish" taklif qilmasin.
    // Avval taklif qolib ketardi va uni bosgan odam panelga o'tib, darhol
    // login sahifasiga qaytarilardi: tashqaridan qaraganda tugamaydigan halqa.
    forgetLastIfGone();
  },
};

export const clientAuth = {
  get: (slug) => read(keyClient(slug)),
  set: (slug, session) => write(keyClient(slug), session),
  clear: (slug) => write(keyClient(slug), null),
};

// ---------- Yagona login uchun ----------

// Oxirgi muvaffaqiyatli kirish: login sahifasi "siz allaqachon kirgansiz"
// deb tanlov berishi uchun
export const lastSession = {
  get: () => read(KEY_LAST),
  set: (info) => write(KEY_LAST, info),
  clear: () => write(KEY_LAST, null),
};

// "Davom etish" taklifi ortida haqiqiy sessiya bormi?
// Taklif ko'rsatishdan oldin shu tekshiriladi.
export function hasSessionFor(info) {
  if (!info || !info.path) return false;
  if (info.role === 'super_admin') {
    const s = superAuth.get();
    return !!(s && s.token);
  }
  const slug = String(info.path).split('/')[1];
  if (!slug) return false;
  const s = read(keyStaff(slug, info.role));
  return !!(s && s.token);
}

// Sessiyasi qolmagan taklifni olib tashlaymiz
function forgetLastIfGone() {
  const info = read(KEY_LAST);
  if (info && !hasSessionFor(info)) write(KEY_LAST, null);
}

// Login javobidan sessiyani to'g'ri joyga saqlaydi va qayerga
// yo'naltirishni qaytaradi
export function storeLogin(data) {
  if (data.role === 'super_admin') {
    const saved = superAuth.set({ token: data.token, admin: data.user });
    if (!saved) throw new Error(STORAGE_BLOCKED);
    lastSession.set({ role: 'super_admin', name: data.user.fullName, path: '/super-admin' });
    return '/super-admin';
  }

  const slug = data.restaurant.slug;
  const session = {
    token: data.token,
    user: data.user,
    restaurant: data.restaurant,
  };
  if (!staffAuth.set(slug, session)) throw new Error(STORAGE_BLOCKED);

  const path = panelPathForRole(slug, data.user.role);
  lastSession.set({
    role: data.user.role,
    name: data.user.fullName,
    place: data.restaurant.name,
    path,
  });
  return path;
}

// ---------- "Qayerda edim, o'sha yerga qaytar" ----------
//
// Sessiya qabul qilinmaganda (masalan token muddati tugaganda) odam login
// sahifasiga tushadi. Avval u shu bilan QAYERDA turgani ham yo'qolardi:
// qaytadan kirgach panelning boshiga tushardi, o'zi ochib turgan bo'limga
// emas. Endi manzil `?next=` da saqlanadi va kirishdan keyin qaytariladi.

// FAQAT ichki manzil. Tashqi havola (`//zarar.uz`, `https://…`) hech
// qachon qabul qilinmaydi — aks holda bu ochiq redirect teshigi bo'lardi.
//
// Login sahifasining o'zi ham rad etiladi (`/` va `/?next=…`): aks holda
// manzil o'z ichiga o'ralib ketardi — `/?next=/?next=/?next=…`
export function safeNext(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw === '/' || raw.startsWith('/?')) return null;
  return raw;
}

// Login sahifasiga qaytish manzili.
//
// `location` — react-router'ning `useLocation()` qiymati. Ataylab
// `window.location` EMAS: u yo'naltirishdan keyin darhol o'zgaradi va
// effekt ikkinchi marta ishlaganda (React dev rejimida bu odatiy hol)
// yangi manzilni yana o'rab, `?next=%2F%3Fnext%3D…` hosil qilardi.
export function loginPathFrom(location) {
  const here = location ? `${location.pathname || ''}${location.search || ''}` : null;
  const next = safeNext(here);
  return next ? `/?next=${encodeURIComponent(next)}` : '/';
}

// Kirgan odam `next` ga tushishi mumkinmi? Ofitsiantni admin bo'limiga
// qaytarishning ma'nosi yo'q — u yerda baribir rad etiladi.
export function allowedNext(next, role, slug) {
  const clean = safeNext(next);
  if (!clean) return null;
  if (role === 'super_admin') return clean.startsWith('/super-admin') ? clean : null;
  if (!slug || !clean.startsWith(`/${slug}/`)) return null;

  const home = panelPathForRole(slug, role);
  // Oshxona va ofitsiant panellari admin sessiyasi bilan ham ochiladi,
  // shuning uchun admin uchun uchala bo'lim ham ochiq
  if (role === 'admin') return clean;
  return clean.startsWith(home) ? clean : null;
}

// Xodim rolига qarab qaysi panelga tushishi
export function panelPathForRole(slug, role) {
  if (role === 'kitchen') return `/${slug}/kitchen`;
  if (role === 'waiter') return `/${slug}/waiter`;
  return `/${slug}/admin`;
}

export const ROLE_LABELS = {
  super_admin: 'Platforma egasi',
  admin: 'Administrator',
  kitchen: 'Oshpaz',
  waiter: 'Ofitsiant',
};

export const BUSINESS_LABELS = {
  restaurant: 'Restoran',
  cafe: 'Kafe',
};
