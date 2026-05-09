const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    category: {
        type: String,
        required: true
    },
    typeOfCategory: {
        type: String,
        enum: ['Bike Specific', 'Both', 'Universal'],
        required: true,
        default: 'Universal'
    },
    subCategory: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

categorySchema.index({ category: 1, subCategory: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
