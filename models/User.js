const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên không được để trống'],
        trim: true,
        minlength: [2, 'Tên phải có ít nhất 2 ký tự']
    },
    email: {
        type: String,
        required: [true, 'Email không được để trống'],
        unique: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
            },
            message: 'Email không hợp lệ'
        }
    },
    password: {
        type: String,
        required: [true, 'Mật khẩu không được để trống'],
        minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
        select: false
    },
    role: {
        type: String,
        enum: {
            values: ['user', 'member', 'admin'],
            message: 'Role không hợp lệ'
        },
        default: 'user'
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'inactive', 'banned'],
            message: 'Trạng thái không hợp lệ'
        },
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
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