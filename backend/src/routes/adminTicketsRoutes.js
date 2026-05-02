const express = require('express');
const { adminRequired } = require('../middleware/auth');
const {
  listTicketsAdmin,
  getTicketAdmin,
  setTicketAdminNote,
  requestMoreEvidenceAdmin,
  updateTicketStatusAdmin,
  flagShopAdmin
} = require('../controllers/ticketsController');

const router = express.Router();

router.get('/', adminRequired, listTicketsAdmin);
router.get('/:id', adminRequired, getTicketAdmin);
router.post('/:id/note', adminRequired, setTicketAdminNote);
router.post('/:id/request-evidence', adminRequired, requestMoreEvidenceAdmin);
router.post('/:id/status', adminRequired, updateTicketStatusAdmin);
router.post('/:id/flag-shop', adminRequired, flagShopAdmin);

module.exports = router;
