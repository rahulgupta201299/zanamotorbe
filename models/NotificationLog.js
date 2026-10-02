const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
    interaktMessageId: {
        type: String,
        required: true,
        index: true
    },
    recipientPhone: {
        type: String,
        required: true
    },
    templateName: {
        type: String,
        default: null
    },
    fallbackText: {
        type: String,
        required: true
    },
    sendSmsFallback: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['queued', 'failed_sms_sent', 'failed_no_fallback'],
        default: 'queued'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days TTL
        index: { expires: 0 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
