const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    firstName: {
        type: String
    },
    lastName: {
        type: String
    },
    isdCode: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    emailId: {
        type: String
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
    },
    notifyOffers: {
        type: Boolean,
        default: false
    },
    bikeOwnedByCustomer: [{
        brand: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BikeBrand'
        },
        model: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BikeModel'
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Profile', profileSchema);
