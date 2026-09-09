// Butun ilova bo'ylab bir xil ko'rinishdagi sana/narx formatlash

export function money(value) {
  const n = Number(value || 0);
  return `${n.toLocaleString('ru-RU').replace(/ /g, ' ')} so'm`;
}

export function moneyShort(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')} mln`;
  if (n >= 1000) return `${Math.round(n / 1000)} ming`;
  return String(n);
}

const pad = (n) => String(n).padStart(2, '0');

export function time(value) {
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateTime(value) {
  const d = new Date(value);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateOnly(value) {
  const d = new Date(value);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// "3 daq" / "1 soat 12 daq" ko'rinishidagi o'tgan vaqt
export function elapsed(from, now = Date.now()) {
  const ms = now - new Date(from).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} daq`;
  return `${Math.floor(minutes / 60)} soat ${minutes % 60} daq`;
}

export function elapsedMinutes(from, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(from).getTime()) / 60000));
}

export function relativeDay(value) {
  const d = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return 'Bugun';
  if (diff === 1) return 'Ertaga';
  if (diff === -1) return 'Kecha';
  return dateOnly(value);
}

// Avatar uchun bosh harflar: "Malika Yusupova" -> "MY"
// Bitta so'zli ism bo'lsa — bitta harf.
export function initials(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

// Ro'yxatlarda to'liq ism juda uzun bo'lsa — ism + familiya bosh harfi
export function shortName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

export const ORDER_STATUS_LABELS = {
  new: 'Yangi',
  accepted: 'Qabul qilindi',
  preparing: 'Tayyorlanmoqda',
  ready: 'Tayyor',
  picked_up: 'Olib ketildi',
  delivered: 'Yetkazildi',
  paid: 'To\'landi',
  cancelled: 'Bekor qilindi',
};

export const RESERVATION_STATUS_LABELS = {
  pending: 'Kutilmoqda',
  confirmed: 'Tasdiqlangan',
  cancelled: 'Bekor qilingan',
  completed: 'Yakunlangan',
};

export const SUBSCRIPTION_LABELS = {
  trial: 'Sinov',
  active: 'Faol',
  suspended: 'To\'xtatilgan',
  cancelled: 'Bekor qilingan',
};

export const PLAN_LABELS = { basic: 'Basic', standard: 'Standard', pro: 'Pro' };
