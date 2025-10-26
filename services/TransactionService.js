// services/TransactionService.js
const mongoose = require('mongoose');
const GiaoDich = require('../models/GiaoDich');
const ViGiaoDich = require('../models/ViGiaoDich');
const DichVu = require('../models/DichVu');
const config = require('../config/app');

class TransactionService {
    // Khởi tạo giao dịch nạp tiền
    static async initializeDeposit(userId, amount) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Validate số tiền nạp
            if (amount < config.payment.minimumDeposit) {
                throw new Error(`Số tiền nạp tối thiểu là ${config.payment.minimumDeposit.toLocaleString()}đ`);
            }

            // Tìm ví của user
            const wallet = await ViGiaoDich.findOne({ ChuSoHuu: userId }).session(session);
            if (!wallet) {
                throw new Error('Không tìm thấy ví');
            }

            // Tạo giao dịch
            const transaction = new GiaoDich({
                Loai: 'deposit',
                SoTien: amount,
                NguoiThamGia: userId,
                TrangThai: 'pending',
                MoTa: `Nạp ${amount.toLocaleString('vi-VN')}đ vào ví`
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

    // Xử lý hoàn thành giao dịch nạp tiền
    static async completeDeposit(transactionId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const transaction = await GiaoDich.findById(transactionId).session(session);
            if (!transaction || transaction.Loai !== 'deposit') {
                throw new Error('Giao dịch không hợp lệ');
            }

            if (transaction.TrangThai !== 'pending') {
                throw new Error('Giao dịch đã được xử lý');
            }

            const wallet = await ViGiaoDich.findOne({ 
                ChuSoHuu: transaction.NguoiThamGia 
            }).session(session);

            if (!wallet) {
                throw new Error('Không tìm thấy ví');
            }

            // Cập nhật số dư
            wallet.SoDuHienTai += transaction.SoTien;
            transaction.TrangThai = 'success';
            transaction.NgayHoanThanh = new Date();

            await Promise.all([
                wallet.save({ session }),
                transaction.save({ session })
            ]);

            await session.commitTransaction();
            return { wallet, transaction };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Xử lý rút tiền
    static async processWithdrawal(userId, amount) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Validate số tiền rút
            if (amount < config.payment.minimumWithdraw) {
                throw new Error(`Số tiền rút tối thiểu là ${config.payment.minimumWithdraw.toLocaleString()}đ`);
            }

            // Kiểm tra ví và số dư
            const wallet = await ViGiaoDich.findOne({ ChuSoHuu: userId }).session(session);
            if (!wallet) {
                throw new Error('Không tìm thấy ví');
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
                MoTa: `Rút ${amount.toLocaleString('vi-VN')}đ từ ví`
            });

            // Tạm giữ số tiền
            wallet.SoDuHienTai -= amount;
            wallet.GiaoDich.push(transaction._id);

            await Promise.all([
                transaction.save({ session }),
                wallet.save({ session })
            ]);

            await session.commitTransaction();
            return { wallet, transaction };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Xử lý thanh toán dịch vụ
    static async processServicePayment(userId, serviceId, amount) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Kiểm tra dịch vụ
            const service = await DichVu.findById(serviceId).session(session);
            if (!service) {
                throw new Error('Dịch vụ không tồn tại');
            }

            if (service.TrangThai !== 'active') {
                throw new Error('Dịch vụ không khả dụng');
            }

            // Kiểm tra ví và số dư
            const wallet = await ViGiaoDich.findOne({ ChuSoHuu: userId }).session(session);
            if (!wallet) {
                throw new Error('Không tìm thấy ví');
            }

            if (wallet.SoDuHienTai < amount) {
                throw new Error('Số dư không đủ');
            }

            // Tính phí hoa hồng
            const commissionAmount = Math.max(
                amount * config.payment.commission.rate,
                config.payment.commission.minimum
            );

            // Tạo giao dịch thanh toán
            const paymentTx = new GiaoDich({
                Loai: 'service_payment',
                SoTien: amount,
                NguoiThamGia: userId,
                DichVu: serviceId,
                TrangThai: 'success',
                MoTa: `Thanh toán dịch vụ: ${service.TenDichVu}`
            });

            // Tạo giao dịch hoa hồng
            const commissionTx = new GiaoDich({
                Loai: 'commission_payment',
                SoTien: commissionAmount,
                NguoiThamGia: service.ChuSoHuu,
                DichVu: serviceId,
                TrangThai: 'success',
                MoTa: `Nhận hoa hồng từ dịch vụ: ${service.TenDichVu}`
            });

            // Cập nhật ví người thanh toán
            wallet.SoDuHienTai -= amount;
            wallet.GiaoDich.push(paymentTx._id);

            // Cập nhật ví chủ dịch vụ
            const ownerWallet = await ViGiaoDich.findOne({ 
                ChuSoHuu: service.ChuSoHuu 
            }).session(session);
            
            if (!ownerWallet) {
                throw new Error('Không tìm thấy ví chủ dịch vụ');
            }

            ownerWallet.SoDuHienTai += commissionAmount;
            ownerWallet.GiaoDich.push(commissionTx._id);

            // Lưu tất cả thay đổi
            await Promise.all([
                paymentTx.save({ session }),
                commissionTx.save({ session }),
                wallet.save({ session }),
                ownerWallet.save({ session })
            ]);

            await session.commitTransaction();
            return { 
                payment: paymentTx, 
                commission: commissionTx,
                userWallet: wallet,
                ownerWallet
            };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Tính toán thống kê giao dịch
    static async getTransactionStats(userId, startDate, endDate) {
        const stats = await GiaoDich.aggregate([
            {
                $match: {
                    NguoiThamGia: mongoose.Types.ObjectId(userId),
                    createdAt: {
                        $gte: startDate,
                        $lte: endDate
                    },
                    TrangThai: 'success'
                }
            },
            {
                $group: {
                    _id: {
                        type: '$Loai',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    },
                    total: { $sum: '$SoTien' },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: '$_id.type',
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

        return stats.reduce((acc, stat) => {
            acc[stat._id] = {
                daily: stat.daily,
                total: stat.totalAmount,
                count: stat.totalCount
            };
            return acc;
        }, {});
    }
}