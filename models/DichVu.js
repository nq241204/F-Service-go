// models/DichVu.js (Không thay đổi nhiều, logic ổn)

const mongoose = require('mongoose');

const DichVuSchema = new mongoose.Schema({
    TenDichVu: { type: String, required: true },
    MoTa: { type: String },
    GiaMacDinhAI: { type: Number, default: 0 } 
});

module.exports = mongoose.model('DichVu', DichVuSchema);