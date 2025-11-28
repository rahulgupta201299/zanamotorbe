const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

// Cart APIs
// Validate cart items availability
router.post('/validate', cartController.validateCart);

// Save cart with validation, product details, price, quantity and address
router.post('/save', cartController.saveCartWithDetails);

// Get cart by phone number
router.get('/:phoneNumber', cartController.getCart);

// Order APIs
// Get all orders for a phone number with pagination
router.get('/orders/:phoneNumber', cartController.getUserOrders);

// Get specific order by orderId
router.get('/order/:orderId', cartController.getOrderById);

// Checkout cart to create order
router.post('/checkout', cartController.checkoutCart);

module.exports = router;
