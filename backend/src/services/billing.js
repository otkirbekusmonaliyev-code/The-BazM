// OYLIK TO'LOV.
//
// Qanday ishlaydi:
//
//   1) Har oy muassasaga BITTA hisob ochiladi (`monthlyFee` summasida).
//   2) To'lov QISMAN kelishi mumkin. 300 000 lik hisobga 100 000 tushsa,
//      hisob YOPILMAYDI — qolgan 200 000 qarz bo'lib turadi va tizim
//      to'lovni so'rayveradi. Pul yo'qolmaydi.
//   3) Hisob TO'LIQ yopilgandagina xizmat yana bir oyga ochiladi.
//   4) Muddatga 5 kun qolganda panelda eslatma chiqadi va har kuni
//      ko'rinib turadi.
//   5) Muddat o'tgach 3 kun muhlat beriladi. Undan keyin xizmat
//      to'xtaydi — lekin to'lov sahifasi ochiq qoladi.
//
// NEGA MUHLAT BOR. Bank o'tkazmasi kechikishi mumkin, va bitta kunlik
// kechikish uchun restoranning zalini ish o'rtasida yopish — mijozni
// yo'qotishning eng tez yo'li. Uch kun ichida panelda qizil ogohlantirish
// turadi, ya'ni hech kim kutilmaganda qolmaydi.
//
// ORTIQCHA TO'LOV yo'qolmaydi: u `creditBalance` ga tushadi va keyingi
// hisob ochilganda avtomatik ishlatiladi.

const masterPrisma = require('../config/masterDb');
const { invalidateTenantClient } = require('../config/tenantDb');

const REMIND_DAYS = Number(process.env.BILLING_REMIND_DAYS) || 5;
const GRACE_DAYS = Number(process.env.BILLING_GRACE_DAYS) || 3;

const DAY = 24 * 60 * 60 * 1000;
const num = (v) => Number(v || 0);

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

function addMonth(date) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);
  // 31-yanvarga bir oy qo'shilsa 3-mart chiqadi — buni to'g'irlaymiz
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

const daysBetween = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY);

function invoiceNumber(slug, when) {
  const y = when.getFullYear();
  const m = String(when.getMonth() + 1).padStart(2, '0');
  const tail = slug.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();
  return `${y}${m}-${tail}`;
}

// ============================================================
//  HISOB OCHISH
// ============================================================

// Ochiq hisob (bo'lsa)
function openInvoiceOf(restaurantId) {
  return masterPrisma.billingRecord.findFirst({
    where: { restaurantId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    include: { payments: { orderBy: { createdAt: 'desc' } } },
  });
}

/**
 * Muassasaga hisob kerakmi? Kerak bo'lsa ochadi.
 *
 * Hisob muddatdan `REMIND_DAYS` kun OLDIN ochiladi — shunda odam
 * to'lashga ulguradi va eslatma ko'rsatishga narsa bo'ladi.
 */
async function ensureInvoice(restaurant) {
  if (num(restaurant.monthlyFee) <= 0) return null;
  if (restaurant.subscriptionStatus === 'cancelled') return null;

  const existing = await openInvoiceOf(restaurant.id);
  if (existing) return existing;

  const due = restaurant.nextBillingDate ? new Date(restaurant.nextBillingDate) : new Date();
  const openFrom = new Date(due.getTime() - REMIND_DAYS * DAY);
  if (Date.now() < openFrom.getTime()) return null;

  const periodStart = due;
  const periodEnd = addMonth(due);

  const created = await masterPrisma.billingRecord.create({
    data: {
      restaurantId: restaurant.id,
      amount: num(restaurant.monthlyFee),
      status: 'pending',
      invoiceNumber: invoiceNumber(restaurant.slug, periodStart),
      periodStart,
      periodEnd,
      dueDate: due,
    },
    include: { payments: true },
  });

  // Oldingi ortiqcha to'lov bo'lsa — darhol ishlatamiz
  const credit = num(restaurant.creditBalance);
  if (credit > 0) {
    await masterPrisma.restaurant.update({
      where: { id: restaurant.id },
      data: { creditBalance: 0 },
    });
    // DIQQAT: `applyPayment` {invoice, closed, remaining} qaytaradi,
    // hisobning O'ZINI emas. Bu yerda uni to'g'ridan-to'g'ri qaytarish
    // xato edi — chaqiruvchi kod `invoice.amount` o'rniga `undefined`
    // olardi va to'lov sahifasida qarz "0" bo'lib ko'rinardi, ya'ni
    // ortiqcha to'lagan muassasa keyingi oyni bepul olardi.
    const applied = await applyPayment(created.id, credit, {
      method: 'credit',
      note: 'Oldingi ortiqcha to\'lov',
    });
    return applied.invoice;
  }

  return created;
}

// ============================================================
//  TO'LOV
// ============================================================

/**
 * Hisobga pul qo'shadi. To'liq yopilsa — xizmatni yana bir oyga ochadi.
 * @returns {Promise<{invoice: object, closed: boolean, remaining: number}>}
 */
async function applyPayment(invoiceId, amount, { method = 'manual', reference, note } = {}) {
  const value = num(amount);
  if (value <= 0) {
    const err = new Error('To\'lov summasi noldan katta bo\'lishi kerak');
    err.statusCode = 400;
    throw err;
  }

  const invoice = await masterPrisma.billingRecord.findUnique({
    where: { id: invoiceId },
    include: { restaurant: true },
  });
  if (!invoice) {
    const err = new Error('Hisob topilmadi');
    err.statusCode = 404;
    throw err;
  }
  if (invoice.status !== 'pending') {
    const err = new Error('Bu hisob allaqachon yopilgan');
    err.statusCode = 409;
    throw err;
  }

  await masterPrisma.billingPayment.create({
    data: { invoiceId, amount: value, method, reference: reference || null, note: note || null },
  });

  const paid = num(invoice.paidAmount) + value;
  const total = num(invoice.amount);
  const closed = paid >= total;

  const updated = await masterPrisma.billingRecord.update({
    where: { id: invoiceId },
    data: {
      paidAmount: paid,
      ...(closed ? { status: 'paid', paidAt: new Date() } : {}),
    },
    include: { payments: { orderBy: { createdAt: 'desc' } } },
  });

  if (closed) {
    // Xizmat yana bir oyga ochiladi. Ortiqcha pul keyingi hisobga qoladi.
    const base = invoice.periodEnd || addMonth(invoice.dueDate || new Date());
    await masterPrisma.restaurant.update({
      where: { id: invoice.restaurantId },
      data: {
        nextBillingDate: base,
        creditBalance: Math.max(0, paid - total),
        // To'lov tushdi — to'xtatilgan bo'lsa qaytadan ochamiz
        ...(invoice.restaurant.subscriptionStatus === 'suspended'
          ? { subscriptionStatus: 'active' }
          : {}),
      },
    });
    // Suspend paytida kesh yopilgan edi — yangisi ochilsin
    invalidateTenantClient(invoice.restaurant.slug);
  }

  return { invoice: updated, closed, remaining: Math.max(0, total - paid) };
}

// ============================================================
//  HOLAT
// ============================================================

/**
 * Muassasaning to'lov holati. Panel banneri va to'lov sahifasi shu
 * javobdan chiziladi.
 *
 * `state`:
 *   'ok'        — muddatgacha hali vaqt bor
 *   'due_soon'  — 5 kun yoki kamroq qoldi
 *   'overdue'   — muddat o'tdi, lekin muhlat ichida
 *   'suspended' — xizmat to'xtatilgan
 */
async function statusOf(slug) {
  const restaurant = await masterPrisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) {
    const err = new Error('Muassasa topilmadi');
    err.statusCode = 404;
    throw err;
  }

  const invoice = await ensureInvoice(restaurant);
  const fresh = await masterPrisma.restaurant.findUnique({ where: { slug } });

  const due = invoice ? invoice.dueDate : fresh.nextBillingDate;
  const daysLeft = due ? daysBetween(due, new Date()) : null;

  let state = 'ok';
  if (fresh.subscriptionStatus === 'suspended') state = 'suspended';
  else if (daysLeft !== null && daysLeft < 0) state = 'overdue';
  else if (daysLeft !== null && daysLeft <= REMIND_DAYS) state = 'due_soon';

  const amount = invoice ? num(invoice.amount) : num(fresh.monthlyFee);
  const paid = invoice ? num(invoice.paidAmount) : 0;

  return {
    state,
    plan: fresh.subscriptionPlan,
    monthlyFee: num(fresh.monthlyFee),
    dueDate: due,
    daysLeft,
    // Muhlat: muddat o'tgach necha kun qoldi
    graceDaysLeft: daysLeft !== null && daysLeft < 0 ? Math.max(0, GRACE_DAYS + daysLeft) : null,
    graceDays: GRACE_DAYS,
    creditBalance: num(fresh.creditBalance),
    invoice: invoice
      ? {
          id: invoice.id,
          number: invoice.invoiceNumber,
          amount,
          paid,
          remaining: Math.max(0, amount - paid),
          dueDate: invoice.dueDate,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          payments: (invoice.payments || []).map((p) => ({
            id: p.id,
            amount: num(p.amount),
            method: p.method,
            note: p.note,
            createdAt: p.createdAt,
          })),
        }
      : null,
  };
}

// ============================================================
//  KUNLIK TEKSHIRUV (cron)
// ============================================================

/**
 * Hamma muassasa bo'ylab yuradi: hisob ochadi va muhlati tugaganini
 * to'xtatadi.
 *
 * TO'XTATISH FAQAT MUHLAT TUGAGACH. Muddat o'tgan kuniyoq yopish
 * restoranni ish o'rtasida qoldiradi.
 */
async function runDailyCheck() {
  const restaurants = await masterPrisma.restaurant.findMany({
    where: { subscriptionStatus: { in: ['trial', 'active'] } },
  });

  let opened = 0;
  let suspended = 0;

  for (const r of restaurants) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const invoice = await ensureInvoice(r);
      if (invoice && daysBetween(invoice.createdAt, new Date()) === 0) opened += 1;

      const due = invoice ? invoice.dueDate : r.nextBillingDate;
      if (!due) continue;
      const overdueDays = -daysBetween(due, new Date());
      if (overdueDays > GRACE_DAYS && invoice && invoice.status === 'pending') {
        // eslint-disable-next-line no-await-in-loop
        await masterPrisma.restaurant.update({
          where: { id: r.id },
          data: { subscriptionStatus: 'suspended' },
        });
        invalidateTenantClient(r.slug);
        suspended += 1;
        console.log(`   [to'lov] ${r.slug} to'xtatildi — ${overdueDays} kun kechikdi`);
      }
    } catch (err) {
      console.error(`   [to'lov] ${r.slug}: ${err.message}`);
    }
  }

  return { checked: restaurants.length, opened, suspended };
}

module.exports = {
  REMIND_DAYS,
  GRACE_DAYS,
  ensureInvoice,
  openInvoiceOf,
  applyPayment,
  statusOf,
  runDailyCheck,
  addMonth,
};
