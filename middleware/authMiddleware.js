// middleware/authMiddleware.js (Phiên bản đã tối ưu)

const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Cần import Model User

const authMiddleware = (roles) => async (req, res, next) => {
    // Kiểm tra token từ header (API) hoặc session (Web)
    const token = req.session.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        // Nếu là yêu cầu web, chuyển hướng về login
        if (!req.originalUrl.startsWith('/api')) {
            req.flash('error', 'Vui lòng đăng nhập để truy cập.');
            return res.redirect('/login');
        }
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // BƯỚC MỚI: Truy vấn database để lấy thông tin người dùng đầy đủ
        const user = await User.findById(decoded.id).select('-MatKhau');

        if (!user || user.TrangThaiUser === false) {
             return res.status(401).json({ msg: 'User not found or account is inactive' });
        }
        
        // Đính kèm user object và role (lấy từ DB) vào request
        req.user = user; 
        req.userRole = user.Role; 

        // Kiểm tra Phân quyền (sử dụng Role lấy từ DB)
        if (roles && !roles.includes(req.userRole)) {
            // Nếu là yêu cầu web, chuyển hướng về trang chủ
            if (!req.originalUrl.startsWith('/api')) {
                req.flash('error', 'Bạn không có quyền truy cập chức năng này.');
                return res.redirect('/');
            }
            return res.status(403).json({ msg: 'Access denied' });
        }

        next();
    } catch (error) {
        // Xử lý lỗi token không hợp lệ hoặc hết hạn
        if (!req.originalUrl.startsWith('/api')) {
            req.session.destroy(); // Hủy session nếu token lỗi/hết hạn
            req.flash('error', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
            return res.redirect('/login');
        }
        res.status(401).json({ msg: 'Invalid token' });
    }
};

module.exports = authMiddleware;