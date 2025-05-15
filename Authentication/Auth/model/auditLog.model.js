import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            'REGISTER',
            'LOGIN',
            'LOGOUT',
            'PASSWORD_RESET',
            'EMAIL_VERIFICATION',
            'PROFILE_UPDATE',
            'ACCOUNT_DELETION'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: ['SUCCESS', 'FAILURE']
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: true
    },
    error: {
        type: String,
        required: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for faster queries
auditLogSchema.index({ userId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema); 