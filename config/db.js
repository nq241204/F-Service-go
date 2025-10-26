// config/db.js (Phiên bản đã tối ưu)
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            // Đã loại bỏ useNewUrlParser và useUnifiedTopology (mặc định true từ Mongoose v6)
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            // Cân nhắc thêm: autoIndex: process.env.NODE_ENV !== 'production', 
        });
        console.log('MongoDB connected successfully');
        
        // Lắng nghe sự kiện kết nối
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
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