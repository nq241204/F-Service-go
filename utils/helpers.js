// utils/helpers.js
const bcrypt = require('bcryptjs');

/**
 * Format số tiền theo định dạng tiền Việt Nam
 * @param {number} amount Số tiền cần format
 * @returns {string} Chuỗi đã format
 */
exports.formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
};

/**
 * Format ngày giờ theo định dạng Việt Nam
 * @param {Date} date Ngày cần format
 * @returns {string} Chuỗi đã format
 */
exports.formatDate = (date) => {
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
};

/**
 * So sánh mật khẩu với hash
 * @param {string} password Mật khẩu cần kiểm tra
 * @param {string} hash Hash được lưu trong database 
 * @returns {Promise<boolean>}
 */
exports.comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

/**
 * Tạo hash cho mật khẩu
 * @param {string} password Mật khẩu cần hash
 * @returns {Promise<string>} Hash của mật khẩu
 */
exports.hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

/**
 * Tạo mã ngẫu nhiên
 * @param {number} length Độ dài mã
 * @returns {string} Mã ngẫu nhiên
 */
exports.generateRandomCode = (length = 6) => {
    return Math.random()
        .toString(36)
        .substring(2, 2 + length)
        .toUpperCase();
};

/**
 * Validate số điện thoại Việt Nam
 * @param {string} phone Số điện thoại cần kiểm tra
 * @returns {boolean}
 */
exports.isVietnamesePhone = (phone) => {
    return /^(0|84)(3|5|7|8|9)[0-9]{8}$/.test(phone);
};

/**
 * Tính khoảng cách giữa hai ngày
 * @param {Date} date1 Ngày thứ nhất
 * @param {Date} date2 Ngày thứ hai
 * @returns {number} Số ngày chênh lệch
 */
exports.daysBetween = (date1, date2) => {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date1 - date2) / oneDay));
};