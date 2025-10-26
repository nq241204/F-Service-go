// server.js
const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

// Load environment variables
dotenv.config();

// Kết nối Database
const connectDB = require('./config/db');
connectDB();

const app = express();

// --- Cấu hình Middleware ---

// Body parser
app.use(express.json()); // Cho API requests (JSON body)
app.use(express.urlencoded({ extended: true })); // Cho Form POST requests (URL-encoded body)

// Cấu hình EJS
app.set('view engine', 'ejs');
app.set('views', 'views'); // Đảm bảo thư mục views đúng
app.use(expressLayouts);
app.set('layout', './layout'); // Đặt layout.ejs là layout mặc định

// Cấu hình thư mục Public (CSS, JS, images)
app.use(express.static('public'));

// Cấu hình Session (Cần thiết cho req.session.user và flash messages)
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey', // Thay thế bằng key mạnh hơn
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 giờ
}));

// Cấu hình Flash Messages
app.use(flash());

// Middleware cho biến cục bộ (locals)
app.use((req, res, next) => {
    // Truyền flash messages và user session vào tất cả các view
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.error = req.flash('error'); // Dùng cho Passport/Auth lỗi chung
    res.locals.user = req.session.user || null; // Dùng để kiểm tra user đã đăng nhập chưa
    next();
});


// --- Định tuyến (Routes) ---

// Public Routes (Web access)
app.use('/', require('./routes/web')); 

// API Routes
app.use('/api/auth', require('./routes/auth')); 
app.use('/api/user', require('./routes/user')); 
app.use('/api/member', require('./routes/member'));
// app.use('/api/admin', require('./routes/admin')); // Tạm thời chưa cần

// Web Routes (Chuyên biệt theo vai trò)
app.use('/user', require('./routes/user'));
app.use('/member', require('./routes/member')); 
// app.use('/admin', require('./routes/admin')); // Tạm thời chưa cần


// --- Xử lý 404 ---
app.use((req, res, next) => {
    res.status(404).render('404', { title: '404 - Không tìm thấy' });
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`));
