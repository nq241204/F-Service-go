// server.js
process.env.NODE_NO_WARNINGS = 1; // Disable deprecation warnings
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Security middleware
const helmet = require('helmet');
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_session_secret',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/f-service',
        collection: 'sessions'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Flash messages
app.use(flash());

// Global variables middleware
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;
    next();
});

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Khởi tạo kết nối MongoDB và routes
async function initializeApp() {
    try {
        // Kết nối MongoDB trước
        await connectDB();

        // Đăng ký các routes
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/services', require('./routes/services'));
        app.use('/api/wallet', require('./routes/wallet'));
        app.use('/auth', require('./routes/auth'));
        app.use('/user', require('./routes/user'));
        app.use('/admin', require('./routes/admin'));
        app.use('/service', require('./routes/service'));
        app.use('/api/monitor', require('./routes/monitoring'));
        app.use('/member', require('./routes/member'));
        app.use('/', require('./routes/web'));

        // Error handlers
        app.use((req, res, next) => {
            res.status(404).render('404', {
                title: 'Không tìm thấy trang',
                user: req.user
            });
        });

        // Global error handler
        app.use((err, req, res, next) => {
            console.error(err.stack);
            
            if (req.xhr || req.path.startsWith('/api')) {
                return res.status(err.status || 500).json({
                    error: process.env.NODE_ENV === 'development' ? err.message : 'Đã xảy ra lỗi',
                    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
                });
            }

            res.status(err.status || 500).render('error', {
                title: 'Lỗi',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Đã xảy ra lỗi',
                error: process.env.NODE_ENV === 'development' ? err : {},
                user: req.user
            });
        });

        // Khởi động server
        const PORT = process.env.PORT || 5000;
        const server = app.listen(PORT, () => console.log(`Server đang chạy trên cổng ${PORT}`));

        // Xử lý tắt server
        process.on('SIGTERM', () => {
            console.log('Nhận tín hiệu SIGTERM. Đang đóng server...');
            server.close(() => {
                console.log('Server đã đóng.');
                mongoose.connection.close(false, () => {
                    console.log('MongoDB connection đã đóng.');
                    process.exit(0);
                });
            });
        });

    } catch (error) {
        console.error('Không thể khởi động server:', error);
        process.exit(1);
    }
}

// Khởi động ứng dụng
initializeApp();