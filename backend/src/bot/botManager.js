// Har bir restoran o'z Telegram botiga ega bo'lishi mumkin (Master DB'dagi
// `telegramBotToken` maydoni). Bu menejer server ishga tushganda barcha
// tokenlarni yig'ib, har biri uchun alohida bot instansiyasini ishga tushiradi.
//
// Development uchun: .env dagi TELEGRAM_BOT_TOKEN + TELEGRAM_DEV_SLUG juftligi
// ham qo'shimcha bot sifatida ko'tariladi (Master DB'ga token yozmasdan sinash uchun).
//
// Token bo'lmasa — bu QISM UMUMAN ISHGA TUSHMAYDI va server bemalol ishlaydi.

const masterPrisma = require('../config/masterDb');
const { createRestaurantBot } = require('./restaurantBot');
const { setBotUsername, getBotUsername, clearBotUsername } = require('./registry');
const session = require('./session');

const running = new Map(); // slug -> bot

async function launchOne({ token, slug, name }) {
  if (running.has(slug)) return;

  const bot = createRestaurantBot({ token, slug, name });

  // Bot username'ini oldindan bilib olamiz — QR kodlar deep-link rejimida
  // (QR_TARGET=telegram) shu nomga ishora qiladi
  try {
    const me = await bot.telegram.getMe();
    setBotUsername(slug, me.username);
  } catch (err) {
    console.error(`   [bot:${slug}] token tekshirilmadi: ${err.message}`);
    return;
  }

  // Buyruqlar ro'yxati Telegram menyusida ko'rinadi — mijoz nima yozishni
  // taxmin qilib o'tirmaydi
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Boshlash / Начать' },
      { command: 'menu', description: 'Asosiy menyu / Главное меню' },
      { command: 'demo', description: 'Namuna menyu / Демо-меню' },
      { command: 'bekor', description: 'Bekor qilish / Отмена' },
      { command: 'help', description: 'Yordam / Помощь' },
      { command: 'stop', description: 'Raqamimni o\'chirish / Удалить номер' },
    ]);
  } catch (err) {
    console.error(`   [bot:${slug}] buyruqlar o'rnatilmadi: ${err.message}`);
  }

  // launch() promise'i bot to'xtaguncha "hal bo'lmaydi" — shuning uchun kutmaymiz.
  //
  // dropPendingUpdates: server o'chib turgan paytda kelgan eski xabarlarga
  // javob bermaymiz. Aks holda qayta ishga tushganda bot bir necha soat
  // oldingi bosishlarga birdaniga javob berib, mijozni chalg'itardi.
  bot.launch({ dropPendingUpdates: true }).catch((err) => {
    console.error(`   [bot:${slug}] ishga tushmadi: ${err.message}`);
    running.delete(slug);
    clearBotUsername(slug);
  });

  running.set(slug, bot);
  console.log(`   Telegram bot ishga tushdi: ${slug} (@${getBotUsername(slug)})`);
}

async function startBots() {
  const configs = [];

  try {
    const restaurants = await masterPrisma.restaurant.findMany({
      where: { telegramBotToken: { not: null }, subscriptionStatus: { in: ['trial', 'active'] } },
      select: { slug: true, name: true, telegramBotToken: true },
    });
    for (const r of restaurants) {
      if (r.telegramBotToken && r.telegramBotToken.trim()) {
        configs.push({ token: r.telegramBotToken.trim(), slug: r.slug, name: r.name });
      }
    }
  } catch (err) {
    console.error('   Bot tokenlarini o\'qishda xato:', err.message);
  }

  const devToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const devSlug = (process.env.TELEGRAM_DEV_SLUG || '').trim();
  if (devToken && devSlug && !configs.some((c) => c.slug === devSlug)) {
    try {
      const r = await masterPrisma.restaurant.findUnique({ where: { slug: devSlug } });
      if (r) configs.push({ token: devToken, slug: r.slug, name: r.name });
      else console.log(`   Telegram bot: "${devSlug}" restorani topilmadi`);
    } catch (_) {
      /* restoran topilmasa — jimgina o'tkazib yuboramiz */
    }
  }

  if (configs.length === 0) {
    console.log('   Telegram bot: token topilmadi (o\'tkazib yuborildi)');
    return;
  }

  for (const cfg of configs) {
    // eslint-disable-next-line no-await-in-loop
    await launchOne(cfg);
  }

  // Tugallanmagan suhbatlar xotirada abadiy qolib ketmasin
  session.startSweeper();
}

// Bitta muassasa uchun botni ISHLAB TURGAN serverda ko'tarish/to'xtatish.
//
// Avval botlar faqat server ishga tushganda ko'tarilardi: panelda yangi
// restoran yaratilsa yoki bot tokeni almashtirilsa, u serverni qayta ishga
// tushirmaguncha jim turardi. Endi o'zgarish darhol kuchga kiradi.
async function refreshBot(slug) {
  if (!slug) return;

  // Eskisini to'xtatamiz — token o'zgargan bo'lishi mumkin
  stopBot(slug);

  try {
    const restaurant = await masterPrisma.restaurant.findUnique({
      where: { slug },
      select: { slug: true, name: true, telegramBotToken: true, subscriptionStatus: true },
    });

    if (!restaurant) return;
    // To'xtatilgan obunada bot ishlamaydi
    if (!['trial', 'active'].includes(restaurant.subscriptionStatus)) return;

    let token = (restaurant.telegramBotToken || '').trim();

    // O'z tokeni bo'lmasa — development uchun .env dagi token.
    // `startBots` da ham xuddi shunday, shu bilan yangi yaratilgan
    // sinov restorani ham darhol bot bilan ishlaydi.
    if (!token && slug === (process.env.TELEGRAM_DEV_SLUG || '').trim()) {
      token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    }

    if (!token) return;

    await launchOne({ token, slug: restaurant.slug, name: restaurant.name });
  } catch (err) {
    console.error(`   [bot:${slug}] yangilanmadi: ${err.message}`);
  }
}

function stopBot(slug) {
  const bot = running.get(slug);
  if (!bot) return;
  try {
    bot.stop('refresh');
  } catch (_) {
    /* allaqachon to'xtagan bo'lishi mumkin */
  }
  running.delete(slug);
  clearBotUsername(slug);
}

function stopBots(signal) {
  for (const [slug, bot] of running) {
    try {
      bot.stop(signal);
    } catch (_) {
      /* to'xtatishda xato bo'lsa e'tiborsiz qoldiramiz */
    }
    running.delete(slug);
    clearBotUsername(slug);
  }
  session.stopSweeper();
}

module.exports = { startBots, stopBots, refreshBot, stopBot };
