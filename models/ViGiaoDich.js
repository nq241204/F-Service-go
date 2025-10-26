// models/ViGiaoDich.js (Phiên bản đã sửa)

const mongoose = require('mongoose');

const ViGiaoDichSchema = new mongoose.Schema({
    LoaiVi: { type: String, enum: ['User', 'Member', 'HeThong'], required: true },
    // ChuSoHuu: refPath dùng để liên kết với User/Member/HeThong (còn thiếu Schema HeThong)
    ChuSoHuu: { type: mongoose.Schema.Types.ObjectId, refPath: 'LoaiVi', required: true }, 

    SoDuHienTai: { type: Number, default: 0 },

    GiaoDich: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GiaoDich' }], // SỬA: ref: 'GiaoDich'
}, { timestamps: true });

module.exports = mongoose.model('ViGiaoDich', ViGiaoDichSchema);