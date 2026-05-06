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
router.post('/generate-admin-email', otpController.generateAdminEmailOTP);

// Verify OTP (Admin Email)
router.post('/verify-admin-email', otpController.verifyAdminEmailOTP);

module.exports = router;
