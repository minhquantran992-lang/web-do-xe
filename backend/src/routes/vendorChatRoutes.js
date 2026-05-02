const express = require('express');
const { requireVendorApproved } = require('../middleware/auth');
const {
  listVendorThreads,
  getOrCreateVendorThread,
  listVendorMessages,
  sendVendorMessage,
  deleteVendorThread
} = require('../controllers/chatController');

const router = express.Router();

router.get('/threads', requireVendorApproved, listVendorThreads);
router.post('/threads', requireVendorApproved, getOrCreateVendorThread);
router.delete('/threads/:id', requireVendorApproved, deleteVendorThread);
router.get('/threads/:id/messages', requireVendorApproved, listVendorMessages);
router.post('/threads/:id/messages', requireVendorApproved, sendVendorMessage);

module.exports = router;
