// seed.js
require('dotenv').config(); 
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// === Import Models ĐÃ ĐỒNG BỘ ===
const User = require('./models/User');
const Member = require('./models/Member');
const DichVu = require('./models/DichVu'); // Dùng DichVu thay vì Service
const ViGiaoDich = require('./models/ViGiaoDich'); 
const GiaoDich = require('./models/GiaoDich'); 
const UyThac = require('./models/UyThac'); 
// ================================

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Kết nối DB thành công.');

        // Xóa dữ liệu cũ (Cần xóa hết các bảng liên quan)
        await User.deleteMany({});
        await Member.deleteMany({});
        await DichVu.deleteMany({});
        await ViGiaoDich.deleteMany({});
        await GiaoDich.deleteMany({});
        await UyThac.deleteMany({});

        console.log('Đã xóa dữ liệu cũ.');

        // === 1. TẠO VÍ HỆ THỐNG (Rất quan trọng cho giao dịch) ===
        const systemWallet = await ViGiaoDich.create({
            LoaiVi: 'System',
            ChuSoHuu: null, // Không liên kết với bất kỳ User nào
            SoDuHienTai: 0,
            TenVi: 'Ví Hệ thống (Phí dịch vụ)'
        });
        console.log(`Đã tạo Ví Hệ thống với ID: ${systemWallet._id}`);

        // === 2. TẠO USER VÀ VÍ (Admin, User, Member) ===
        const hashedPassword = await bcrypt.hash('123456', 10);
        
        // ADMIN
        const adminUser = await User.create({ Ten: 'Admin', Email: 'admin@fservice.com', MatKhau: hashedPassword, Role: 'admin' });
        const adminWallet = await ViGiaoDich.create({ LoaiVi: 'Admin', ChuSoHuu: adminUser._id, SoDuHienTai: 5000000 });
        adminUser.ViGiaoDich = adminWallet._id;
        await adminUser.save();

        // USER
        const normalUser = await User.create({ Ten: 'Test User', Email: 'user@fservice.com', MatKhau: hashedPassword, Role: 'user' });
        const userWallet = await ViGiaoDich.create({ LoaiVi: 'User', ChuSoHuu: normalUser._id, SoDuHienTai: 1000000 });
        normalUser.ViGiaoDich = userWallet._id;
        await normalUser.save();
        
        // MEMBER
        const memberUser = await User.create({ Ten: 'Test Member', Email: 'member@fservice.com', MatKhau: hashedPassword, Role: 'member' });
        const memberWallet = await ViGiaoDich.create({ LoaiVi: 'Member', ChuSoHuu: memberUser._id, SoDuHienTai: 0 });
        memberUser.ViGiaoDich = memberWallet._id;
        await memberUser.save();
        
        // Tạo hồ sơ Member
        const memberProfile = await Member.create({
            UserId: memberUser._id,
            Ten: memberUser.Ten,
            CapBac: 'Bronze',
            LinhVuc: 'Lập trình Web'
        });

        // === 3. TẠO DỊCH VỤ MẪU (DichVu) ===
        const service1 = await DichVu.create({
            TenDichVu: 'Thiết kế Logo cơ bản',
            MoTa: 'Thiết kế logo theo yêu cầu 2D đơn giản.',
            GiaMacDinhAI: 500000,
            TrangThai: 'Active'
        });

        console.log('Dữ liệu mẫu đã được thêm thành công!');
        process.exit(0);
    } catch (error) {
        console.error('Lỗi khi thêm dữ liệu:', error);
        process.exit(1);
    }
};

seedData();