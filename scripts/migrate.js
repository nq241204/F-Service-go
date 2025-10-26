const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Member = require('../models/Member');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');

const connectDB = require('../config/db');

const migrateData = async () => {
  try {
    // Connect to database
    await connectDB();
    
    console.log('Starting data migration...');
    
    // Clear existing data (optional - be careful in production!)
    if (process.env.NODE_ENV === 'development') {
      console.log('Clearing existing data...');
      await User.deleteMany({});
      await Member.deleteMany({});
      await Service.deleteMany({});
      await Transaction.deleteMany({});
    }
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminUser = new User({
      email: 'admin@fservice.com',
      password: adminPassword,
      role: 'admin',
      balance: 10000,
      isVip: true
    });
    await adminUser.save();
    console.log('✅ Admin user created');
    
    // Create test users
    const userPassword = await bcrypt.hash('user123', 10);
    const testUsers = [
      {
        email: 'user1@test.com',
        password: userPassword,
        role: 'user',
        balance: 5000,
        isVip: false
      },
      {
        email: 'user2@test.com',
        password: userPassword,
        role: 'user',
        balance: 3000,
        isVip: true
      }
    ];
    
    const createdUsers = await User.insertMany(testUsers);
    console.log('✅ Test users created');
    
    // Create members
    const members = [
      {
        user: createdUsers[0]._id,
        skills: ['Web Development', 'JavaScript', 'React'],
        level: 'Chuyên gia',
        certifications: ['AWS Certified Developer', 'React Professional'],
        rating: 4.8
      },
      {
        user: createdUsers[1]._id,
        skills: ['Mobile Development', 'Flutter', 'Dart'],
        level: 'Thành thạo',
        certifications: ['Google Mobile Web Specialist'],
        rating: 4.5
      }
    ];
    
    const createdMembers = await Member.insertMany(members);
    console.log('✅ Members created');
    
    // Create services
    const services = [
      {
        title: 'Website Development',
        description: 'Professional website development using modern technologies',
        user: createdUsers[0]._id,
        member: createdMembers[0]._id,
        status: 'pending',
        price: 1500,
        aiPrice: 1200
      },
      {
        title: 'Mobile App Development',
        description: 'Cross-platform mobile app development with Flutter',
        user: createdUsers[1]._id,
        member: createdMembers[1]._id,
        status: 'accepted',
        price: 2500,
        aiPrice: 2000
      },
      {
        title: 'E-commerce Solution',
        description: 'Complete e-commerce platform with payment integration',
        user: createdUsers[0]._id,
        status: 'pending',
        price: 3000,
        aiPrice: 2500
      }
    ];
    
    const createdServices = await Service.insertMany(services);
    console.log('✅ Services created');
    
    // Create transactions
    const transactions = [
      {
        user: createdUsers[0]._id,
        amount: 5000,
        type: 'deposit'
      },
      {
        user: createdUsers[1]._id,
        amount: 3000,
        type: 'deposit'
      },
      {
        user: createdUsers[0]._id,
        amount: 1500,
        type: 'payment'
      }
    ];
    
    await Transaction.insertMany(transactions);
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
