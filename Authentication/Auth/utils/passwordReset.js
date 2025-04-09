import crypto from 'crypto';
import { User } from '../model/user.model.js';
import { emailService } from './emailService.js';

export class PasswordResetManager {
    static async generateResetToken(user) {
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // Hash token and set to user
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
        
        // Set expiry (10 minutes)
        user.resetPasswordExpireAt = new Date(Date.now() + 10 * 60 * 1000);
        
        await user.save();
        
        return resetToken;
    }

    static async sendResetEmail(user, resetToken) {
        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
        
        const message = `
            <h1>Password Reset Request</h1>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="${resetUrl}" target="_blank">Reset Password</a>
            <p>This link will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `;

        await emailService.sendEmail({
            email: user.email,
            subject: 'Password Reset Request',
            html: message
        });
    }

    static async resetPassword(token, newPassword) {
        // Hash the token
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find user with token
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpireAt: { $gt: Date.now() }
        });

        if (!user) {
            throw new Error('Invalid or expired reset token');
        }

        // Update password and clear reset fields
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpireAt = undefined;
        
        await user.save();
    }
} 