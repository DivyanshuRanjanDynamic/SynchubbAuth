import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    deviceInfo: {
        deviceType: String,
        browser: String,
        os: String,
        ipAddress: String
    },
    refreshToken: {
        type: String,
        required: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, { timestamps: true });

// Index for faster queries
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ refreshToken: 1 });

// Method to check if session is expired
sessionSchema.methods.isExpired = function() {
    return this.expiresAt < new Date();
};

// Method to deactivate session
sessionSchema.methods.deactivate = async function() {
    this.isActive = false;
    await this.save();
};

export const Session = mongoose.model('Session', sessionSchema); 