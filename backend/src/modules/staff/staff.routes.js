const express = require('express');
const router = express.Router();
const controller = require('./staff.controller');
const requireRole = require('../../middleware/requireRole');

const adminOnly = requireRole(['admin']);

router.get('/', adminOnly, controller.listStaff);
router.patch('/:id', adminOnly, controller.updateStaff);

router.post('/invite', adminOnly, controller.inviteStaff);
router.get('/invites', adminOnly, controller.listInvites);
router.delete('/invites/:id', adminOnly, controller.revokeInvite);

module.exports = router;
