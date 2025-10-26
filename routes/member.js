// routes/member.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const memberController = require('../controllers/memberController');
const walletController = require('../controllers/walletController');
const transactionController = require('../controllers/transactionController');

// Middleware chung cho Member (rút gọn)
const isMember = authMiddleware(['member']);

// Dashboard routes
router.get('/dashboard', isMember, memberController.renderDashboard);
router.get('/profile', isMember, memberController.renderProfile);

// API routes
router.get('/api/profile', isMember, memberController.getMemberProfile);
router.put('/api/profile', isMember, memberController.updateProfile);
router.get('/api/wallet/balance', isMember, walletController.getBalance);
router.post('/api/service/accept/:serviceId', isMember, memberController.acceptService);

// @route   POST /api/commission/settle/:serviceId
// @desc    API Thanh toán Ủy thác (sẽ được Admin/Hệ thống gọi)
router.post('/commission/settle/:serviceId', isMember, async (req, res) => {
    try {
        // Lưu ý: Hàm này dùng cho mục đích API. Đối với Web, thường dùng form POST 
        // gọi đến một controller trung gian.
        const result = await transactionController.settleCommissionPayment(req, res); 
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// --- WEB ROUTES ---

// @route   GET /member/dashboard
// @desc    Trang Dashboard chính cho Member
router.get('/dashboard', isMember, memberController.renderDashboard);

// @route   GET /member/profile
// @desc    Trang hồ sơ cá nhân
router.get('/profile', isMember, memberController.renderProfile);


module.exports = router;