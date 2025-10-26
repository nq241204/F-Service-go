// routes/admin.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

router.get('/dashboard', authMiddleware(['admin']), adminController.getSystemStats);
router.get('/users', authMiddleware(['admin']), adminController.getUsers);
router.post('/user/:userId/status', authMiddleware(['admin']), adminController.updateUserStatus);

module.exports = router;