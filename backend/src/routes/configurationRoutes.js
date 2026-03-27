const express = require('express');
const { createConfiguration, updateConfigurationPart, listUserConfigurations } = require('../controllers/configurationsController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/', authRequired, createConfiguration);
router.put('/:id/part', authRequired, updateConfigurationPart);
router.get('/user', authRequired, listUserConfigurations);

module.exports = router;
