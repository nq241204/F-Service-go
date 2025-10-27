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
    walletController.deposit
);

// @route   POST /api/wallet/withdraw
// @desc    Rút tiền từ ví
router.post(
    '/withdraw',
    auth,
    walletController.withdraw
);

// @route   GET /api/wallet/transactions
// @desc    Lấy lịch sử giao dịch
router.get('/transactions', auth, transactionController.getTransactions);

// @route   GET /api/wallet
// @desc    Lấy thông tin ví
router.get('/', auth, walletController.getWallet);

module.exports = router;