const express = require('express');
const { requireVendorApproved } = require('../middleware/auth');
const {
  listVendorBookings,
  getVendorBooking,
  acceptBooking,
  updateBookingStatus,
  rescheduleBooking,
  rejectBooking
} = require('../controllers/bookingsController');

const router = express.Router();

router.get('/', requireVendorApproved, listVendorBookings);
router.get('/:id', requireVendorApproved, getVendorBooking);
router.post('/:id/accept', requireVendorApproved, acceptBooking);
router.post('/:id/reschedule', requireVendorApproved, rescheduleBooking);
router.post('/:id/status', requireVendorApproved, updateBookingStatus);
router.post('/:id/reject', requireVendorApproved, rejectBooking);

module.exports = router;
