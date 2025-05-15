import { User } from '../model/user.model.js';
import { emailService } from './emailService.js';
import { ApiError } from '../utils/apiError.js';
import jwt from 'jsonwebtoken';

class EmailVerificationManager {
    static async generateVerificationToken(user) {
        try {
            // Generate access token for email verification
            const accessToken = user.generateAccessToken();
            
            // Send verification email with the access token
            await this.sendVerificationEmail(user, accessToken);
            
            return accessToken;
        } catch (error) {
            console.error('Error generating verification token:', error);
            throw new ApiError(500, 'Failed to generate verification token');
        }
    }

    static async sendVerificationEmail(user, accessToken) {
        try {
            if (!user || !accessToken) {
                throw new ApiError(400, 'User and access token are required');
            }

            const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${accessToken}`;
            await emailService.sendVerificationEmail(user, verificationUrl);
        } catch (error) {
            console.error('Error sending verification email:', error);
            throw new ApiError(500, 'Failed to send verification email');
        }
    }

    static async verifyEmail(token) {
        try {
            if (!token) {
                throw new ApiError(400, 'Access token is required');
            }

            // Verify the access token
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            
            // Find user by ID from token
            const user = await User.findById(decoded._id);
            if (!user) {
                throw new ApiError(400, 'User not found');
            }

            // Update user verification status
            user.isVerified = true;
            await user.save();
            
            console.log('Email verified for user:', user.email);
        } catch (error) {
            console.error('Email verification error:', error);
            if (error.name === 'JsonWebTokenError') {
                throw new ApiError(400, 'Invalid access token');
            }
            if (error.name === 'TokenExpiredError') {
                throw new ApiError(400, 'Access token has expired');
            }
            throw error;
        }
    }
}

export { EmailVerificationManager };