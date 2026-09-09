const express = require('express');
const router = express.Router();
const controller = require('./kitchen.controller');
const requireRole = require('../../middleware/requireRole');

const kitchenOrAdmin = requireRole(['kitchen', 'admin']);

router.get('/orders', kitchenOrAdmin, controller.listActiveOrders);
router.patch('/orders/:id/status', kitchenOrAdmin, controller.updateOrderStatus);

// Ofitsiantlar paneli
router.get('/waiters', kitchenOrAdmin, controller.listWaiters);
router.patch('/orders/:id/assign-waiter', kitchenOrAdmin, controller.assignWaiter);

// Bronlar (admin ham shu yerdan ko'radi)
router.get('/reservations', kitchenOrAdmin, controller.listReservations);
router.patch('/reservations/:id', kitchenOrAdmin, controller.updateReservation);

module.exports = router;
