// Ishga tushgan botlarning username'lari: { slug -> 'BazM_2026_bot' }.
//
// Alohida kichik modul, chunki uni HAM botManager (yozadi), HAM utils/links
// (o'qiydi) ishlatadi — agar bu ma'lumot botManager ichida tursa,
// modullar orasida aylanma (circular) import paydo bo'lardi.

const usernames = new Map();

const setBotUsername = (slug, username) => usernames.set(slug, username);
const getBotUsername = (slug) => usernames.get(slug) || null;
const clearBotUsername = (slug) => usernames.delete(slug);

module.exports = { setBotUsername, getBotUsername, clearBotUsername };
