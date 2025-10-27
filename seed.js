// seed.js
require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('./models/User');
const Member = require('./models/Member');
const DichVu = require('./models/DichVu');
const ViGiaoDich = require('./models/ViGiaoDich');
const GiaoDich = require('./models/GiaoDich');
const UyThac = require('./models/UyThac');

const seedData = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/f-service';
        await mongoose.connect(mongoUri, {
            // mongoose v7+ no longer needs useNewUrlParser/useUnifiedTopology options
        });
        console.log('Kết nối DB thành công.');

        // Xóa dữ liệu cũ
        await User.deleteMany({});
        await Member.deleteMany({});
        await DichVu.deleteMany({});
        await ViGiaoDich.deleteMany({});
        await GiaoDich.deleteMany({});
        await UyThac.deleteMany({});

        console.log('Đã xóa dữ liệu cũ.');

        // Tạo users (mật khẩu plain sẽ được hash bởi pre-save hook trong model)
        const adminUser = await User.create({ name: 'Admin', email: 'admin@fservice.com', password: '123456', role: 'admin' });
        const normalUser = await User.create({ name: 'Test User', email: 'user@fservice.com', password: '123456', role: 'user' });
        const memberUser = await User.create({ name: 'Test Member', email: 'member@fservice.com', password: '123456', role: 'member' });

        // Tạo ví cho users (LoaiVi 'User' dùng ChuSoHuu = User._id)
        const adminWallet = await ViGiaoDich.create({ LoaiVi: 'User', ChuSoHuu: adminUser._id, SoDuHienTai: 5000000 });
        adminUser.ViGiaoDich = adminWallet._id; await adminUser.save();

        const userWallet = await ViGiaoDich.create({ LoaiVi: 'User', ChuSoHuu: normalUser._id, SoDuHienTai: 1000000 });
        normalUser.ViGiaoDich = userWallet._id; await normalUser.save();

        const memberWallet = await ViGiaoDich.create({ LoaiVi: 'User', ChuSoHuu: memberUser._id, SoDuHienTai: 0 });
        memberUser.ViGiaoDich = memberWallet._id; await memberUser.save();

        // Tạo profile Member liên kết với User
        const memberProfile = await Member.create({ UserId: memberUser._id, Ten: memberUser.name, CapBac: 'Thành thạo', LinhVuc: 'Lập trình Web' });

        // Tạo dịch vụ mẫu (DichVu) - lưu ý các trường trùng với schema
        const service1 = await DichVu.create({
            TenDichVu: 'Thiết kế Logo cơ bản',
            MoTa: 'Thiết kế logo theo yêu cầu 2D đơn giản.',
            NguoiDung: normalUser._id,
            ThanhVien: memberProfile._id,
            TrangThai: 'cho-duyet',
            Gia: 500000,
            GiaAI: 100000
        });

        console.log('Dữ liệu mẫu đã được thêm thành công!');
        process.exit(0);
    } catch (error) {
        console.error('Lỗi khi thêm dữ liệu:', error);
        process.exit(1);
    }
};

seedData();