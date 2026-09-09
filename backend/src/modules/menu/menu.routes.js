const express = require('express');
const router = express.Router();
const controller = require('./menu.controller');
const requireRole = require('../../middleware/requireRole');

// Mijoz uchun — ochiq, hech qanday token kerak emas
router.get('/', controller.getPublicMenu);

// Admin uchun — to'liq ro'yxat (tugagan taomlar ham, tahrirlash imkoniyati bilan)
router.get('/admin', requireRole(['admin']), controller.getAdminMenu);

// Kategoriya CRUD — faqat admin
router.post('/admin/categories', requireRole(['admin']), controller.createCategory);
router.patch('/admin/categories/:id', requireRole(['admin']), controller.updateCategory);
router.delete('/admin/categories/:id', requireRole(['admin']), controller.deleteCategory);

// Taom CRUD — faqat admin
router.post('/admin/items', requireRole(['admin']), controller.createItem);
router.patch('/admin/items/:id', requireRole(['admin']), controller.updateItem);
router.delete('/admin/items/:id', requireRole(['admin']), controller.deleteItem);

// Mavjud/tugagan holatini almashtirish — admin HAM oshpaz bosishi mumkin
// (oshxonada taom tugab qolganda oshpazning o'zi darhol belgilashi uchun)
router.patch('/admin/items/:id/toggle-availability', requireRole(['admin', 'kitchen']), controller.toggleAvailability);

module.exports = router;
