// controllers/walletController.js
const mongoose = require('mongoose');
const ViGiaoDich = require('../models/ViGiaoDich');
const GiaoDich = require('../models/GiaoDich');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Constants
const MIN_DEPOSIT = 10000;
const MAX_DEPOSIT = 50000000;
const MIN_WITHDRAW = 50000;
const MAX_WITHDRAW = 50000000;

// @desc    Lấy thông tin ví và số dư
// @route   GET /user/wallet
// @access  Private
const getWallet = async (req, res) => {
  try {
    // Get user ID from req.user (from authMiddleware) or session
    const userId = req.user?._id || req.session?.user?.id;
    
    if (!userId) {
      req.flash('error_msg', 'Vui lòng đăng nhập lại.');
      return res.redirect('/auth/login');
    }

    // Tìm ví của user
    const wallet = await ViGiaoDich.findOne({ 
      ChuSoHuu: userId,
      LoaiVi: 'User'
    }).lean();

    // Nếu chưa có ví, tạo mới
    if (!wallet) {
      const newWallet = await ViGiaoDich.create({
        LoaiVi: 'User',
        ChuSoHuu: userId,
        SoDuHienTai: 0
      });
      
      // Cập nhật User với ví mới
      await User.findByIdAndUpdate(userId, {
        ViGiaoDich: newWallet._id
      });

      return res.render('user/wallet', {
        user: req.user || req.session.user,
        title: 'Ví của tôi',
        wallet: newWallet.toObject(),
        transactions: [],
        stats: {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalTransactions: 0
        }
      });
    }

    // Lấy lịch sử giao dịch gần đây (10 giao dịch)
    const transactions = await GiaoDich.find({ 
      NguoiThamGia: userId 
    })
    .sort({ NgayGiaoDich: -1 })
    .limit(10)
    .lean();

    // Tính thống kê
    const allTransactions = await GiaoDich.find({ 
      NguoiThamGia: userId 
    }).lean();

    const stats = {
      totalDeposit: 0,
      totalWithdraw: 0,
      totalTransactions: allTransactions.length
    };

    allTransactions.forEach(tx => {
      if (tx.Loai === 'deposit') {
        stats.totalDeposit += tx.SoTien;
      } else if (tx.Loai === 'withdraw') {
        stats.totalWithdraw += tx.SoTien;
      }
    });

    res.render('user/wallet', {
      user: req.user || req.session.user,
      title: 'Ví của tôi',
      wallet,
      transactions,
      stats
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    req.flash('error_msg', 'Lỗi khi tải thông tin ví.');
    res.redirect('/user/dashboard');
  }
};

// @desc    Lấy số dư ví (API)
// @route   GET /api/wallet/balance
// @access  Private
const getBalance = async (req, res) => {
  try {
    const userId = req.user?._id || req.session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập lại'
      });
    }

    const wallet = await ViGiaoDich.findOne({ 
      ChuSoHuu: userId,
      LoaiVi: 'User'
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ví'
      });
    }

    res.json({
      success: true,
      data: {
        balance: wallet.SoDuHienTai
      }
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy số dư ví'
    });
  }
};

// @desc    Nạp tiền vào ví
// @route   POST /api/wallet/deposit
// @access  Private
const deposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, method } = req.body;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    // Validate số tiền
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum < MIN_DEPOSIT || amountNum > MAX_DEPOSIT) {
      return res.status(400).json({
        success: false,
        message: `Số tiền phải từ ${MIN_DEPOSIT.toLocaleString('vi-VN')}đ đến ${MAX_DEPOSIT.toLocaleString('vi-VN')}đ`
      });
    }

    // Validate phương thức
    if (!method || !['banking', 'momo', 'zalopay'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Phương thức thanh toán không hợp lệ'
      });
    }

    // Get user ID
    const userId = req.user?._id || req.session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập lại'
      });
    }

    // Tìm ví của user
    const wallet = await ViGiaoDich.findOne({ 
      ChuSoHuu: userId,
      LoaiVi: 'User'
    }).session(session);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ví'
      });
    }

    // Cập nhật số dư
    await ViGiaoDich.findByIdAndUpdate(
      wallet._id,
      { $inc: { SoDuHienTai: amountNum } },
      { new: true, session }
    );

    // Tạo giao dịch
    const transaction = await GiaoDich.create([{
      Loai: 'deposit',
      SoTien: amountNum,
      NguoiThamGia: userId,
      TrangThai: 'success',
      MoTa: `Nạp tiền qua ${method === 'banking' ? 'Ngân hàng' : method === 'momo' ? 'MoMo' : 'ZaloPay'}`
    }], { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Nạp tiền thành công',
      data: {
        amount: amountNum,
        balance: wallet.SoDuHienTai + amountNum,
        transactionId: transaction[0]._id
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi nạp tiền'
    });
  } finally {
    session.endSession();
  }
};

// @desc    Rút tiền từ ví
// @route   POST /api/wallet/withdraw
// @access  Private
const withdraw = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, bankInfo } = req.body;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    // Validate số tiền
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum < MIN_WITHDRAW || amountNum > MAX_WITHDRAW) {
      return res.status(400).json({
        success: false,
        message: `Số tiền phải từ ${MIN_WITHDRAW.toLocaleString('vi-VN')}đ đến ${MAX_WITHDRAW.toLocaleString('vi-VN')}đ`
      });
    }

    // Validate thông tin ngân hàng
    if (!bankInfo || !bankInfo.accountNumber || !bankInfo.bankName || !bankInfo.accountHolder) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin ngân hàng'
      });
    }

    // Validate định dạng số tài khoản
    if (!/^\d{8,15}$/.test(bankInfo.accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Số tài khoản không hợp lệ (8-15 chữ số)'
      });
    }

    // Get user ID
    const userId = req.user?._id || req.session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập lại'
      });
    }

    // Tìm ví của user
    const wallet = await ViGiaoDich.findOne({ 
      ChuSoHuu: userId,
      LoaiVi: 'User'
    }).session(session);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ví'
      });
    }

    // Kiểm tra số dư
    if (wallet.SoDuHienTai < amountNum) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Số dư không đủ để thực hiện giao dịch này'
      });
    }

    // Trừ tiền
    await ViGiaoDich.findByIdAndUpdate(
      wallet._id,
      { $inc: { SoDuHienTai: -amountNum } },
      { new: true, session }
    );

    // Tạo giao dịch
    const transaction = await GiaoDich.create([{
      Loai: 'withdraw',
      SoTien: amountNum,
      NguoiThamGia: userId,
      TrangThai: 'success',
      MoTa: `Rút tiền về ${bankInfo.bankName} - ${bankInfo.accountNumber} - ${bankInfo.accountHolder}`
    }], { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Rút tiền thành công!',
      data: {
        amount: amountNum,
        balance: wallet.SoDuHienTai - amountNum,
        transactionId: transaction[0]._id
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Withdraw error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi rút tiền'
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  getWallet,
  getBalance,
  deposit,
  withdraw
};

