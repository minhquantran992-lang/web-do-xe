const express = require('express');
const {
  getVendorPublic,
  listPartneredVendors,
  checkPartnerEmail,
  submitPartnerApplication,
  grantVendorFromApplication,
  listVendorPostsPublic
} = require('../controllers/vendorsController');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const ipKey = (req) => req.clientIp || req.ip || '';
const rlCheckEmail = rateLimit({ name: 'partner_check_email_ip', keyPrefix: 'partner_check_email_ip', points: 20, durationSec: 60, keyFn: ipKey });

router.get('/partnered', listPartneredVendors);
router.get('/check-email', rlCheckEmail, checkPartnerEmail);
router.post('/apply', submitPartnerApplication);
router.get('/apply/:id/grant-vendor', grantVendorFromApplication);
router.get('/:id/posts', listVendorPostsPublic);
router.get('/:id', getVendorPublic);

module.exports = router;
