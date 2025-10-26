// controllers/paymentController.js
const { body, validationResult } = require('express-validator');
const PaymentService = require('../services/PaymentService');
const NotificationService = require('../services/NotificationService');
const config = require('../config/app');
const mongoose = require('mongoose');

// @desc    Nạp tiền vào ví
// @route   POST /payment/deposit
exports.deposit = [
    body('amount').isInt({ min: config.payment.minDeposit }).withMessage(`Số tiền nạp tối thiểu ${config.payment.minDeposit}đ`),
    body('paymentInfo').notEmpty().withMessage('Thông tin thanh toán là bắt buộc.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Tạo giao dịch nạp tiền
            const transaction = await PaymentService.deposit(
                req.user._id,
                req.body.amount,
                req.body.paymentInfo
            );

            await session.commitTransaction();

            res.json({
                success: true,
                message: 'Đã tạo yêu cầu nạp tiền.',
                data: transaction
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi nạp tiền:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Lỗi khi nạp tiền.'
            });
        } finally {
            session.endSession();
        }
    }
];

// @desc    Xác nhận nạp tiền
// @route   POST /payment/confirm-deposit/:id
// @access  Admin only
exports.confirmDeposit = [
    async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const result = await PaymentService.confirmDeposit(req.params.id);
            
            // Tạo thông báo
            await NotificationService.createTransactionNotification(result.transaction);

            await session.commitTransaction();

            res.json({
                success: true,
                message: 'Xác nhận nạp tiền thành công.',
                data: result
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi xác nhận nạp tiền:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Lỗi khi xác nhận nạp tiền.'
            });
        } finally {
            session.endSession();
        }
    }
];

// @desc    Rút tiền
// @route   POST /payment/withdraw
exports.withdraw = [
    body('amount').isInt({ min: config.payment.minWithdraw }).withMessage(`Số tiền rút tối thiểu ${config.payment.minWithdraw}đ`),
    body('bankInfo').notEmpty().withMessage('Thông tin ngân hàng là bắt buộc.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Tạo giao dịch rút tiền
            const transaction = await PaymentService.withdraw(
                req.user._id,
                req.body.amount,
                req.body.bankInfo
            );

            await session.commitTransaction();

            res.json({
                success: true,
                message: 'Đã tạo yêu cầu rút tiền.',
                data: transaction
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi rút tiền:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Lỗi khi rút tiền.'
            });
        } finally {
            session.endSession();
        }
    }
];

// @desc    Xác nhận rút tiền
// @route   POST /payment/confirm-withdraw/:id
// @access  Admin only
exports.confirmWithdraw = [
    async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const result = await PaymentService.confirmWithdraw(req.params.id);
            
            // Tạo thông báo
            await NotificationService.createTransactionNotification(result.transaction);

            await session.commitTransaction();

            res.json({
                success: true,
                message: 'Xác nhận rút tiền thành công.',
                data: result
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi xác nhận rút tiền:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Lỗi khi xác nhận rút tiền.'
            });
        } finally {
            session.endSession();
        }
    }
];

// @desc    Hủy rút tiền
// @route   POST /payment/cancel-withdraw/:id
// @access  Admin only
exports.cancelWithdraw = [
    body('reason').notEmpty().withMessage('Lý do hủy là bắt buộc.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const result = await PaymentService.cancelWithdraw(
                req.params.id,
                req.body.reason
            );
            
            // Tạo thông báo
            await NotificationService.createTransactionNotification(result.transaction);

            await session.commitTransaction();

            res.json({
                success: true,
                message: 'Hủy yêu cầu rút tiền thành công.',
                data: result
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi hủy rút tiền:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Lỗi khi hủy rút tiền.'
            });
        } finally {
            session.endSession();
        }
    }
];

// @desc    Chuyển tiền
// @route   POST /payment/transfer
exports.transfer = [
    body('amount').isInt({ min: config.payment.minTransfer }).withMessage(`Số tiền chuyển tối thiểu ${config.payment.minTransfer}đ`),
    body('toUserId').isMongoId().withMessage('ID người nhận không hợp lệ.'),
    body('description').optional().trim(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const result = await PaymentService.transfer(
                req.user._id,
                req.body.toUserId,
                req.body.amount,
                req.body.description
            );
            
            // Tạo thông báo
            await NotificationService.createTransactionNotification(result.transaction);

            await session.commitTransaction();

            res.json({
                success: true,
                message: 'Chuyển tiền thành công.',
                data: result
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi chuyển tiền:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Lỗi khi chuyển tiền.'
            });
        } finally {
            session.endSession();
        }
    }
];

// @desc    Lấy lịch sử giao dịch
// @route   GET /payment/transactions
exports.getTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type;
        const status = req.query.status;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        const filters = {};
        if (type) filters.type = type;
        if (status) filters.status = status;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;

        const result = await PaymentService.getTransactionHistory(
            req.user._id,
            filters,
            { page, limit }
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Lỗi lấy lịch sử giao dịch:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải lịch sử giao dịch.'
        });
    }
};

// @desc    Lấy thống kê giao dịch
// @route   GET /payment/stats
exports.getTransactionStats = async (req, res) => {
    try {
        const startDate = req.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = req.query.endDate || new Date();

        const stats = await PaymentService.getTransactionStats(
            req.user._id,
            startDate,
            endDate
        );

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Lỗi lấy thống kê giao dịch:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải thống kê giao dịch.'
        });
    }
};