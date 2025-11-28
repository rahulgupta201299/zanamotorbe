const mongoose = require('mongoose');

const bikeModelSchema = new mongoose.Schema({
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BikeBrand',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    imageUrl: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BikeModel', bikeModelSchema);
