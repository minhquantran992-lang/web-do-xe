const express = require('express');
const {
  createConfiguration,
  updateConfigurationPart,
  updateConfigurationPaint,
  listUserConfigurations,
  setConfigurationPublic,
  listPublicConfigurations,
  likeConfiguration,
  unlikeConfiguration,
  favoriteConfiguration,
  unfavoriteConfiguration,
  setConfigurationThumbnail,
  getPublicBuildDetail,
  deleteConfiguration
} = require('../controllers/configurationsController');
const { authOptional, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/', authRequired, createConfiguration);
router.get('/public', authOptional, listPublicConfigurations);
router.get('/public/:id', authOptional, getPublicBuildDetail);
router.put('/:id/part', authRequired, updateConfigurationPart);
router.put('/:id/paint', authRequired, updateConfigurationPaint);
router.put('/:id/public', authRequired, setConfigurationPublic);
router.post('/:id/like', authRequired, likeConfiguration);
router.delete('/:id/like', authRequired, unlikeConfiguration);
router.post('/:id/favorite', authRequired, favoriteConfiguration);
router.delete('/:id/favorite', authRequired, unfavoriteConfiguration);
router.get('/user', authRequired, listUserConfigurations);
router.put('/:id/thumbnail', authRequired, setConfigurationThumbnail);
router.delete('/:id', authRequired, deleteConfiguration);

module.exports = router;
