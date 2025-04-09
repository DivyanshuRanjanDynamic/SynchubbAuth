import crypto from 'crypto';
import { User } from '../model/user.model.js';
import { emailService } from './emailService.js';

 class EmailVerificationManager {
    static async generateVerificationToken(user) {
        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        // Hash token and set to user
        user.emailVerificationToken = crypto
            .createHash('sha256')
            .update(verificationToken)
            .digest('hex');
        
        // Set expiry (24 hours)
        user.emailVerificationExpireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        await user.save();
        
        return verificationToken;
    }

    static async sendVerificationEmail(user, verificationToken) {
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
        
        const message = `
            <h1>Email Verification</h1>
            <p>Please verify your email address by clicking the link below:</p>
            <a href="${verificationUrl}" target="_blank">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, please ignore this email.</p>
        `;

        await emailService.sendEmail({
            email: user.email,
            subject: 'Email Verification',
            html: message
        });
    }

    static async verifyEmail(token) {
        // Hash the token
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find user with token
        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpireAt: { $gt: Date.now() }
        });

        if (!user) {
            throw new Error('Invalid or expired verification token');
        }

        // Update user verification status
        user.isVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpireAt = undefined;
        
        await user.save();
    }
} 

export {EmailVerificationManager};