const express = require('express');
const { authRequired } = require('../middleware/auth');
const { createBooking, getMyBooking, captureBookingReview, submitBookingReviewComment } = require('../controllers/bookingsController');

const router = express.Router();

router.post('/', authRequired, createBooking);
router.get('/review', captureBookingReview);
router.post('/review', submitBookingReviewComment);
router.get('/:id', authRequired, getMyBooking);

module.exports = router;
