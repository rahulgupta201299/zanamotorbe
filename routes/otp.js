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

module.exports = router;
