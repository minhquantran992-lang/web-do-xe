const express = require('express');
const { listPublicCars, getPublicCarDetail } = require('../controllers/publicVendorCarsController');

const router = express.Router();

router.get('/', listPublicCars);
router.get('/:id', getPublicCarDetail);

module.exports = router;

