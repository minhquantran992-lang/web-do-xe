const express = require('express');
const { authRequired } = require('../middleware/auth');
const {
  createBooking,
  getMyBooking,
  listMyBookings,
  confirmMyBooking,
  rejectMyBooking,
  finishMyBooking,
  captureBookingReview,
  submitBookingReviewComment
} = require('../controllers/bookingsController');

const router = express.Router();

router.post('/', authRequired, createBooking);
router.get('/my', authRequired, listMyBookings);
router.get('/review', captureBookingReview);
router.post('/review', submitBookingReviewComment);
router.get('/:id', authRequired, getMyBooking);
router.post('/:id/confirm', authRequired, confirmMyBooking);
router.post('/:id/reject', authRequired, rejectMyBooking);
router.post('/:id/finish', authRequired, finishMyBooking);

module.exports = router;
