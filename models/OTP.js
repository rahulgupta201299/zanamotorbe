const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        trim: true
    },
    isdCode: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    otp: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    interaktMessageId: {
        type: String,
        default: null
    },
    smsFallbackSent: {
        type: Boolean,
        default: false
    },
    deliveryMethod: {
        type: String,
        enum: ['whatsapp', 'sms', 'email'],
        default: null
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        index: { expires: 0 } // TTL index - MongoDB will automatically delete expired documents
    }
}, {
    timestamps: true
});

// Create indexes for efficient lookups
otpSchema.index({ isdCode: 1, phoneNumber: 1 });
otpSchema.index({ email: 1 });
otpSchema.index({ interaktMessageId: 1 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
