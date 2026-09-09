// O'z-o'zini tekshirishni qo'lda bir marta o'tkazish (jadvalni kutmasdan).
//   node scripts/selfTestOnce.js
// Server ishlab turgan bo'lishi kerak.

require('dotenv').config();
const { runSelfTest } = require('../src/jobs/selfTestJob');

runSelfTest()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
