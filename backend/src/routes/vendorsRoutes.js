const express = require('express');
const {
  getVendorPublic,
  listPartneredVendors,
  submitPartnerApplication,
  grantVendorFromApplication,
  listVendorPostsPublic
} = require('../controllers/vendorsController');

const router = express.Router();

router.get('/partnered', listPartneredVendors);
router.post('/apply', submitPartnerApplication);
router.get('/apply/:id/grant-vendor', grantVendorFromApplication);
router.get('/:id/posts', listVendorPostsPublic);
router.get('/:id', getVendorPublic);

module.exports = router;
