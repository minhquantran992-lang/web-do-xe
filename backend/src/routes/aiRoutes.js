const express = require('express');
const { advice, chat, modLegality } = require('../controllers/aiController');

const router = express.Router();

router.post('/advice', advice);
router.post('/chat', chat);
router.post('/mod-legality', modLegality);

module.exports = router;
