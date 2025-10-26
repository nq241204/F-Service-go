const User = require('../models/User');
const Member = require('../models/Member');
const DichVu = require('../models/DichVu');
const GiaoDich = require('../models/GiaoDich');

// @desc    Xem thống kê tổng quan hệ thống
// @route   GET /api/admin/dashboard
// @access  Private (Chỉ Admin)
exports.getSystemStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalMembers = await Member.countDocuments();
        const totalServices = await DichVu.countDocuments();
        const totalTransactions = await GiaoDich.countDocuments();

        // Cần thêm logic tính tổng số dư trong các Ví...

        res.status(200).json({ 
            success: true, 
            data: {
                totalUsers,
                totalMembers,
                totalServices,
                totalTransactions,
                // Thêm: TotalRevenue, TotalPendingCommissions...
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

// @desc    Quản lý User: Chặn hoặc Bỏ chặn User
// @route   PUT /api/admin/user/:userId/status
// @access  Private (Chỉ Admin)
exports.toggleUserStatus = async (req, res) => {
    const { userId } = req.params;
    const { status } = req.body; // Ví dụ: status: true/false

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        
        // Cần xác thực input status là boolean
        if (typeof status !== 'boolean') {
             return res.status(400).json({ success: false, message: 'Status phải là true hoặc false.' });
        }

        user.TrangThaiUser = status;
        await user.save();

        res.status(200).json({ 
            success: true, 
            message: `User ${user.Email} đã được ${status ? 'kích hoạt' : 'chặn'}.`, 
            data: user 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

// @desc    Quản lý Dịch vụ: Thêm Dịch vụ mới
// @route   POST /api/admin/service
// @access  Private (Chỉ Admin)
exports.addService = async (req, res) => {
    const { tenDichVu, moTa, giaMacDinhAI } = req.body;

    try {
        const newService = new DichVu({ tenDichVu, moTa, giaMacDinhAI });
        await newService.save();
        res.status(201).json({ success: true, message: 'Dịch vụ đã được thêm.', data: newService });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

module.exports = {
    getSystemStats,
    toggleUserStatus,
    addService,
};