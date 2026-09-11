// BUTUN PLATFORMAGA BITTA TELEGRAM BOT.
//
// Avval har bir restoranga alohida bot berilardi (Master DB'dagi
// `telegramBotToken`). Uch sabab bilan bu yondashuvdan voz kechildi:
//
//   1) Har bir muassasa egasi @BotFather'dan o'zi bot ochishi, tokenni
//      bizga berishi va uni yo'qotmasligi kerak edi. Amalda bu eng ko'p
//      savol tug'diradigan qadam bo'lardi.
//   2) Mijoz uchun ham noqulay: har bir restoran uchun alohida botni
//      topib, alohida /start bosishi kerak edi.
//   3) Har bir bot alohida "long polling" ulanishi — 100 ta restoran
//      100 ta doimiy ulanish degani.
//
// Endi bitta bot ishlaydi va mijoz uning ichida muassasani TANLAYDI:
// viloyat -> shahar -> restoran/kafe. Qaysi muassasa ekani suhbat
// holatida saqlanadi (`session.place`).
//
// Token bo'lmasa — bu qism umuman ishga tushmaydi va server bemalol
// ishlashda davom etadi.

const { createPlatformBot } = require('./restaurantBot');
const { setBotUsername, getBotUsername, clearBotUsername } = require('./registry');
const session = require('./session');

// Bitta bot — registryda ham bitta kalit bilan turadi
const PLATFORM_KEY = '_platform';

let bot = null;

function platformToken() {
  return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

async function startBots() {
  const token = platformToken();
  if (!token) {
    console.log('   Telegram bot: token yo\'q (.env dagi TELEGRAM_BOT_TOKEN) — o\'tkazib yuborildi');
    return;
  }
  if (bot) return;

  bot = createPlatformBot({ token });

  // Bot username'ini oldindan bilib olamiz — QR kodlar deep-link rejimida
  // (QR_TARGET=telegram) shu nomga ishora qiladi
  try {
    const me = await bot.telegram.getMe();
    setBotUsername(PLATFORM_KEY, me.username);
  } catch (err) {
    console.error(`   [bot] token tekshirilmadi: ${err.message}`);
    bot = null;
    return;
  }

  // Buyruqlar ro'yxati Telegram menyusida ko'rinadi — mijoz nima yozishni
  // taxmin qilib o'tirmaydi
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Boshlash / Начать' },
      { command: 'menu', description: 'Asosiy menyu / Главное меню' },
      { command: 'joy', description: 'Muassasani almashtirish / Сменить заведение' },
      { command: 'demo', description: 'Namuna menyu / Демо-меню' },
      { command: 'bekor', description: 'Bekor qilish / Отмена' },
      { command: 'help', description: 'Yordam / Помощь' },
      { command: 'stop', description: 'Raqamimni o\'chirish / Удалить номер' },
    ]);
  } catch (err) {
    console.error(`   [bot] buyruqlar o'rnatilmadi: ${err.message}`);
  }

  // launch() promise'i bot to'xtaguncha "hal bo'lmaydi" — shuning uchun kutmaymiz.
  //
  // dropPendingUpdates: server o'chib turgan paytda kelgan eski xabarlarga
  // javob bermaymiz. Aks holda qayta ishga tushganda bot bir necha soat
  // oldingi bosishlarga birdaniga javob berib, mijozni chalg'itardi.
  bot.launch({ dropPendingUpdates: true }).catch((err) => {
    console.error(`   [bot] ishga tushmadi: ${err.message}`);
    bot = null;
    clearBotUsername(PLATFORM_KEY);
  });

  console.log(`   Telegram bot ishga tushdi: @${getBotUsername(PLATFORM_KEY)} (butun platforma)`);

  // Tugallanmagan suhbatlar xotirada abadiy qolib ketmasin
  session.startSweeper();
}

function stopBots(signal) {
  if (bot) {
    try {
      bot.stop(signal);
    } catch (_) {
      /* to'xtatishda xato bo'lsa e'tiborsiz qoldiramiz */
    }
    bot = null;
  }
  clearBotUsername(PLATFORM_KEY);
  session.stopSweeper();
}

// ESKI CHAQIRUVLAR UCHUN.
//
// Muassasa yaratilganda/to'xtatilganda controller'lar shu funksiyalarni
// chaqiradi. Bitta bot bo'lgani uchun endi ular hech narsa qilmaydi:
// muassasa ro'yxatdan chiqishi kifoya — `placeDirectory` uni ko'rsatmaydi.
// Chaqiruvlarni olib tashlamadik, chunki ular controller mantig'ini
// o'qishga xalaqit bermaydi va kelajakda kerak bo'lishi mumkin.
function refreshBot() {}
function stopBot() {}

module.exports = { startBots, stopBots, refreshBot, stopBot, PLATFORM_KEY };
