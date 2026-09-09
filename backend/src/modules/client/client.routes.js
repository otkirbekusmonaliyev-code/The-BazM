const express = require('express');
const router = express.Router();
const controller = require('./client.controller');
const requireClientSession = require('../../middleware/requireClientSession');

// --- Ochiq (token kerak emas) ---
router.get('/place', controller.getPlace);                        // muassasa nomi
router.post('/session', controller.createSession);              // QR skanerlangach
router.get('/tables/by-qr/:qrToken', controller.checkQrToken);   // bot: QR haqiqiymi
router.get('/tables/available', controller.listAvailableTables); // bot: hozir bo'sh stollar
router.post('/tables/:id/claim', controller.claimTable);         // bot: stolni band qilish
router.post('/reservations', controller.createReservation);      // kelajakka bron

// --- Sessiya (client JWT) talab qiladi ---
router.get('/orders', requireClientSession, controller.listMyOrders);
router.post('/orders', requireClientSession, controller.createOrder);
router.get('/orders/:id', requireClientSession, controller.getOrderStatus);
router.patch('/orders/:id/cancel', requireClientSession, controller.cancelOrder);
router.post('/call-waiter', requireClientSession, controller.callWaiter);

module.exports = router;
