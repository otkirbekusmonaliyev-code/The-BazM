const express = require('express');
const router = express.Router();
const controller = require('./login.controller');
const { loginLimiters } = require('../../middleware/loginLimiter');

// Yagona kirish nuqtasi. Parol tanlashdan himoya `loginLimiter` da —
// u hisob va IP bo'yicha alohida sanaydi va faqat MUVAFFAQIYATSIZ
// urinishlarni hisobga oladi.
router.post('/', loginLimiters, controller.login);

module.exports = router;
