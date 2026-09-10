// KUNLIK TO'LOV TEKSHIRUVI.
//
// Kuniga bir marta hamma muassasa bo'ylab yuradi:
//   · muddat yaqinlashganda hisob ochadi (shunda panelda eslatma chiqadi)
//   · muhlati tugaganini to'xtatadi
//
// Tekshiruv KUNIGA BIR MARTA yetarli — hisob va muddat kun aniqligida
// ishlaydi, soat aniqligida emas. Lekin server tunda o'chib-yoqilsa ham
// o'tkazib yubormasligi kerak, shuning uchun ishga tushishda ham bir
// marta ishlaydi (biroz kechikish bilan — bot va boshqa ishlar
// tinchlanib olsin).

const billing = require('../services/billing');

const DEFAULT_INTERVAL_HOURS = 12;
const DEFAULT_FIRST_DELAY_SEC = 60;

let timer = null;
let last = null;

async function runOnce() {
  try {
    const result = await billing.runDailyCheck();
    last = { at: new Date().toISOString(), ...result };
    if (result.opened > 0 || result.suspended > 0) {
      console.log(
        `   [to'lov] ${result.checked} ta muassasa · ${result.opened} ta yangi hisob · ${result.suspended} ta to'xtatildi`
      );
    }
    return last;
  } catch (err) {
    console.error('   [to\'lov] tekshiruv to\'xtadi:', err.message);
    return null;
  }
}

function startBillingJob() {
  if (String(process.env.BILLING_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('   To\'lov tekshiruvi: o\'chirilgan (BILLING_ENABLED=false)');
    return null;
  }

  const hours = Math.max(1, Number(process.env.BILLING_INTERVAL_HOURS) || DEFAULT_INTERVAL_HOURS);
  const firstDelay = Math.max(5, Number(process.env.BILLING_FIRST_DELAY_SEC) || DEFAULT_FIRST_DELAY_SEC);

  const first = setTimeout(runOnce, firstDelay * 1000);
  if (first.unref) first.unref();

  timer = setInterval(runOnce, hours * 60 * 60 * 1000);
  if (timer.unref) timer.unref();

  console.log(
    `   To'lov: har ${hours} soatda tekshiriladi `
    + `(${billing.REMIND_DAYS} kun oldin eslatma, ${billing.GRACE_DAYS} kun muhlat)`
  );
  return timer;
}

function stopBillingJob() {
  if (timer) clearInterval(timer);
  timer = null;
}

const getLastRun = () => last;

module.exports = { startBillingJob, stopBillingJob, runOnce, getLastRun };
