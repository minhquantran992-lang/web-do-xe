const express = require('express');
const { adminRequired } = require('../middleware/auth');
const { listUsersAdmin, updateUserAdmin, deleteUserAdmin } = require('../controllers/adminUsersController');

const router = express.Router();

router.get('/', adminRequired, listUsersAdmin);
router.patch('/:id', adminRequired, updateUserAdmin);
router.delete('/:id', adminRequired, deleteUserAdmin);

module.exports = router;
