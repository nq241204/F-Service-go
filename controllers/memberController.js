// controllers/memberController.js
const User = require('../models/User');
const Member = require('../models/Member');
const ViGiaoDich = require('../models/ViGiaoDich');
const DichVu = require('../models/DichVu');
const { validationResult } = require('express-validator');

// --- Helper functions ---
const getWalletBalance = async (userId) => {
    const user = await User.findById(userId).select('ViGiaoDich');
    if (!user || !user.ViGiaoDich) {
        return 0;
    }
    const wallet = await ViGiaoDich.findById(user.ViGiaoDich).select('SoDuHienTai');
    return wallet ? wallet.SoDuHienTai : 0;
};

// --- Web Render Controllers ---

// @desc    Render trang Dashboard Member
// @route   GET /member/dashboard
const renderDashboard = async (req, res) => {
    try {
        const memberId = req.user._id;
        const member = await Member.findOne({ UserId: memberId });
        
        if (!member) {
            req.flash('error_msg', 'Không tìm thấy thông tin thành viên');
            return res.redirect('/');
        }

        // Lấy số dư ví
        const balance = await getWalletBalance(memberId);

        // Lấy các dịch vụ đang chờ
        const pendingServices = await DichVu.find({ 
            TrangThai: 'cho-duyet',
            $or: [
                { ThanhVien: null },
                { ThanhVien: member._id }
            ]
        })
        .populate('ChuSoHuu', 'ten email')
        .sort('-createdAt')
        .limit(5)
        .lean();

        // 3. Lấy các ủy thác Member đã nhận (trạng thái 'accepted' hoặc 'in_progress')
        const acceptedServices = await DichVu.find({
            ThanhVienNhan: memberId,
            TrangThai: { $in: ['accepted', 'in_progress'] }
        }).populate('ChuSoHuu', 'ten email');

        res.render('member/dashboard', { 
            title: 'Dashboard Thành Viên',
            balance: balance,
            availableServices: pendingServices,
            acceptedServices: acceptedServices
        });

    } catch (error) {
        console.error("Lỗi khi render Dashboard Member:", error);
        req.flash('error', 'Không thể tải dữ liệu Dashboard Thành Viên.');
        res.redirect('/');
    }
};

// @desc    Render trang Profile Member
// @route   GET /member/profile
const renderProfile = async (req, res) => {
    try {
        // Lấy thông tin chi tiết của Member để hiển thị form
        const member = await User.findById(req.session.user._id).select('ten email role'); 

        res.render('member/profile', { 
            title: 'Hồ Sơ Thành Viên'
        });
    } catch (error) {
        console.error("Lỗi khi render Profile Member:", error);
        req.flash('error', 'Không thể tải trang hồ sơ.');
        res.redirect('/member/dashboard');
    }
};

// --- API Controllers ---

// @desc    Cập nhật thông tin profile Member
// @route   PUT /api/member/profile
const updateProfile = async (req, res) => {
    const { ten, mota } = req.body;
    try {
        const user = await User.findByIdAndUpdate(
            req.userId,
            { ten, mota },
            { new: true, runValidators: true }
        ).select('ten email role');

        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }
        
        // Cập nhật session nếu cần thiết
        req.session.user.ten = user.ten; 

        // Nếu là request từ Web, chuyển hướng
        if (req.headers['accept'] && req.headers['accept'].includes('text/html')) {
            req.flash('success', 'Cập nhật hồ sơ thành công!');
            return res.redirect('/member/profile');
        }

        // Nếu là request API, trả về JSON
        res.status(200).json({ success: true, message: 'Cập nhật hồ sơ thành công.', user });

    } catch (error) {
        console.error("Lỗi khi cập nhật profile Member:", error);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật profile.' });
    }
};

// @desc    Member chấp nhận một ủy thác đang chờ
// @route   POST /api/member/accept/:serviceId
const acceptService = async (req, res) => {
    const { serviceId } = req.params;
    const memberId = req.userId; // ID của Member từ token/session

    try {
        const dichVu = await DichVu.findById(serviceId);

        if (!dichVu) {
            req.flash('error', 'Không tìm thấy Ủy thác.');
            return res.redirect('/member/dashboard');
        }

        if (dichVu.TrangThai !== 'pending') {
            req.flash('error', `Ủy thác đã được ${dichVu.TrangThai}.`);
            return res.redirect('/member/dashboard');
        }

        // Cập nhật trạng thái và người nhận
        dichVu.TrangThai = 'accepted'; // hoặc 'in_progress'
        dichVu.ThanhVienNhan = memberId;
        await dichVu.save();

        req.flash('success', `Đã chấp nhận Ủy thác: ${dichVu.TieuDe}. Bắt đầu làm việc!`);
        res.redirect('/member/dashboard'); // Chuyển hướng về Dashboard
        
    } catch (error) {
        console.error("Lỗi khi Member chấp nhận ủy thác:", error);
        req.flash('error', 'Lỗi server khi chấp nhận ủy thác.');
        res.redirect('/member/dashboard');
    }
};

// @desc    Lấy thông tin profile API
// @route   GET /api/member/profile
const getMemberProfile = async (req, res) => {
    try {
        // req.user được đặt bởi authMiddleware
        const balance = await getWalletBalance(req.userId);
        
        res.status(200).json({
            success: true,
            user: req.user,
            balance: balance,
            role: req.user.Role 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy profile.' });
    }
};


// --- Export tất cả các hàm ---
module.exports = {
    renderDashboard,
    renderProfile,
    getMemberProfile,
    updateProfile, // Hàm mới
    acceptService, // Hàm mới
};