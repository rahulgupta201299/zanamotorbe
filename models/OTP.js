const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        trim: true
    },
    isdCode: {
        type: String,
        required: true,
        trim: true
    },
    otp: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
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

// Create compound index for efficient lookups
otpSchema.index({ isdCode: 1, phoneNumber: 1 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
