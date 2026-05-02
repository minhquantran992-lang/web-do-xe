const express = require('express');

const { financeRequired } = require('../middleware/auth');
const {
  getFinanceOverview,
  getFinanceRevenue,
  listFinanceBookings,
  exportFinanceReport
} = require('../controllers/adminFinanceController');

const router = express.Router();

router.get('/overview', financeRequired, getFinanceOverview);
router.get('/revenue', financeRequired, getFinanceRevenue);
router.get('/bookings', financeRequired, listFinanceBookings);
router.get('/export', financeRequired, exportFinanceReport);

module.exports = router;
