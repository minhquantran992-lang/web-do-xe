const express = require('express');
const { adminRequired } = require('../middleware/auth');
const { listSecurityEvents } = require('../controllers/adminSecurityController');

const router = express.Router();

router.get('/events', adminRequired, listSecurityEvents);

module.exports = router;
