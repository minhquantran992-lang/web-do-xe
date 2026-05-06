const express = require('express');
const { authRequired } = require('../middleware/auth');
const { createOrder, confirmOrder, rejectOrder, cancelOrder, reviewOrder, listMyOrders, getMyOrderDetail } = require('../controllers/ordersController');

const router = express.Router();

router.post('/', authRequired, createOrder);
router.get('/my', authRequired, listMyOrders);
router.post('/:id/confirm', authRequired, confirmOrder);
router.post('/:id/reject', authRequired, rejectOrder);
router.post('/:id/cancel', authRequired, cancelOrder);
router.post('/:id/review', authRequired, reviewOrder);
router.get('/:id', authRequired, getMyOrderDetail);

module.exports = router;
