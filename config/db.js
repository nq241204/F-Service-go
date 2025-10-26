// config/db.js (Phiên bản đã tối ưu)
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/f-service', {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            autoIndex: process.env.NODE_ENV !== 'production'
        });
        console.log('Kết nối MongoDB thành công');
        
        // Lắng nghe sự kiện kết nối
        mongoose.connection.on('error', (err) => {
            console.error('Lỗi kết nối MongoDB:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB đã ngắt kết nối');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });
        
    } catch (error) {
        console.error('MongoDB connection error:', error);
        // Dừng ứng dụng nếu không thể kết nối
        process.exit(1); 
    }
};

module.exports = connectDB;