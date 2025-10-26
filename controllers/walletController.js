// controllers/walletController.js
const mongoose = require('mongoose');
const User = require('../models/User');
const ViGiaoDich = require('../models/ViGiaoDich');
const GiaoDich = require('../models/GiaoDich'); 

// --- Helper Functions ---

// @desc    Lấy số dư ví của User
const getBalance = async (req, res) => {
    try {
        const userId = req.session.user._id;
        
        // Lấy ID ví từ User
        const user = await User.findById(userId).select('ViGiaoDich');
        if (!user || !user.ViGiaoDich) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ví.' });
        }

        // Lấy số dư hiện tại
        const wallet = await ViGiaoDich.findById(user.ViGiaoDich).select('SoDuHienTai');
        
        res.status(200).json({
            success: true,
            balance: wallet ? wallet.SoDuHienTai : 0
        });
    } catch (error) {
        console.error("Lỗi khi lấy số dư ví:", error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy số dư ví.' });
    }
};

// --- Transaction Controllers ---

// @desc    Xử lý nạp tiền (deposit)
// @route   POST /api/user/wallet/deposit
const deposit = async (req, res) => {
    const { amount } = req.body;
    const amountNum = parseInt(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
        req.flash('error', 'Số tiền nạp không hợp lệ.');
        return res.redirect('/user/wallet');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.session.user._id;

        // 1. Tìm User và ID Ví
        const user = await User.findById(userId).session(session);
        if (!user || !user.ViGiaoDich) {
            throw new Error('User hoặc Ví không hợp lệ.');
        }
        
        // 2. Cập nhật số dư Ví
        const wallet = await ViGiaoDich.findByIdAndUpdate(
            user.ViGiaoDich,
            { $inc: { SoDuHienTai: amountNum } },
            { new: true, session: session }
        );

        if (!wallet) {
            throw new Error('Cập nhật số dư ví thất bại.');
        }

        // 3. Tạo bản ghi Giao Dịch
        const newTransaction = new GiaoDich({
            Loai: 'deposit',
            SoTien: amountNum,
            NguoiThamGia: user._id,
            TrangThai: 'success',
            MoTa: `Nạp tiền thành công ${amountNum.toLocaleString()} VNĐ`,
            NgayGiaoDich: new Date()
        });
        await newTransaction.save({ session });

        // 4. Commit transaction
        await session.commitTransaction();
        session.endSession();

        req.flash('success', `Nạp tiền ${amountNum.toLocaleString()} VNĐ thành công!`);
        res.redirect('/user/wallet');

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Lỗi Deposit (MongoDB Transaction):", error.message);
        req.flash('error', 'Nạp tiền thất bại do lỗi hệ thống.');
        res.redirect('/user/wallet');
    }
};

// @desc    Yêu cầu rút tiền (withdraw)
// @route   POST /api/user/wallet/withdraw
const withdraw = async (req, res) => {
    const { amount } = req.body;
    const amountNum = parseInt(amount);

    if (isNaN(amountNum) || amountNum <= 50000) {
        req.flash('error', 'Số tiền rút không hợp lệ (tối thiểu 50,000 VNĐ).');
        return res.redirect('/user/wallet');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.session.user._id;

        // 1. Tìm User và ID Ví
        const user = await User.findById(userId).session(session);
        if (!user || !user.ViGiaoDich) {
            throw new Error('User hoặc Ví không hợp lệ.');
        }

        // 2. Kiểm tra số dư trước
        const wallet = await ViGiaoDich.findById(user.ViGiaoDich).session(session);
        if (wallet.SoDuHienTai < amountNum) {
            await session.abortTransaction();
            session.endSession();
            req.flash('error', 'Số dư ví không đủ để thực hiện giao dịch.');
            return res.redirect('/user/wallet');
        }
        
        // 3. Trừ số dư Ví
        const updatedWallet = await ViGiaoDich.findByIdAndUpdate(
            user.ViGiaoDich,
            { $inc: { SoDuHienTai: -amountNum } },
            { new: true, session: session }
        );

        // 4. Tạo bản ghi Giao Dịch (Ban đầu ở trạng thái Pending)
        const newTransaction = new GiaoDich({
            Loai: 'withdraw',
            SoTien: amountNum,
            NguoiThamGia: user._id,
            TrangThai: 'pending', 
            MoTa: `Yêu cầu rút tiền ${amountNum.toLocaleString()} VNĐ`,
            NgayGiaoDich: new Date()
        });
        await newTransaction.save({ session });

        // 5. Commit transaction
        await session.commitTransaction();
        session.endSession();

        req.flash('success', `Yêu cầu rút tiền ${amountNum.toLocaleString()} VNĐ đã được ghi nhận. Vui lòng chờ Admin xét duyệt.`);
        res.redirect('/user/wallet');

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Lỗi Withdraw (MongoDB Transaction):", error.message);
        req.flash('error', 'Rút tiền thất bại do lỗi hệ thống.');
        res.redirect('/user/wallet');
    }
};


// Export các hàm đã được định nghĩa bằng 'const'
module.exports = {
    getBalance,
    deposit,
    withdraw,
};