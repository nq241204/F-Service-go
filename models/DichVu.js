// models/DichVu.js (Không thay đổi nhiều, logic ổn)

const mongoose = require('mongoose');

const DichVuSchema = new mongoose.Schema({
    TenDichVu: { 
        type: String, 
        required: [true, 'Tên dịch vụ là bắt buộc'],
        trim: true
    },
    MoTa: { 
        type: String,
        trim: true
    },
    NguoiDung: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ThanhVien: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        default: null
    },
    TrangThai: {
        type: String,
        enum: ['cho-duyet', 'da-nhan', 'dang-xu-ly', 'hoan-thanh', 'huy-bo'],
        default: 'cho-duyet'
    },
    Gia: {
        type: Number,
        required: [true, 'Giá dịch vụ là bắt buộc'],
        min: [0, 'Giá không được âm']
    },
    GiaAI: {
        type: Number,
        min: [0, 'Giá AI không được âm'],
        default: 0
    },
    ThoiGianHoanThanh: {
        type: Date
    },
    DanhGia: {
        Sao: {
            type: Number,
            min: 1,
            max: 5
        },
        NhanXet: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('DichVu', DichVuSchema);