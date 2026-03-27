const express = require('express');
const { authRequired } = require('../middleware/auth');
const { getMyShop, upsertMyShop } = require('../controllers/vendorController');

const router = express.Router();

router.get('/shop', authRequired, getMyShop);
router.post('/shop', authRequired, upsertMyShop);
router.put('/shop', authRequired, upsertMyShop);

module.exports = router;

