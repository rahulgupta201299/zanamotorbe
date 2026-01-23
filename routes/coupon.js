const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');

// Admin routes (should be protected with authentication middleware)
router.get('/', couponController.getAllCoupons);
router.post('/', couponController.createCoupon);
router.post('/update', couponController.updateCoupon);
router.post('/toggle-status', couponController.toggleCouponStatus);
router.post('/delete', couponController.deleteCoupon);

// Public routes
router.post('/validate', couponController.validateCouponCode);

module.exports = router;
