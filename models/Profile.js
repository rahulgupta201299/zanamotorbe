const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
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
    address: {
        type: String
    },
    notifyOffers: {
        type: Boolean,
        default: false
    },
    bikeOwnedByCustomer: [{
        brand: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BikeBrand',
            required: true
        },
        model: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BikeModel',
            required: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Profile', profileSchema);
