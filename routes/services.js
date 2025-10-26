// routes/services.js (thêm route)
const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/servicesController');
const { authMiddleware } = require('../middleware/authMiddleware');
const UyThac = require('../models/UyThac');

router.get('/list', servicesController.getServices);
router.post('/commission', authMiddleware(['user', 'member']), servicesController.createCommission);
router.get('/my-commissions', authMiddleware(['user', 'member']), servicesController.getMyCommissions);
router.get('/:id', authMiddleware(['user', 'member']), async (req, res) => {
  try {
    const commission = await UyThac.findById(req.params.id).populate('DichVuId').lean();
    if (!commission || commission.UserId.toString() !== req.user._id.toString()) {
      return res.status(404).render('404', { title: 'Not Found' });
    }
    res.render('service/detail', { user: req.user, title: 'Chi Tiết Ủy Thác', commission });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Lỗi khi tải chi tiết ủy thác.');
    res.redirect('/user/commissions');
  }
});

module.exports = router;