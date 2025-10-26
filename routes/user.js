// routes/user.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');
const walletController = require('../controllers/walletController');
const DichVu = require('../models/DichVu'); // Cần cho route POST /request

// --- API ROUTES ---

// @route   GET /api/user/profile
// @desc    Lấy thông tin profile
router.get('/profile', authMiddleware(['user']), userController.getProfile);

// @route   GET /api/user/wallet/balance
// @desc    Lấy số dư ví
router.get('/wallet/balance', authMiddleware(['user']), walletController.getBalance);

// @route   POST /api/user/wallet/deposit
// @desc    Nạp tiền vào ví
router.post('/wallet/deposit', authMiddleware(['user']), walletController.deposit);

// @route   POST /api/user/wallet/withdraw
// @desc    Yêu cầu rút tiền
router.post('/wallet/withdraw', authMiddleware(['user']), walletController.withdraw);


// --- WEB ROUTES ---

// @route   GET /user/dashboard
// @desc    Trang Dashboard
router.get('/dashboard', authMiddleware(['user']), userController.renderDashboard);

// @route   GET /user/wallet
// @desc    Trang quản lý ví (dùng controller)
router.get('/wallet', authMiddleware(['user']), userController.renderWallet);

// @route   GET /user/commissions
// @desc    Trang xem các ủy thác mình đã tạo (dùng controller)
router.get('/commissions', authMiddleware(['user']), userController.renderMyCommissions);

// @route   GET /user/request
// @desc    Trang hiển thị form tạo yêu cầu
router.get('/request', authMiddleware(['user']), (req, res) => {
    res.render('user/request', { title: 'Tạo Yêu Cầu Mới' }); 
});

// @route   POST /user/request (Tạo Ủy thác mới)
// @desc    Xử lý POST tạo yêu cầu mới
router.post('/request', authMiddleware(['user']), async (req, res) => {
    const { title, description, price } = req.body;
    try {
        const dichVu = new DichVu({
            TieuDe: title,
            MoTa: description,
            GiaTri: parseInt(price) || 0,
            ChuSoHuu: req.session.user._id,
            TrangThai: 'pending',
        });
        await dichVu.save();
        req.flash('success', 'Tạo yêu cầu ủy thác thành công! Vui lòng chờ Member nhận.');
        res.redirect('/user/dashboard'); 
    } catch (err) {
        console.error("Lỗi khi tạo yêu cầu ủy thác:", err);
        req.flash('error', 'Lỗi khi tạo yêu cầu ủy thác.');
        res.redirect('/user/request');
    }
});


module.exports = router;