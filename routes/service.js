// routes/service.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const serviceController = require('../controllers/serviceController');

// @route   GET /api/service/list
// @desc    Lấy danh sách các loại Dịch vụ có sẵn (Public access)
router.get('/list', serviceController.getServiceList);

// @route   POST /api/service/create
// @desc    Tạo một Yêu cầu Ủy thác mới (Chỉ User)
router.post('/create', authMiddleware(['user']), serviceController.createUyThac);

// @route   GET /api/service/:id
// @desc    Lấy chi tiết một Yêu cầu Ủy thác (User/Member/Admin)
router.get('/:id', authMiddleware(['user', 'member', 'admin']), serviceController.getUyThacDetails);

// THÊM: Các route cho Member nhận/hủy Ủy thác (Nên đặt trong memberController)

module.exports = router;