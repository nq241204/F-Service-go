// services/PaymentService.js
const mongoose = require('mongoose');
const GiaoDich = require('../models/GiaoDich');
const ViGiaoDich = require('../models/ViGiaoDich');
const User = require('../models/User');
const config = require('../config/app');

class PaymentService {
    // Nạp tiền vào ví
    static async deposit(userId, amount, paymentInfo) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Kiểm tra ví
            let wallet = await ViGiaoDich.findOne({ ChuSoHuu: userId }).session(session);
            if (!wallet) {
                throw new Error('Ví không tồn tại');
            }

            // Tạo giao dịch nạp tiền
            const transaction = new GiaoDich({
                Loai: 'deposit',
                SoTien: amount,
                NguoiThamGia: userId,
                TrangThai: 'pending',
                MoTa: 'Nạp tiền vào ví',
                ThongTinThanhToan: paymentInfo
            });

            await transaction.save({ session });

            // Cập nhật ví
            wallet.GiaoDich.push(transaction._id);
            await wallet.save({ session });

            await session.commitTransaction();
            return transaction;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Xác nhận nạp tiền thành công
    static async confirmDeposit(transactionId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const transaction = await GiaoDich.findById(transactionId).session(session);
            if (!transaction || transaction.Loai !== 'deposit' || transaction.TrangThai !== 'pending') {
                throw new Error('Giao dịch không hợp lệ');
            }

            const wallet = await ViGiaoDich.findOne({
                ChuSoHuu: transaction.NguoiThamGia
            }).session(session);

            if (!wallet) {
                throw new Error('Ví không tồn tại');
            }

            // Cập nhật số dư và trạng thái
            wallet.SoDuHienTai += transaction.SoTien;
            transaction.TrangThai = 'success';
            transaction.NgayHoanThanh = new Date();

            await Promise.all([
                wallet.save({ session }),
                transaction.save({ session })
            ]);

            await session.commitTransaction();
            return {
                wallet,
                transaction
            };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Rút tiền từ ví
    static async withdraw(userId, amount, bankInfo) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Kiểm tra ví và số dư
            const wallet = await ViGiaoDich.findOne({ ChuSoHuu: userId }).session(session);
            if (!wallet) {
                throw new Error('Ví không tồn tại');
            }

            if (wallet.SoDuHienTai < amount) {
                throw new Error('Số dư không đủ');
            }

            // Tạo giao dịch rút tiền
            const transaction = new GiaoDich({
                Loai: 'withdraw',
                SoTien: amount,
                NguoiThamGia: userId,
                TrangThai: 'pending',
                MoTa: 'Rút tiền từ ví',
                ThongTinThanhToan: bankInfo
            });

            // Tạm khóa số dư
            wallet.SoDuHienTai -= amount;
            wallet.SoDuTamKhoa = (wallet.SoDuTamKhoa || 0) + amount;
            wallet.GiaoDich.push(transaction._id);

            await Promise.all([
                transaction.save({ session }),
                wallet.save({ session })
            ]);

            await session.commitTransaction();
            return transaction;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Xác nhận rút tiền thành công
    static async confirmWithdraw(transactionId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const transaction = await GiaoDich.findById(transactionId).session(session);
            if (!transaction || transaction.Loai !== 'withdraw' || transaction.TrangThai !== 'pending') {
                throw new Error('Giao dịch không hợp lệ');
            }

            const wallet = await ViGiaoDich.findOne({
                ChuSoHuu: transaction.NguoiThamGia
            }).session(session);

            if (!wallet) {
                throw new Error('Ví không tồn tại');
            }

            // Giải phóng số dư tạm khóa
            wallet.SoDuTamKhoa -= transaction.SoTien;
            transaction.TrangThai = 'success';
            transaction.NgayHoanThanh = new Date();

            await Promise.all([
                wallet.save({ session }),
                transaction.save({ session })
            ]);

            await session.commitTransaction();
            return {
                wallet,
                transaction
            };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Hủy giao dịch rút tiền
    static async cancelWithdraw(transactionId, reason) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const transaction = await GiaoDich.findById(transactionId).session(session);
            if (!transaction || transaction.Loai !== 'withdraw' || transaction.TrangThai !== 'pending') {
                throw new Error('Giao dịch không hợp lệ');
            }

            const wallet = await ViGiaoDich.findOne({
                ChuSoHuu: transaction.NguoiThamGia
            }).session(session);

            if (!wallet) {
                throw new Error('Ví không tồn tại');
            }

            // Hoàn lại số dư
            wallet.SoDuHienTai += transaction.SoTien;
            wallet.SoDuTamKhoa -= transaction.SoTien;
            
            transaction.TrangThai = 'cancelled';
            transaction.LyDoHuy = reason;
            transaction.NgayHuy = new Date();

            await Promise.all([
                wallet.save({ session }),
                transaction.save({ session })
            ]);

            await session.commitTransaction();
            return {
                wallet,
                transaction
            };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Chuyển tiền giữa các ví
    static async transfer(fromUserId, toUserId, amount, description) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Kiểm tra ví người gửi
            const fromWallet = await ViGiaoDich.findOne({
                ChuSoHuu: fromUserId
            }).session(session);

            if (!fromWallet || fromWallet.SoDuHienTai < amount) {
                throw new Error('Số dư không đủ hoặc ví không tồn tại');
            }

            // Kiểm tra ví người nhận
            const toWallet = await ViGiaoDich.findOne({
                ChuSoHuu: toUserId
            }).session(session);

            if (!toWallet) {
                throw new Error('Ví người nhận không tồn tại');
            }

            // Tạo giao dịch chuyển tiền
            const transaction = new GiaoDich({
                Loai: 'transfer',
                SoTien: amount,
                NguoiThamGia: fromUserId,
                NguoiNhan: toUserId,
                TrangThai: 'success',
                MoTa: description || 'Chuyển tiền',
                NgayHoanThanh: new Date()
            });

            // Cập nhật số dư
            fromWallet.SoDuHienTai -= amount;
            toWallet.SoDuHienTai += amount;

            fromWallet.GiaoDich.push(transaction._id);
            toWallet.GiaoDich.push(transaction._id);

            await Promise.all([
                transaction.save({ session }),
                fromWallet.save({ session }),
                toWallet.save({ session })
            ]);

            await session.commitTransaction();
            return {
                transaction,
                fromWallet,
                toWallet
            };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Lấy lịch sử giao dịch
    static async getTransactionHistory(userId, filters = {}, pagination = {}) {
        const query = { NguoiThamGia: userId };

        // Áp dụng bộ lọc
        if (filters.type) query.Loai = filters.type;
        if (filters.status) query.TrangThai = filters.status;
        if (filters.startDate) query.createdAt = { $gte: new Date(filters.startDate) };
        if (filters.endDate) {
            query.createdAt = {
                ...query.createdAt,
                $lte: new Date(filters.endDate)
            };
        }

        // Phân trang
        const page = pagination.page || 1;
        const limit = pagination.limit || 10;
        const skip = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            GiaoDich.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('NguoiNhan', 'HoTen Email')
                .populate('DichVu', 'TenDichVu')
                .lean(),
            GiaoDich.countDocuments(query)
        ]);

        return {
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // Thống kê giao dịch
    static async getTransactionStats(userId, startDate, endDate) {
        const stats = await GiaoDich.aggregate([
            {
                $match: {
                    $or: [
                        { NguoiThamGia: mongoose.Types.ObjectId(userId) },
                        { NguoiNhan: mongoose.Types.ObjectId(userId) }
                    ],
                    createdAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    },
                    TrangThai: 'success'
                }
            },
            {
                $addFields: {
                    isIncoming: {
                        $cond: [
                            { $eq: ['$NguoiNhan', mongoose.Types.ObjectId(userId)] },
                            true,
                            false
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        type: '$Loai',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        direction: '$isIncoming'
                    },
                    total: { $sum: '$SoTien' },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: {
                        type: '$_id.type',
                        direction: '$_id.direction'
                    },
                    daily: {
                        $push: {
                            date: '$_id.date',
                            total: '$total',
                            count: '$count'
                        }
                    },
                    totalAmount: { $sum: '$total' },
                    totalCount: { $sum: '$count' }
                }
            }
        ]);

        // Định dạng kết quả
        const result = {
            incoming: {},
            outgoing: {}
        };

        stats.forEach(stat => {
            const direction = stat._id.direction ? 'incoming' : 'outgoing';
            result[direction][stat._id.type] = {
                daily: stat.daily,
                total: stat.totalAmount,
                count: stat.totalCount
            };
        });

        return result;
    }
}

module.exports = PaymentService;