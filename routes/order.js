const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/user/:phoneNumber', orderController.getOrdersByPhone);
router.get('/admin/all', orderController.getAdminAllOrders);
router.get('/admin/stats', orderController.getAdminOrderStats);
router.get('/:orderId', orderController.getOrderById);
router.get('/track-order/:orderId', orderController.trackOrderByOrderId);

module.exports = router;
