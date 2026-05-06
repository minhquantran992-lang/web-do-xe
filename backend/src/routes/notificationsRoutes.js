const express = require('express');
const { listMyNotifications, markRead, markAllRead } = require('../controllers/notificationsController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, listMyNotifications);
router.post('/read-all', authRequired, markAllRead);
router.post('/read/:id', authRequired, markRead);

module.exports = router;
