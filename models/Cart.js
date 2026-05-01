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

const cartItemSchema = new mongoose.Schema({
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
}, { _id: false });

const cartSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true
    },
    emailId: {
        type: String,
        default: null
    },
    items: [cartItemSchema],
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    shippingAddressSameAsBillingAddress: {
        type: Boolean,
        default: false
    },
    subtotal: {
        type: Number,
        default: 0
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
    codCharges: {
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
    // Payment-related fields (set before checkout)
    razorpayOrderId: {
        type: String
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'upi', 'netbanking', 'cod', 'wallet', 'online']
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'partial_paid', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'checkout'],
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

// Index for faster queries
cartSchema.index({ phoneNumber: 1 });
cartSchema.index({ status: 1 });

// Pre-save middleware to calculate totals
cartSchema.pre('save', async function() {
    this.subtotal = this.items.reduce((total, item) => total + item.totalPrice, 0);
    this.totalAmount = this.subtotal + this.shippingCost + this.taxAmount + (this.codCharges || 0) - this.discountAmount;
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('Cart', cartSchema);
