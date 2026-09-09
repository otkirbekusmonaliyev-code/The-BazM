// BITTA MUASSASAGA XIZMAT QILUVCHI TELEGRAM BOT.
//
// Bot bazaga to'g'ridan-to'g'ri emas, o'z backend'imizning HTTP API'si orqali
// murojaat qiladi — shu bilan barcha tekshiruvlar (stol bandmi, bron vaqti
// to'g'rimi) bitta joyda, controller'larda qoladi.
//
// Ikkita kirish yo'li:
//   1) QR kod deep-link'i:  t.me/<bot>?start=t_<qrToken>
//      Kod avval TEKSHIRILADI — yaroqsiz bo'lsa mijozga aniq aytiladi va
//      darhol boshqa yo'l taklif qilinadi (avval buzuq havolali tugma
//      berilar edi va mijoz bo'sh ekranga tushib qolardi).
//   2) Oddiy /start — to'liq menyu.
//
// Suhbat holati `session.js` da, matnlar `texts.js` da (o'zbekcha/ruscha).

const { Telegraf, Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const { tableWebUrl, tablePickerUrl } = require('../utils/links');
const session = require('./session');
const { t, pickLang } = require('./texts');

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

const money = (value) => `${new Intl.NumberFormat('ru-RU').format(Number(value) || 0)} so'm`;

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
function withLink(c, text, url) {
  const button = openButton(c.openMenu, url);
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

function mainMenu(c, s) {
  const rows = [
    // Eng birinchi va eng muhim: QR kodsiz ham ilovani ochish mumkin
    [Markup.button.callback(c.menu.openApp, 'open_app')],
    [Markup.button.callback(c.menu.pickTable, 'pick_table')],
    [Markup.button.callback(c.menu.reserve, 'reserve')],
    [Markup.button.callback(c.menu.browse, 'menu')],
  ];
  // Bu ikkisi faqat stolda o'tirgan mijozga ma'noli
  if (s.table) {
    rows.push([
      Markup.button.callback(c.menu.myOrder, 'my_order'),
      Markup.button.callback(c.menu.callWaiter, 'call_waiter'),
    ]);
  }
  rows.push([
    Markup.button.callback(c.menu.help, 'help'),
    Markup.button.callback(c.menu.lang, 'lang'),
  ]);
  return Markup.inlineKeyboard(rows);
}

const backRow = (c) => [Markup.button.callback(c.menu.back, 'home')];

// Sanani "25.12.2026" ko'rinishida
const fmtDate = (d) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
const fmtTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// ============================================================
//  BOT
// ============================================================

function createRestaurantBot({ token, slug, name }) {
  const bot = new Telegraf(token, { handlerTimeout: 20000 });

  // Har bir handler'dan oldin: sessiya + til
  const ctxOf = (ctx) => {
    const s = session.get(ctx);
    if (!s.lang) s.lang = pickLang(s, ctx);
    return { s, c: t(s.lang) };
  };

  async function goHome(ctx, prefix) {
    const { s, c } = ctxOf(ctx);
    s.draft = null;
    const head = prefix ? `${prefix}\n\n` : '';
    return show(ctx, `${head}${c.whatNext}`, mainMenu(c, s));
  }

  // ---------- /start ----------
  bot.start(async (ctx) => {
    const { s, c } = ctxOf(ctx);
    s.draft = null;
    const payload = (ctx.startPayload || '').trim();

    // QR kod orqali kelgan: t_<qrToken>
    if (payload.startsWith('t_')) {
      const qrToken = payload.slice(2);
      try {
        const table = await api(slug, `/client/tables/by-qr/${encodeURIComponent(qrToken)}`);
        s.table = { id: table.id, number: table.tableNumber, token: null };
        const link = withLink(
          c,
          `${c.welcome(name)}\n\n${c.qr.valid(table.tableNumber)}`,
          tableWebUrl(slug, qrToken)
        );
        return ctx.reply(
          link.text,
          Markup.inlineKeyboard([...link.rows, [Markup.button.callback(c.menu.back, 'home')]])
        );
      } catch (err) {
        // Yaroqsiz QR — mijozni boshi berk ko'chada qoldirmaymiz
        return ctx.reply(
          `${c.welcome(name)}\n\n${err.offline ? c.errors.offline : c.qr.invalid}`,
          mainMenu(c, s)
        );
      }
    }

    // Til hali bir marta ham tanlanmagan bo'lsa — avval shuni so'raymiz
    if (!s.langChosen) {
      return ctx.reply(
        `${c.welcome(name)}\n\n${c.chooseLang}`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🇺🇿  O'zbekcha", 'set_lang_uz')],
          [Markup.button.callback('🇷🇺  Русский', 'set_lang_ru')],
        ])
      );
    }

    return ctx.reply(`${c.welcome(name)}\n\n${c.whatNext}`, mainMenu(c, s));
  });

  bot.command('menu', (ctx) => goHome(ctx));
  bot.command('help', async (ctx) => {
    const { s, c } = ctxOf(ctx);
    return ctx.reply(c.help, mainMenu(c, s));
  });

  // Har qanday oqimni to'xtatish. Ikkala tilda ham ishlaydi.
  const cancelFlow = async (ctx) => {
    const { s, c } = ctxOf(ctx);
    const had = !!s.draft;
    s.draft = null;
    return ctx.reply(
      had ? `${c.reserve.cancelled}\n\n${c.whatNext}` : c.whatNext,
      mainMenu(c, s)
    );
  };
  bot.command('bekor', cancelFlow);
  bot.command('cancel', cancelFlow);
  bot.command('otmena', cancelFlow);

  bot.action('home', async (ctx) => {
    await ctx.answerCbQuery();
    return goHome(ctx);
  });

  bot.action('help', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    return show(ctx, c.help, mainMenu(c, s));
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
    return show(ctx, `${c.langSet}\n\n${c.whatNext}`, mainMenu(c, s));
  });

  // ---------- Menyuni ko'rish ----------
  bot.action('menu', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    try {
      const categories = await api(slug, '/menu');
      if (!categories || categories.length === 0) {
        return show(ctx, c.menuView.empty, Markup.inlineKeyboard([backRow(c)]));
      }
      s.categories = categories;

      const rows = categories.map((cat, i) => [
        Markup.button.callback(cat.name, `cat_${i}`),
      ]);
      rows.push(backRow(c));
      return show(ctx, `🍽  ${c.menuView.pickCategory}`, Markup.inlineKeyboard(rows));
    } catch (err) {
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([backRow(c)]));
    }
  });

  bot.action(/^cat_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    const category = s.categories && s.categories[Number(ctx.match[1])];
    if (!category) return goHome(ctx);

    const lines = category.items.map((item) => {
      const price = money(item.price);
      const tail = item.isAvailable === false ? ` — ${c.menuView.soldOut}` : '';
      const desc = item.description ? `\n     ${item.description}` : '';
      return `• ${item.name} — ${price}${tail}${desc}`;
    });

    const body = `📖  ${category.name}\n\n${lines.join('\n')}\n\n${c.menuView.orderHint}`;
    return show(
      ctx,
      body.length > 3900 ? `${body.slice(0, 3900)}…` : body,
      Markup.inlineKeyboard([
        [Markup.button.callback(c.menu.browse, 'menu')],
        backRow(c),
      ])
    );
  });

  // ---------- Bo'sh stolni tanlash ----------
  bot.action('pick_table', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    try {
      const tables = await api(slug, '/client/tables/available');
      if (!tables.length) {
        return show(ctx, c.tables.none, Markup.inlineKeyboard([
          [Markup.button.callback(c.menu.reserve, 'reserve')],
          backRow(c),
        ]));
      }

      const rows = [];
      for (let i = 0; i < tables.length; i += 4) {
        rows.push(
          tables
            .slice(i, i + 4)
            .map((tb) => Markup.button.callback(c.tables.label(tb.tableNumber), `claim_${tb.id}`))
        );
      }
      rows.push(backRow(c));
      return show(ctx, c.tables.pick(tables.length), Markup.inlineKeyboard(rows));
    } catch (err) {
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([backRow(c)]));
    }
  });

  bot.action(/^claim_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    const tableId = ctx.match[1];
    const clientName = ctx.from.first_name || 'Mehmon';

    try {
      const result = await api(slug, `/client/tables/${tableId}/claim`, {
        method: 'POST',
        body: JSON.stringify({ clientName }),
      });

      // Sessiya tokenini saqlaymiz — "buyurtmam qayerda?" va "ofitsiantni
      // chaqirish" aynan shu token bilan ishlaydi
      s.table = {
        id: result.table.id,
        number: result.table.tableNumber,
        token: result.token,
        name: clientName,
      };

      // Mijoz Mini App'da yana ism kiritmasligi uchun tokenni havolaga qo'shamiz
      const url =
        `${tablePickerUrl(slug)}?table=${result.table.id}&n=${result.table.tableNumber}` +
        `&name=${encodeURIComponent(clientName)}&token=${result.token}`;

      const link = withLink(c, c.tables.claimed(result.table.tableNumber), url);

      // Stol ALLAQACHON band qilindi. Endi xabar yuborishdagi har qanday
      // muammo mijozni "stol bandmi yo'qmi" degan noaniqlikda qoldirmasligi
      // kerak — shuning uchun yuborish alohida himoyalangan.
      try {
        return await show(ctx, link.text, Markup.inlineKeyboard([...link.rows, backRow(c)]));
      } catch (sendErr) {
        console.error(`   [bot:${slug}] tasdiq yuborilmadi:`, sendErr.message);
        await ctx.answerCbQuery(c.tables.claimed(result.table.tableNumber), { show_alert: true });
        return null;
      }
    } catch (err) {
      if (err.status === 409) {
        return show(ctx, c.tables.taken, Markup.inlineKeyboard([
          [Markup.button.callback(c.menu.pickTable, 'pick_table')],
          backRow(c),
        ]));
      }
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([backRow(c)]));
    }
  });

  // ---------- Skanersiz Mini App'ni ochish ----------
  //
  // QR kod bo'lmasa ham menyuni ilovada ochish mumkin. Stol sessiyasi bor
  // bo'lsa — o'sha stol bilan ochiladi, bo'lmasa ilovaning o'zi stol
  // tanlashni so'raydi.
  bot.action('open_app', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);

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

  // ---------- Buyurtma holati ----------
  bot.action('my_order', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    if (!s.table || !s.table.token) {
      return show(ctx, c.order.needTable, Markup.inlineKeyboard([
        [Markup.button.callback(c.menu.pickTable, 'pick_table')],
        backRow(c),
      ]));
    }

    try {
      const orders = await api(slug, '/client/orders', {
        headers: { Authorization: `Bearer ${s.table.token}` },
      });
      if (!orders || orders.length === 0) {
        return show(ctx, c.order.none, Markup.inlineKeyboard([backRow(c)]));
      }

      const lines = orders.slice(0, 5).map((o) => {
        const status = c.order.statuses[o.status] || o.status;
        return `#${String(o.id).slice(0, 6)} · ${money(o.totalPrice)}\n${status}`;
      });

      return show(
        ctx,
        `${c.order.title}\n\n${lines.join('\n\n')}`,
        Markup.inlineKeyboard([
          [Markup.button.callback(c.menu.myOrder, 'my_order')],
          backRow(c),
        ])
      );
    } catch (err) {
      // Sessiya muddati tugagan bo'lishi mumkin (3 soat)
      if (err.status === 401) {
        s.table = null;
        return show(ctx, c.order.needTable, Markup.inlineKeyboard([
          [Markup.button.callback(c.menu.pickTable, 'pick_table')],
          backRow(c),
        ]));
      }
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([backRow(c)]));
    }
  });

  bot.action('call_waiter', async (ctx) => {
    const { s, c } = ctxOf(ctx);
    if (!s.table || !s.table.token) {
      await ctx.answerCbQuery();
      return show(ctx, c.order.needTable, Markup.inlineKeyboard([
        [Markup.button.callback(c.menu.pickTable, 'pick_table')],
        backRow(c),
      ]));
    }
    try {
      await api(slug, '/client/call-waiter', {
        method: 'POST',
        headers: { Authorization: `Bearer ${s.table.token}` },
        body: JSON.stringify({}),
      });
      await ctx.answerCbQuery(c.order.waiterCalled, { show_alert: true });
      return null;
    } catch (err) {
      await ctx.answerCbQuery();
      if (err.status === 401) s.table = null;
      return show(ctx, errorText(c, err), Markup.inlineKeyboard([backRow(c)]));
    }
  });

  // ============================================================
  //  BRON QILISH — bosqichma-bosqich, asosan tugmalar bilan
  // ============================================================

  bot.action('reserve', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
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
    const { s, c } = ctxOf(ctx);
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

  async function askPhone(ctx, c, name) {
    await show(ctx, `${c.fields.name}  ${name}`);
    const s = session.get(ctx);
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
    const { s, c } = ctxOf(ctx);
    if (!s.draft) return goHome(ctx);
    s.draft.partySize = Number(ctx.match[1]);
    s.draft.step = 'date';
    return show(ctx, c.reserve.askDate, dateKeyboard(c));
  });

  bot.action('r_party_more', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    if (!s.draft) return goHome(ctx);
    s.draft.step = 'party_manual';
    return show(ctx, c.reserve.askPartyManual, Markup.inlineKeyboard([[Markup.button.callback(c.menu.cancel, 'home')]]));
  });

  bot.action(/^r_date_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    if (!s.draft) return goHome(ctx);
    const d = new Date();
    d.setDate(d.getDate() + Number(ctx.match[1]));
    s.draft.date = { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
    s.draft.step = 'time';
    return show(ctx, c.reserve.askTime, timeKeyboard(c));
  });

  bot.action('r_date_other', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    if (!s.draft) return goHome(ctx);
    s.draft.step = 'date_manual';
    return show(ctx, c.reserve.askDateManual, Markup.inlineKeyboard([[Markup.button.callback(c.menu.cancel, 'home')]]));
  });

  bot.action(/^r_time_(\d+)_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
    if (!s.draft || !s.draft.date) return goHome(ctx);
    return applyTime(ctx, c, s, Number(ctx.match[1]), Number(ctx.match[2]));
  });

  bot.action('r_time_other', async (ctx) => {
    await ctx.answerCbQuery();
    const { s, c } = ctxOf(ctx);
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
    const { s, c } = ctxOf(ctx);
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
        mainMenu(c, s)
      );
    } catch (err) {
      s.draft = null;
      return show(ctx, `${c.reserve.failed}: ${errorText(c, err)}`, mainMenu(c, s));
    }
  });

  // ---------- Kontakt ulashildi ----------
  bot.on(message('contact'), async (ctx) => {
    const { s, c } = ctxOf(ctx);
    if (!s.draft || s.draft.step !== 'phone') {
      return ctx.reply(c.whatNext, mainMenu(c, s));
    }
    s.draft.phone = ctx.message.contact.phone_number;
    s.draft.step = 'party';
    // Kontakt tugmasi klaviaturasini olib tashlaymiz
    await ctx.reply(`${c.fields.phone} ${s.draft.phone}`, Markup.removeKeyboard());
    return ctx.reply(c.reserve.askParty, partyKeyboard(c));
  });

  // ---------- Matnli javoblar ----------
  bot.on(message('text'), async (ctx) => {
    const { s, c } = ctxOf(ctx);
    const draft = s.draft;
    const text = (ctx.message.text || '').trim();

    // Hech qanday oqim yo'q — buyruq bo'lmagan har qanday matnga menyu
    if (!draft) {
      return ctx.reply(c.whatNext, mainMenu(c, s));
    }

    if (draft.step === 'name') {
      if (text.length < 2 || text.length > 60) return ctx.reply(c.reserve.start);
      draft.clientName = text;
      draft.step = 'phone';
      return ctx.reply(c.reserve.askPhone, phoneKeyboard(c));
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

    return ctx.reply(c.whatNext, mainMenu(c, s));
  });

  // Boshqa turdagi xabarlar (rasm, stiker, ovoz) — jimgina menyuga qaytaramiz
  bot.on('message', async (ctx) => {
    const { s, c } = ctxOf(ctx);
    return ctx.reply(c.whatNext, mainMenu(c, s));
  });

  // Ushlanmagan har qanday xato: jurnalga yozamiz va mijozga bir og'iz aytamiz.
  // Bot HECH QACHON javobsiz qolmasligi kerak.
  bot.catch(async (err, ctx) => {
    console.error(`   [bot:${slug}] xato:`, err && err.message);
    try {
      const s = session.get(ctx);
      const c = t(s.lang || 'uz');
      if (ctx.updateType === 'callback_query') await ctx.answerCbQuery();
      await ctx.reply(c.errors.generic, mainMenu(c, s));
    } catch (_) {
      /* mijoz botni bloklagan bo'lishi mumkin — bu yerda qiladigan ish yo'q */
    }
  });

  return bot;
}

module.exports = { createRestaurantBot };
