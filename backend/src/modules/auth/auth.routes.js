const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');

router.post('/login', controller.login);
router.get('/accept-invite/:token', controller.getInvite);
router.post('/accept-invite/:token', controller.acceptInvite);

module.exports = router;
