const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const DichVu = require('../models/DichVu');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'public/uploads/services');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: function(req, file, cb) {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

router.get('/create', authMiddleware(['user', 'member']), (req, res) => {
    res.render('services/create', {
        user: req.user,
        title: 'T?o D?ch V? M?i'
    });
});

router.post('/create',
    authMiddleware(['user', 'member']),
    upload.single('HinhAnh'),
    [
        body('TenDichVu').trim().notEmpty().withMessage('Tên dịch vụ l� b?t bu?c'),
        body('MoTa').trim().notEmpty().withMessage('M� t? l� b?t bu?c'),
        body('GiaTien').isInt({ min: 0 }).withMessage('Gi� ti?n ph?i l� s? kh�ng �m'),
        body('LoaiDichVu').isIn(['basic', 'premium', 'vip']).withMessage('Lo?i d?ch v? kh�ng h?p l?'),
        body('ThoiGianHoanThanh').isInt({ min: 1 }).withMessage('Th?i gian ho�n th�nh ph?i l?n hon 0')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.render('services/create', {
                    title: 'T?o D?ch V? M?i',
                    user: req.user,
                    error: errors.array()[0].msg,
                    values: req.body
                });
            }

            const dichVu = new DichVu({
                TenDichVu: req.body.TenDichVu,
                MoTa: req.body.MoTa,
                GiaTien: req.body.GiaTien,
                LoaiDichVu: req.body.LoaiDichVu,
                ThoiGianHoanThanh: req.body.ThoiGianHoanThanh,
                HinhAnh: req.file ? '/uploads/services/' + req.file.filename : null,
                TrangThai: req.body.TrangThai === 'active' ? 'active' : 'inactive',
                NguoiTao: req.user._id
            });

            await dichVu.save();
            req.flash('success_msg', 'T?o d?ch v? th�nh c�ng');
            res.redirect('/services');
        } catch (error) {
            console.error('L?i khi t?o d?ch v?:', error);
            res.render('services/create', {
                title: 'T?o D?ch V? M?i',
                user: req.user,
                error: 'C� l?i x?y ra khi t?o d?ch v?',
                values: req.body
            });
        }
    }
);

router.get('/', async (req, res) => {
    try {
        const dichVu = await DichVu.find().populate('NguoiTao', 'HoTen');
        res.render('services/list', {
            title: 'Danh S�ch D?ch V?',
            user: req.user,
            dichVu
        });
    } catch (error) {
        console.error('L?i khi l?y danh s�ch d?ch v?:', error);
        res.status(500).render('error', {
            title: 'L?i',
            error: 'C� l?i x?y ra khi t?i danh s�ch d?ch v?'
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const dichVu = await DichVu.findById(req.params.id).populate('NguoiTao', 'HoTen');
        if (!dichVu) {
            return res.status(404).render('error', {
                title: 'Kh�ng t�m th?y',
                error: 'Kh�ng t�m th?y d?ch v?'
            });
        }
        res.render('services/detail', {
            title: dichVu.TenDichVu,
            user: req.user,
            dichVu
        });
    } catch (error) {
        console.error('L?i khi l?y chi ti?t d?ch v?:', error);
        res.status(500).render('error', {
            title: 'L?i',
            error: 'C� l?i x?y ra khi t?i th�ng tin d?ch v?'
        });
    }
});

module.exports = router;
