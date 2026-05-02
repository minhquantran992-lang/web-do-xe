const express = require('express');

const { adminRequired } = require('../middleware/auth');
const { adminShadowIssueToken, adminShadowLogs, adminShadowSuspicious, adminShadowHeatmap } = require('../controllers/shadowController');

const router = express.Router();

router.use(adminRequired);

router.get('/logs', adminShadowLogs);
router.get('/suspicious', adminShadowSuspicious);
router.get('/heatmap', adminShadowHeatmap);
router.post('/token', adminShadowIssueToken);

module.exports = router;
