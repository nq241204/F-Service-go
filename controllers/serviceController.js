// controllers/serviceController.js
const { body, validationResult } = require('express-validator');
const ServiceManager = require('../services/ServiceManager');
const PaymentService = require('../services/PaymentService');
const NotificationService = require('../services/NotificationService');
const mongoose = require('mongoose');
const DichVu = require('../models/DichVu');

// @desc    Tạo dịch vụ mới
// @route   POST /service/create
exports.createService = [
    body('tenDichVu').trim().notEmpty().withMessage('Tên dịch vụ là bắt buộc.'),
    body('giaTien').isInt({ min: 0 }).withMessage('Giá tiền phải là số không âm.'),
    body('loaiDichVu').notEmpty().withMessage('Loại dịch vụ là bắt buộc.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.accepts('json')) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }
            req.flash('error', errors.array().map(err => err.msg).join(', '));
            return res.redirect('/service/create');
        }

        try {
            const service = await ServiceManager.createService(req.body, req.user._id);
            await NotificationService.createServiceNotification(service, 'created');

            if (req.accepts('json')) {
                res.status(201).json({
                    success: true,
                    message: 'Dịch vụ đã được tạo.',
                    data: service
                });
            } else {
                req.flash('success', 'Dịch vụ đã được tạo và đang chờ duyệt.');
                res.redirect('/service/list');
            }
        } catch (error) {
            console.error('Lỗi tạo dịch vụ:', error);
            if (req.accepts('json')) {
                res.status(500).json({
                    success: false,
                    message: error.message || 'Lỗi khi tạo dịch vụ.'
                });
            } else {
                req.flash('error', error.message || 'Lỗi khi tạo dịch vụ.');
                res.redirect('/service/create');
            }
        }
    }
];

// @desc    Cập nhật dịch vụ
// @route   PUT /service/:id
exports.updateService = [
    body('giaTien').optional().isInt({ min: 0 }).withMessage('Giá tiền phải là số không âm.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        try {
            const service = await ServiceManager.updateService(
                req.params.id,
                req.body,
                req.user._id
            );

            res.json({
                success: true,
                message: 'Dịch vụ đã được cập nhật.',
                data: service
            });
        } catch (error) {
            console.error('Lỗi cập nhật dịch vụ:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Lỗi khi cập nhật dịch vụ.'
            });
        }
    }
];

// @desc    Đăng ký sử dụng dịch vụ
// @route   POST /service/:id/register
exports.registerService = [
    body('registrationData').notEmpty().withMessage('Thông tin đăng ký là bắt buộc.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Đăng ký dịch vụ
            const result = await ServiceManager.registerService(
                req.params.id,
                req.user._id,
                req.body.registrationData
            );

            // Tạo thông báo
            await NotificationService.createServiceNotification(
                result.service,
                'registered',
                req.user._id
            );

            await session.commitTransaction();

            if (req.accepts('json')) {
                res.json({
                    success: true,
                    message: 'Đăng ký dịch vụ thành công.',
                    data: result
                });
            } else {
                req.flash('success', 'Đăng ký dịch vụ thành công.');
                res.redirect('/service/my-services');
            }
        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi đăng ký dịch vụ:', error);
            if (req.accepts('json')) {
                res.status(400).json({
                    success: false,
                    message: error.message || 'Lỗi khi đăng ký dịch vụ.'
                });
            } else {
                req.flash('error', error.message || 'Lỗi khi đăng ký dịch vụ.');
                res.redirect(`/service/${req.params.id}`);
            }
        } finally {
            session.endSession();
        }
    }
];

// @desc    Hủy dịch vụ
// @route   POST /service/:id/cancel
exports.cancelService = [
    body('reason').notEmpty().withMessage('Lý do hủy là bắt buộc.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Hủy dịch vụ
            const service = await ServiceManager.cancelService(
                req.params.id,
                req.user._id,
                req.body.reason
            );

            // Tạo thông báo
            await NotificationService.createServiceNotification(
                service,
                'cancelled',
                req.user._id
            );

            await session.commitTransaction();

            if (req.accepts('json')) {
                res.json({
                    success: true,
                    message: 'Hủy dịch vụ thành công.',
                    data: service
                });
            } else {
                req.flash('success', 'Hủy dịch vụ thành công.');
                res.redirect('/service/my-services');
            }
        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi hủy dịch vụ:', error);
            if (req.accepts('json')) {
                res.status(400).json({
                    success: false,
                    message: error.message || 'Lỗi khi hủy dịch vụ.'
                });
            } else {
                req.flash('error', error.message || 'Lỗi khi hủy dịch vụ.');
                res.redirect(`/service/${req.params.id}`);
            }
        } finally {
            session.endSession();
        }
    }
];

// @desc    Lấy danh sách dịch vụ 
// @route   GET /service/list
exports.getServices = async (req, res) => {
    try {
        // Lấy tham số phân trang và lọc
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const category = req.query.category;
        const status = req.query.status || 'active';
        const sort = req.query.sort || '-createdAt';

        // Xây dựng query
        const query = {
            TrangThai: status
        };

        // Thêm điều kiện tìm kiếm
        if (search) {
            query.$or = [
                { TenDichVu: { $regex: search, $options: 'i' } },
                { MoTa: { $regex: search, $options: 'i' } }
            ];
        }

        // Thêm điều kiện lọc theo danh mục
        if (category) {
            query.LoaiDichVu = category;
        }

        // Tính toán skip
        const skip = (page - 1) * limit;

        // Thực hiện query
        const [services, total] = await Promise.all([
            DichVu.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate('ChuSoHuu', 'HoTen Avatar')
                .lean(),
            DichVu.countDocuments(query)
        ]);

        // Tính toán tổng số trang
        const totalPages = Math.ceil(total / limit);

        // Thêm thông tin bổ sung cho mỗi dịch vụ
        const enrichedServices = services.map(service => ({
            ...service,
            statusInfo: {
                label: {
                    'pending': 'Đang chờ duyệt',
                    'active': 'Đang hoạt động',
                    'cancelled': 'Đã hủy'
                }[service.TrangThai],
                class: {
                    'pending': 'bg-yellow-100 text-yellow-800',
                    'active': 'bg-green-100 text-green-800',
                    'cancelled': 'bg-red-100 text-red-800'
                }[service.TrangThai]
            }
        }));

        if (req.accepts('json')) {
            res.json({
                success: true,
                data: {
                    services: enrichedServices,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages
                    }
                }
            });
        } else {
            res.render('service/list', {
                title: 'Danh Sách Dịch Vụ',
                services: enrichedServices,
                filters: {
                    search,
                    category,
                    status
                },
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                user: req.user
            });
        }
    } catch (error) {
        console.error('Lỗi lấy danh sách dịch vụ:', error);
        if (req.accepts('json')) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi tải danh sách dịch vụ.'
            });
        } else {
            req.flash('error', 'Lỗi khi tải danh sách dịch vụ.');
            res.redirect('/');
        }
    }
};

// @desc    Lấy chi tiết dịch vụ
// @route   GET /service/:id
exports.getService = async (req, res) => {
    try {
        const service = await DichVu.findById(req.params.id)
            .populate('ChuSoHuu', 'HoTen Avatar Email')
            .lean();

        if (!service) {
            if (req.accepts('json')) {
                return res.status(404).json({
                    success: false,
                    message: 'Dịch vụ không tồn tại.'
                });
            }
            req.flash('error', 'Dịch vụ không tồn tại.');
            return res.redirect('/service/list');
        }

        // Lấy thông tin bổ sung
        const isOwner = service.ChuSoHuu._id.toString() === req.user._id.toString();
        const isRegistered = service.NguoiDung && service.NguoiDung.some(
            u => u.userId.toString() === req.user._id.toString() && u.trangThai === 'active'
        );

        // Thêm thông tin trạng thái
        service.statusInfo = {
            label: {
                'pending': 'Đang chờ duyệt',
                'active': 'Đang hoạt động',
                'cancelled': 'Đã hủy'
            }[service.TrangThai],
            class: {
                'pending': 'bg-yellow-100 text-yellow-800',
                'active': 'bg-green-100 text-green-800',
                'cancelled': 'bg-red-100 text-red-800'
            }[service.TrangThai]
        };

        if (req.accepts('json')) {
            res.json({
                success: true,
                data: {
                    ...service,
                    isOwner,
                    isRegistered
                }
            });
        } else {
            res.render('service/detail', {
                title: service.TenDichVu,
                service,
                isOwner,
                isRegistered,
                user: req.user
            });
        }
    } catch (error) {
        console.error('Lỗi lấy chi tiết dịch vụ:', error);
        if (req.accepts('json')) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi tải thông tin dịch vụ.'
            });
        } else {
            req.flash('error', 'Lỗi khi tải thông tin dịch vụ.');
            res.redirect('/service/list');
        }
    }
};

// @desc    Lấy danh sách dịch vụ của user
// @route   GET /service/my-services
exports.getMyServices = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const sort = req.query.sort || '-createdAt';

        // Xây dựng query
        const query = {
            $or: [
                { ChuSoHuu: req.user._id },
                { 'NguoiDung.userId': req.user._id }
            ]
        };

        if (status) {
            query.TrangThai = status;
        }

        const skip = (page - 1) * limit;

        // Thực hiện query
        const [services, total] = await Promise.all([
            DichVu.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate('ChuSoHuu', 'HoTen Avatar')
                .lean(),
            DichVu.countDocuments(query)
        ]);

        // Tính toán tổng số trang
        const totalPages = Math.ceil(total / limit);

        // Thêm thông tin bổ sung cho mỗi dịch vụ
        const enrichedServices = services.map(service => {
            const isOwner = service.ChuSoHuu._id.toString() === req.user._id.toString();
            const userService = service.NguoiDung && service.NguoiDung.find(
                u => u.userId.toString() === req.user._id.toString()
            );

            return {
                ...service,
                isOwner,
                userStatus: userService ? userService.trangThai : null,
                statusInfo: {
                    label: {
                        'pending': 'Đang chờ duyệt',
                        'active': 'Đang hoạt động',
                        'cancelled': 'Đã hủy'
                    }[service.TrangThai],
                    class: {
                        'pending': 'bg-yellow-100 text-yellow-800',
                        'active': 'bg-green-100 text-green-800',
                        'cancelled': 'bg-red-100 text-red-800'
                    }[service.TrangThai]
                }
            };
        });

        if (req.accepts('json')) {
            res.json({
                success: true,
                data: {
                    services: enrichedServices,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages
                    }
                }
            });
        } else {
            // Lấy thống kê
            const stats = await ServiceManager.getServiceStats(
                req.user._id,
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 ngày trước
                new Date()
            );

            res.render('service/my-services', {
                title: 'Dịch Vụ Của Tôi',
                services: enrichedServices,
                stats,
                filters: { status },
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                user: req.user
            });
        }
    } catch (error) {
        console.error('Lỗi lấy danh sách dịch vụ của user:', error);
        if (req.accepts('json')) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi tải danh sách dịch vụ.'
            });
        } else {
            req.flash('error', 'Lỗi khi tải danh sách dịch vụ.');
            res.redirect('/user/dashboard');
        }
    }
};