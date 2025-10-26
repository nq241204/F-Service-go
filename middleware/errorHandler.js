// middleware/errorHandler.js
const config = require('../config/app');

module.exports = (err, req, res, next) => {
    console.error(err.stack);

    // Xử lý lỗi validation
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(error => error.message);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors
            });
        }
        req.flash('error_msg', errors[0]);
        return res.redirect('back');
    }

    // Xử lý lỗi MongoDB
    if (err.name === 'MongoError' && err.code === 11000) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu đã tồn tại trong hệ thống'
            });
        }
        req.flash('error_msg', 'Dữ liệu đã tồn tại trong hệ thống');
        return res.redirect('back');
    }

    // Xử lý lỗi JWT
    if (err.name === 'JsonWebTokenError') {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({
                success: false,
                message: 'Token không hợp lệ'
            });
        }
        req.flash('error_msg', 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
        return res.redirect('/auth/login');
    }

    // Xử lý lỗi multer
    if (err.code === 'LIMIT_FILE_SIZE') {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(400).json({
                success: false,
                message: 'File quá lớn'
            });
        }
        req.flash('error_msg', 'File tải lên quá lớn');
        return res.redirect('back');
    }

    // Xử lý lỗi chung
    const statusCode = err.statusCode || 500;
    const message = config.app.env === 'production' 
        ? 'Có lỗi xảy ra. Vui lòng thử lại sau.' 
        : err.message;

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(statusCode).json({
            success: false,
            message
        });
    }

    res.status(statusCode).render('error', {
        title: 'Lỗi ' + statusCode,
        message,
        error: config.app.env === 'development' ? err : {}
    });
};