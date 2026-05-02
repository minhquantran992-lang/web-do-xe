const express = require('express');
const { listBrands } = require('../controllers/brandsController');

const router = express.Router();

router.get('/', listBrands);

module.exports = router;

