const express = require('express');
const router = express.Router();
const controller = require('./waiter.controller');
const requireRole = require('../../middleware/requireRole');

const waiterOrAdmin = requireRole(['waiter', 'admin']);

router.get('/orders', waiterOrAdmin, controller.listMyOrders);
router.patch('/orders/:id/respond', waiterOrAdmin, controller.respondToAssignment);
router.patch('/orders/:id/status', waiterOrAdmin, controller.updateOrderStatus);

module.exports = router;
