const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');

// Generate and send OTP (Mobile)
router.post('/generate', otpController.generateOTP);

// Verify OTP (Mobile)
router.post('/verify', otpController.verifyOTP);

// Generate and send OTP (Email)
router.post('/generate-email', otpController.generateEmailOTP);

// Verify OTP (Email)
router.post('/verify-email', otpController.verifyEmailOTP);

// Generate and send OTP (Admin Email)
router.post('/generate-admin-email-otp', otpController.generateAdminEmailOTP);

// Verify OTP (Admin Email)
router.post('/verify-admin-email-otp', otpController.verifyAdminEmailOTP);

// Interakt Webhook (for WhatsApp failure SMS fallback)
router.post('/interakt-webhook', otpController.handleInteraktWebhook);

module.exports = router;
