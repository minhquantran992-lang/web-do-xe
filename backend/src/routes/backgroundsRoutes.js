const express = require('express');
const { listBackgrounds } = require('../controllers/backgroundsController');

const router = express.Router();

router.get('/', listBackgrounds);

module.exports = router;

