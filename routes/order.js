const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Get orders for a specific user
router.get('/user/:phoneNumber', orderController.getUserOrders);

// Get order details by order ID
router.get('/:orderId', orderController.getOrderById);

// Get order by order number
router.get('/number/:orderNumber', orderController.getOrderByNumber);

// Update order status (Admin)
router.put('/:orderId/status', orderController.updateOrderStatus);

// Cancel order
router.put('/:orderId/cancel', orderController.cancelOrder);

module.exports = router;
