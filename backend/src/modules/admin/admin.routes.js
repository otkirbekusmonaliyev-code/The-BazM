const express = require('express');
const router = express.Router();
const controller = require('./admin.controller');
const requireRole = require('../../middleware/requireRole');

// Restoran profili barcha xodimlarga kerak (header'da nom ko'rsatiladi)
router.get('/restaurant', requireRole(['admin', 'kitchen', 'waiter']), controller.getRestaurantProfile);

const adminOnly = requireRole(['admin']);
router.get('/dashboard', adminOnly, controller.getDashboard);
router.get('/orders', adminOnly, controller.listOrders);
router.patch('/orders/:id/status', adminOnly, controller.updateOrderStatus);

module.exports = router;
