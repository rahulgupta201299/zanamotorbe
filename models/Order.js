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

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BikeProduct',
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    }
}, { _id: false });

const orderStatusHistorySchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String
    }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    emailId: {
        type: String,
        default: null
    },
    items: [orderItemSchema],
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    shippingAddressSameAsBillingAddress: {
        type: Boolean,
        default: false
    },
    subtotal: {
        type: Number,
        required: true
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
    totalAmount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    currencySymbol: {
        type: String,
        default: '₹'
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'upi', 'netbanking', 'cod', 'wallet', 'online'],
        required: true
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
        default: 'placed'
    },
    statusHistory: [orderStatusHistorySchema],
    orderDate: {
        type: Date,
        default: Date.now
    },
    estimatedDelivery: {
        type: Date
    },
    deliveredDate: {
        type: Date
    },
    trackingNumber: {
        type: String
    },
    notes: {
        type: String
    },
    // Original cart reference
    originalCartId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart'
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

// Index for faster queries
orderSchema.index({ phoneNumber: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ orderDate: -1 });

// Pre-save middleware to update timestamp
orderSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Order', orderSchema);