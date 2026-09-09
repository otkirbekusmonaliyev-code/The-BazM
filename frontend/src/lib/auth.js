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

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    /* private rejimda localStorage yopiq bo'lishi mumkin */
  }
}

export const superAuth = {
  get: () => read(KEY_SUPER),
  set: (session) => write(KEY_SUPER, session),
  clear: () => write(KEY_SUPER, null),
};

export const staffAuth = {
  set(slug, session) {
    write(keyStaff(slug, session.user.role), session);
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

  clear(slug, role) {
    if (role) write(keyStaff(slug, role), null);
    else STAFF_ROLES.forEach((r) => write(keyStaff(slug, r), null));
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

// Login javobidan sessiyani to'g'ri joyga saqlaydi va qayerga
// yo'naltirishni qaytaradi
export function storeLogin(data) {
  if (data.role === 'super_admin') {
    superAuth.set({ token: data.token, admin: data.user });
    lastSession.set({ role: 'super_admin', name: data.user.fullName, path: '/super-admin' });
    return '/super-admin';
  }

  const slug = data.restaurant.slug;
  const session = {
    token: data.token,
    user: data.user,
    restaurant: data.restaurant,
  };
  staffAuth.set(slug, session);

  const path = panelPathForRole(slug, data.user.role);
  lastSession.set({
    role: data.user.role,
    name: data.user.fullName,
    place: data.restaurant.name,
    path,
  });
  return path;
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
