const express = require('express');
const { authRequired } = require('../middleware/auth');
const { listMyThreads, getOrCreateMyThread, listMyMessages, sendMyMessage, deleteMyThread } = require('../controllers/chatController');

const router = express.Router();

router.get('/threads', authRequired, listMyThreads);
router.post('/threads', authRequired, getOrCreateMyThread);
router.delete('/threads/:id', authRequired, deleteMyThread);
router.get('/threads/:id/messages', authRequired, listMyMessages);
router.post('/threads/:id/messages', authRequired, sendMyMessage);

module.exports = router;
