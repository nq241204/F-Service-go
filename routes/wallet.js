// routes/wallet.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const transactionController = require('../controllers/transactionController');
const walletController = require('../controllers/walletController');

// Middleware chung cho wallet routes
const auth = authMiddleware(['user', 'member']);

// @route   GET /api/wallet/balance
// @desc    Lấy số dư ví
router.get('/balance', auth, walletController.getBalance);

// @route   POST /api/wallet/deposit
// @desc    Nạp tiền vào ví
router.post(
    '/deposit',
    auth,
    [
        body('amount').isInt({ min: 10000 }).withMessage('Số tiền tối thiểu là 10,000'),
        body('method').isIn(['banking', 'momo', 'zalopay']).withMessage('Phương thức thanh toán không hợp lệ')
    ],
    transactionController.deposit
);

// @route   POST /api/wallet/withdraw
// @desc    Rút tiền từ ví
router.post(
    '/withdraw',
    auth,
    [
        body('amount').isInt({ min: 100000 }).withMessage('Số tiền rút tối thiểu là 100,000'),
        body('bankInfo.accountNumber').notEmpty().withMessage('Số tài khoản không được để trống'),
        body('bankInfo.bankName').notEmpty().withMessage('Tên ngân hàng không được để trống')
    ],
    transactionController.withdraw
);

// @route   GET /api/wallet/transactions
// @desc    Lấy lịch sử giao dịch
router.get('/transactions', auth, transactionController.getTransactions);

// @route   GET /api/wallet
// @desc    Lấy thông tin ví
router.get('/', auth, walletController.getWallet);

module.exports = router;