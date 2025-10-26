// controllers/authController.js
const User = require('../models/User');
const ViGiaoDich = require('../models/ViGiaoDich');
const jwt = require('jsonwebtoken');

// Hàm tạo JWT Token
const generateToken = (id) => {
    // Đảm bảo JWT_SECRET đã được định nghĩa trong file .env
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d', // Hạn sử dụng 30 ngày
    });
};

// Hàm Đăng ký người dùng mới
const register = async (req, res, next) => { // ĐÃ SỬA: Loại bỏ "exports."
    const { ten, email, password, role } = req.body;
    const isApi = req.originalUrl.startsWith('/api');

    try {
        // 1. Kiểm tra User đã tồn tại
        let user = await User.findOne({ Email: email });
        if (user) {
            if (isApi) {
                return res.status(400).json({ success: false, message: 'Email đã tồn tại.' });
            }
            req.flash('error', 'Email đã tồn tại');
            return res.redirect('/register');
        }

        // 2. Tạo User
        user = new User({ 
            Ten: ten || email.split('@')[0], 
            Email: email, 
            MatKhau: password, 
            Role: role || 'user' 
        });
        await user.save();
        
        // 3. TẠO VÍ GIAO DỊCH
        const newWallet = new ViGiaoDich({
            LoaiVi: user.Role === 'member' ? 'Member' : 'User', 
            ChuSoHuu: user._id,
            SoDuHienTai: 0,
        });
        await newWallet.save();

        // 4. Cập nhật liên kết Ví cho User
        user.ViGiaoDich = newWallet._id;
        await user.save(); 

        // 5. Phản hồi
        if (isApi) {
            return res.status(201).json({ 
                success: true, 
                message: 'Đăng ký thành công.', 
                user: { id: user._id, email: user.Email, role: user.Role } 
            });
        }
        
        req.flash('success', 'Đăng ký thành công! Vui lòng đăng nhập.');
        res.redirect('/login');

    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        if (isApi) {
            return res.status(500).json({ success: false, message: 'Lỗi server khi đăng ký.' });
        }
        req.flash('error', 'Lỗi server');
        res.redirect('/register');
    }
};


const login = async (req, res) => { // ĐÃ SỬA: Loại bỏ "exports."
    const { email, password } = req.body;
    const isApi = req.originalUrl.startsWith('/api');

    try {
        // 1. Tìm người dùng
        // Do MatKhau có `select: false`, ta phải dùng .select('+MatKhau') để có thể so sánh
        const user = await User.findOne({ Email: email }).select('+MatKhau'); 

        if (!user) {
            const errorMsg = 'Thông tin đăng nhập không hợp lệ.';
            if (isApi) {
                return res.status(401).json({ success: false, message: errorMsg });
            }
            req.flash('error', errorMsg);
            return res.redirect('/login');
        }
        
        // 2. So sánh mật khẩu
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            const errorMsg = 'Thông tin đăng nhập không hợp lệ.';
            if (isApi) {
                return res.status(401).json({ success: false, message: errorMsg });
            }
            req.flash('error', errorMsg);
            return res.redirect('/login');
        }

        // 3. Xử lý thành công
        
        // Trích xuất thông tin cơ bản (Không bao gồm mật khẩu)
        const userData = {
            _id: user._id,
            ten: user.Ten,
            email: user.Email,
            role: user.Role,
            viGiaoDichId: user.ViGiaoDich,
        };

        if (isApi) {
            // API Login: Trả về Token
            const token = generateToken(user._id);
            
            res.status(200).json({ 
                success: true, 
                message: 'Đăng nhập thành công.', 
                user: userData,
                token: token
            });
        } else {
            // Web Login: Dùng Session và Redirect
            req.session.user = userData;
            req.flash('success', `Chào mừng ${user.Ten}!`);
            
            if (user.Role === 'admin') {
                res.redirect('/admin/dashboard');
            } else if (user.Role === 'member') {
                res.redirect('/member/dashboard');
            } else {
                res.redirect('/user/dashboard');
            }
        }

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        if (isApi) {
            res.status(500).json({ success: false, message: 'Lỗi server khi đăng nhập.' });
        } else {
            req.flash('error', 'Lỗi server khi đăng nhập.');
            res.redirect('/login');
        }
    }
};

// === KHẮC PHỤC LỖI: Export các biến cục bộ đã định nghĩa ===
module.exports = {
    register, // Hàm đăng ký
    login     // Hàm đăng nhập
};