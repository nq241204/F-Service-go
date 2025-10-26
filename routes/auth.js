// routes/auth.js (Phiên bản Hoàn thiện)
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// @route   POST /api/auth/register
// @desc    Đăng ký người dùng mới (sẽ tạo cả User và ViGiaoDich)
router.post('/register', authController.register);

// @route   POST /api/auth/login
// @desc    Đăng nhập và nhận JWT token
router.post('/login', authController.login);

// THÊM: Có thể thêm route /me để lấy thông tin user hiện tại
// const authMiddleware = require('../middleware/authMiddleware');
// router.get('/me', authMiddleware(['user', 'member', 'admin']), (req, res) => {
//     res.status(200).json({ success: true, user: req.user });
// });

module.exports = router;