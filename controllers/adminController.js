// controllers/adminController.js
const { body, validationResult } = require('express-validator');
const ServiceManager = require('../services/ServiceManager');
const PaymentService = require('../services/PaymentService');
const NotificationService = require('../services/NotificationService');
const User = require('../models/User');
const DichVu = require('../models/DichVu');
const GiaoDich = require('../models/GiaoDich');
const Member = require('../models/Member');
const mongoose = require('mongoose');

// @desc    Get system statistics
// @route   GET /admin/stats
exports.getSystemStats = async (req, res) => {
  try {
    // Get basic stats
    const [
      totalUsers,
      totalMembers,
      totalServices,
      totalTransactions,
      pendingServices,
      pendingWithdraws
    ] = await Promise.all([
      User.countDocuments({ Role: 'user' }),
      Member.countDocuments(),
      DichVu.countDocuments(),
      GiaoDich.countDocuments(),
      DichVu.countDocuments({ TrangThai: 'pending' }),
      GiaoDich.countDocuments({ 
        Loai: 'withdraw',
        TrangThai: 'pending'
      })
    ]);

    // Get transaction stats for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const transactionStats = await GiaoDich.aggregate([
      {
        $match: {
          TrangThai: 'success',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            type: '$Loai',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          total: { $sum: '$SoTien' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          daily: {
            $push: {
              date: '$_id.date',
              total: '$total',
              count: '$count'
            }
          },
          totalAmount: { $sum: '$total' },
          totalCount: { $sum: '$count' }
        }
      }
    ]);

    const stats = {
      basic: {
        totalUsers,
        totalMembers,
        totalServices,
        totalTransactions,
        pendingServices,
        pendingWithdraws
      },
      transactions: transactionStats.reduce((acc, stat) => {
        acc[stat._id] = {
          daily: stat.daily,
          total: stat.totalAmount,
          count: stat.totalCount
        };
        return acc;
      }, {})
    };

    if (req.accepts('json')) {
      res.json({
        success: true,
        data: stats
      });
    } else {
      res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        stats
      });
    }
  } catch (error) {
    console.error('Lỗi lấy thống kê hệ thống:', error);
    if (req.accepts('json')) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải thống kê.'
      });
    } else {
      req.flash('error', 'Lỗi khi tải thống kê.');
      res.redirect('/admin');
    }
  }
};

// @desc    Get user list
// @route   GET /admin/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-MatKhau').lean();
    res.render('admin/users', { user: req.user, title: 'Quản Lý Users', users });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Lỗi khi tải danh sách user.');
    res.redirect('/admin/dashboard');
  }
};

exports.updateUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User không tồn tại.' });
    }
    user.TrangThai = status === 'true' ? 'active' : 'banned';
    await user.save();

    req.flash('success_msg', 'Cập nhật trạng thái user thành công.');
    res.redirect('/admin/users');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Lỗi khi cập nhật trạng thái.');
    res.redirect('/admin/users');
  }
};