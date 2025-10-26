const mongoose = require('mongoose');
const ViGiaoDich = require('../models/ViGiaoDich');
const GiaoDich = require('../models/GiaoDich');
const moment = require('moment');
const { validationResult, body } = require('express-validator');
const QRCode = require('qrcode');

// Helper function để lấy thông tin ví và giao dịch
const getWalletInfo = async (userId) => {
    const wallet = await ViGiaoDich.findOne({ ChuSoHuu: userId });
    if (!wallet) {
        throw new Error('Không tìm thấy ví');
    }
    
    const recentTransactions = await GiaoDich.find({ 
        NguoiThamGia: userId 
    })
    .sort('-createdAt')
    .limit(10)
    .populate('DichVu', 'TenDichVu');

    return {
        wallet,
        recentTransactions
    };
};

// @desc    Lấy thông tin ví
// @route   GET /api/wallet
exports.getWallet = async (req, res) => {
    try {
        const { wallet, recentTransactions } = await getWalletInfo(req.user._id);

        if (req.xhr) {
            return res.json({
                success: true,
                data: {
                    balance: wallet.SoDuHienTai,
                    recentTransactions: recentTransactions.map(t => ({
                        ...t.toObject(),
                        formattedAmount: new Intl.NumberFormat('vi-VN', { 
                            style: 'currency', 
                            currency: 'VND' 
                        }).format(t.SoTien),
                        formattedDate: moment(t.createdAt).format('DD/MM/YYYY HH:mm')
                    }))
                }
            });
        }

        res.render('user/wallet', {
            title: 'Ví của tôi',
            wallet,
            recentTransactions,
            moment,
            user: req.user
        });
    } catch (error) {
        console.error('Lỗi getWallet:', error);
        if (req.xhr) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy thông tin ví'
            });
        }
        req.flash('error_msg', 'Lỗi khi lấy thông tin ví');
        res.redirect('/user/dashboard');
    }
};

// @desc    Lấy số dư ví
// @route   GET /api/wallet/balance
exports.getBalance = async (req, res) => {
    try {
        const wallet = await ViGiaoDich.findOne({ 
            ChuSoHuu: req.user._id 
        });

        if (!wallet) {
            throw new Error('Không tìm thấy ví');
        }

        res.json({
            success: true,
            balance: wallet.SoDuHienTai,
            formattedBalance: new Intl.NumberFormat('vi-VN', { 
                style: 'currency', 
                currency: 'VND' 
            }).format(wallet.SoDuHienTai)
        });
    } catch (error) {
        console.error('Lỗi getBalance:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Nạp tiền vào ví
// @route   POST /api/wallet/deposit
exports.deposit = [
    body('soTien').isInt({ min: 10000 }).withMessage('Số tiền nạp tối thiểu là 10,000 VNĐ.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.xhr) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            }
            req.flash('error_msg', errors.array()[0].msg);
            return res.redirect('back');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { soTien } = req.body;
            const userId = req.user._id;

            const vi = await ViGiaoDich.findOne({ ChuSoHuu: userId }).session(session);
            if (!vi) {
                throw new Error('Không tìm thấy ví');
            }

            // Tạo giao dịch
            const giaoDich = new GiaoDich({
                Loai: 'deposit',
                SoTien: parseInt(soTien),
                NguoiThamGia: userId,
                TrangThai: 'pending',
                MoTa: `Nạp ${parseInt(soTien).toLocaleString('vi-VN')}đ vào ví`
            });
            
            await giaoDich.save({ session });
            vi.GiaoDich.push(giaoDich._id);
            await vi.save({ session });

            // Tạo mã QR
            const qrData = {
                type: 'deposit',
                amount: soTien,
                userId: userId.toString(),
                transactionId: giaoDich._id.toString()
            };
            
            const qrCode = await QRCode.toDataURL(JSON.stringify(qrData));

            await session.commitTransaction();

            if (req.xhr) {
                return res.json({ 
                    success: true, 
                    message: 'Yêu cầu nạp tiền đã được tạo.',
                    data: {
                        qrCode,
                        transaction: giaoDich
                    }
                });
            }

            req.flash('success_msg', 'Yêu cầu nạp tiền đã được tạo.');
            res.render('user/wallet', {
                user: req.user,
                title: 'Ví của tôi',
                wallet: vi,
                qrCode,
                recentTransactions: await GiaoDich.find({ 
                    NguoiThamGia: userId 
                })
                .sort('-createdAt')
                .limit(10),
                moment
            });

        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi deposit:', error);
            
            if (req.xhr) {
                return res.status(500).json({
                    success: false,
                    message: 'Lỗi khi xử lý yêu cầu nạp tiền'
                });
            }
            
            req.flash('error_msg', 'Lỗi khi xử lý yêu cầu nạp tiền');
            res.redirect('back');
        } finally {
            session.endSession();
        }
    }
];

// @desc    Rút tiền từ ví
// @route   POST /api/wallet/withdraw
exports.withdraw = [
    body('soTien').isInt({ min: 50000 }).withMessage('Số tiền rút tối thiểu là 50,000 VNĐ.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.xhr) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            }
            req.flash('error_msg', errors.array()[0].msg);
            return res.redirect('back');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { soTien } = req.body;
            const userId = req.user._id;

            const vi = await ViGiaoDich.findOne({ ChuSoHuu: userId }).session(session);
            if (!vi) {
                throw new Error('Ví không tồn tại');
            }

            if (vi.SoDuHienTai < parseInt(soTien)) {
                throw new Error('Số dư không đủ');
            }

            // Tạo giao dịch rút tiền
            const giaoDich = new GiaoDich({
                Loai: 'withdraw',
                SoTien: parseInt(soTien),
                NguoiThamGia: userId,
                TrangThai: 'pending',
                MoTa: `Yêu cầu rút ${parseInt(soTien).toLocaleString('vi-VN')}đ`
            });

            // Cập nhật số dư và lưu giao dịch
            vi.SoDuHienTai -= parseInt(soTien);
            await giaoDich.save({ session });
            vi.GiaoDich.push(giaoDich._id);
            await vi.save({ session });

            await session.commitTransaction();

            if (req.xhr) {
                return res.json({
                    success: true,
                    message: 'Yêu cầu rút tiền đã được tạo',
                    data: {
                        transaction: giaoDich,
                        newBalance: vi.SoDuHienTai
                    }
                });
            }

            req.flash('success_msg', 'Yêu cầu rút tiền đã được tạo.');
            res.redirect('back');

        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi withdraw:', error);

            if (req.xhr) {
                return res.status(500).json({
                    success: false,
                    message: error.message || 'Lỗi khi xử lý yêu cầu rút tiền'
                });
            }

            req.flash('error_msg', error.message || 'Lỗi khi xử lý yêu cầu rút tiền');
            res.redirect('back');
        } finally {
            session.endSession();
        }
    }
];