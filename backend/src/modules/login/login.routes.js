const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const controller = require('./login.controller');

// Login — parol tanlashga urinishlardan himoya uchun alohida, qattiqroq chegara
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urinib ko\'ring.' },
});

router.post('/', loginLimiter, controller.login);

module.exports = router;
