const express = require('express');
const { listCars } = require('../controllers/carsController');

const router = express.Router();

router.get('/', listCars);

module.exports = router;

