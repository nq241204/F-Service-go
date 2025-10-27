// controllers/userController.js
const User = require('../models/User');
const ViGiaoDich = require('../models/ViGiaoDich');
const DichVu = require('../models/DichVu');
const GiaoDich = require('../models/GiaoDich');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const moment = require('moment');

// --- Helper Functions ---

// Lấy thông tin ví và số dư
const getWalletInfo = async (userId) => {
    const user = await User.findById(userId)
        .select('ViGiaoDich HoTen Email')
        .lean();

    if (!user || !user.ViGiaoDich) {
        throw new Error('Không tìm thấy thông tin ví');
    }

    const wallet = await ViGiaoDich.findById(user.ViGiaoDich)
        .populate({
            path: 'GiaoDich',
            options: { sort: { createdAt: -1 }, limit: 10 }
        })
        .lean();

    if (!wallet) {
        throw new Error('Không tìm thấy ví');
    }

    // Tính toán thống kê
    const stats = {
        totalDeposit: 0,
        totalWithdraw: 0,
        totalCommission: 0,
        pendingTransactions: 0
    };

    if (wallet.GiaoDich && wallet.GiaoDich.length > 0) {
        wallet.GiaoDich.forEach(tx => {
            if (tx.TrangThai === 'success') {
                switch (tx.Loai) {
                    case 'deposit':
                        stats.totalDeposit += tx.SoTien;
                        break;
                    case 'withdraw':
                        stats.totalWithdraw += tx.SoTien;
                        break;
                    case 'commission_payment':
                        stats.totalCommission += tx.SoTien;
                        break;
                }
            } else if (tx.TrangThai === 'pending') {
                stats.pendingTransactions++;
            }
        });
    }

    return {
        user,
        wallet,
        stats
    };
};

// --- Web Render Controllers ---

// @desc    Render trang Dashboard User
// @route   GET /user/dashboard
exports.renderDashboard = async (req, res) => {
    try {
        const userId = req.user._id;

        // Lấy thông tin ví và thống kê
        const { wallet, stats } = await getWalletInfo(userId);

        // Lấy danh sách dịch vụ và thống kê
        const [services, serviceStats] = await Promise.all([
            DichVu.find({ ChuSoHuu: userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            DichVu.aggregate([
                { $match: { ChuSoHuu: mongoose.Types.ObjectId(userId) } },
                {
                    $group: {
                        _id: '$TrangThai',
                        count: { $sum: 1 },
                        totalValue: { $sum: '$GiaTri' }
                    }
                }
            ])
        ]);

        // Xử lý thống kê dịch vụ
        const processedStats = serviceStats.reduce((acc, stat) => {
            acc[stat._id] = {
                count: stat.count,
                value: stat.totalValue
            };
            return acc;
        }, {
            pending: { count: 0, value: 0 },
            active: { count: 0, value: 0 },
            completed: { count: 0, value: 0 },
            cancelled: { count: 0, value: 0 }
        });

        // Lấy các giao dịch gần đây
        const recentTransactions = await GiaoDich.find({ 
            NguoiThamGia: userId 
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('DichVu', 'TenDichVu')
        .lean();

        res.render('user/dashboard', {
            title: 'Trang Chủ',
            wallet,
            stats,
            services,
            serviceStats: processedStats,
            recentTransactions,
            moment,
            helpers: {
                formatCurrency: (amount) => {
                    return new Intl.NumberFormat('vi-VN', { 
                        style: 'currency', 
                        currency: 'VND' 
                    }).format(amount);
                }
            }
        });
    } catch (error) {
        console.error("Lỗi khi render Dashboard:", error);
        req.flash('error_msg', 'Không thể tải dữ liệu. Vui lòng thử lại sau.');
        res.redirect('/');
    }
};

// @desc    Render trang Ví giao dịch
// @route   GET /user/wallet
exports.renderWallet = async (req, res) => {
    try {
        const userId = req.user._id;
        const { wallet, stats } = await getWalletInfo(userId);

        // Lấy lịch sử giao dịch chi tiết
        const transactions = await GiaoDich.find({ 
            NguoiThamGia: userId 
        })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('DichVu', 'TenDichVu')
        .lean();

        // Phân loại giao dịch
        const categorizedTransactions = {
            deposits: transactions.filter(tx => tx.Loai === 'deposit'),
            withdrawals: transactions.filter(tx => tx.Loai === 'withdraw'),
            payments: transactions.filter(tx => tx.Loai === 'service_payment'),
            commissions: transactions.filter(tx => tx.Loai === 'commission_payment')
        };

        // Tính toán thống kê theo thời gian (7 ngày gần nhất)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
            return {
                date,
                deposits: 0,
                withdrawals: 0,
                commissions: 0
            };
        }).reverse();

        transactions.forEach(tx => {
            const txDate = moment(tx.createdAt).format('YYYY-MM-DD');
            const dayStats = last7Days.find(day => day.date === txDate);
            if (dayStats && tx.TrangThai === 'success') {
                switch (tx.Loai) {
                    case 'deposit':
                        dayStats.deposits += tx.SoTien;
                        break;
                    case 'withdraw':
                        dayStats.withdrawals += tx.SoTien;
                        break;
                    case 'commission_payment':
                        dayStats.commissions += tx.SoTien;
                        break;
                }
            }
        });

        res.render('user/wallet', {
            title: 'Ví Điện Tử',
            wallet,
            stats,
            transactions: categorizedTransactions,
            chartData: last7Days,
            moment,
            helpers: {
                formatCurrency: (amount) => {
                    return new Intl.NumberFormat('vi-VN', { 
                        style: 'currency', 
                        currency: 'VND' 
                    }).format(amount);
                },
                getStatusClass: (status) => {
                    return {
                        'success': 'bg-green-100 text-green-800',
                        'pending': 'bg-yellow-100 text-yellow-800',
                        'failed': 'bg-red-100 text-red-800'
                    }[status] || 'bg-gray-100 text-gray-800';
                }
            }
        });
    } catch (error) {
        console.error("Lỗi khi render Ví:", error);
        req.flash('error_msg', 'Không thể tải thông tin ví. Vui lòng thử lại sau.');
        res.redirect('/user/dashboard');
    }
};

// @desc    Render trang Danh sách Ủy thác
// @route   GET /user/commissions
exports.renderMyCommissions = async (req, res) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const search = req.query.search;

        // Xây dựng query
        let query = { ChuSoHuu: userId };
        if (status && status !== 'all') {
            query.TrangThai = status;
        }
        if (search) {
            query.$or = [
                { TenDichVu: { $regex: search, $options: 'i' } },
                { MoTa: { $regex: search, $options: 'i' } }
            ];
        }

        // Thực hiện truy vấn với pagination
        const [services, totalDocs] = await Promise.all([
            DichVu.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('NguoiThucHien', 'HoTen Avatar')
                .lean(),
            DichVu.countDocuments(query)
        ]);

        // Tính toán thống kê
        const stats = await DichVu.aggregate([
            { $match: { ChuSoHuu: mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: '$TrangThai',
                    count: { $sum: 1 },
                    totalValue: { $sum: '$GiaTri' }
                }
            }
        ]);

        // Xử lý phân trang
        const totalPages = Math.ceil(totalDocs / limit);
        const pagination = {
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            totalDocs
        };

        // Thêm thông tin phụ cho mỗi dịch vụ
        const enrichedServices = await Promise.all(services.map(async service => {
            const transactions = await GiaoDich.find({
                DichVu: service._id
            }).sort({ createdAt: -1 }).limit(1).lean();

            return {
                ...service,
                lastTransaction: transactions[0] || null,
                statusInfo: {
                    label: {
                        'pending': 'Đang chờ',
                        'active': 'Đang thực hiện',
                        'completed': 'Hoàn thành',
                        'cancelled': 'Đã hủy'
                    }[service.TrangThai],
                    class: {
                        'pending': 'bg-yellow-100 text-yellow-800',
                        'active': 'bg-blue-100 text-blue-800',
                        'completed': 'bg-green-100 text-green-800',
                        'cancelled': 'bg-red-100 text-red-800'
                    }[service.TrangThai]
                }
            };
        }));

        res.render('user/commissions', {
            title: 'Dịch Vụ Của Tôi',
            services: enrichedServices,
            stats: stats.reduce((acc, stat) => {
                acc[stat._id] = stat;
                return acc;
            }, {}),
            filters: {
                status,
                search
            },
            pagination,
            moment,
            helpers: {
                formatCurrency: (amount) => {
                    return new Intl.NumberFormat('vi-VN', { 
                        style: 'currency', 
                        currency: 'VND' 
                    }).format(amount);
                }
            }
        });
    } catch (error) {
        console.error("Lỗi khi render Danh sách Dịch vụ:", error);
        req.flash('error_msg', 'Không thể tải danh sách dịch vụ. Vui lòng thử lại sau.');
        res.redirect('/user/dashboard');
    }
};


// --- API Controllers ---

// @desc    Lấy thông tin profile
// @route   GET /api/user/profile
exports.getProfile = async (req, res) => {
    try {
        const { user, wallet, stats } = await getWalletInfo(req.user._id);
        
        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    HoTen: user.HoTen,
                    Email: user.Email,
                    Avatar: user.Avatar
                },
                wallet: {
                    balance: wallet.SoDuHienTai,
                    formattedBalance: new Intl.NumberFormat('vi-VN', { 
                        style: 'currency', 
                        currency: 'VND' 
                    }).format(wallet.SoDuHienTai)
                },
                stats
            }
        });
    } catch (error) {
        console.error('Lỗi getProfile:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Lỗi server khi lấy thông tin profile.' 
        });
    }
};

// @desc    Cập nhật thông tin profile
// @route   PUT /api/user/profile
exports.updateProfile = async (req, res) => {
    try {
        const updates = {};
        const allowedUpdates = ['HoTen', 'SoDienThoai', 'DiaChi'];
        
        // Kiểm tra và lọc các trường được phép cập nhật
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updates[key] = req.body[key];
            }
        });

        // Validate dữ liệu
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        // Cập nhật user
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-MatKhau');

        res.json({
            success: true,
            message: 'Cập nhật thông tin thành công.',
            data: updatedUser
        });
    } catch (error) {
        console.error('Lỗi updateProfile:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi khi cập nhật thông tin.'
        });
    }
};

// @desc    Lấy lịch sử giao dịch
// @route   GET /api/user/transactions
exports.getTransactionHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type; // deposit, withdraw, service_payment, commission_payment
        const status = req.query.status; // success, pending, failed
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        // Xây dựng query
        let query = { NguoiThamGia: req.user._id };
        if (type) query.Loai = type;
        if (status) query.TrangThai = status;
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Thực hiện truy vấn với pagination
        const [transactions, totalDocs] = await Promise.all([
            GiaoDich.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('DichVu', 'TenDichVu')
                .lean(),
            GiaoDich.countDocuments(query)
        ]);

        // Format dữ liệu trả về
        const formattedTransactions = transactions.map(tx => ({
            ...tx,
            formattedAmount: new Intl.NumberFormat('vi-VN', { 
                style: 'currency', 
                currency: 'VND' 
            }).format(tx.SoTien),
            formattedDate: moment(tx.createdAt).format('DD/MM/YYYY HH:mm')
        }));

        res.json({
            success: true,
            data: {
                transactions: formattedTransactions,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalDocs / limit),
                    totalDocs,
                    hasNextPage: page < Math.ceil(totalDocs / limit),
                    hasPrevPage: page > 1
                }
            }
        });
    } catch (error) {
        console.error('Lỗi getTransactionHistory:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi khi lấy lịch sử giao dịch.'
        });
    }
};

// @desc    Lấy thông tin thống kê
// @route   GET /api/user/stats
exports.getStats = async (req, res) => {
    try {
        const { stats } = await getWalletInfo(req.user._id);

        // Lấy thống kê theo thời gian (30 ngày gần nhất)
        const timeStats = await GiaoDich.aggregate([
            {
                $match: {
                    NguoiThamGia: mongoose.Types.ObjectId(req.user._id),
                    createdAt: { 
                        $gte: moment().subtract(30, 'days').toDate() 
                    },
                    TrangThai: 'success'
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        type: "$Loai"
                    },
                    total: { $sum: "$SoTien" }
                }
            },
            {
                $sort: { "_id.date": 1 }
            }
        ]);

        res.json({
            success: true,
            data: {
                overview: stats,
                timeStats: timeStats.reduce((acc, stat) => {
                    const { date, type } = stat._id;
                    if (!acc[date]) acc[date] = {};
                    acc[date][type] = stat.total;
                    return acc;
                }, {})
            }
        });
    } catch (error) {
        console.error('Lỗi getStats:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi khi lấy thống kê.'
        });
    }
};