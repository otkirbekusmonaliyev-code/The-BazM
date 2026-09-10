require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./realtime/io');
const { startTableReleaseJob, stopTableReleaseJob } = require('./jobs/tableReleaseJob');
const { startSelfTestJob, stopSelfTestJob } = require('./jobs/selfTestJob');
const { startBillingJob, stopBillingJob } = require('./jobs/billingJob');
const { startBots, stopBots } = require('./bot/botManager');

const PORT = process.env.PORT || 4000;

// Muhim sozlamalar yo'q bo'lsa — server ishga tushishdan OLDIN aytamiz,
// aks holda xato faqat birinchi login urinishida chiqadi
for (const key of ['MASTER_DB_URL', 'JWT_SECRET', 'ENCRYPTION_KEY']) {
  if (!process.env[key]) {
    console.error(`\n❌ .env faylida ${key} ko'rsatilmagan. Server to'xtatildi.\n`);
    process.exit(1);
  }
}

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, async () => {
  console.log(`\n🚀 Server ishga tushdi: http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  startTableReleaseJob();
  startSelfTestJob();
  startBillingJob();
  await startBots();
  console.log('');
});

function shutdown(signal) {
  console.log(`\n${signal} — server to'xtatilmoqda...`);
  stopTableReleaseJob();
  stopSelfTestJob();
  stopBillingJob();
  stopBots(signal);
  server.close(() => process.exit(0));
  // 5 soniyada yopilmasa — majburan chiqamiz
  setTimeout(() => process.exit(0), 5000).unref();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
