const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    addressLine1: {
        type: String,
        required: true
    },
    addressLine2: {
        type: String
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    postalCode: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    }
}, { _id: false });

const cartSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BikeProduct',
            required: true
        },
        quantity: {
            type: Number,
            default: 1
        },
        price: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        }
    }],
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    subtotal: {
        type: Number,
        default: 0
    },
    // Order-related fields
    orderNumber: {
        type: String,
        unique: true,
        sparse: true // Only orders will have this field
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'upi', 'netbanking', 'cod', 'wallet']
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    },
    razorpaySignature: {
        type: String
    },
    orderStatus: {
        type: String,
        enum: ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    },
    orderDate: {
        type: Date
    },
    estimatedDelivery: {
        type: Date
    },
    trackingNumber: {
        type: String
    },
    notes: {
        type: String
    },
    shippingCost: {
        type: Number,
        default: 0
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    couponCode: {
        type: String,
        default: null
    },
    appliedCoupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        default: null
    },
    totalAmount: {
        type: Number,
        default: 0
    },

    status: {
        type: String,
        enum: ['active', 'validated', 'checkout', 'completed', 'ordered'],
        default: 'active'
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

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
    this.subtotal = this.items.reduce((total, item) => total + item.totalPrice, 0);
    this.totalAmount = this.subtotal + this.shippingCost + this.taxAmount - this.discountAmount;
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Cart', cartSchema);
