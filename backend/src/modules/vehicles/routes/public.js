const express = require('express');
const { listCarModels, listCars } = require('../controllers/carsController');

const router = express.Router();

router.get('/', listCars);
router.get('/models', listCarModels);

module.exports = router;
