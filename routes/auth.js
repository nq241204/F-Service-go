// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isGuest, authMiddleware } = require('../middleware/authMiddleware');

// Guest routes (only accessible when not logged in)
router.get('/login', isGuest, async (req, res) => {
    // Set no-cache headers to prevent browser caching login page
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.render('auth/login', {
        title: 'Đăng nhập',
    });
});

router.get('/register', isGuest, async (req, res) => {
    // Set no-cache headers to prevent browser caching register page
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.render('auth/register', {
        title: 'Đăng ký tài khoản',
    });
});

// Các route xử lý đăng nhập/đăng ký
router.post('/register', isGuest, ...authController.register);
router.post('/login', isGuest, ...authController.login);
router.get('/logout', authMiddleware(['user', 'member', 'admin']), authController.logout);

module.exports = router;
