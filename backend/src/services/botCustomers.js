// TELEGRAM MIJOZLARI.
//
// Bot odatda hamma ishni HTTP API orqali qiladi — shu bilan tekshiruvlar
// bitta joyda, controller'larda qoladi. Bu yerda esa ataylab boshqacha:
// ro'yxatga olish to'g'ridan-to'g'ri tenant bazasiga yoziladi.
//
// Sababi xavfsizlik. Agar bu ochiq endpoint bo'lsa, kim xohlasa istalgan
// `telegramId` ni istalgan raqam bilan ro'yxatdan o'tkazib qo'yardi va bot
// keyin o'sha odamni "tanigan" bo'lardi. Bot backend'ning O'Z ichida
// ishlaganligi uchun bu yerda tashqi kirish yo'li umuman kerak emas.

const { getTenantClient } = require('../config/tenantDb');

// Telegram ID doim son, lekin bazada matn: 32-bitdan katta bo'lishi mumkin
const idOf = (telegramId) => String(telegramId);

async function find(slug, telegramId) {
  const db = await getTenantClient(slug);
  return db.telegramCustomer.findUnique({ where: { telegramId: idOf(telegramId) } });
}

// Ro'yxatdan o'tkazish yoki mavjudini yangilash.
// Odam raqamini almashtirgan bo'lsa — yangisi yoziladi.
async function register(slug, { telegramId, phone, firstName, username, lang }) {
  const db = await getTenantClient(slug);
  const data = {
    phone: String(phone).trim(),
    firstName: firstName || null,
    username: username || null,
    lang: lang === 'ru' ? 'ru' : 'uz',
  };
  return db.telegramCustomer.upsert({
    where: { telegramId: idOf(telegramId) },
    update: { ...data, lastSeenAt: new Date() },
    create: { telegramId: idOf(telegramId), ...data },
  });
}

// Til almashtirilganda — keyingi safar o'sha tilda kutib olamiz
async function setLang(slug, telegramId, lang) {
  const db = await getTenantClient(slug);
  try {
    await db.telegramCustomer.update({
      where: { telegramId: idOf(telegramId) },
      data: { lang: lang === 'ru' ? 'ru' : 'uz' },
    });
  } catch (_) {
    /* hali ro'yxatdan o'tmagan — yozadigan joy yo'q, bu normal */
  }
}

// Mijoz raqamini o'chirish (/stop). Yozuv topilmasa — jimgina o'tamiz:
// odam uchun natija bir xil, "yo'q edi" deb tushuntirishning ma'nosi yo'q.
async function remove(slug, telegramId) {
  const db = await getTenantClient(slug);
  try {
    await db.telegramCustomer.delete({ where: { telegramId: idOf(telegramId) } });
  } catch (err) {
    if (err.code !== 'P2025') throw err;
  }
}

module.exports = { find, register, setLang, remove };
