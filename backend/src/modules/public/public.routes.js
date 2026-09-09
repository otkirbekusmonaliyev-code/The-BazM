const express = require('express');
const router = express.Router();
const controller = require('./public.controller');

// Marketing saytidan keladigan, autentifikatsiyasiz ochiq endpointlar
router.post('/apply', controller.submitApplication);
router.get('/places', controller.searchPlaces);
router.get('/stats', controller.publicStats);
router.get('/plans', controller.listPlans);
router.get('/regions', controller.listRegions);

module.exports = router;
