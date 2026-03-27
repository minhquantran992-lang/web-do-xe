const express = require('express');
const { getVendorPublic } = require('../controllers/vendorsController');

const router = express.Router();

router.get('/:id', getVendorPublic);

module.exports = router;

