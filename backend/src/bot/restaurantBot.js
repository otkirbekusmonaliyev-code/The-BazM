// BITTA MUASSASAGA XIZMAT QILUVCHI TELEGRAM BOT.
//
// BOT NIMA QILADI — VA NIMA QILMAYDI.
//
// Bot ataylab uchta ish bilan cheklangan:
//   🍽  Mini App'ni ochib beradi
//   🔔  aniq bir ofitsiantni chaqiradi
//   📅  kelajakdagi kunga stol bron qiladi
//
// Menyu varaqlash, stol band qilish, "buyurtmam qayerda?" — bularning
// hammasi ilovada bor va u yerda ancha yaxshi ishlaydi. Botdagi takrori
// ikki zarar keltirardi: mijoz qaysi biridan foydalanishni bilmay qolardi,
// va bir xil mantiq ikki joyda yozilgani uchun ular sekin-asta bir-biridan
// uzoqlashardi. Shuning uchun bot faqat ILOVA QILA OLMAYDIGAN ishlarni
// qiladi — ofitsiantga xabar yuborish va oldindan bron.
//
// Bot bazaga asosan o'z backend'imizning HTTP API'si orqali murojaat qiladi —
// shu bilan tekshiruvlar (bron vaqti to'g'rimi) controller'larda qoladi.
// Ikki istisno bor va ikkalasi ham ATAYLAB: ro'yxatga olish va ofitsiant
// chaqirish to'g'ridan-to'g'ri servis moduliga boradi, chunki ular uchun
// ochiq endpoint yaratish begonaga eshik ochib qo'yardi (istalgan odam
// istalgan ofitsiantni istalgan stolga chaqirib turaverardi).
//
// Ikkita kirish yo'li:
//   1) QR kod deep-link'i:  t.me/<bot>?start=t_<qrToken>
//      Kod avval TEKSHIRILADI — yaroqsiz bo'lsa mijozga aniq aytiladi va
//      darhol boshqa yo'l taklif qilinadi (avval buzuq havolali tugma
//      berilar edi va mijoz bo'sh ekranga tushib qolardi).
//   2) Oddiy /start — to'liq menyu.
//
// RO'YXATDAN O'TISH. Ish boshlashdan oldin bot mijozdan kontaktini so'raydi
// (Telegram'ning o'z tugmasi bilan — qo'lda terish yo'q). Uch qoida:
//
//   1) Boshi berk ko'cha bo'lmaydi. Raqam bermagan odam ham NAMUNA menyuni
//      ko'ra oladi — ya'ni "nima olishimni bilmasdan raqamimni beraymi?"
//      degan holat yuzaga kelmaydi.
//   2) Rad etsa — sabab tushuntiriladi, so'ng yana taklif qilinadi. Bot
//      hech qachon jim qolmaydi.
//   3) QR kod bilan kelgan odam yo'qotilmaydi: kod eslab qolinadi va
//      ro'yxatdan o'tgach u to'g'ri o'z stoliga tushadi.
//
// Namuna menyu HAQIQIY muassasaga tegmaydi — u /demo sahifasi bo'lib,
// serverga bitta ham so'rov yubormaydi (qarang: frontend/src/client/demoData.js).
//
// Suhbat holati `session.js` da, matnlar `texts.js` da (o'zbekcha/ruscha).

const { Telegraf, Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const { tableWebUrl, tablePickerUrl, demoUrl } = require('../utils/links');
const placeDirectory = require('../services/placeDirectory');
const { getTenantClient } = require('../config/tenantDb');
const botCustomers = require('../services/botCustomers');
const waiterCalls = require('../services/waiterCalls');
const session = require('./session');
const { t, pickLang } = require('./texts');

// Muassasa tanlanmagunicha shu nom ishlatiladi
const PLATFORM_NAME = process.env.PLATFORM_NAME || 'Bazm';

const API_BASE = () => `http://127.0.0.1:${process.env.PORT || 4000}/api`;
const REQUEST_TIMEOUT = 8000;

// ============================================================
//  BACKEND BILAN ALOQA
// ============================================================

async function api(slug, path, options = {}) {
  // So'rov osilib qolsa mijoz javobsiz qolmasin
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let res;
  try {
    res = await fetch(`${API_BASE()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Restaurant-Slug': slug,
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    const wrapped = new Error(err.name === 'AbortError' ? 'TIMEOUT' : 'OFFLINE');
    wrapped.offline = true;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = null;
  }

  if (!res.ok) {
    const err = new Error((body && (body.error || body.message)) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = body;
    throw err;
  }
  return body;
}

// ============================================================
//  KICHIK YORDAMCHILAR
// ============================================================


// TELEGRAM TUGMALARIDAGI URL CHEKLOVLARI.
//
// Telegram inline tugmadagi manzilni O'ZI tekshiradi va yoqmasa BUTUN
// xabarni rad etadi ("Bad Request: ... is invalid: Wrong HTTP URL").
// Aynan shu narsa development'da sindirdi: APP_URL=http://localhost:5173
// bo'lgani uchun stol band qilinardi, lekin tugmali xabar yuborilmasdi va
// mijoz "nimadir noto'g'ri ketdi" degan xabarni ko'rardi — stol esa band
// bo'lib qolaverardi.
//
// Endi manzil oldindan tekshiriladi:
//   https + haqiqiy domen  -> Mini App tugmasi (eng yaxshisi)
//   http  + haqiqiy domen  -> oddiy havola tugmasi
//   localhost / IP / boshqa -> tugma UMUMAN qo'yilmaydi, havola matn
//                              ko'rinishida beriladi (nusxalab ochsa bo'ladi)
function urlKind(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const local =
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    !host.includes('.');
  if (local) return null;
  if (parsed.protocol === 'https:') return 'webapp';
  if (parsed.protocol === 'http:') return 'url';
  return null;
}

function openButton(label, url) {
  const kind = urlKind(url);
  if (kind === 'webapp') return Markup.button.webApp(label, url);
  if (kind === 'url') return Markup.button.url(label, url);
  return null;
}

// Havolani tugma qilib bo'lmasa, uni matnga qo'shamiz — mijoz ochiq qoladi
function withLink(c, text, url, label) {
  const button = openButton(label || c.openMenu, url);
  if (button) return { text, rows: [[button]] };
  return { text: `${text}

${c.openLinkFallback}
${url}`, rows: [] };
}

// Tugma bosilganda YANGI xabar yubormasdan, o'shanining o'zini tahrirlaymiz —
// aks holda suhbat o'nlab bir xil xabarlar bilan to'lib ketardi.
// Matn o'zgarmagan bo'lsa Telegram xato qaytaradi, uni jimgina yutamiz.
async function show(ctx, text, keyboard) {
  const extra = { ...(keyboard || {}), disable_web_page_preview: true };
  if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message) {
    try {
      return await ctx.editMessageText(text, extra);
    } catch (err) {
      if (/message is not modified/i.test(err.message || '')) return null;
      // Xabar juda eski yoki o'chirilgan — yangisini yuboramiz
    }
  }
  return ctx.reply(text, extra);
}

// Foydalanuvchiga ko'rsatiladigan xato matni
function errorText(c, err) {
  if (err && err.offline) return c.errors.offline;
  if (err && err.status === 403) return c.errors.suspended;
  if (err && err.status >= 400 && err.status < 500 && err.message) return err.message;
  return c.errors.generic;
}

// BOT ATAYLAB KICHIK.
//
// Avval bu yerda oltita tugma bor edi: menyuni varaqlash, stol tanlash,
// "buyurtmam qayerda?" va h.k. Ularning hammasi ilovada ALLAQACHON bor va
// u yerda ancha yaxshi ishlaydi — botdagi takrori faqat ikkita zarar
// keltirardi: mijoz qaysi biridan foydalanishni bilmay qolardi, va bir xil
// mantiq ikki joyda yozilgani uchun ular sekin-asta bir-biridan uzoqlashardi.
//
// Endi bot faqat ILOVA QILA OLMAYDIGAN ishlarni qiladi:
//   🍽  ilovani ochib berish
//   🔔  aniq bir ofitsiantni chaqirish
//   📅  kelajakdagi kunga stol bron qilish
function mainMenu(c) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(c.menu.openApp, 'open_app')],
    [Markup.button.callback(c.menu.callWaiter, 'call_waiter')],
    [Markup.button.callback(c.menu.reserve, 'reserve')],
    // Bitta bot hamma muassasaga xizmat qilgani uchun "boshqa joyga
    // o'tish" har doim qo'l ostida turishi kerak — odam bugun bir
    // restoranda, ertaga boshqasida bo'ladi
    [Markup.button.callback(c.place.change, 'place_start')],
    [Markup.button.callback(c.menu.lang, 'lang')],
  ]);
}

const backRow = (c) => [Markup.button.callback(c.menu.back, 'home')];

// Sanani "25.12.2026" ko'rinishida
const fmtDate = (d) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
const fmtTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// ============================================================
//  BOT
// ============================================================

function createPlatformBot({ token }) {
  const bot = new Telegraf(token, { handlerTimeout: 20000 });

  // Har bir handler'dan oldin: sessiya + til + TANLANGAN MUASSASA.
  //
  // `slug` sessiyadan keladi, funksiya argumentidan emas — bitta bot
  // hamma muassasaga xizmat qiladi va qaysi biri ekani har bir suhbatda
  // alohida hal qilinadi.
  const ctxOf = (ctx) => {
    const s = session.get(ctx);
    if (!s.lang) s.lang = pickLang(s, ctx);
    return { s, c: t(s.lang), slug: (s.place && s.place.slug) || null };
  };

  // ctxOf chaqirilmaydigan joylar uchun
  const placeSlug = (ctx) => {
    const s = session.get(ctx);
    return (s.place && s.place.slug) || null;
  };

  // Muassasa nomi — salomlashishda ishlatiladi. Tanlanmagan bo'lsa
  // platformaning o'z nomi.
  const placeName = (s) => (s.place && s.place.name) || PLATFORM_NAME;

  async function goHome(ctx, prefix) {
    const { s, c, slug } = ctxOf(ctx);
    s.draft = null;
    // Ro'yxatdan o'tmagan odamga menyuni ko'rsatib, so'ng har bir tugmada
    // "avval raqam bering" deyish — bu ochiq masxara. Bir marta so'raymiz.
    if (!(await currentCustomer(ctx))) return askRegistration(ctx, c);
    if (!(await restoreLastPlace(ctx, s))) return askRegion(ctx, c, s);
    const head = prefix ? `${prefix}\n\n` : '';
    // Qaysi muassasada ekani har doim ko'rinib tursin — bitta bot
    // o'nlab joyga xizmat qiladi va odam adashib ketishi mumkin
    return show(ctx, `📍 ${s.place.name}\n\n${head}${c.whatNext}`, mainMenu(c));
  }

  // ============================================================
  //  RO'YXATDAN O'TISH
  // ============================================================

  // Kontakt so'raladigan klaviatura. Uchala tugma ham SHU YERDA, chunki
  // reply-klaviatura bilan inline-tugmalarni bitta xabarga qo'shib
  // bo'lmaydi — aks holda "namuna" va "nega kerak" alohida xabar talab
  // qilar va suhbat chalkashardi.
  const authKeyboard = (c) =>
    Markup.keyboard([
      [Markup.button.contactRequest(c.auth.shareBtn)],
      [c.auth.demoBtn, c.auth.whyBtn],
    ])
      .resize()
      .persistent();

  async function askRegistration(ctx, c, prefix) {
    return ctx.reply(prefix ? `${prefix}\n\n${c.auth.ask}` : c.auth.ask, authKeyboard(c));
  }

  // Ro'yxatdan o'tganmi? Javob sessiyada keshlanadi — har bosishda
  // bazaga bormaydi.
  //
  // Baza javob bermasa RUXSAT BERAMIZ. Sababi: `telegramCustomer` jadvali
  // hali yoyilmagan bo'lsa (yangi muassasa, `npm run tenant:sync` qilinmagan)
  // qattiq to'sish botni butunlay o'lik qilardi va mijoz hech qachon
  // ro'yxatdan ham o'ta olmasdi — ya'ni abadiy halqa. Ochiq qolish esa eng
  // yomon holatda faqat ro'yxatga olishni yo'qotadi, xizmatni emas.
  async function currentCustomer(ctx) {
    const s = session.get(ctx);
    if (s.customer !== undefined) return s.customer;
    try {
      s.customer = await botCustomers.find(ctx.from.id);
    } catch (err) {
      console.error(`   [bot] mijozlar jadvali o'qilmadi: ${err.message}`);
      s.customer = { degraded: true };
    }
    return s.customer;
  }

  // Amaldan oldin qo'yiladigan to'siq. `true` — davom etsa bo'ladi.
  async function requireRegistration(ctx, c) {
    const customer = await currentCustomer(ctx);
    if (customer) return true;
    if (ctx.updateType === 'callback_query') {
      await ctx.answerCbQuery();
      await show(ctx, c.auth.needed);
    }
    await askRegistration(ctx, c);
    return false;
  }

  // Ro'yxatdan o'tgandan keyin qayerga borish: QR kod bilan kelgan bo'lsa
  // — o'sha stolga, aks holda asosiy menyuga
  async function afterRegistration(ctx, c, s, greeting) {
    const pending = s.pendingQr;
    s.pendingQr = null;

    const head = greeting ? `${greeting}\n\n` : '';

    if (pending && pending.slug && pending.token) {
      // QR kod qaysi muassasaniki ekani havolada aytilgan — joy tanlash
      // qadamlari umuman kerak emas, odam allaqachon o'sha zalda o'tiribdi
      const place = await placeDirectory.findServing(pending.slug).catch(() => null);
      if (!place) {
        return ctx.reply(`${head}${c.qr.invalid}`, mainMenu(c));
      }
      s.place = { slug: place.slug, name: place.name, businessType: place.businessType };
      botCustomers.setLastPlace(ctx.from.id, place.slug).catch(() => {});

      const slug = place.slug;
      try {
        const table = await api(slug, `/client/tables/by-qr/${encodeURIComponent(pending.token)}`);
        s.table = { id: table.id, number: table.tableNumber, token: null };
        const link = withLink(c, `${head}${c.qr.valid(table.tableNumber)}`, tableWebUrl(slug, pending.token));
        return ctx.reply(
          link.text,
          Markup.inlineKeyboard([...link.rows, [Markup.button.callback(c.menu.back, 'home')]])
        );
      } catch (err) {
        // Kod eskirgan yoki boshqa muassasaniki — sababini aytamiz va
        // odamni oddiy menyuga olib chiqamiz, boshi berk ko'chada emas
        return ctx.reply(
          `${head}${err.offline ? c.errors.offline : c.qr.invalid}`,
          mainMenu(c)
        );
      }
    }

    // Joy tanlanmagan bo'lsa — avval shuni so'raymiz
    if (!(await restoreLastPlace(ctx, s))) {
      if (head) await ctx.reply(head.trim());
      return askRegion(ctx, c, s);
    }
    return ctx.reply(`${head}${c.whatNext}`, mainMenu(c));
  }

  // Namuna menyu — ro'yxatdan o'tmasdan ham ochiladi
  async function sendDemo(ctx, c) {
    const link = withLink(c, c.demo.intro, demoUrl(), c.openDemo);
    const registered = !!(await currentCustomer(ctx));
    const rows = [...link.rows];
    if (registered) rows.push([Markup.button.callback(c.menu.back, 'home')]);
    return ctx.reply(
      registered ? link.text : `${link.text}\n\n${c.demo.after}`,
      rows.length ? Markup.inlineKeyboard(rows) : undefined
    );
  }

  // ============================================================
  //  JOY TANLASH — viloyat -> shahar -> tur -> muassasa
  // ============================================================
  //
  // Bitta bot butun platformaga xizmat qilgani uchun mijoz avval "qaysi
  // muassasa?" degan savolga javob beradi. Davlat so'ralmaydi — hozircha
  // faqat O'zbekiston, va bitta variantli savol berish — vaqt o'g'irlash.
  //
  // FAQAT MAVJUD JOYLAR KO'RSATILADI: muassasasi yo'q viloyat ham, shahar
  // ham ro'yxatga tushmaydi. Aks holda odam to'rt qadam bosib, oxirida
  // "bu yerda hech narsa yo'q" degan javob olardi.
  //
  // Tugma ma'lumoti 64 baytdan oshmasligi kerak, viloyat nomlari esa uzun.
  // Shuning uchun tugmalarda RAQAM turadi, ro'yxatning o'zi sessiyada
  // saqlanadi.

  const rowsOf = (items, prefix, perRow = 2) => {
    const rows = [];
    for (let i = 0; i < items.length; i += perRow) {
      rows.push(
        items.slice(i, i + perRow).map((x, k) =>
          Markup.button.callback(x.label, `${prefix}${i + k}`)
        )
      );
    }
    return rows;
  };

  // 1-qadam: viloyat
  async function askRegion(ctx, c, s) {
    const regions = await placeDirectory.regionsWithPlaces();
    if (regions.length === 0) {
      return show(ctx, c.place.noRegions, Markup.inlineKeyboard([]));
    }
    s.pick = { regions: regions.map((r) => r.name) };
    const items = regions.map((r) => ({ label: `${r.name} (${r.count})` }));
    return show(
      ctx,
      `${c.place.intro}\n\n${c.place.country}\n${c.place.askRegion}`,
      Markup.inlineKeyboard(rowsOf(items, 'pl_r_', 1))
    );
  }

  // 2-qadam: shahar. Toshkent shahri uchun bu qadam O'TKAZIB YUBORILADI —
  // "Toshkent shahri" deganda odam allaqachon shaharni aytgan bo'ladi.
  async function askCity(ctx, c, s) {
    const region = s.pick.region;
    if (placeDirectory.skipsCityStep(region)) {
      s.pick.city = null;
      return askType(ctx, c, s);
    }

    const cities = await placeDirectory.citiesWithPlaces(region);
    if (cities.length === 0) return askRegion(ctx, c, s);

    s.pick.cities = cities.map((x) => x.name);
    const items = cities.map((x) => ({ label: `${x.name} (${x.count})` }));
    return show(
      ctx,
      c.place.askCity(region),
      Markup.inlineKeyboard([
        ...rowsOf(items, 'pl_c_', 2),
        [Markup.button.callback(c.place.backRegion, 'place_start')],
      ])
    );
  }

  // 3-qadam: restoran yoki kafe. Bo'sh turdagi tugma KO'RSATILMAYDI.
  async function askType(ctx, c, s) {
    const { region, city } = s.pick;
    const available = await placeDirectory.typesAvailable(region, city);
    const where = city ? `${region}, ${city}` : region;

    const rows = [];
    if (available.restaurant > 0) {
      rows.push([
        Markup.button.callback(`${c.place.restaurant} (${available.restaurant})`, 'pl_t_restaurant'),
      ]);
    }
    if (available.cafe > 0) {
      rows.push([Markup.button.callback(`${c.place.cafe} (${available.cafe})`, 'pl_t_cafe')]);
    }
    if (rows.length === 0) return askRegion(ctx, c, s);

    rows.push([
      Markup.button.callback(
        placeDirectory.skipsCityStep(region) ? c.place.backRegion : c.place.backCity,
        placeDirectory.skipsCityStep(region) ? 'place_start' : 'pl_back_city'
      ),
    ]);
    return show(ctx, c.place.askType(where), Markup.inlineKeyboard(rows));
  }

  // 4-qadam: muassasa
  async function askWhich(ctx, c, s) {
    const { region, city, type } = s.pick;
    const places = await placeDirectory.placesIn(region, city, type);
    if (places.length === 0) {
      const label = type === 'cafe' ? c.place.cafe : c.place.restaurant;
      return show(
        ctx,
        c.place.noPlaces(label.trim()),
        Markup.inlineKeyboard([[Markup.button.callback(c.place.backRegion, 'place_start')]])
      );
    }

    s.pick.places = places.map((x) => x.slug);
    // Toshkent shahrida shahar so'ralmagani uchun nom yonida tumanni
    // ko'rsatamiz — bir xil nomli joylarni ajratish uchun
    const items = places.map((x) => ({
      label: placeDirectory.skipsCityStep(region) && x.city ? `${x.name} · ${x.city}` : x.name,
    }));
    return show(
      ctx,
      c.place.askPlace(places.length),
      Markup.inlineKeyboard([
        ...rowsOf(items, 'pl_p_', 1),
        [Markup.button.callback(c.place.backRegion, 'place_start')],
      ])
    );
  }

  bot.action('place_start', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    if (!(await currentCustomer(ctx))) return askRegistration(ctx, c);
    s.pick = {};
    try {
      return await askRegion(ctx, c, s);
    } catch (err) {
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([]));
    }
  });

  bot.action(/^pl_r_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    const list = (s.pick && s.pick.regions) || [];
    const region = list[Number(ctx.match[1])];
    if (!region) return askRegion(ctx, c, s);
    s.pick = { ...s.pick, region, city: null };
    try {
      return await askCity(ctx, c, s);
    } catch (err) {
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([]));
    }
  });

  bot.action(/^pl_c_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    const list = (s.pick && s.pick.cities) || [];
    const city = list[Number(ctx.match[1])];
    if (!city) return askRegion(ctx, c, s);
    s.pick.city = city;
    try {
      return await askType(ctx, c, s);
    } catch (err) {
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([]));
    }
  });

  bot.action('pl_back_city', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    if (!s.pick || !s.pick.region) return askRegion(ctx, c, s);
    return askCity(ctx, c, s);
  });

  bot.action(/^pl_t_(restaurant|cafe)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    if (!s.pick || !s.pick.region) return askRegion(ctx, c, s);
    s.pick.type = ctx.match[1];
    try {
      return await askWhich(ctx, c, s);
    } catch (err) {
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([]));
    }
  });

  bot.action(/^pl_p_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    const list = (s.pick && s.pick.places) || [];
    const chosen = list[Number(ctx.match[1])];
    if (!chosen) return askRegion(ctx, c, s);

    // Tanlangan muassasa shu orada to'xtatilgan bo'lishi mumkin —
    // eski tugma bosilganda shu holat yuzaga keladi
    const place = await placeDirectory.findServing(chosen);
    if (!place) {
      return show(
        ctx,
        c.place.gone,
        Markup.inlineKeyboard([[Markup.button.callback(c.place.change, 'place_start')]])
      );
    }

    s.place = { slug: place.slug, name: place.name, businessType: place.businessType };
    s.pick = null;
    // Stol tanlovi eski muassasaga tegishli edi — tozalaymiz
    s.table = null;
    s.call = null;
    botCustomers.setLastPlace(ctx.from.id, place.slug).catch(() => {});

    return show(ctx, `${c.place.chosen(place.name)}\n\n${c.whatNext}`, mainMenu(c));
  });

  // Muassasa tanlanmagan bo'lsa — amalga o'tkazmaymiz
  async function requirePlace(ctx, c) {
    const s = session.get(ctx);
    if (s.place && s.place.slug) return true;
    await show(ctx, c.place.needPlace);
    await askRegion(ctx, c, s);
    return false;
  }

  // ---------- /start ----------
  bot.start(async (ctx) => {
    const { s, c, slug } = ctxOf(ctx);
    s.draft = null;
    const payload = (ctx.startPayload || '').trim();

    // QR KOD ORQALI KELGAN: t_<slug>_<qrToken>
    //
    // Slug endi havolaning O'ZIDA. Avval bitta restoranga bitta bot
    // to'g'ri kelardi va slug botning o'zidan ma'lum edi; bitta platforma
    // botida esa qaysi muassasaning stoli ekanini havoladan bilishdan
    // boshqa iloj yo'q (stol tokenlari har bir muassasaning O'Z bazasida).
    //
    // Kodni DARHOL eslab qolamiz — ro'yxatdan o'tish oralig'ida yo'qolmasin.
    if (payload.startsWith('t_')) {
      const rest = payload.slice(2);
      const cut = rest.lastIndexOf('_');
      if (cut > 0) {
        s.pendingQr = { slug: rest.slice(0, cut), token: rest.slice(cut + 1) };
      }
    }

    // Til hali bir marta ham tanlanmagan bo'lsa — avval shuni so'raymiz
    if (!s.langChosen) {
      return ctx.reply(
        `${c.welcome(placeName(s))}\n\n${c.chooseLang}`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🇺🇿  O'zbekcha", 'set_lang_uz')],
          [Markup.button.callback('🇷🇺  Русский', 'set_lang_ru')],
        ])
      );
    }

    return startOrAsk(ctx, c, s);
  });

  // Til tanlangandan keyin ham, /start dan keyin ham shu yerga tushamiz
  async function startOrAsk(ctx, c, s) {
    const customer = await currentCustomer(ctx);
    if (!customer) return askRegistration(ctx, c, c.welcome(placeName(s)));

    const greeting = customer.firstName
      ? c.auth.back(customer.firstName)
      : c.welcome(placeName(s));
    return afterRegistration(ctx, c, s, greeting);
  }

  // Oxirgi tanlagan muassasasini tiklaymiz — doimiy mijoz har safar
  // to'rt qadamdan o'tmasin. Muassasa endi ishlamayotgan bo'lsa jimgina
  // o'tkazib yuboriladi va odam qaytadan tanlaydi.
  async function restoreLastPlace(ctx, s) {
    if (s.place && s.place.slug) return true;
    const customer = s.customer;
    if (!customer || !customer.lastSlug) return false;
    try {
      const place = await placeDirectory.findServing(customer.lastSlug);
      if (!place) return false;
      s.place = { slug: place.slug, name: place.name, businessType: place.businessType };
      return true;
    } catch (_) {
      return false;
    }
  }

  // Muassasani almashtirish — bitta bot o'nlab joyga xizmat qilgani uchun
  // bu buyruq har doim qo'l ostida bo'lishi kerak
  bot.command('joy', async (ctx) => {
    const { s, c } = ctxOf(ctx);
    if (!(await currentCustomer(ctx))) return askRegistration(ctx, c);
    s.pick = {};
    return askRegion(ctx, c, s);
  });

  bot.command('demo', async (ctx) => {
    const { c } = ctxOf(ctx);
    return sendDemo(ctx, c);
  });

  // Raqamni o'chirish. Va'da berilgan narsa bajarilishi kerak: matnda
  // "/stop yozib o'chirtirishingiz mumkin" deyilgan.
  bot.command('stop', async (ctx) => {
    const { s, c, slug } = ctxOf(ctx);
    try {
      await botCustomers.remove(ctx.from.id);
    } catch (err) {
      console.error(`   [bot] mijoz o'chirilmadi: ${err.message}`);
    }
    s.customer = undefined;
    s.table = null;
    s.draft = null;
    await ctx.reply(c.auth.removed, Markup.removeKeyboard());
    return askRegistration(ctx, c);
  });

  bot.command('menu', (ctx) => goHome(ctx));
  bot.command('help', async (ctx) => {
    const { s, c, slug } = ctxOf(ctx);
    // Ro'yxatdan o'tmaganga ishlaydigan tugmalar emas, keyingi qadam kerak
    if (!(await currentCustomer(ctx))) return askRegistration(ctx, c, c.help);
    return ctx.reply(c.help, mainMenu(c));
  });

  // Har qanday oqimni to'xtatish. Ikkala tilda ham ishlaydi.
  const cancelFlow = async (ctx) => {
    const { s, c, slug } = ctxOf(ctx);
    const had = !!s.draft;
    s.draft = null;
    if (!(await currentCustomer(ctx))) return askRegistration(ctx, c);
    return ctx.reply(
      had ? `${c.reserve.cancelled}\n\n${c.whatNext}` : c.whatNext,
      mainMenu(c)
    );
  };
  bot.command('bekor', cancelFlow);
  bot.command('cancel', cancelFlow);
  bot.command('otmena', cancelFlow);

  bot.action('home', async (ctx) => {
    await ctx.answerCbQuery();
    return goHome(ctx);
  });

  // ---------- Til ----------
  bot.action('lang', async (ctx) => {
    await ctx.answerCbQuery();
    const { c } = ctxOf(ctx);
    return show(
      ctx,
      c.chooseLang,
      Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿  O'zbekcha", 'set_lang_uz')],
        [Markup.button.callback('🇷🇺  Русский', 'set_lang_ru')],
      ])
    );
  });

  bot.action(/^set_lang_(uz|ru)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const s = session.get(ctx);
    s.lang = ctx.match[1];
    s.langChosen = true;
    const c = t(s.lang);

    const customer = await currentCustomer(ctx);
    if (!customer) {
      // Til tanlash xabarini yopamiz va ro'yxatdan o'tishga o'tamiz.
      // Kontakt tugmasi reply-klaviaturada, ya'ni ALOHIDA xabar kerak.
      await show(ctx, c.langSet);
      return askRegistration(ctx, c);
    }

    // Til tanlovi keyingi safar ham eslansin
    botCustomers.setLang(ctx.from.id, s.lang).catch(() => {});
    if (s.customer && s.customer.lang) s.customer.lang = s.lang;

    return show(ctx, `${c.langSet}\n\n${c.whatNext}`, mainMenu(c));
  });

  // ---------- Skanersiz Mini App'ni ochish ----------
  //
  // QR kod bo'lmasa ham menyuni ilovada ochish mumkin. Stol sessiyasi bor
  // bo'lsa — o'sha stol bilan ochiladi, bo'lmasa ilovaning o'zi stol
  // tanlashni so'raydi.
  bot.action('open_app', async (ctx) => {
    const { s, c, slug } = ctxOf(ctx);
    if (!(await requireRegistration(ctx, c))) return null;
    if (!(await requirePlace(ctx, c))) return null;
    await ctx.answerCbQuery();

    const url =
      s.table && s.table.token
        ? `${tablePickerUrl(slug)}?table=${s.table.id}&n=${s.table.number}` +
          `&name=${encodeURIComponent(s.table.name || ctx.from.first_name || 'Mehmon')}` +
          `&token=${s.table.token}`
        : tablePickerUrl(slug);

    const head = s.table && s.table.number ? c.app.withTable(s.table.number) : c.app.noTable;
    const link = withLink(c, head, url);
    return show(ctx, link.text, Markup.inlineKeyboard([...link.rows, backRow(c)]));
  });

  // ============================================================
  //  OFITSIANT CHAQIRISH — MANZILLI
  // ============================================================
  //
  // Avval chaqiruv hamma ofitsiantga birdan ketardi va u ishlashi uchun
  // mijozda ochiq "stol sessiyasi" bo'lishi shart edi — ya'ni odam avval
  // stol band qilib, buyurtma oqimidan o'tishi kerak edi. Faqat suv
  // so'ramoqchi bo'lgan odam uchun bu juda uzun yo'l.
  //
  // Endi ikki qadam: qaysi stol -> qaysi ofitsiant. Xabar AYNAN o'sha
  // ofitsiantga boradi, "hamma ko'radi, hech kim bormaydi" holati yo'q.
  //
  // STOL HAR SAFAR QAYTA SO'RALADI va hech qachon eslab qolinmaydi.
  // Sabab oddiy: odam ertaga boshqa stolga o'tiradi. Bir marta tanlangan
  // stolni keyingi safar ham ishlatish — ofitsiantni ATAYLAB noto'g'ri
  // stolga yuborish degani, va mijoz buni chaqiruv ketgandan keyingina
  // bilib qoladi. Bitta ortiqcha tugma bosish bundan ancha arzon.
  //
  // Shu sababli tanlov `s.table` da EMAS, alohida `s.call` da turadi:
  // `s.table` QR kod bilan bog'liq (Mini App havolasi uchun), `s.call` esa
  // faqat shu chaqiruv uchun yashaydi va yuborilishi bilan o'chadi.

  const tableRows = (c, tables) => {
    const rows = [];
    for (let i = 0; i < tables.length; i += 4) {
      rows.push(
        tables
          .slice(i, i + 4)
          .map((t) => Markup.button.callback(c.call.tableLabel(t.tableNumber), `cw_t_${t.id}`))
      );
    }
    return rows;
  };

  // 2-qadam. Stol tanlandi — endi kimni chaqirishni so'raymiz.
  async function askWaiter(ctx, c, s) {
    const db = await getTenantClient(s.place.slug);
    const { waiters, allBusy } = await waiterCalls.listCallableWaiters(db);

    if (waiters.length === 0) {
      return show(ctx, c.call.none, Markup.inlineKeyboard([backRow(c)]));
    }

    const rows = waiters.map((w) => [
      Markup.button.callback(
        w.status === 'busy' ? `${w.fullName} · ⏳` : w.fullName,
        `cw_w_${w.id}`
      ),
    ]);
    // "Farqi yo'q" — eng tez yo'l, shuning uchun eng tepada
    rows.unshift([Markup.button.callback(c.call.anyone, 'cw_any')]);
    rows.push([Markup.button.callback(c.call.changeTable, 'cw_change')]);
    rows.push(backRow(c));

    const head = allBusy ? c.call.pickAllBusy : c.call.pick(waiters.length);
    return show(ctx, `${c.call.tableLabel(s.call.number)}\n\n${head}`, Markup.inlineKeyboard(rows));
  }

  // 1-qadam. Har safar shu yerdan boshlanadi.
  async function askTable(ctx, c) {
    const db = await getTenantClient(placeSlug(ctx));
    const tables = await waiterCalls.listTables(db);
    if (tables.length === 0) {
      return show(ctx, c.call.noTables, Markup.inlineKeyboard([backRow(c)]));
    }
    return show(
      ctx,
      c.call.askTable,
      Markup.inlineKeyboard([...tableRows(c, tables), backRow(c)])
    );
  }

  bot.action('call_waiter', async (ctx) => {
    const { s, c, slug } = ctxOf(ctx);
    if (!(await requireRegistration(ctx, c))) return null;
    if (!(await requirePlace(ctx, c))) return null;
    await ctx.answerCbQuery();
    // Eski tanlov qolib ketmasin — har chaqiruv toza varaqdan boshlanadi
    s.call = null;
    try {
      return await askTable(ctx, c);
    } catch (err) {
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([backRow(c)]));
    }
  });

  // Ofitsiant tanlash ekranidan stol tanlashga qaytish
  bot.action('cw_change', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c, slug } = ctxOf(ctx);
    s.call = null;
    try {
      return await askTable(ctx, c);
    } catch (err) {
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([backRow(c)]));
    }
  });

  bot.action(/^cw_t_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c, slug } = ctxOf(ctx);
    try {
      const db = await getTenantClient(slug);
      const tables = await waiterCalls.listTables(db);
      const table = tables.find((t) => t.id === ctx.match[1]);
      if (!table) return await askTable(ctx, c);

      // FAQAT shu chaqiruv uchun. Yuborilgach o'chadi — keyingi safar
      // odam boshqa stolda o'tirgan bo'lishi mumkin.
      s.call = { id: table.id, number: table.tableNumber };
      return await askWaiter(ctx, c, s);
    } catch (err) {
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([backRow(c)]));
    }
  });

  // Aniq ofitsiant yoki "farqi yo'q" — ikkalasi ham shu yerga tushadi
  async function sendCall(ctx, waiterId) {
    const { s, c, slug } = ctxOf(ctx);
    if (!s.call || !s.call.id) return askTable(ctx, c);

    try {
      const db = await getTenantClient(slug);
      const { waiter, tableNumber } = await waiterCalls.call(slug, db, {
        tableId: s.call.id,
        waiterId,
        clientName: (s.customer && s.customer.firstName) || ctx.from.first_name || 'Mehmon',
      });
      // Tanlov ishlatildi — o'chiramiz. Keyingi chaqiruv stolni qaytadan
      // so'raydi, chunki odam allaqachon boshqa joyda o'tirgan bo'lishi mumkin.
      s.call = null;
      return show(
        ctx,
        c.call.sent(waiter.fullName, tableNumber),
        Markup.inlineKeyboard([
          [Markup.button.callback(c.menu.callWaiter, 'call_waiter')],
          backRow(c),
        ])
      );
    } catch (err) {
      s.call = null;
      if (err.code === 'NO_WAITERS') {
        return show(ctx, c.call.none, Markup.inlineKeyboard([backRow(c)]));
      }
      if (err.code === 'TABLE_NOT_FOUND') {
        return askTable(ctx, c);
      }
      console.error(`   [bot] chaqiruv yuborilmadi:`, err.message);
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([backRow(c)]));
    }
  }

  bot.action('cw_any', async (ctx) => {
    await ctx.answerCbQuery();
    return sendCall(ctx, null);
  });

  bot.action(/^cw_w_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    return sendCall(ctx, ctx.match[1]);
  });
  // ============================================================
  //  BRON QILISH — bosqichma-bosqich, asosan tugmalar bilan
  // ============================================================

  bot.action('reserve', async (ctx) => {
    const { s, c, slug } = ctxOf(ctx);
    if (!(await requireRegistration(ctx, c))) return null;
    if (!(await requirePlace(ctx, c))) return null;
    await ctx.answerCbQuery();
    s.draft = { step: 'name' };

    const rows = [];
    if (ctx.from.first_name) {
      rows.push([Markup.button.callback(c.reserve.useMyName(ctx.from.first_name), 'r_myname')]);
    }
    rows.push([Markup.button.callback(c.menu.cancel, 'home')]);
    return show(ctx, c.reserve.start, Markup.inlineKeyboard(rows));
  });

  bot.action('r_myname', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c, slug } = ctxOf(ctx);
    if (!s.draft) return goHome(ctx);
    s.draft.clientName = ctx.from.first_name;
    return askPhone(ctx, c, ctx.from.first_name);
  });

  // Telefon: Telegram'ning "kontaktni ulashish" tugmasi eng qulay yo'l —
  // mijoz raqamni qo'lda terib xato qilmaydi
  function phoneKeyboard(c) {
    return Markup.keyboard([[Markup.button.contactRequest(c.reserve.sharePhone)]])
      .oneTime()
      .resize();
  }

  // Ro'yxatdan o'tishda raqam allaqachon olingan — bron qilayotgan odamdan
  // uni QAYTA so'ramaymiz. Aynan shu narsa ro'yxatdan o'tishning mijoz
  // uchun ko'rinadigan foydasi.
  async function askPhone(ctx, c, clientName) {
    await show(ctx, `${c.fields.name}  ${clientName}`);
    const s = session.get(ctx);
    const customer = await currentCustomer(ctx);

    if (customer && customer.phone) {
      s.draft.phone = customer.phone;
      s.draft.step = 'party';
      await ctx.reply(`${c.fields.phone}  ${customer.phone}`);
      return ctx.reply(c.reserve.askParty, partyKeyboard(c));
    }

    s.draft.step = 'phone';
    return ctx.reply(c.reserve.askPhone, phoneKeyboard(c));
  }

  function partyKeyboard(c) {
    const rows = [];
    for (let i = 1; i <= 8; i += 4) {
      rows.push([1, 2, 3, 4].map((k) => k + i - 1).map((n) => Markup.button.callback(String(n), `r_party_${n}`)));
    }
    rows.push([Markup.button.callback(c.reserve.morePeople, 'r_party_more')]);
    rows.push([Markup.button.callback(c.menu.cancel, 'home')]);
    return Markup.inlineKeyboard(rows);
  }

  function dateKeyboard(c) {
    const now = new Date();
    const day = (offset) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      return d;
    };
    const labels = [c.reserve.today, c.reserve.tomorrow, c.reserve.dayAfter];
    const rows = [
      [0, 1, 2].map((i) => Markup.button.callback(labels[i], `r_date_${i}`)),
      [3, 4, 5].map((i) => Markup.button.callback(fmtDate(day(i)), `r_date_${i}`)),
      [Markup.button.callback(c.reserve.otherDate, 'r_date_other')],
      [Markup.button.callback(c.menu.cancel, 'home')],
    ];
    return Markup.inlineKeyboard(rows);
  }

  function timeKeyboard(c) {
    const hours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const rows = [];
    for (let i = 0; i < hours.length; i += 4) {
      rows.push(
        hours.slice(i, i + 4).map((h) => Markup.button.callback(`${h}:00`, `r_time_${h}_0`))
      );
    }
    rows.push([
      Markup.button.callback('18:30', 'r_time_18_30'),
      Markup.button.callback('19:30', 'r_time_19_30'),
      Markup.button.callback('20:30', 'r_time_20_30'),
    ]);
    rows.push([Markup.button.callback(c.reserve.otherTime, 'r_time_other')]);
    rows.push([Markup.button.callback(c.menu.cancel, 'home')]);
    return Markup.inlineKeyboard(rows);
  }

  bot.action(/^r_party_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c, slug } = ctxOf(ctx);
    if (!s.draft) return goHome(ctx);
    s.draft.partySize = Number(ctx.match[1]);
    s.draft.step = 'date';
    return show(ctx, c.reserve.askDate, dateKeyboard(c));
  });

  bot.action('r_party_more', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c, slug } = ctxOf(ctx);
    if (!s.draft) return goHome(ctx);
    s.draft.step = 'party_manual';
    return show(ctx, c.reserve.askPartyManual, Markup.inlineKeyboard([[Markup.button.callback(c.menu.cancel, 'home')]]));
  });

  bot.action(/^r_date_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c, slug } = ctxOf(ctx);
    if (!s.draft) return goHome(ctx);
    const d = new Date();
    d.setDate(d.getDate() + Number(ctx.match[1]));
    s.draft.date = { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
    s.draft.step = 'time';
    return show(ctx, c.reserve.askTime, timeKeyboard(c));
  });

  bot.action('r_date_other', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c, slug } = ctxOf(ctx);
    if (!s.draft) return goHome(ctx);
    s.draft.step = 'date_manual';
    return show(ctx, c.reserve.askDateManual, Markup.inlineKeyboard([[Markup.button.callback(c.menu.cancel, 'home')]]));
  });

  bot.action(/^r_time_(\d+)_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c, slug } = ctxOf(ctx);
    if (!s.draft || !s.draft.date) return goHome(ctx);
    return applyTime(ctx, c, s, Number(ctx.match[1]), Number(ctx.match[2]));
  });

  bot.action('r_time_other', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c, slug } = ctxOf(ctx);
    if (!s.draft) return goHome(ctx);
    s.draft.step = 'time_manual';
    return show(ctx, c.reserve.askTimeManual, Markup.inlineKeyboard([[Markup.button.callback(c.menu.cancel, 'home')]]));
  });

  async function applyTime(ctx, c, s, hh, mm) {
    const { y, m, d } = s.draft.date;
    const when = new Date(y, m, d, hh, mm);
    if (when.getTime() < Date.now()) {
      return show(ctx, `${c.reserve.pastTime}\n\n${c.reserve.askTime}`, timeKeyboard(c));
    }
    s.draft.when = when.toISOString();
    s.draft.step = 'confirm';
    return showConfirm(ctx, c, s);
  }

  function showConfirm(ctx, c, s) {
    const d = s.draft;
    const when = new Date(d.when);
    const summary =
      `${c.reserve.confirmTitle}\n\n` +
      `${c.fields.name}  ${d.clientName}\n` +
      `${c.fields.phone}  ${d.phone}\n` +
      `${c.fields.party}  ${d.partySize} ${c.fields.people}\n` +
      `${c.fields.when}  ${fmtDate(when)}  ${fmtTime(when)}`;

    return show(
      ctx,
      summary,
      Markup.inlineKeyboard([
        [Markup.button.callback(c.reserve.confirm, 'r_confirm')],
        [Markup.button.callback(c.reserve.edit, 'reserve')],
        [Markup.button.callback(c.menu.cancel, 'home')],
      ])
    );
  }

  bot.action('r_confirm', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c, slug } = ctxOf(ctx);
    const d = s.draft;
    if (!d || !d.when) return goHome(ctx);

    try {
      await api(slug, '/client/reservations', {
        method: 'POST',
        body: JSON.stringify({
          clientName: d.clientName,
          phone: d.phone,
          partySize: d.partySize,
          reservationDate: d.when,
          note: `Telegram: @${ctx.from.username || ctx.from.id}`,
        }),
      });

      const when = new Date(d.when);
      s.draft = null;
      return show(
        ctx,
        `${c.reserve.sent}\n\n` +
          `${c.fields.name}  ${d.clientName}\n` +
          `${c.fields.phone}  ${d.phone}\n` +
          `${c.fields.party}  ${d.partySize} ${c.fields.people}\n` +
          `${c.fields.when}  ${fmtDate(when)}  ${fmtTime(when)}\n\n` +
          c.reserve.afterSent,
        mainMenu(c)
      );
    } catch (err) {
      s.draft = null;
      return show(ctx, `${c.reserve.failed}: ${errorText(c, err)}`, mainMenu(c));
    }
  });

  // ---------- Kontakt ulashildi ----------
  bot.on(message('contact'), async (ctx) => {
    const { s, c, slug } = ctxOf(ctx);
    const contact = ctx.message.contact;

    // BEGONA KONTAKT. Telegram'da istalgan odamning kontaktini yuborish
    // mumkin, shuning uchun `user_id` ni tekshiramiz: u faqat O'Z kontaktini
    // yuborganda o'zining ID'siga teng bo'ladi. Bu tekshiruvsiz kimdir
    // boshqa odamning raqami bilan ro'yxatdan o'tib ketardi.
    const isOwn = contact.user_id && String(contact.user_id) === String(ctx.from.id);

    // Bron oqimi ichida — eski xatti-harakat saqlanadi
    if (s.draft && s.draft.step === 'phone') {
      s.draft.phone = contact.phone_number;
      s.draft.step = 'party';
      await ctx.reply(`${c.fields.phone} ${s.draft.phone}`, Markup.removeKeyboard());
      return ctx.reply(c.reserve.askParty, partyKeyboard(c));
    }

    if (!isOwn) {
      return ctx.reply(c.auth.notYours, authKeyboard(c));
    }

    // Ro'yxatdan o'tkazamiz
    try {
      s.customer = await botCustomers.register({
        telegramId: ctx.from.id,
        phone: contact.phone_number,
        firstName: contact.first_name || ctx.from.first_name || null,
        username: ctx.from.username || null,
        lang: s.lang,
      });
    } catch (err) {
      console.error(`   [bot] ro'yxatga olinmadi: ${err.message}`);
      return ctx.reply(c.errors.generic, authKeyboard(c));
    }

    // Kontakt klaviaturasi endi keraksiz — olib tashlaymiz, aks holda u
    // suhbat ostida turib olardi
    await ctx.reply(c.auth.done(s.customer.firstName), Markup.removeKeyboard());
    return afterRegistration(ctx, c, s, null);
  });

  // ---------- Matnli javoblar ----------
  bot.on(message('text'), async (ctx) => {
    const { s, c, slug } = ctxOf(ctx);
    const draft = s.draft;
    const text = (ctx.message.text || '').trim();

    // ---- Hali ro'yxatdan o'tmagan ----
    //
    // Bu yerda odam faqat uch narsa qila oladi: namunani ko'rish, sababni
    // so'rash yoki raqamini yuborish. Boshqa har qanday matnga bot JIM
    // QOLMAYDI — nima kutayotganini qayta aytadi.
    if (!(await currentCustomer(ctx))) {
      if (text === c.auth.demoBtn) return sendDemo(ctx, c);
      if (text === c.auth.whyBtn) return ctx.reply(c.auth.why, authKeyboard(c));

      // Raqamni qo'lda yozgan bo'lsa — nega tugma kerakligini aytamiz
      if (/^[+0-9\s()-]{7,20}$/.test(text)) {
        return ctx.reply(c.auth.typed, authKeyboard(c));
      }
      return askRegistration(ctx, c);
    }

    // Ro'yxatdan o'tgan odam ham namunani ko'rmoqchi bo'lishi mumkin
    if (text === c.auth.demoBtn) return sendDemo(ctx, c);

    // Hech qanday oqim yo'q — buyruq bo'lmagan har qanday matnga menyu
    if (!draft) {
      return ctx.reply(c.whatNext, mainMenu(c));
    }

    if (draft.step === 'name') {
      if (text.length < 2 || text.length > 60) return ctx.reply(c.reserve.start);
      draft.clientName = text;
      return askPhone(ctx, c, text);
    }

    if (draft.step === 'phone') {
      if (!/^[+0-9\s()-]{7,20}$/.test(text)) return ctx.reply(c.reserve.badPhone);
      draft.phone = text;
      draft.step = 'party';
      await ctx.reply(`${c.fields.phone} ${text}`, Markup.removeKeyboard());
      return ctx.reply(c.reserve.askParty, partyKeyboard(c));
    }

    if (draft.step === 'party_manual') {
      const n = Number(text);
      if (!Number.isInteger(n) || n < 1 || n > 50) return ctx.reply(c.reserve.askPartyManual);
      draft.partySize = n;
      draft.step = 'date';
      return ctx.reply(c.reserve.askDate, dateKeyboard(c));
    }

    if (draft.step === 'date_manual') {
      const m = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
      if (!m) return ctx.reply(c.reserve.badDate);
      const [, dd, mm, yyyy] = m;
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (Number.isNaN(d.getTime()) || d.getMonth() !== Number(mm) - 1) {
        return ctx.reply(c.reserve.badDate);
      }
      const endOfDay = new Date(d);
      endOfDay.setHours(23, 59, 59, 999);
      if (endOfDay.getTime() < Date.now()) return ctx.reply(c.reserve.pastDate);

      draft.date = { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
      draft.step = 'time';
      return ctx.reply(c.reserve.askTime, timeKeyboard(c));
    }

    if (draft.step === 'time_manual') {
      const m = text.match(/^(\d{1,2})[:.](\d{2})$/);
      if (!m) return ctx.reply(c.reserve.badTime);
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (hh > 23 || mm > 59) return ctx.reply(c.reserve.badTime);
      if (!draft.date) {
        draft.step = 'date';
        return ctx.reply(c.reserve.askDate, dateKeyboard(c));
      }
      const when = new Date(draft.date.y, draft.date.m, draft.date.d, hh, mm);
      if (when.getTime() < Date.now()) return ctx.reply(c.reserve.pastTime);
      draft.when = when.toISOString();
      draft.step = 'confirm';
      return showConfirm(ctx, c, s);
    }

    return ctx.reply(c.whatNext, mainMenu(c));
  });

  // Boshqa turdagi xabarlar (rasm, stiker, ovoz) — jimgina menyuga qaytaramiz
  bot.on('message', async (ctx) => {
    const { s, c, slug } = ctxOf(ctx);
    if (!(await currentCustomer(ctx))) return askRegistration(ctx, c);
    return ctx.reply(c.whatNext, mainMenu(c));
  });

  // Ushlanmagan har qanday xato: jurnalga yozamiz va mijozga bir og'iz aytamiz.
  // Bot HECH QACHON javobsiz qolmasligi kerak.
  bot.catch(async (err, ctx) => {
    console.error('   [bot] xato:', err && err.message);
    try {
      const s = session.get(ctx);
      const c = t(s.lang || 'uz');
      if (ctx.updateType === 'callback_query') await ctx.answerCbQuery();
      await ctx.reply(c.errors.generic, mainMenu(c));
    } catch (_) {
      /* mijoz botni bloklagan bo'lishi mumkin — bu yerda qiladigan ish yo'q */
    }
  });

  return bot;
}

module.exports = { createPlatformBot };
