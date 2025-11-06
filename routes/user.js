// routes/user.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const ViGiaoDich = require('../models/ViGiaoDich');
const UyThac = require('../models/UyThac');
const DichVu = require('../models/DichVu');
const GiaoDich = require('../models/GiaoDich');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const walletController = require('../controllers/walletController');
const moment = require('moment');

// Home page for logged-in users
router.get('/home', authMiddleware(['user', 'member']), async (req, res) => {
  try {
    // Get wallet info
    const wallet = await ViGiaoDich.findOne({ ChuSoHuu: req.user._id }).lean();
    
    // Get commissions statistics
    const allCommissions = await UyThac.find({ UserId: req.user._id }).lean();
    const totalCommissions = allCommissions.length;
    const inProgressCommissions = allCommissions.filter(c => 
      c.TrangThai === 'DangThucHien' || c.TrangThai === 'in_progress'
    ).length;
    
    // Get recent commissions
    const recentCommissions = await UyThac.find({ UserId: req.user._id })
      .populate('DichVu')
      .sort({ NgayTao: -1 })
      .limit(5)
      .lean();
    
    // Get transactions statistics
    const allTransactions = await GiaoDich.find({ ViGiaoDichId: wallet?._id }).lean();
    const totalTransactions = allTransactions.length;
    
    // Get recent transactions
    const recentTransactions = await GiaoDich.find({ ViGiaoDichId: wallet?._id })
      .sort({ NgayGiaoDich: -1 })
      .limit(5)
      .lean();
    
    res.render('home', {
      title: 'Trang chủ',
      user: req.user,
      wallet,
      totalCommissions,
      inProgressCommissions,
      totalTransactions,
      recentCommissions,
      recentTransactions
    });
  } catch (err) {
    console.error('Home page error:', err);
    req.flash('error_msg', 'Lỗi khi tải trang chủ.');
    res.redirect('/');
  }
});

router.get('/dashboard', authMiddleware(['user', 'member']), async (req, res) => {
  try {
    console.log('User in dashboard:', req.user);
    const wallet = await ViGiaoDich.findOne({ ChuSoHuu: req.user._id }).lean();
    const commissions = await UyThac.find({ UserId: req.user._id })
      .populate('DichVuId')
      .lean();
    const pendingCount = commissions.filter(c => c.TrangThai === 'Moi').length;
    res.render('user/dashboard', {
      user: req.user,
      title: 'User Dashboard',
      wallet,
      commissions,
      pendingCount,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    req.flash('error_msg', 'Lỗi khi tải dashboard.');
    res.redirect('/');
  }
});

router.get('/request', authMiddleware(['user']), (req, res) => {
  res.render('user/request', { user: req.user, title: 'Tạo Yêu Cầu Dịch Vụ' });
});

router.post(
  '/request',
  authMiddleware(['user']),
  [
    body('title').trim().notEmpty().withMessage('Tiêu đề là bắt buộc.'),
    body('price').isInt({ min: 0 }).withMessage('Giá phải là số không âm.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/user/request');
    }

    const { title, description, price } = req.body;
    try {
      const dichVu = new DichVu({
        TenDichVu: title,
        MoTa: description,
        GiaMacDinhAI: parseInt(price) || 0,
      });
      await dichVu.save();
      req.flash('success_msg', 'Tạo yêu cầu thành công!');
      res.redirect('/user/dashboard');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Lỗi khi tạo yêu cầu.');
      res.redirect('/user/request');
    }
  }
);

router.get('/commissions', authMiddleware(['user', 'member']), async (req, res) => {
  try {
    const status = req.query.status || null;
    const query = { UserId: req.user._id };
    if (status) query.TrangThai = status;
    const commissions = await UyThac.find(query).populate('DichVuId').lean();
    res.render('user/commissions', {
      user: req.user,
      title: 'Ủy Thác Của Tôi',
      commissions,
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Lỗi khi tải danh sách ủy thác.');
    res.redirect('/user/dashboard');
  }
});

// routes/user.js (thêm route)
router.get('/transactions', authMiddleware(['user', 'member']), async (req, res) => {
  try {
    const transactions = await GiaoDich.find({ NguoiThamGia: req.user._id }).lean();
    res.render('user/transactions', {
      user: req.user,
      title: 'Lịch Sử Giao Dịch',
      transactions,
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Lỗi khi tải lịch sử giao dịch.');
    res.redirect('/user/wallet');
  }
});

// Wallet routes
router.get('/wallet', authMiddleware(['user', 'member']), walletController.getWallet);

// Become Member flow
router.get('/become-member', authMiddleware(['user']), memberApplicationController.renderApplyForm);
router.post(
  '/become-member',
  authMiddleware(['user']),
  upload.array('certificates', 5),
  handleUploadError,
  memberApplicationController.submitApplication
);

// Profile routes
router.get('/profile', authMiddleware(['user', 'member']), async (req, res) => {
  try {
    const wallet = await ViGiaoDich.findOne({ ChuSoHuu: req.user._id }).lean();
    const commissions = await UyThac.find({ UserId: req.user._id }).lean();
    const transactions = await GiaoDich.find({ NguoiThamGia: req.user._id }).lean();
    
    // Calculate statistics
    const totalCommissions = commissions.length;
    const completedCommissions = commissions.filter(c => c.TrangThai === 'DaHoanThanh').length;
    const inProgressCommissions = commissions.filter(c => c.TrangThai === 'DangThucHien').length;
    const totalTransactions = transactions.length;

    res.render('user/profile', {
      user: req.user,
      title: 'Thông tin cá nhân',
      wallet,
      totalCommissions,
      completedCommissions,
      inProgressCommissions,
      totalTransactions
    });
  } catch (err) {
    console.error('Profile error:', err);
    req.flash('error_msg', 'Lỗi khi tải thông tin cá nhân.');
    res.redirect('/user/dashboard');
  }
});

router.post('/profile/update', 
  authMiddleware(['user', 'member']),
  [
    body('name').trim().notEmpty().withMessage('Tên không được để trống.')
      .isLength({ min: 2 }).withMessage('Tên phải có ít nhất 2 ký tự.'),
    body('email').isEmail().withMessage('Email không hợp lệ.')
      .normalizeEmail()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/user/profile');
    }

    const { name, email } = req.body;
    try {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: req.user._id } 
      });
      
      if (existingUser) {
        req.flash('error_msg', 'Email này đã được sử dụng bởi tài khoản khác.');
        return res.redirect('/user/profile');
      }

      // Update user information
      await User.findByIdAndUpdate(req.user._id, {
        name: name,
        email: email.toLowerCase()
      });

      // Update session user data
      if (req.session.user) {
        req.session.user.name = name;
        req.session.user.email = email.toLowerCase();
      }

      req.flash('success_msg', 'Cập nhật thông tin thành công!');
      res.redirect('/user/profile');
    } catch (err) {
      console.error('Profile update error:', err);
      req.flash('error_msg', 'Lỗi khi cập nhật thông tin.');
      res.redirect('/user/profile');
    }
  }
);

module.exports = router;