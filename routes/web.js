// routes/web.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');

// --- Trang Chung (Public Access) ---
router.get('/', (req, res) => {
    // Render trang chủ (home.ejs)
    res.render('home', { title: 'Trang chủ - F-Service' });
});

router.get('/login', (req, res) => {
    // Nếu đã đăng nhập, chuyển hướng đến dashboard
    if (req.session.user) {
        return res.redirect(`/${req.session.user.role}/dashboard`);
    }
    res.render('auth/login', { title: 'Đăng nhập' });
});

router.get('/register', (req, res) => {
    // Nếu đã đăng nhập, chuyển hướng
    if (req.session.user) {
        return res.redirect(`/${req.session.user.role}/dashboard`);
    }
    res.render('auth/register', { title: 'Đăng ký' });
});

// Xử lý POST đăng nhập và đăng ký
router.post('/register', authController.register);
router.post('/login', authController.login);

// Xử lý Đăng xuất
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Lỗi khi đăng xuất:', err);
            // Flash message cho trường hợp lỗi
            req.flash('error_msg', 'Lỗi Server khi đăng xuất');
            return res.redirect('/');
        }
        res.redirect('/');
    });
});

// --- Chuyển hướng Dashboard (Dùng Controller/Route riêng cho mỗi role) ---
// Route này sẽ chuyển hướng chung và bảo vệ các URL Dashboard cụ thể
router.get('/:role/dashboard', authMiddleware(['user', 'member', 'admin']), (req, res, next) => {
    const userRole = req.session.user.role;
    const requestedRole = req.params.role;

    // 1. Kiểm tra vai trò có khớp không
    if (requestedRole !== userRole) {
        // Chuyển hướng về đúng dashboard của user nếu URL sai
        req.flash('error', 'Bạn đã cố gắng truy cập dashboard không thuộc vai trò của mình.');
        return res.redirect(`/${userRole}/dashboard`);
    }
    
    // 2. Chuyển giao việc render cho route/controller cụ thể của từng role
    // Chúng ta sẽ cần định nghĩa các route này trong routes/user.js, routes/member.js, routes/admin.js
    if (userRole === 'user') {
        // Chuyển sang route /user/dashboard trong routes/user.js
        return res.redirect('/user/dashboard'); 
    }
    if (userRole === 'member') {
        // Chuyển sang route /member/dashboard trong routes/member.js
        return res.redirect('/member/dashboard'); 
    }
    if (userRole === 'admin') {
        // Chuyển sang route /admin/dashboard (hoặc /admin/users) trong routes/admin.js
        return res.redirect('/admin/users'); // Admin thường vào quản lý User
    }

    // Trường hợp mặc định
    return res.redirect('/'); 
});


// === TẠO ROUTE WEB CHO USER (User Routes) ===
// Do các route chi tiết cho user nằm trong routes/user.js, ta không cần thêm chúng ở đây.

// NOTE: Chúng ta sẽ giả định app.use('/user', require('./routes/user'));
// đã được cấu hình trong server.js.

module.exports = router;