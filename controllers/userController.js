// controllers/userController.js
const User = require('../models/User');
const ViGiaoDich = require('../models/ViGiaoDich');
const DichVu = require('../models/DichVu');

// --- Helper function (Lấy số dư ví) ---
const getWalletBalance = async (userId) => {
    // 1. Tìm User để lấy ID Ví
    const user = await User.findById(userId).select('ViGiaoDich');
    if (!user || !user.ViGiaoDich) {
        return 0;
    }
    // 2. Lấy thông tin Ví giao dịch
    const wallet = await ViGiaoDich.findById(user.ViGiaoDich).select('SoDuHienTai');
    return wallet ? wallet.SoDuHienTai : 0;
};

// --- Web Render Controllers ---

// @desc    Render trang Dashboard User
// @route   GET /user/dashboard
exports.renderDashboard = async (req, res) => {
    try {
        const userId = req.session.user._id;

        // Lấy dữ liệu cần thiết cho Dashboard
        const balance = await getWalletBalance(userId);

        // Lấy 5 ủy thác gần đây nhất của User
        const services = await DichVu.find({ ChuSoHuu: userId })
                                     .sort({ createdAt: -1 })
                                     .limit(5);
        
        // Đếm số lượng ủy thác đang chờ (pending)
        const pendingCount = await DichVu.countDocuments({ ChuSoHuu: userId, TrangThai: 'pending' });

        res.render('user/dashboard', {
            title: 'Dashboard Người Dùng',
            user: req.session.user,
            balance: balance, // Truyền số dư ví
            services: services, // Truyền danh sách ủy thác
            pendingCount: pendingCount, // Truyền số lượng đang chờ
            // locals.success_msg và locals.error_msg đã có sẵn nhờ middleware
        });
    } catch (error) {
        console.error("Lỗi khi render Dashboard User:", error);
        req.flash('error', 'Không thể tải dữ liệu Dashboard.');
        res.redirect('/');
    }
};

// @desc    Render trang Ví giao dịch
// @route   GET /user/wallet
exports.renderWallet = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const balance = await getWalletBalance(userId);

        // Giả định không có QR Code ngay lúc này (sẽ hiển thị sau POST Deposit)
        res.render('user/wallet', {
            title: 'Ví Giao Dịch',
            user: req.session.user,
            balance: balance, // Truyền số dư ví
            qrCode: null, // Ban đầu chưa có QR code
        });
    } catch (error) {
        console.error("Lỗi khi render Ví giao dịch:", error);
        req.flash('error', 'Không thể tải dữ liệu Ví giao dịch.');
        res.redirect('/user/dashboard');
    }
};

// @desc    Render trang Danh sách Ủy thác
// @route   GET /user/commissions
exports.renderMyCommissions = async (req, res) => {
    try {
        const userId = req.session.user._id;

        // Lấy tất cả ủy thác của User (có thể thêm phân trang sau)
        const services = await DichVu.find({ ChuSoHuu: userId })
                                     .sort({ createdAt: -1 });

        res.render('user/commissions', { // Giả định có view commissions.ejs
            title: 'Ủy Thác Của Tôi',
            user: req.session.user,
            services: services,
        });
    } catch (error) {
        console.error("Lỗi khi render Danh sách Ủy thác:", error);
        req.flash('error', 'Không thể tải danh sách ủy thác.');
        res.redirect('/user/dashboard');
    }
};


// --- API Controllers (Cần thiết để hoàn thành routes/user.js) ---

// @desc    Lấy thông tin profile
// @route   GET /api/user/profile
exports.getProfile = async (req, res) => {
    try {
        // req.user được đặt bởi authMiddleware
        const balance = await getWalletBalance(req.userId);
        
        res.status(200).json({
            success: true,
            user: req.user,
            balance: balance
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy profile.' });
    }
};

// ... (Các hàm API khác như updateProfile, getMyCommissions, confirmPayment sẽ được thêm sau)
// Hiện tại chỉ cần các hàm render và getProfile để khởi động hệ thống.