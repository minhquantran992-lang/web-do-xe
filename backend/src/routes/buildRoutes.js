const express = require('express');
const {
  shareBuild,
  listPublicConfigurations,
  likeConfiguration,
  favoriteConfiguration,
  getPublicBuildDetail
} = require('../controllers/configurationsController');
const { authOptional, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/build/share', authRequired, shareBuild);
router.get('/leaderboard', authOptional, listPublicConfigurations);

router.post('/vote/:buildId', authRequired, (req, res, next) => {
  req.params.id = req.params.buildId;
  return likeConfiguration(req, res, next);
});

router.post('/favorite/:buildId', authRequired, (req, res, next) => {
  req.params.id = req.params.buildId;
  return favoriteConfiguration(req, res, next);
});

router.get('/build/:id', authOptional, getPublicBuildDetail);

module.exports = router;
