const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

router.get('/active/:phoneNumber', cartController.getActiveCart);
router.post('/item', cartController.manageCartItem);
router.post('/clear', cartController.clearCart);
router.post('/addresses', cartController.updateCartAddresses);

// Cart validation
router.post('/validate', cartController.validateCart);

// Coupon operations
router.post('/apply-coupon', cartController.applyCoupon);
router.post('/remove-coupon', cartController.removeCoupon);

// Checkout process
router.post('/checkout', cartController.checkoutCart);

module.exports = router;
