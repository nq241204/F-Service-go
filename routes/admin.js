// routes/admin.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');
const User = require('../models/User'); // Import để dùng trong route /users đã có trước đó
const Service = require('../models/DichVu'); // Import để dùng trong route /services đã có trước đó

// --- Route Quản lý Người dùng (Đã có trong code cũ, bổ sung controller) ---
// @route   GET /api/admin/users
// @desc    Lấy danh sách Users (Đã sửa lỗi select('-password') thành select('-MatKhau'))
router.get('/users', authMiddleware(['admin']), async (req, res) => {
    try {
        const users = await User.find().select('-MatKhau');
        res.json(users);
    } catch (error) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   PUT /api/admin/user/:userId/status
// @desc    Chặn/Kích hoạt User
router.put('/user/:userId/status', authMiddleware(['admin']), adminController.toggleUserStatus);


// --- Route Quản lý Dịch vụ (Bổ sung controller) ---
// @route   GET /api/admin/services
// @desc    Lấy danh sách Services
router.get('/services', authMiddleware(['admin']), async (req, res) => {
    try {
        // Giữ nguyên logic cũ nếu muốn lấy services và populate
        const services = await Service.find().populate('user member'); 
        res.json(services);
    } catch (error) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   POST /api/admin/service
// @desc    Thêm Dịch vụ mới
router.post('/service', authMiddleware(['admin']), adminController.addService);


// --- Route Thống kê Hệ thống ---
// @route   GET /api/admin/stats
// @desc    Xem thống kê tổng quan
router.get('/stats', authMiddleware(['admin']), adminController.getSystemStats);


module.exports = router;