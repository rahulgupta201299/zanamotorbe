const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Online payment (Razorpay)
router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);

// COD (Cash on Delivery)
router.post('/create-cod-order', paymentController.createCODOrder);
router.post('/confirm-cod-order', paymentController.confirmCODOrder);

// Webhook and status
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);
router.get('/status/:orderId', paymentController.getPaymentStatus);

module.exports = router;
