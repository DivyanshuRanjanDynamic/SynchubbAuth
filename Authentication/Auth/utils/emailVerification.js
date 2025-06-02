import { User } from '../model/user.model.js';
import { emailService } from './emailService.js';
import { ApiError } from '../utils/apiError.js';
import jwt from 'jsonwebtoken';

class EmailVerificationManager {

     // Generates a JWT token and sends verification email with 4-digit code
    static async generateVerificationToken(user) {
        try {
            const accessToken = user.generateAccessToken();
            
            // Send verification email with the access token
            await emailService.sendVerificationEmail(user, accessToken);
            
            return accessToken;
        } catch (error) {
            console.error('Error generating verification token:', error);
            throw new ApiError(500, 'Failed to generate verification token');
        }
    }
   // Sends verification email with 4-digit code and saves code + expiry in DB
    static async sendVerificationEmail(user, accessToken) {
          try {
        if (!user  || !user.email) {
            throw new ApiError(400, 'User is required');
        }

        // 1. Generate 4-digit code
        const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();


         // Save code and expiry in user document
            user.verificationCode = verificationCode;
            user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        await user.save();

        // 3. Send email with the 4-digit code  or the passed message
      await emailService.sendEmail({
        to: user.email,
       subject: 'Your Verification Code',
        html: `<h1>Verify Your Email</h1><p>Your verification code is: <b>${verificationCode}</b></p>`
});

        
    }
     catch (error) {
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