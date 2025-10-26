const DichVu = require('../models/DichVu');
const UyThac = require('../models/UyThac');

// @desc    Tạo một Yêu cầu Ủy thác mới (Service/Commission)
// @route   POST /api/service/create
// @access  Private (Chỉ User)
exports.createUyThac = async (req, res) => {
    const { dichVuId, giaThoaThuan } = req.body; // userId sẽ được lấy từ req.user

    try {
        // 1. Kiểm tra dịch vụ có tồn tại không
        const dichVu = await DichVu.findById(dichVuId);
        if (!dichVu) {
            return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại.' });
        }
        
        // 2. Tạo Ủy thác
        const uyThac = new UyThac({
            UserId: req.userId, // Lấy từ authMiddleware
            DichVuId: dichVuId,
            GiaThoaThuan: giaThoaThuan,
            TrangThai: 'Moi'
        });

        await uyThac.save();
        
        res.status(201).json({ success: true, message: 'Yêu cầu ủy thác đã được tạo thành công. Đang chờ Member nhận việc.', data: uyThac });

    } catch (error) {
        console.error('Lỗi tạo Ủy thác:', error);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

// @desc    Lấy danh sách các loại Dịch vụ có sẵn
// @route   GET /api/service/list
// @access  Public
exports.getServiceList = async (req, res) => {
    try {
        const services = await DichVu.find();
        res.status(200).json({ success: true, count: services.length, data: services });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

// @desc    Lấy chi tiết một Yêu cầu Ủy thác
// @route   GET /api/service/:id
// @access  Private (User/Member/Admin)
exports.getUyThacDetails = async (req, res) => {
    try {
        const uyThac = await UyThac.findById(req.params.id)
            .populate('UserId', 'Ten Email')
            .populate('MemberId', 'Ten CapBac')
            .populate('DichVuId', 'TenDichVu');

        if (!uyThac) {
            return res.status(404).json({ success: false, message: 'Ủy thác không tồn tại.' });
        }
        
        // Logic bảo mật: Chỉ cho phép người liên quan xem chi tiết
        const isRelated = (
            uyThac.UserId.equals(req.userId) || 
            (uyThac.MemberId && uyThac.MemberId.equals(req.userId)) || 
            req.userRole === 'admin'
        );

        if (!isRelated) {
             return res.status(403).json({ success: false, message: 'Bạn không có quyền xem chi tiết ủy thác này.' });
        }

        res.status(200).json({ success: true, data: uyThac });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

module.exports = {
    createUyThac,
    getServiceList,
    getUyThacDetails,
};