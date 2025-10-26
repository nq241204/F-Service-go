const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Member = require('../models/Member');
const DichVu = require('../models/DichVu');
const GiaoDich = require('../models/GiaoDich');
const ViGiaoDich = require('../models/ViGiaoDich');

const connectDB = require('../config/db');

const migrateData = async () => {
  try {
    // Connect to database
    await connectDB();
    
    console.log('Starting data migration...');
    
    // Clear existing data
    console.log('Clearing existing data...');
    
    // Drop collections để xóa cả indexes
    const collections = ['users', 'members', 'dichvus', 'giaodiches', 'vigiaodichies'];
    for (const collection of collections) {
      try {
        await mongoose.connection.db.dropCollection(collection);
        console.log(`Dropped collection: ${collection}`);
      } catch (err) {
        console.log(`Collection ${collection} might not exist yet`);
      }
    }
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = await User.create({
      Ten: 'Admin',
      Email: 'admin@fservice.com',
      MatKhau: adminPassword,
      Role: 'admin',
      TrangThai: 'active'
    });
    console.log('✅ Admin user created');
    
    // Create test users
    const userPassword = await bcrypt.hash('user123', 10);
    const testUsers = [
      {
        Ten: 'Người dùng 1',
        Email: 'user1@fservice.com',
        MatKhau: userPassword,
        Role: 'user',
        TrangThai: 'active'
      },
      {
        Ten: 'Người dùng 2',
        Email: 'user2@fservice.com',
        MatKhau: userPassword,
        Role: 'user',
        TrangThai: 'active'
      }
    ];
    
    const createdUsers = await User.insertMany(testUsers);
    console.log('✅ Test users created');
    
    // Create members
    const members = [
      {
        UserId: createdUsers[0]._id,
        Ten: 'Thành viên 1',
        CapBac: 'Chuyên gia',
        LinhVuc: 'Phát triển Web',
        DiemDanhGiaTB: 4.8
      },
      {
        UserId: createdUsers[1]._id,
        Ten: 'Thành viên 2',
        CapBac: 'Thành thạo',
        LinhVuc: 'Phát triển Mobile',
        DiemDanhGiaTB: 4.5
      }
    ];
    
    const createdMembers = await Member.insertMany(members);
    console.log('✅ Members created');
    
    // Create services
    const services = [
      {
        TenDichVu: 'Phát triển Website',
        MoTa: 'Phát triển website chuyên nghiệp với công nghệ hiện đại',
        NguoiDung: createdUsers[0]._id,
        ThanhVien: createdMembers[0]._id,
        TrangThai: 'cho-duyet',
        Gia: 1500000,
        GiaAI: 1200000
      },
      {
        TenDichVu: 'Phát triển Ứng dụng Di động',
        MoTa: 'Phát triển ứng dụng di động đa nền tảng với Flutter',
        NguoiDung: createdUsers[1]._id,
        ThanhVien: createdMembers[1]._id,
        TrangThai: 'da-duyet',
        Gia: 2500000,
        GiaAI: 2000000
      },
      {
        TenDichVu: 'Giải pháp E-commerce',
        MoTa: 'Nền tảng thương mại điện tử hoàn chỉnh với tích hợp thanh toán',
        NguoiDung: createdUsers[0]._id,
        TrangThai: 'cho-duyet',
        Gia: 3000000,
        GiaAI: 2500000
      }
    ];
    
    const createdServices = await DichVu.insertMany(services);
    console.log('✅ Services created');
    
    // Create transactions
    const transactions = [
      {
        NguoiThamGia: createdUsers[0]._id,
        SoTien: 5000000,
        Loai: 'deposit',
        TrangThai: 'success',
        MoTa: 'Nạp tiền vào tài khoản',
        NgayGiaoDich: new Date()
      },
      {
        NguoiThamGia: createdUsers[1]._id,
        SoTien: 3000000,
        Loai: 'deposit',
        TrangThai: 'success',
        MoTa: 'Nạp tiền vào tài khoản',
        NgayGiaoDich: new Date()
      },
      {
        NguoiThamGia: createdUsers[0]._id,
        SoTien: 1500000,
        Loai: 'commission_payment',
        TrangThai: 'success',
        MoTa: 'Thanh toán hoa hồng',
        NgayGiaoDich: new Date()
      }
    ];
    
    await GiaoDich.insertMany(transactions);
    console.log('✅ Transactions created');
    
    console.log('🎉 Migration completed successfully!');
    console.log('\nTest accounts:');
    console.log('Admin: admin@fservice.com / admin123');
    console.log('User 1: user1@test.com / user123');
    console.log('User 2: user2@test.com / user123');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run migration if called directly
if (require.main === module) {
  migrateData();
}

module.exports = migrateData;
