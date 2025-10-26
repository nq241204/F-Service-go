// models/UyThac.js (Phiên bản đã sửa)

const mongoose = require('mongoose');

const UyThacSchema = new mongoose.Schema({
    UserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    MemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    DichVuId: { type: mongoose.Schema.Types.ObjectId, ref: 'DichVu', required: true },

    GiaThoaThuan: { type: Number, required: true },
    TrangThai: { 
        type: String, 
        // MỞ RỘNG: Thêm trạng thái quan trọng
        enum: ['Moi', 'DaChuyenTienVaoHeThong', 'DangThucHien', 'ChoPheDuyetHoanThanh', 'DaHoanThanh', 'DaHuy'], 
        default: 'Moi' 
    },

    NgayTao: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UyThac', UyThacSchema);