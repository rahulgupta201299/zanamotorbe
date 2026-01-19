const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);
router.get('/status/:cartId', paymentController.getPaymentStatus);

module.exports = router;
