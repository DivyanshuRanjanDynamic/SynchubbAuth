import { User } from '../model/user.model.js';
import { emailService } from './emailService.js';
import { ApiError } from '../utils/apiError.js';
import jwt from 'jsonwebtoken';

class PasswordResetManager {
    static async generateAccessToken(user) {
        try {
            if (!user) {
                throw new ApiError(400, 'User is required');
            }

            // Generate access token
            const accessToken = user.generateAccessToken();
            
            // Send reset email with the access token
            await this.sendResetEmail(user, accessToken);
            
            return accessToken;
        } catch (error) {
            console.error('Error generating access token:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(500, 'Failed to generate access token');
        }
    }

    static async sendResetEmail(user, accessToken) {
        try {
            if (!user) {
                throw new ApiError(400, 'User is required');
            }

            if (!user.email) {
                throw new ApiError(400, 'User email is required');
            }

            if (!accessToken) {
                throw new ApiError(400, 'Access token is required');
            }

            console.log('Sending reset email to:', user.email);
            await emailService.sendPasswordResetEmail(user, accessToken);
            console.log('Reset email sent successfully to:', user.email);
        } catch (error) {
            console.error('Failed to send reset email:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(500, 'Failed to send reset email');
        }
    }

    static async resetPassword(token, newPassword) {
        try {
            if (!token) {
                throw new ApiError(400, 'Access token is required');
            }

            if (!newPassword) {
                throw new ApiError(400, 'New password is required');
            }

            // Verify the access token
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            
            // Find user by ID from token
            const user = await User.findById(decoded._id);
            if (!user) {
                throw new ApiError(400, 'User not found');
            }

            // Update password
            user.password = newPassword;
            await user.save();
            
            console.log('Password reset successful for user:', user.email);
        } catch (error) {
            console.error('Error resetting password:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            if (error.name === 'JsonWebTokenError') {
                throw new ApiError(400, 'Invalid access token');
            }
            if (error.name === 'TokenExpiredError') {
                throw new ApiError(400, 'Access token has expired');
            }
            throw new ApiError(500, 'Failed to reset password');
        }
    }
}

export { PasswordResetManager }; 