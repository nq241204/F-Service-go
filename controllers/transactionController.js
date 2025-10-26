// controllers/transactionController.js
const mongoose = require('mongoose');
const ViGiaoDich = require('../models/ViGiaoDich');
const GiaoDich = require('../models/GiaoDich');
const DichVu = require('../models/DichVu');

// Tỷ lệ phí dịch vụ (ví dụ: 10%)
const SERVICE_FEE_RATE = 0.10; 

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


// --- Export tất cả các hàm ---
module.exports = { 
    settleCommissionPayment 
};