const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

router.post('/validate', cartController.validateCart);
router.post('/save', cartController.saveCartWithDetails);
router.get('/orders/:phoneNumber', cartController.getUserOrders);
router.get('/:phoneNumber', cartController.getCart);
router.get('/order/:orderId', cartController.getOrderById);
router.post('/checkout', cartController.checkoutCart);

module.exports = router;
