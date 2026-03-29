const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Get orders for a specific user
router.get('/user/:phoneNumber', orderController.getOrdersByPhone);

// Get order details by order ID
router.get('/:orderId', orderController.getOrderById);

module.exports = router;
