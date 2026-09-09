const express = require('express');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const { getSelfTestHistory, runSelfTest } = require('../jobs/selfTestJob');
const { poolStats } = require('../config/tenantDb');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// O'z-o'zini tekshirish natijalari. Faqat platforma egasi ko'radi —
// muvaffaqiyatsiz qadam nomlari ichki tuzilma haqida ma'lumot beradi.
router.get('/selftest', requireSuperAdmin, (req, res) => {
  res.json({ ...getSelfTestHistory(), connections: poolStats() });
});

// Kutmasdan hoziroq o'tkazish (odatda kuniga 1-2 marta o'zi ishlaydi)
router.post('/selftest', requireSuperAdmin, async (req, res, next) => {
  try {
    res.json(await runSelfTest());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
