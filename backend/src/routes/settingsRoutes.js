const express = require('express');

const {
  getHeroImagesPublic,
  getLandingHeroImagesPublic,
  getDashboardHeroImagesPublic
} = require('../controllers/settingsController');

const router = express.Router();

router.get('/hero-images', getHeroImagesPublic);
router.get('/landing-hero-images', getLandingHeroImagesPublic);
router.get('/dashboard-hero-images', getDashboardHeroImagesPublic);

module.exports = router;
