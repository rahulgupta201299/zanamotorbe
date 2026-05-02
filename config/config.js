require('dotenv').config();

module.exports = {
    BYPASS_OTP: process.env.BYPASS_OTP === 'true',

    // Server Configuration
    PORT: process.env.PORT || 3000,

    // Database Configuration
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/zana-motors',

    // Twilio Configuration
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,

    // Razorpay Configuration
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,

    // SMTP/Email Configuration
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT || 587,
    SMTP_SECURE: process.env.SMTP_SECURE === 'true',
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'Zana Motors',

    // CROSS CURRENCY MULTIPLIER
    CROSS_CURRENCY_MULTIPLIER: process.env.CROSS_CURRENCY_MULTIPLIER,

    // EXCHANGE RATE API
    EXCHANGE_RATE_API_KEY: process.env.EXCHANGE_RATE_API_KEY,

    // SHIPKLOUD Configuration
    SHIPKLOUD_PUBLIC_KEY: process.env.SHIPKLOUD_PUBLIC_KEY,
    SHIPKLOUD_PRIVATE_KEY: process.env.SHIPKLOUD_PRIVATE_KEY,
    SHIPKLOUD_TRACK_ORDER_URL: process.env.SHIPKLOUD_TRACK_ORDER_URL,

    // COD Charges
    COD_CHARGES: parseInt(process.env.COD_CHARGES, 10) || 300,

    // AWS S3 Configuration
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    CDN_BASE_URL: process.env.CDN_BASE_URL
};
