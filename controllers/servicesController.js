// controllers/servicesController.js
const DichVu = require('../models/DichVu');
const UyThac = require('../models/UyThac');
const { body, validationResult } = require('express-validator');

exports.getServices = async (req, res) => {
  try {
    const services = await DichVu.find().lean();
    if (req.originalUrl.startsWith('/api')) {
      res.status(200).json({ success: true, data: services });
    } else {
      res.render('services/list', { user: req.user, title: 'Danh Sách Dịch Vụ', services });
    }
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Lỗi khi tải danh sách dịch vụ.');
    res.redirect('/');
  }
};

exports.createCommission = [
  body('dichVuId').isMongoId().withMessage('ID dịch vụ không hợp lệ.'),
  body('giaThoaThuan').isInt({ min: 0 }).withMessage('Giá thỏa thuận phải là số không âm.'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { dichVuId, giaThoaThuan } = req.body;
    const userId = req.user._id;

    try {
      const dichVu = await DichVu.findById(dichVuId);
      if (!dichVu) {
        return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại.' });
      }

      const uyThac = new UyThac({
        UserId: userId,
        DichVuId: dichVuId,
        GiaThoaThuan: parseInt(giaThoaThuan),
        TrangThai: 'Moi',
      });
      await uyThac.save();

      if (req.originalUrl.startsWith('/api')) {
        res.status(201).json({ success: true, message: 'Ủy thác đã được tạo.', data: uyThac });
      } else {
        req.flash('success_msg', 'Ủy thác đã được tạo.');
        res.redirect('/user/commissions');
      }
    } catch (error) {
      console.error(error);
      req.flash('error_msg', 'Lỗi khi tạo ủy thác.');
      res.redirect('/service/list');
    }
  },
];

exports.getMyCommissions = async (req, res) => {
  try {
    const commissions = await UyThac.find({ UserId: req.user._id })
      .populate('DichVuId')
      .lean();
    if (req.originalUrl.startsWith('/api')) {
      res.status(200).json({ success: true, data: commissions });
    } else {
      res.render('user/commissions', { user: req.user, title: 'Ủy Thác Của Tôi', commissions });
    }
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Lỗi khi tải danh sách ủy thác.');
    res.redirect('/user/dashboard');
  }
};