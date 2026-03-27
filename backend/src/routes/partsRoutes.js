const express = require('express');
const { listParts } = require('../controllers/partsController');

const router = express.Router();

router.get('/', listParts);

module.exports = router;

