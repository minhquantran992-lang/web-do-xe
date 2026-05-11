const express = require('express');
const { authRequired } = require('../middleware/auth');
const { requireVerifiedEmail } = require('../middleware/requireVerifiedEmail');
const { rateLimit, compose } = require('../middleware/rateLimit');
const { requireTurnstile } = require('../middleware/turnstile');
const { requireNotBlockedByShopFromBody } = require('../middleware/vendorBlock');
const { createOrder, confirmOrder, rejectOrder, cancelOrder, reviewOrder, listMyOrders, getMyOrderDetail } = require('../controllers/ordersController');

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
  createOrder
);
router.get('/my', authRequired, listMyOrders);
router.post('/:id/confirm', authRequired, confirmOrder);
router.post('/:id/reject', authRequired, rejectOrder);
router.post('/:id/cancel', authRequired, cancelOrder);
router.post('/:id/review', authRequired, reviewOrder);
router.get('/:id', authRequired, getMyOrderDetail);

module.exports = router;
