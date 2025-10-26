const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Đảm bảo import bcryptjs

const UserSchema = new mongoose.Schema({
    Ten: {
        type: String,
        required: true,
        trim: true,
    },
    Email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    MatKhau: {
        type: String,
        required: true,
        select: false, // Không trả về mật khẩu khi tìm kiếm mặc định
    },
    Role: {
        type: String,
        enum: ['user', 'member', 'admin'],
        default: 'user',
    },
    TrangThai: {
        type: String,
        enum: ['active', 'inactive', 'banned'],
        default: 'active',
    },
    // Liên kết với Ví giao dịch (ViGiaoDich Model)
    ViGiaoDich: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ViGiaoDich',
        required: false, // Được gán sau khi user được tạo
    },
}, { timestamps: true });


// Middleware PRE-SAVE: Băm mật khẩu trước khi lưu
UserSchema.pre('save', async function(next) {
    // Chỉ băm mật khẩu nếu nó đã được thay đổi (hoặc là mới)
    if (!this.isModified('MatKhau')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.MatKhau = await bcrypt.hash(this.MatKhau, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method: So sánh mật khẩu (Sẽ dùng trong authController.js)
UserSchema.methods.matchPassword = async function(enteredPassword) {
    // So sánh mật khẩu đầu vào với MatKhau đã băm trong DB
    // Vì MatKhau có `select: false`, ta cần đảm bảo fetch nó trước khi gọi method này (thường không cần trong logic login)
    return await bcrypt.compare(enteredPassword, this.MatKhau);
};

module.exports = mongoose.model('User', UserSchema);