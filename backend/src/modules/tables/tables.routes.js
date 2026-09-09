const express = require('express');
const router = express.Router();
const controller = require('./tables.controller');
const requireRole = require('../../middleware/requireRole');

const adminOnly = requireRole(['admin']);
// Oshpaz va ofitsiant ham stol xaritasini ko'radi (faqat o'qish)
const staff = requireRole(['admin', 'kitchen', 'waiter']);

router.get('/admin', staff, controller.listTables);
router.post('/admin', adminOnly, controller.createTable);
router.post('/admin/bulk', adminOnly, controller.createTablesBulk);
router.get('/admin/qr-codes', adminOnly, controller.listTableQrCodes);
router.get('/admin/qr-info', adminOnly, controller.getQrInfo);
router.get('/admin/:id/qr-code', adminOnly, controller.getTableQrImage);
router.post('/admin/:id/qr-code/regenerate', adminOnly, controller.regenerateTableQr);
router.patch('/admin/:id/release', staff, controller.releaseTable);
router.delete('/admin/:id', adminOnly, controller.deleteTable);

module.exports = router;
