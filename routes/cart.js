const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

router.get('/active/:phoneNumber', cartController.getActiveCart);
router.post('/item', cartController.manageCartItem);
router.post('/clear', cartController.clearCart);
router.post('/addresses', cartController.updateCartAddresses);

// Cart validation
router.post('/validate', cartController.validateCart);

// Checkout process
router.post('/checkout', cartController.checkoutCart);

module.exports = router;
