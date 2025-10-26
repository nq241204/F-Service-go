// services/ServiceManager.js
const mongoose = require('mongoose');
const DichVu = require('../models/DichVu');
const User = require('../models/User');
const GiaoDich = require('../models/GiaoDich');
const ViGiaoDich = require('../models/ViGiaoDich');
const config = require('../config/app');

class ServiceManager {
    // Tạo dịch vụ mới
    static async createService(serviceData, userId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Validate người tạo
            const user = await User.findById(userId).session(session);
            if (!user) {
                throw new Error('Người dùng không tồn tại');
            }

            // Tạo dịch vụ
            const service = new DichVu({
                TenDichVu: serviceData.tenDichVu,
                MoTa: serviceData.moTa,
                GiaTien: serviceData.giaTien,
                LoaiDichVu: serviceData.loaiDichVu,
                ChuSoHuu: userId,
                TrangThai: 'pending',
                YeuCauThem: serviceData.yeuCauThem || [],
                DieuKhoanDichVu: serviceData.dieuKhoan || []
            });

            // Thêm hình ảnh nếu có
            if (serviceData.hinhAnh && serviceData.hinhAnh.length > 0) {
                service.HinhAnh = serviceData.hinhAnh;
            }

            await service.save({ session });

            // Cập nhật danh sách dịch vụ của user
            user.DichVu = user.DichVu || [];
            user.DichVu.push(service._id);
            await user.save({ session });

            await session.commitTransaction();
            return service;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Cập nhật dịch vụ
    static async updateService(serviceId, updateData, userId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Kiểm tra quyền
            const service = await DichVu.findOne({
                _id: serviceId,
                ChuSoHuu: userId
            }).session(session);

            if (!service) {
                throw new Error('Dịch vụ không tồn tại hoặc không có quyền cập nhật');
            }

            if (service.TrangThai === 'active' && updateData.GiaTien) {
                throw new Error('Không thể thay đổi giá dịch vụ đang hoạt động');
            }

            // Cập nhật thông tin
            Object.assign(service, updateData);
            await service.save({ session });

            await session.commitTransaction();
            return service;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Đăng ký sử dụng dịch vụ
    static async registerService(serviceId, userId, registrationData) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Kiểm tra dịch vụ
            const service = await DichVu.findById(serviceId).session(session);
            if (!service || service.TrangThai !== 'active') {
                throw new Error('Dịch vụ không khả dụng');
            }

            // Kiểm tra số dư
            const userWallet = await ViGiaoDich.findOne({ 
                ChuSoHuu: userId 
            }).session(session);

            if (!userWallet || userWallet.SoDuHienTai < service.GiaTien) {
                throw new Error('Số dư không đủ để đăng ký dịch vụ');
            }

            // Tạo giao dịch
            const transaction = new GiaoDich({
                Loai: 'service_payment',
                SoTien: service.GiaTien,
                NguoiThamGia: userId,
                DichVu: serviceId,
                TrangThai: 'success',
                MoTa: `Đăng ký dịch vụ: ${service.TenDichVu}`
            });

            // Cập nhật số dư
            userWallet.SoDuHienTai -= service.GiaTien;
            userWallet.GiaoDich.push(transaction._id);

            // Cập nhật thông tin dịch vụ
            service.NguoiDung = service.NguoiDung || [];
            service.NguoiDung.push({
                userId,
                dangKyInfo: registrationData,
                trangThai: 'active',
                ngayDangKy: new Date()
            });

            await Promise.all([
                transaction.save({ session }),
                userWallet.save({ session }),
                service.save({ session })
            ]);

            await session.commitTransaction();
            return {
                service,
                transaction
            };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Hủy dịch vụ
    static async cancelService(serviceId, userId, reason) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Kiểm tra dịch vụ
            const service = await DichVu.findById(serviceId).session(session);
            if (!service) {
                throw new Error('Dịch vụ không tồn tại');
            }

            // Kiểm tra quyền
            const isOwner = service.ChuSoHuu.toString() === userId.toString();
            const isUser = service.NguoiDung && service.NguoiDung.some(
                u => u.userId.toString() === userId.toString() && u.trangThai === 'active'
            );

            if (!isOwner && !isUser) {
                throw new Error('Không có quyền hủy dịch vụ');
            }

            if (isOwner) {
                // Chủ dịch vụ hủy
                service.TrangThai = 'cancelled';
                service.LyDoHuy = reason;

                // Hoàn tiền cho người dùng đang sử dụng
                const refunds = await Promise.all(
                    service.NguoiDung
                        .filter(u => u.trangThai === 'active')
                        .map(async (user) => {
                            const userWallet = await ViGiaoDich.findOne({
                                ChuSoHuu: user.userId
                            }).session(session);

                            if (userWallet) {
                                const refundTx = new GiaoDich({
                                    Loai: 'service_refund',
                                    SoTien: service.GiaTien,
                                    NguoiThamGia: user.userId,
                                    DichVu: serviceId,
                                    TrangThai: 'success',
                                    MoTa: `Hoàn tiền dịch vụ: ${service.TenDichVu}`
                                });

                                userWallet.SoDuHienTai += service.GiaTien;
                                userWallet.GiaoDich.push(refundTx._id);

                                return Promise.all([
                                    refundTx.save({ session }),
                                    userWallet.save({ session })
                                ]);
                            }
                        })
                );

                await Promise.all([service.save({ session }), ...refunds]);
            } else {
                // Người dùng hủy
                const userIndex = service.NguoiDung.findIndex(
                    u => u.userId.toString() === userId.toString()
                );
                service.NguoiDung[userIndex].trangThai = 'cancelled';
                service.NguoiDung[userIndex].lyDoHuy = reason;
                service.NguoiDung[userIndex].ngayHuy = new Date();

                await service.save({ session });
            }

            await session.commitTransaction();
            return service;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Lấy thống kê dịch vụ
    static async getServiceStats(serviceId, startDate, endDate) {
        const stats = await GiaoDich.aggregate([
            {
                $match: {
                    DichVu: mongoose.Types.ObjectId(serviceId),
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

        // Lấy thông tin người dùng
        const userStats = await DichVu.findById(serviceId)
            .select('NguoiDung')
            .lean();

        const userCounts = {
            total: 0,
            active: 0,
            cancelled: 0
        };

        if (userStats && userStats.NguoiDung) {
            userStats.NguoiDung.forEach(user => {
                userCounts.total++;
                if (user.trangThai === 'active') userCounts.active++;
                if (user.trangThai === 'cancelled') userCounts.cancelled++;
            });
        }

        return {
            transactions: stats.reduce((acc, stat) => {
                acc[stat._id] = {
                    daily: stat.daily,
                    total: stat.totalAmount,
                    count: stat.totalCount
                };
                return acc;
            }, {}),
            users: userCounts
        };
    }
}