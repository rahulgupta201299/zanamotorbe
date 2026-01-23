const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    type: {
        type: String,
        enum: ['Percentage', 'Flat', 'Special', 'Festival', 'First Order'],
        required: true
    },
    discount: {
        type: Number,
        required: true,
        min: 0
    },
    maxDiscount: {
        type: Number,
        default: null // Only for percentage coupons
    },
    minCartAmount: {
        type: Number,
        default: 0
    },
    usageLimit: {
        type: Number,
        default: null // null means unlimited
    },
    usedCount: {
        type: Number,
        default: 0
    },
    usedBy: [{
        phoneNumber: {
            type: String,
            required: true
        },
        usageCount: {
            type: Number,
            default: 1
        },
        usedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: null
    },
    description: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ expiresAt: 1 });

// Pre-save middleware
couponSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Coupon', couponSchema);
