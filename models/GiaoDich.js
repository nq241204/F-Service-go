// models/GiaoDich.js (Transaction)
const mongoose = require('mongoose');

const GiaoDichSchema = new mongoose.Schema({
    Loai: {
        type: String,
        enum: ['deposit', 'withdraw', 'commission_payment', 'commission_fee'], // Loại giao dịch
        required: true
    },
    SoTien: {
        type: Number,
        required: true,
        min: 1
    },
    NguoiThamGia: { // User/Member liên quan đến giao dịch
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    TrangThai: {
        type: String,
        enum: ['pending', 'success', 'failed', 'cancelled'],
        default: 'pending'
    },
    MoTa: {
        type: String,
        required: false
    },
    NgayGiaoDich: {
        type: Date,
        default: Date.now
    },
    // Trường hợp giao dịch liên quan đến một ủy thác cụ thể
    DichVu: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DichVu',
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('GiaoDich', GiaoDichSchema, 'GiaoDich');