// models/Member.js (Phiên bản đã sửa)

const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
    UserId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        unique: true 
    }, // THÊM: Liên kết với tài khoản User
    Ten: { type: String, required: true },
    CapBac: { type: String, enum: ['Intern', 'Thành thạo', 'Chuyên gia'], required: true },
    LinhVuc: { type: String, required: true },
    SoDienThoai: { type: String, required: false },
    KyNang: { type: [String], default: [] },
    ChungChi: { type: [String], default: [] }, // lưu đường dẫn file upload
    TrangThai: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    DiemDanhGiaTB: { type: Number, default: 0 }
});

module.exports = mongoose.model('Member', MemberSchema);