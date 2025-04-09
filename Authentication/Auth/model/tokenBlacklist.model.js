import mongoose from 'mongoose';

const tokenBlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        enum: ['LOGOUT', 'PASSWORD_CHANGE', 'SECURITY_REVOKE'],
        required: true
    }
}, { timestamps: true });

// Index for faster queries
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema); 