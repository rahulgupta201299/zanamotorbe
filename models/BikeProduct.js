const mongoose = require('mongoose');

const bikeProductSchema = new mongoose.Schema({
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BikeBrand'
    },
    model: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BikeModel'
    },
    isBikeSpecific: {
        type: Boolean,
        default: true
    },
    name: {
        type: String,
        required: true
    },
    shortDescription: {
        type: String
    },
    longDescription: {
        type: String
    },
    description: {
        type: String
    },
    category: {
        type: String
    },
    categoryIcon: {
        type: String
    },
    price: {
        type: Number,
        required: true
    },
    imageUrl: {
        type: String
    },
    images: [{
        type: String
    }],
    quantityAvailable: {
        type: Number,
        required: true
    },
    specifications: {
        type: String
    },
    shippingAndReturn: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BikeProduct', bikeProductSchema);
