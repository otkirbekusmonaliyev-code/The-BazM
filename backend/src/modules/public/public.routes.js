const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const controller = require('./public.controller');

// Ariza holati so'rovi Google tokenini tekshiradi — bu tashqi tarmoq
// murojaati. Cheklovsiz qoldirilsa, kimdir uni behuda yuklash uchun
// ishlatishi mumkin. Haqiqiy odam bu tugmani kuniga bir-ikki marta bosadi.
const statusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.' },
});

// Marketing saytidan keladigan, autentifikatsiyasiz ochiq endpointlar
router.post('/apply', controller.submitApplication);
router.get('/places', controller.searchPlaces);
router.get('/stats', controller.publicStats);
router.get('/plans', controller.listPlans);
router.get('/regions', controller.listRegions);
router.get('/config', controller.siteConfig);
router.post('/application-status', statusLimiter, controller.applicationStatus);

module.exports = router;
