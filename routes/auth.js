// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isGuest, authMiddleware } = require('../middleware/authMiddleware');

// Guest routes (only accessible when not logged in)
router.get('/login', isGuest, async (req, res) => {
    res.render('auth/login', {
        title: 'Đăng nhập',
        error_msg: req.flash('error_msg'),
        success_msg: req.flash('success_msg')
    });
});

router.get('/register', isGuest, async (req, res) => {
    res.render('auth/register', {
        title: 'Đăng ký tài khoản',
        error_msg: req.flash('error_msg'),
        success_msg: req.flash('success_msg')
    });
});

// Các route xử lý đăng nhập/đăng ký
router.post('/register', isGuest, authController.register[0], authController.register[1]);
router.post('/login', isGuest, authController.login[0], authController.login[1]);
router.get('/logout', authMiddleware(['user', 'member', 'admin']), authController.logout);

module.exports = router;