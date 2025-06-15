import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    action: {
        type: String,
        required: true,
        enum: [
            'REGISTER',
            'LOGIN',
            'LOGOUT',
            'PASSWORD_RESET',
            'PASSWORD_RESET_REQUEST',
            'PASSWORD_CHANGE',
            'EMAIL_VERIFICATION',
            'VIEW_PROFILE',
            'DELETE_ACCOUNT',
            'PROFILE_UPDATE',
            'SESSION_LIST',
            'ACCOUNT_DELETION',
            'REVOKE_ALL_SESSIONS',
            'REGISTER_ATTEMPT',
            'EMAIL_VERIFICATION_ATTEMPT',
            'LOGIN_ATTEMPT',
            'PASSWORD_RESET_ATTEMPT'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: ['SUCCESS', 'FAILURE', 'PENDING']
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