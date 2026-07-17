const mongoose = require('mongoose');

const metadataSchema = new mongoose.Schema({
  isBikeSpecific: {
    type: Boolean,
    required: true
  },
  products: {
    type: mongoose.Schema.Types.Mixed
  }
});

module.exports = mongoose.model('Metadata', metadataSchema, 'metadata');
