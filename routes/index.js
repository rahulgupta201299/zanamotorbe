const express = require('express');
const router = express.Router();

router.use('/health', require('./health'));
router.use('/country', require('./country'));
router.use('/blog', require('./blog'));
router.use('/profile', require('./profile'));
router.use('/brand', require('./brand'));
router.use('/model', require('./model'));
router.use('/product', require('./product'));
router.use('/cart', require('./cart'));

// OTP routes
router.use('/otp', require('./otp'));

module.exports = router;
