const express = require('express');
const { authRequired } = require('../middleware/auth');
const { requireVerifiedEmail } = require('../middleware/requireVerifiedEmail');
const { rateLimit, compose } = require('../middleware/rateLimit');
const { requireTurnstile } = require('../middleware/turnstile');
const { requireNotBlockedByShopFromBody } = require('../middleware/vendorBlock');
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

router.post(
  '/',
  authRequired,
  requireVerifiedEmail,
  compose(
    rateLimit({
      name: 'quote_user_cooldown',
      keyPrefix: 'quote_user_cooldown',
      points: 1,
      durationSec: 30,
      keyFn: (req) => req.user?.id
    }),
    rateLimit({ name: 'quote_user_hour', keyPrefix: 'quote_user_hour', points: 5, durationSec: 60 * 60, keyFn: (req) => req.user?.id }),
    rateLimit({ name: 'quote_ip_hour', keyPrefix: 'quote_ip_hour', points: 15, durationSec: 60 * 60, keyFn: (req) => req.clientIp }),
    requireTurnstile({ action: 'quote' })
  ),
  requireNotBlockedByShopFromBody(),
  createBooking
);
router.get('/my', authRequired, listMyBookings);
router.get('/review', captureBookingReview);
router.post('/review', submitBookingReviewComment);
router.get('/:id', authRequired, getMyBooking);
router.post('/:id/confirm', authRequired, confirmMyBooking);
router.post('/:id/reject', authRequired, rejectMyBooking);
router.post('/:id/finish', authRequired, finishMyBooking);

module.exports = router;
