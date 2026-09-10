const express = require('express');
const router = express.Router();

const controller = require('./superAdmin.controller');
const { loginLimiters } = require('../../middleware/loginLimiter');
const requireSuperAdmin = require('../../middleware/requireSuperAdmin');

// Ochiq — login uchun
// Platforma egasining hisobi — parol tanlashdan albatta himoyalanishi kerak
router.post('/login', loginLimiters, controller.login);

// Bundan keyingilari faqat super_admin token bilan
router.use(requireSuperAdmin);

router.get('/stats', controller.getStats);

router.get('/restaurants', controller.listRestaurants);
router.post('/restaurants', controller.createRestaurant);
router.get('/restaurants/:id', controller.getRestaurant);
router.patch('/restaurants/:id', controller.updateRestaurant);
router.patch('/restaurants/:id/suspend', controller.suspendRestaurant);
router.patch('/restaurants/:id/activate', controller.activateRestaurant);
router.delete('/restaurants/:id', controller.deleteRestaurant);

// To'lovlar. Hozircha qo'lda tasdiqlanadi; Payme/Click ulanganda ular ham
// shu yerdagi mantiqni chaqiradi.
router.get('/restaurants/:id/billing', controller.getRestaurantBilling);
router.post('/restaurants/:id/payments', controller.recordPayment);

router.get('/applications', controller.listApplications);
router.post('/applications/:id/approve', controller.approveApplication);
router.patch('/applications/:id/reject', controller.rejectApplication);

module.exports = router;
