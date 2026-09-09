// BOT SUHBAT HOLATI.
//
// Har bir foydalanuvchi uchun: tanlagan tili, ochilgan stol sessiyasi va
// tugallanmagan bron qoralamasi. Bularning hammasi xotirada turadi —
// bot qayta ishga tushsa unutiladi, bu esa to'g'ri: mijoz baribir yangi
// suhbatni /start dan boshlaydi.
//
// MUHIM: eski yozuvlar o'z-o'zidan tozalanadi. Avval bunday tozalash yo'q
// edi va har bir suhbat xotirada abadiy qolib ketardi — ko'p mijozli
// restoranda bu sekin-asta o'sib boradigan xotira sizishi (memory leak).

const TTL_MS = 6 * 60 * 60 * 1000; // 6 soat
const SWEEP_MS = 10 * 60 * 1000; // har 10 daqiqada tozalash

const store = new Map(); // key -> { data, touchedAt }

function keyOf(ctx) {
  // Guruhda ham ishlashi uchun chat va foydalanuvchi birga olinadi
  const chatId = ctx.chat ? ctx.chat.id : (ctx.from && ctx.from.id);
  const userId = ctx.from ? ctx.from.id : chatId;
  return `${chatId}:${userId}`;
}

function get(ctx) {
  const key = keyOf(ctx);
  const found = store.get(key);
  if (found) {
    found.touchedAt = Date.now();
    return found.data;
  }
  const data = { lang: null, table: null, draft: null };
  store.set(key, { data, touchedAt: Date.now() });
  return data;
}

function reset(ctx) {
  const session = get(ctx);
  session.draft = null;
  return session;
}

function clear(ctx) {
  store.delete(keyOf(ctx));
}

function size() {
  return store.size;
}

let timer = null;

function startSweeper() {
  if (timer) return;
  timer = setInterval(() => {
    const cutoff = Date.now() - TTL_MS;
    for (const [key, entry] of store) {
      if (entry.touchedAt < cutoff) store.delete(key);
    }
  }, SWEEP_MS);
  // Bu taymer tufayli Node jarayoni yopilmay qolmasin
  if (timer.unref) timer.unref();
}

function stopSweeper() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  store.clear();
}

module.exports = { get, reset, clear, size, startSweeper, stopSweeper };
