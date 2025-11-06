// controllers/authController.js
const User = require('../models/User');
const ViGiaoDich = require('../models/ViGiaoDich');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { upload } = require('../middleware/uploadMiddleware');
const imageProcessor = require('../utils/imageProcessor');
const crypto = require('crypto');
const sendEmail = require('../utils/email');

// Registration route handler

// Login route handler

// Registration validation middleware
const registerValidation = [
  body('name')
    .notEmpty().withMessage('Tên không được để trống')
    .trim()
    .isLength({ min: 2 }).withMessage('Tên phải có ít nhất 2 ký tự'),
  body('email')
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  body('password2')
    .notEmpty().withMessage('Vui lòng xác nhận mật khẩu')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Mật khẩu xác nhận không khớp');
      }
      return true;
    })
];

// Login validation middleware
const loginValidation = [
  body('email')
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự')
];

exports.register = [
  registerValidation,
  async (req, res) => {
    try {
      console.log('Register request body:', req.body);
      
      // Validate form data
      const errors = validationResult(req);
      console.log('Validation errors:', errors.array());
      
      if (!errors.isEmpty()) {
        const errorMessage = errors.array().map(err => err.msg).join(', ');
        console.log('Setting flash message:', errorMessage);
        req.flash('error_msg', errorMessage);
        return res.redirect('/auth/register');
      }
      const { name, email, password } = req.body;

      // Check for existing user
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        req.flash('error_msg', 'Email đã được sử dụng');
        return res.redirect('/auth/register');
      }

      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        name,
        email,
        password: hashedPassword,
        role: 'user',
        status: 'active'
      });

      await user.save();

      // Create wallet for new user
      const wallet = new ViGiaoDich({
        LoaiVi: 'User',
        ChuSoHuu: user._id,
        SoDuHienTai: 0,
        GiaoDich: []
      });
      
      await wallet.save();

      // Link wallet to user
      user.ViGiaoDich = wallet._id;
      await user.save();

      req.flash('success_msg', 'Đăng ký thành công! Vui lòng đăng nhập.');
      res.redirect('/auth/login');

    } catch (err) {
      console.error('Registration error:', err);
      req.flash('error_msg', 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.');
      res.redirect('/auth/register');
    }
  }
];

exports.login = [
  loginValidation,
  async (req, res) => {
    try {
      console.log('Login request body:', req.body);
      
      // Validate form data
      const errors = validationResult(req);
      console.log('Login validation errors:', errors.array());
      
      if (!errors.isEmpty()) {
        const errorMessage = errors.array().map(err => err.msg).join(', ');
        console.log('Setting login flash message:', errorMessage);
        req.flash('error_msg', errorMessage);
        return res.redirect('/auth/login');
      }

      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        console.log('User not found for email:', email);
        req.flash('error_msg', 'Email không tồn tại trong hệ thống');
        return res.redirect('/auth/login');
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log('Password mismatch for email:', email);
        req.flash('error_msg', 'Mật khẩu không đúng. Vui lòng thử lại.');
        return res.redirect('/auth/login');
      }

      // Create token
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1d' }
      );

      // Save token and user info in session
      req.session.token = token;
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      };

      // Redirect based on role
      if (user.role === 'admin') {
        res.redirect('/admin/dashboard');
      } else if (user.role === 'member') {
        res.redirect('/member/dashboard');
      } else {
        res.redirect('/user/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      req.flash('error_msg', 'Đã có lỗi xảy ra, vui lòng thử lại');
      res.redirect('/auth/login');
    }
  }
];

// Logout controller
exports.logout = async (req, res) => {
  try {
    // Set no-cache headers to prevent browser from caching the logout page
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Clear session data
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      
      // Clear all cookies
      res.clearCookie('connect.sid', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });
      res.clearCookie('token', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });
      
      // Redirect to login with cache headers
      res.redirect('/auth/login');
    });
  } catch (error) {
    console.error('Lỗi đăng xuất:', error);
    req.flash('error_msg', 'Có lỗi xảy ra khi đăng xuất.');
    res.redirect('/');
  }
};

// @desc    Get the current logged in user
// @route   GET /auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-MatKhau')
      .lean();

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin người dùng.'
    });
  }
};

// @desc    Update user profile
// @route   PUT /auth/profile
exports.updateProfile = [
  upload.single('avatar'),
  body('hoTen').trim().notEmpty().withMessage('Họ tên là bắt buộc.'),
  body('soDienThoai').optional().matches(/^[0-9]{10}$/).withMessage('Số điện thoại không hợp lệ.'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const updateData = {
        HoTen: req.body.hoTen,
        SoDienThoai: req.body.soDienThoai
      };

      if (req.file) {
        // Xử lý và lưu avatar (imageProcessor exports processImage)
        const processedImage = await imageProcessor.processImage(req.file.path || req.file.pathName || req.file.filename);
        // processImage returns paths without 'public' prefix
        updateData.Avatar = processedImage.medium || processedImage.thumbnail || processedImage.large || processedImage;
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updateData },
        { new: true }
      ).select('-MatKhau');

      res.json({
        success: true,
        message: 'Cập nhật thông tin thành công.',
        data: user
      });
    } catch (error) {
      console.error('Lỗi cập nhật profile:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi cập nhật thông tin.'
      });
    }
  }
];

// @desc    Update user password
// @route   PUT /auth/password
exports.updatePassword = [
  body('matKhauCu').notEmpty().withMessage('Mật khẩu cũ là bắt buộc.'),
  body('matKhauMoi')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự.')
    .matches(/\d/)
    .withMessage('Mật khẩu mới phải chứa ít nhất 1 số.'),
  body('xacNhanMatKhau').custom((value, { req }) => {
    if (value !== req.body.matKhauMoi) {
      throw new Error('Xác nhận mật khẩu không khớp.');
    }
    return true;
  }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const user = await User.findById(req.user._id);

      // Kiểm tra mật khẩu cũ
      const isMatch = await bcrypt.compare(req.body.matKhauCu, user.MatKhau);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu cũ không đúng.'
        });
      }

      // Hash mật khẩu mới
      const salt = await bcrypt.genSalt(10);
      user.MatKhau = await bcrypt.hash(req.body.matKhauMoi, salt);
      await user.save();

      res.json({
        success: true,
        message: 'Đổi mật khẩu thành công.'
      });
    } catch (error) {
      console.error('Lỗi đổi mật khẩu:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi đổi mật khẩu.'
      });
    }
  }
];

// @desc    Reset password request
// @route   POST /auth/reset-password
exports.resetPasswordRequest = [
  body('email').isEmail().withMessage('Email không hợp lệ.'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const user = await User.findOne({ Email: req.body.email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản với email này.'
        });
      }

      // Tạo token reset password
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.ResetPasswordToken = resetToken;
      user.ResetPasswordExpires = Date.now() + 3600000; // 1 giờ
      await user.save();

      // Gửi email reset password
      const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
      await sendEmail({
        email: user.Email,
        subject: 'Đặt lại mật khẩu',
        html: `
          <h1>Yêu cầu đặt lại mật khẩu</h1>
          <p>Bạn đã yêu cầu đặt lại mật khẩu. Click vào link bên dưới để tiếp tục:</p>
          <a href="${resetUrl}">Đặt lại mật khẩu</a>
          <p>Link này sẽ hết hạn sau 1 giờ.</p>
          <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
        `
      });

      res.json({
        success: true,
        message: 'Email đặt lại mật khẩu đã được gửi.'
      });
    } catch (error) {
      console.error('Lỗi yêu cầu reset password:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi gửi email đặt lại mật khẩu.'
      });
    }
  }
];

// @desc    Reset password
// @route   PUT /auth/reset-password/:token
exports.resetPassword = [
  body('matKhau')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự.')
    .matches(/\d/)
    .withMessage('Mật khẩu phải chứa ít nhất 1 số.'),
  body('xacNhanMatKhau').custom((value, { req }) => {
    if (value !== req.body.matKhau) {
      throw new Error('Xác nhận mật khẩu không khớp.');
    }
    return true;
  }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const user = await User.findOne({
        ResetPasswordToken: req.params.token,
        ResetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
        });
      }

      // Hash mật khẩu mới
      const salt = await bcrypt.genSalt(10);
      user.MatKhau = await bcrypt.hash(req.body.matKhau, salt);
      user.ResetPasswordToken = undefined;
      user.ResetPasswordExpires = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Đặt lại mật khẩu thành công.'
      });
    } catch (error) {
      console.error('Lỗi reset password:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi đặt lại mật khẩu.'
      });
    }
  }
];