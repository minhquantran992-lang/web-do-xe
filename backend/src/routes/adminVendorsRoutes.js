const express = require('express');
const { adminRequired } = require('../middleware/auth');
const { listVendorsAdmin, approveVendorAdmin, rejectVendorAdmin } = require('../controllers/adminVendorsController');

const router = express.Router();

router.get('/', adminRequired, listVendorsAdmin);
router.put('/:id/approve', adminRequired, approveVendorAdmin);
router.put('/:id/reject', adminRequired, rejectVendorAdmin);

module.exports = router;

