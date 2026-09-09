// Oshxona va ofitsiant panellari uchun ovozli signal.
//
// Audio fayl yuklamaymiz — WebAudio orqali qisqa "ding" generatsiya qilinadi.
// Sabab: tashqi fayl kerak emas, kechikish yo'q, va offline ham ishlaydi.
//
// Brauzerlar foydalanuvchi sahifa bilan ishlamaguncha ovozga ruxsat bermaydi,
// shuning uchun birinchi bosishda audio kontekst "uyg'otiladi".

let ctx = null;

function getContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

export function unlockAudio() {
  const c = getContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function tone(frequency, startAt, duration, volume) {
  const c = getContext();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

// Yangi buyurtma — ikki notali ko'tariluvchi signal
export function playNewOrderSound() {
  const c = getContext();
  if (!c) return;
  unlockAudio();
  const now = c.currentTime;
  tone(880, now, 0.16, 0.22);
  tone(1320, now + 0.15, 0.24, 0.2);
}

// Ofitsiantga taklif — uch martalik diqqat signali
export function playAssignmentSound() {
  const c = getContext();
  if (!c) return;
  unlockAudio();
  const now = c.currentTime;
  tone(1046, now, 0.12, 0.24);
  tone(1046, now + 0.18, 0.12, 0.24);
  tone(1568, now + 0.36, 0.28, 0.22);
}

// Yengil tasdiq signali
export function playTapSound() {
  const c = getContext();
  if (!c) return;
  tone(660, c.currentTime, 0.08, 0.14);
}

// Telegram Mini App ichida bo'lsak — haptik javob ham beramiz
export function haptic(type = 'success') {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.HapticFeedback) {
      if (type === 'impact') tg.HapticFeedback.impactOccurred('light');
      else tg.HapticFeedback.notificationOccurred(type);
      return;
    }
  } catch (_) {
    /* Telegram tashqarisida — pastdagi vibratsiyaga o'tamiz */
  }
  if (navigator.vibrate) navigator.vibrate(type === 'impact' ? 10 : [40, 60, 40]);
}
