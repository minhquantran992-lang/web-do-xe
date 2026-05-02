const express = require('express');
const { authRequired, requireVendor } = require('../middleware/auth');
const {
  getMyShop,
  upsertMyShop,
  setMyAcceptingBookings,
  setMyClosedToday,
  setMyCapacity,
  getMyStats,
  listMyReviews,
  listMyShopPosts,
  createMyShopPost,
  updateMyShopPost,
  deleteMyShopPost
} = require('../controllers/vendorController');

const router = express.Router();

router.get('/shop', authRequired, getMyShop);
router.post('/shop', authRequired, upsertMyShop);
router.put('/shop', authRequired, upsertMyShop);
router.post('/shop/accepting-bookings', requireVendor, setMyAcceptingBookings);
router.post('/shop/closed-today', requireVendor, setMyClosedToday);
router.post('/shop/capacity', requireVendor, setMyCapacity);
router.get('/stats', requireVendor, getMyStats);
router.get('/reviews', requireVendor, listMyReviews);
router.get('/posts', requireVendor, listMyShopPosts);
router.post('/posts', requireVendor, createMyShopPost);
router.put('/posts/:id', requireVendor, updateMyShopPost);
router.delete('/posts/:id', requireVendor, deleteMyShopPost);

module.exports = router;
