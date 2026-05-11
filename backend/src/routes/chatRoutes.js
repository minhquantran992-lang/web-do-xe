const express = require('express');
const { authRequired } = require('../middleware/auth');
const { requireVerifiedEmail } = require('../middleware/requireVerifiedEmail');
const { rateLimit, compose } = require('../middleware/rateLimit');
const { requireTurnstile } = require('../middleware/turnstile');
const { listMyThreads, getOrCreateMyThread, listMyMessages, sendMyMessage, deleteMyThread } = require('../controllers/chatController');
const { requireNotBlockedByShopFromBody } = require('../middleware/vendorBlock');

const router = express.Router();

router.get('/threads', authRequired, listMyThreads);
router.post(
  '/threads',
  authRequired,
  requireVerifiedEmail,
  compose(
    rateLimit({ name: 'chat_thread_user_day', keyPrefix: 'chat_thread_user_day', points: 30, durationSec: 24 * 60 * 60, keyFn: (req) => req.user?.id }),
    requireTurnstile({ action: 'chat_first' })
  ),
  requireNotBlockedByShopFromBody(),
  getOrCreateMyThread
);
router.delete('/threads/:id', authRequired, deleteMyThread);
router.get('/threads/:id/messages', authRequired, listMyMessages);
router.post(
  '/threads/:id/messages',
  authRequired,
  requireVerifiedEmail,
  rateLimit({ name: 'chat_msg_user_min', keyPrefix: 'chat_msg_user_min', points: 60, durationSec: 60, keyFn: (req) => req.user?.id }),
  sendMyMessage
);

module.exports = router;
