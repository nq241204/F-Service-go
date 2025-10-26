// services/NotificationService.js
const mongoose = require('mongoose');
const User = require('../models/User');

class NotificationService {
    // Gửi thông báo
    static async sendNotification(userId, notification) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const user = await User.findById(userId).session(session);
            if (!user) {
                throw new Error('Người dùng không tồn tại');
            }

            // Thêm thông báo mới
            user.ThongBao = user.ThongBao || [];
            user.ThongBao.unshift({
                TieuDe: notification.title,
                NoiDung: notification.content,
                Loai: notification.type,
                DuLieu: notification.data,
                TrangThai: 'unread',
                ThoiGian: new Date()
            });

            // Giới hạn số lượng thông báo
            if (user.ThongBao.length > 100) {
                user.ThongBao = user.ThongBao.slice(0, 100);
            }

            await user.save({ session });
            await session.commitTransaction();

            return user.ThongBao[0];
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Đánh dấu đã đọc thông báo
    static async markAsRead(userId, notificationIds) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const user = await User.findById(userId).session(session);
            if (!user) {
                throw new Error('Người dùng không tồn tại');
            }

            // Cập nhật trạng thái thông báo
            user.ThongBao.forEach(notification => {
                if (notificationIds.includes(notification._id.toString())) {
                    notification.TrangThai = 'read';
                    notification.NgayDoc = new Date();
                }
            });

            await user.save({ session });
            await session.commitTransaction();

            return user.ThongBao;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Xóa thông báo
    static async deleteNotifications(userId, notificationIds) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const user = await User.findById(userId).session(session);
            if (!user) {
                throw new Error('Người dùng không tồn tại');
            }

            // Xóa thông báo
            user.ThongBao = user.ThongBao.filter(
                notification => !notificationIds.includes(notification._id.toString())
            );

            await user.save({ session });
            await session.commitTransaction();

            return user.ThongBao;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Lấy danh sách thông báo
    static async getNotifications(userId, filters = {}, pagination = {}) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('Người dùng không tồn tại');
        }

        let notifications = user.ThongBao || [];

        // Áp dụng bộ lọc
        if (filters.type) {
            notifications = notifications.filter(n => n.Loai === filters.type);
        }
        if (filters.status) {
            notifications = notifications.filter(n => n.TrangThai === filters.status);
        }

        // Phân trang
        const page = pagination.page || 1;
        const limit = pagination.limit || 10;
        const start = (page - 1) * limit;
        const end = start + limit;

        return {
            notifications: notifications.slice(start, end),
            pagination: {
                page,
                limit,
                total: notifications.length,
                totalPages: Math.ceil(notifications.length / limit)
            },
            unreadCount: notifications.filter(n => n.TrangThai === 'unread').length
        };
    }

    // Tạo thông báo cho giao dịch
    static async createTransactionNotification(transaction) {
        let title = '';
        let content = '';
        const amount = transaction.SoTien.toLocaleString('vi-VN');

        switch (transaction.Loai) {
            case 'deposit':
                title = 'Nạp tiền thành công';
                content = `Bạn đã nạp ${amount}đ vào ví`;
                break;
            case 'withdraw':
                title = 'Rút tiền thành công';
                content = `Bạn đã rút ${amount}đ từ ví`;
                break;
            case 'transfer':
                if (transaction.NguoiNhan) {
                    // Thông báo cho người gửi
                    await NotificationService.sendNotification(
                        transaction.NguoiThamGia,
                        {
                            title: 'Chuyển tiền thành công',
                            content: `Bạn đã chuyển ${amount}đ`,
                            type: 'transaction',
                            data: { transactionId: transaction._id }
                        }
                    );

                    // Thông báo cho người nhận
                    await NotificationService.sendNotification(
                        transaction.NguoiNhan,
                        {
                            title: 'Nhận tiền thành công',
                            content: `Bạn đã nhận ${amount}đ`,
                            type: 'transaction',
                            data: { transactionId: transaction._id }
                        }
                    );
                    return;
                }
                break;
            case 'service_payment':
                title = 'Thanh toán dịch vụ';
                content = `Bạn đã thanh toán ${amount}đ cho dịch vụ`;
                break;
            default:
                return;
        }

        if (title && content) {
            await NotificationService.sendNotification(
                transaction.NguoiThamGia,
                {
                    title,
                    content,
                    type: 'transaction',
                    data: { transactionId: transaction._id }
                }
            );
        }
    }

    // Tạo thông báo cho dịch vụ
    static async createServiceNotification(service, action, userId) {
        const notifications = [];

        switch (action) {
            case 'created':
                // Thông báo cho admin
                notifications.push({
                    userId: 'admin', // ID của admin
                    title: 'Dịch vụ mới cần duyệt',
                    content: `Dịch vụ "${service.TenDichVu}" đang chờ duyệt`,
                    type: 'service_admin',
                    data: { serviceId: service._id }
                });
                break;

            case 'approved':
                // Thông báo cho chủ dịch vụ
                notifications.push({
                    userId: service.ChuSoHuu,
                    title: 'Dịch vụ được duyệt',
                    content: `Dịch vụ "${service.TenDichVu}" đã được duyệt`,
                    type: 'service_owner',
                    data: { serviceId: service._id }
                });
                break;

            case 'rejected':
                // Thông báo cho chủ dịch vụ
                notifications.push({
                    userId: service.ChuSoHuu,
                    title: 'Dịch vụ bị từ chối',
                    content: `Dịch vụ "${service.TenDichVu}" đã bị từ chối`,
                    type: 'service_owner',
                    data: { serviceId: service._id }
                });
                break;

            case 'registered':
                // Thông báo cho chủ dịch vụ
                notifications.push({
                    userId: service.ChuSoHuu,
                    title: 'Có người đăng ký dịch vụ',
                    content: `Có người dùng mới đăng ký dịch vụ "${service.TenDichVu}"`,
                    type: 'service_owner',
                    data: { serviceId: service._id, userId }
                });
                break;

            case 'cancelled':
                if (userId === service.ChuSoHuu.toString()) {
                    // Chủ dịch vụ hủy - thông báo cho người dùng
                    service.NguoiDung
                        .filter(u => u.trangThai === 'active')
                        .forEach(user => {
                            notifications.push({
                                userId: user.userId,
                                title: 'Dịch vụ bị hủy',
                                content: `Dịch vụ "${service.TenDichVu}" đã bị hủy bởi chủ dịch vụ`,
                                type: 'service_user',
                                data: { serviceId: service._id }
                            });
                        });
                } else {
                    // Người dùng hủy - thông báo cho chủ dịch vụ
                    notifications.push({
                        userId: service.ChuSoHuu,
                        title: 'Người dùng hủy dịch vụ',
                        content: `Có người dùng đã hủy đăng ký dịch vụ "${service.TenDichVu}"`,
                        type: 'service_owner',
                        data: { serviceId: service._id, userId }
                    });
                }
                break;
        }

        // Gửi tất cả thông báo
        await Promise.all(
            notifications.map(notification =>
                NotificationService.sendNotification(
                    notification.userId,
                    {
                        title: notification.title,
                        content: notification.content,
                        type: notification.type,
                        data: notification.data
                    }
                )
            )
        );
    }
}

module.exports = NotificationService;