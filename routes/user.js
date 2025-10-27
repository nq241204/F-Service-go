// routes/user.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const ViGiaoDich = require('../models/ViGiaoDich');
const UyThac = require('../models/UyThac');
const DichVu = require('../models/DichVu');
const GiaoDich = require('../models/GiaoDich');
const { body, validationResult } = require('express-validator');

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
module.exports = router;