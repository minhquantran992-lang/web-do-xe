const express = require('express');
const { toggleFollow, getFollowStatus, listFollowing } = require('../controllers/followController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/toggle', authRequired, toggleFollow);
router.get('/status', authRequired, getFollowStatus);
router.get('/list', authRequired, listFollowing);

module.exports = router;
