// controllers/transactionController.js
const mongoose = require('mongoose');
const ViGiaoDich = require('../models/ViGiaoDich');
const GiaoDich = require('../models/GiaoDich');
const DichVu = require('../models/DichVu');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Constants
const SERVICE_FEE_RATE = 0.10; // 10% phí dịch vụ
const MIN_WITHDRAW = 100000;    // Số tiền rút tối thiểu
const MAX_WITHDRAW = 50000000;  // Số tiền rút tối đa
const DEPOSIT_METHODS = ['banking', 'momo', 'zalopay']; // Phương thức nạp tiền

// @desc    Thực hiện thanh toán ủy thác khi Member hoàn thành
// @route   POST /api/member/commission/settle/:serviceId (API sẽ gọi sau này)
const settleCommissionPayment = async (req, res, next) => {
    // Lưu ý: Hàm này thường chỉ được gọi bởi Admin hoặc sau khi User xác nhận hoàn thành,
    // nhưng để hoàn thiện hệ thống, chúng ta đặt logic ở đây.

    const { serviceId } = req.params;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Tìm và khóa Ủy thác (Service)
        const dichVu = await DichVu.findById(serviceId).session(session);

        if (!dichVu) {
            throw new Error("Không tìm thấy Ủy thác.");
        }
        if (dichVu.TrangThai !== 'completed') {
            throw new Error(`Ủy thác chưa hoàn thành (Trạng thái: ${dichVu.TrangThai}).`);
        }
        if (dichVu.ThanhToan) {
            throw new Error("Ủy thác này đã được thanh toán.");
        }

        const price = dichVu.GiaTri;
        const fee = Math.round(price * SERVICE_FEE_RATE);
        const memberReceive = price - fee;

        // 2. Lấy Ví của User (người thuê) và Member (người làm)
        const userWallet = await ViGiaoDich.findOne({ ChuSoHuu: dichVu.ChuSoHuu }).session(session);
        const memberWallet = await ViGiaoDich.findOne({ ChuSoHuu: dichVu.ThanhVienNhan }).session(session);

        if (!userWallet || !memberWallet) {
            throw new Error("Không tìm thấy Ví giao dịch.");
        }

        // 3. Kiểm tra số dư User (Giả định tiền đã được giữ khi ủy thác được chấp nhận)
        // Nếu dùng Transaction, ta không cần kiểm tra lại vì tiền đã bị khóa hoặc trừ.
        // Ở đây ta giả định tiền đã được chuyển vào "quỹ giữ tiền" (escrow) và đang được giữ.
        // Để đơn giản, ta sẽ trực tiếp thực hiện giao dịch:

        // 4. Cập nhật Ví Member: + Tiền thù lao
        await ViGiaoDich.findByIdAndUpdate(
            memberWallet._id,
            { $inc: { SoDuHienTai: memberReceive } },
            { new: true, session: session }
        );

        // 5. Tạo bản ghi Giao Dịch cho Member (Nhận tiền)
        await GiaoDich.create([{
            Loai: 'commission_payment',
            SoTien: memberReceive,
            NguoiThamGia: dichVu.ThanhVienNhan,
            TrangThai: 'success',
            MoTa: `Thanh toán thù lao cho Ủy thác #${dichVu._id}`,
            DichVu: dichVu._id
        }], { session });

        // 6. Tạo bản ghi Giao Dịch cho Phí Dịch vụ (Trừ tiền cho hệ thống)
        await GiaoDich.create([{
            Loai: 'commission_fee',
            SoTien: fee,
            NguoiThamGia: dichVu.ThanhVienNhan, // Phí này trừ từ Member (hoặc User tùy theo chính sách)
            TrangThai: 'success',
            MoTa: `Phí dịch vụ 10% cho Ủy thác #${dichVu._id}`,
            DichVu: dichVu._id
        }], { session });
        
        // 7. Cập nhật trạng thái thanh toán của Ủy thác
        dichVu.ThanhToan = true;
        await dichVu.save({ session });

        // 8. Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Trả về kết quả thành công (Đây là API endpoint, không phải Web render)
        return { success: true, message: "Thanh toán ủy thác thành công.", memberGained: memberReceive };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Lỗi Thanh toán Ủy thác (MongoDB Transaction):", error.message);
        // Trả về lỗi nếu là API call
        throw new Error(`Thanh toán ủy thác thất bại: ${error.message}`); 

    }
};


// @desc    Nạp tiền vào ví
// @route   POST /api/wallet/deposit
const deposit = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { amount, method } = req.body;
        
        // Validate input
        if (!amount || amount <= 0) {
            throw new Error('Số tiền không hợp lệ');
        }
        if (!DEPOSIT_METHODS.includes(method)) {
            throw new Error('Phương thức thanh toán không hợp lệ');
        }

        // Tìm ví của user
        const wallet = await ViGiaoDich.findOne({ 
            ChuSoHuu: req.user._id,
            LoaiVi: 'User'
        }).session(session);

        if (!wallet) {
            throw new Error('Không tìm thấy ví');
        }

        // Cập nhật số dư
        await ViGiaoDich.findByIdAndUpdate(
            wallet._id,
            { $inc: { SoDuHienTai: amount } },
            { new: true, session }
        );

        // Tạo giao dịch
        await GiaoDich.create([{
            Loai: 'deposit',
            SoTien: amount,
            NguoiThamGia: req.user._id,
            TrangThai: 'success',
            MoTa: `Nạp tiền qua ${method}`,
            PhuongThuc: method
        }], { session });

        await session.commitTransaction();
        
        // Generate mock QR code for demo
        const qrCodeData = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
        
        res.json({
            success: true,
            message: 'Tạo yêu cầu nạp tiền thành công',
            data: {
                qrCode: qrCodeData,
                amount: amount,
                transactionId: 'DEMO_' + Date.now()
            }
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({
            success: false,
            message: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Rút tiền từ ví
// @route   POST /api/wallet/withdraw
const withdraw = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { amount, bankInfo } = req.body;

        // Validate
        if (!amount || amount < MIN_WITHDRAW || amount > MAX_WITHDRAW) {
            throw new Error(`Số tiền phải từ ${MIN_WITHDRAW} đến ${MAX_WITHDRAW}`);
        }
        if (!bankInfo || !bankInfo.accountNumber || !bankInfo.bankName) {
            throw new Error('Thông tin ngân hàng không đầy đủ');
        }

        // Tìm ví
        const wallet = await ViGiaoDich.findOne({ 
            ChuSoHuu: req.user._id,
            LoaiVi: 'User'
        }).session(session);

        if (!wallet || wallet.SoDuHienTai < amount) {
            throw new Error('Số dư không đủ');
        }

        // Trừ tiền
        await ViGiaoDich.findByIdAndUpdate(
            wallet._id,
            { $inc: { SoDuHienTai: -amount } },
            { new: true, session }
        );

        // Tạo giao dịch
        await GiaoDich.create([{
            Loai: 'withdraw',
            SoTien: amount,
            NguoiThamGia: req.user._id,
            TrangThai: 'pending',
            MoTa: `Rút tiền về TK ${bankInfo.accountNumber}`,
            ThongTinNganHang: bankInfo
        }], { session });

        await session.commitTransaction();

        res.json({
            success: true,
            message: 'Yêu cầu rút tiền đang được xử lý',
            amount: amount
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({
            success: false,
            message: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Lấy lịch sử giao dịch
// @route   GET /api/wallet/transactions
const getTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;

        const transactions = await GiaoDich.find({ 
            NguoiThamGia: req.user._id 
        })
        .sort('-createdAt')
        .skip(startIndex)
        .limit(limit)
        .populate('DichVu', 'TenDichVu');

        const total = await GiaoDich.countDocuments({ 
            NguoiThamGia: req.user._id 
        });

        res.json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy lịch sử giao dịch'
        });
    }
};

// @desc    Thanh toán dịch vụ
// @route   POST /api/service/payment/:serviceId
const servicePayment = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const service = await DichVu.findById(req.params.serviceId)
            .session(session);

        if (!service) {
            throw new Error('Không tìm thấy dịch vụ');
        }
        if (service.TrangThai !== 'cho-duyet') {
            throw new Error('Dịch vụ không ở trạng thái chờ duyệt');
        }

        const userWallet = await ViGiaoDich.findOne({ 
            ChuSoHuu: req.user._id,
            LoaiVi: 'User'
        }).session(session);

        if (!userWallet || userWallet.SoDuHienTai < service.Gia) {
            throw new Error('Số dư không đủ để thanh toán');
        }

        // Trừ tiền từ ví người dùng
        await ViGiaoDich.findByIdAndUpdate(
            userWallet._id,
            { $inc: { SoDuHienTai: -service.Gia } },
            { session }
        );

        // Tạo giao dịch thanh toán
        await GiaoDich.create([{
            Loai: 'service_payment',
            SoTien: service.Gia,
            NguoiThamGia: req.user._id,
            TrangThai: 'success',
            MoTa: `Thanh toán dịch vụ ${service.TenDichVu}`,
            DichVu: service._id
        }], { session });

        // Cập nhật trạng thái dịch vụ
        service.TrangThai = 'da-thanh-toan';
        await service.save({ session });

        await session.commitTransaction();

        res.json({
            success: true,
            message: 'Thanh toán dịch vụ thành công'
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({
            success: false,
            message: error.message
        });
    } finally {
        session.endSession();
    }
};

// Export all controllers
module.exports = {
    settleCommissionPayment,
    deposit,
    withdraw,
    getTransactions,
    servicePayment
};