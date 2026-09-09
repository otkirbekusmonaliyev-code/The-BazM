const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');
const { loginLimiters } = require('../../middleware/loginLimiter');

router.post('/login', loginLimiters, controller.login);
router.get('/accept-invite/:token', controller.getInvite);
router.post('/accept-invite/:token', controller.acceptInvite);

module.exports = router;
