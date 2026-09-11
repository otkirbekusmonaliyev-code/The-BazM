// TELEGRAM MIJOZLARI.
//
// Yozuv MASTER bazada, muassasa bazasida emas — va buning sababi botning
// tuzilishida. Avval har bir restoranning O'Z boti bor edi, shuning uchun
// mijoz ham o'sha restoranning bazasiga yozilardi. Endi butun platformada
// BITTA bot ishlaydi: odam avval ro'yxatdan o'tadi, muassasani KEYIN
// tanlaydi. Ya'ni ro'yxatga olish paytida qaysi bazaga yozishni bilish
// mumkin emas.
//
// Mijoz uchun ham qulayroq: raqamini bir marta beradi, keyin istalgan
// muassasaga kiradi.
//
// Bot backend'ning O'Z ichida ishlagani uchun bu yerda HTTP endpoint
// kerak emas — u ochiq bo'lsa, kim xohlasa istalgan `telegramId` ni
// istalgan raqam bilan ro'yxatdan o'tkazib qo'yardi.

const masterPrisma = require('../config/masterDb');

// Telegram ID doim son, lekin bazada matn: 32-bitdan katta bo'lishi mumkin
const idOf = (telegramId) => String(telegramId);

async function find(telegramId) {
  return masterPrisma.telegramCustomer.findUnique({
    where: { telegramId: idOf(telegramId) },
  });
}

// Ro'yxatdan o'tkazish yoki mavjudini yangilash.
// Odam raqamini almashtirgan bo'lsa — yangisi yoziladi.
async function register({ telegramId, phone, firstName, username, lang }) {
  const data = {
    phone: String(phone).trim(),
    firstName: firstName || null,
    username: username || null,
    lang: lang === 'ru' ? 'ru' : 'uz',
  };
  return masterPrisma.telegramCustomer.upsert({
    where: { telegramId: idOf(telegramId) },
    update: { ...data, lastSeenAt: new Date() },
    create: { telegramId: idOf(telegramId), ...data },
  });
}

// Til almashtirilganda — keyingi safar o'sha tilda kutib olamiz
async function setLang(telegramId, lang) {
  try {
    await masterPrisma.telegramCustomer.update({
      where: { telegramId: idOf(telegramId) },
      data: { lang: lang === 'ru' ? 'ru' : 'uz' },
    });
  } catch (_) {
    /* hali ro'yxatdan o'tmagan — yozadigan joy yo'q, bu normal */
  }
}

// Oxirgi tanlagan muassasasi. Keyingi safar uni birinchi bo'lib taklif
// qilamiz — doimiy mijoz har safar to'rt qadamdan o'tmasin.
async function setLastPlace(telegramId, slug) {
  try {
    await masterPrisma.telegramCustomer.update({
      where: { telegramId: idOf(telegramId) },
      data: { lastSlug: slug || null },
    });
  } catch (_) {
    /* ro'yxatdan o'tmagan bo'lsa — e'tiborsiz */
  }
}

// Mijoz raqamini o'chirish (/stop). Yozuv topilmasa — jimgina o'tamiz:
// odam uchun natija bir xil.
async function remove(telegramId) {
  try {
    await masterPrisma.telegramCustomer.delete({ where: { telegramId: idOf(telegramId) } });
  } catch (err) {
    if (err.code !== 'P2025') throw err;
  }
}

module.exports = { find, register, setLang, setLastPlace, remove };
