require('dotenv').config();

module.exports = {
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
};
