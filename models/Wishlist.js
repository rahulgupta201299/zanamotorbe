const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true
    },
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BikeProduct',
        required: true
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure unique products in wishlist
wishlistSchema.pre('save', function(next) {
    this.products = [...new Set(this.products.map(id => id.toString()))].map(id => new mongoose.Types.ObjectId(id));
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Wishlist', wishlistSchema);
