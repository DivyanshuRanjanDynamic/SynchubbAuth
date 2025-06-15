import { User } from "../model/user.model.js";
import { Session } from "../model/session.model.js";
import { AuditLog } from "../model/auditLog.model.js";
import { TokenManager } from "../utils/tokenManager.js";
import { PasswordResetManager } from "../utils/passwordReset.js";
import { EmailVerificationManager } from "../utils/emailVerification.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asynchandler } from "../utils/asynchandler.js";
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { emailService } from "../utils/emailService.js";
import mongoose from "mongoose";
import { TempUser } from "../model/tempUser.model.js";

// Helper to generate 4-digit code
const generateCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit string
};

export const generateAccessAndRefreshTokens = async (userId) => {
    try {
      const user = await User.findById(userId);
  
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();
  
      // attach refresh token to the user document to avoid refreshing the access token with multiple refresh tokens
      user.refreshToken = refreshToken;
  
      await user.save({ validateBeforeSave: false });
      return { accessToken, refreshToken };
    } catch (error) {
      
      console.log( "Something went wrong while generating the access token");
  }
};

// Register new user
export const registerUser = asynchandler(async (req, res) => {
    const { username, email, password } = req.body;

    // Validate request
    if (!username || !email || !password) {
        throw new ApiError(400, "Username, email and password are required");
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().replace(/\.(?=.*@gmail\.com)/g, '');
    console.log('Starting registration process:', { 
        originalEmail: email,
        normalizedEmail: normalizedEmail,
        username: username.toLowerCase()
    });

    try {
        // Check if user already exists in main collection
        const existingUser = await User.findOne({ 
            $or: [
                { email: normalizedEmail },
                { email: email.toLowerCase() },
                { username: username.toLowerCase() }
            ]
        });
        if (existingUser) {
            console.log('User already exists in main collection:', existingUser.email);
            throw new ApiError(409, "User already exists");
        }

        const verificationCode = generateCode();
        const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Check if temporary user exists
        let tempUser = await TempUser.findOne({ 
            $or: [
                { email: normalizedEmail },
                { email: email.toLowerCase() },
                { username: username.toLowerCase() }
            ]
        });
        
        if (tempUser) {
            // Update existing temporary user
            tempUser.verificationCode = verificationCode;
            tempUser.verificationCodeExpires = verificationExpiry;
            tempUser.password = password;
            tempUser.plainPassword = password;
            tempUser.verificationAttempts = 0;
            await tempUser.save();
        } else {
            // Create new temporary user
            tempUser = await TempUser.create({
                username: username.toLowerCase(),
                email: normalizedEmail,
                password,
                plainPassword: password,
                verificationCode,
                verificationCodeExpires: verificationExpiry,
                isVerified: false,
                verificationAttempts: 0
            });
        }

        // Send verification email
        const message = `
            <h1>Verify Your Email</h1>
            <p>Your verification code is: <b>${verificationCode}</b></p>
            <p>This code will expire in 15 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `;
        await EmailVerificationManager.sendVerificationEmail(tempUser, message);

        // Log registration attempt
        await AuditLog.create({
            userId: tempUser._id,
            action: 'REGISTER_ATTEMPT',
            status: 'PENDING',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        return res.status(201).json(
            new ApiResponse(201, null, "Registration initiated. Please check your email for verification code.")
        );
    } catch (error) {
        console.error('Registration error:', error);
        throw new ApiError(500, "Failed to complete registration process: " + error.message);
    }
});

// Login user
export const loginUser = asynchandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const normalizedEmail = email.toLowerCase().replace(/\.(?=.*@gmail\.com)/g, '');
    console.log('Login attempt:', {
        originalEmail: email,
        normalizedEmail: normalizedEmail,
        timestamp: new Date().toISOString()
    });

    try {
        // Find user
        const user = await User.findOne({ 
            $or: [
                { email: normalizedEmail },
                { email: email.toLowerCase() }
            ]
        });
        
        console.log('User lookup result:', {
            found: user ? 'Yes' : 'No',
            userId: user?._id,
            email: user?.email,
            isVerified: user?.isVerified,
            isLocked: user?.isLocked?.() || false
        });

        if (!user) {
            console.log('Login failed: User not found');
            throw new ApiError(401, "Invalid credentials");
        }

        if (!user.isVerified) {
            console.log('Login failed: Email not verified');
            throw new ApiError(403, "Please verify your email before logging in");
        }

        if (user.isLocked()) {
            console.log('Login failed: Account locked');
            throw new ApiError(423, "Account is locked. Please try again later.");
        }

        // Verify password
        console.log('Attempting password verification');
        const isPasswordValid = await user.comparePassword(password);
        console.log('Password verification result:', { isValid: isPasswordValid });

        if (!isPasswordValid) {
            console.log('Login failed: Invalid password');
            await user.incrementLoginAttempts();
            throw new ApiError(401, "Invalid credentials");
        }

        // Reset login attempts
        await user.resetLoginAttempts();
        console.log('Login attempts reset');

        // Update last login
        user.lastLogin = new Date();
        user.lastLoginIp = req.ip;
        await user.save();
        console.log('Last login updated');

        // Generate tokens
        console.log('Generating tokens');
        const { accessToken, refreshToken } = await TokenManager.generateTokens(user);

        // Create session
        const session = new Session({
            userId: user._id,
            deviceInfo: {
                deviceType: req.get('User-Agent'),
                ipAddress: req.ip
            },
            refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
        await session.save();
        console.log('Session created');

        // Log successful login
        await AuditLog.create({
            userId: user._id,
            action: 'LOGIN',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Set cookies
        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
        };

        console.log('Login successful:', {
            userId: user._id,
            email: user.email,
            timestamp: new Date().toISOString()
        });

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(200, {
                    user: {
                        id: user._id,
                        username: user.username,
                        email: user.email,
                        role: user.role
                    },
                    accessToken,
                    refreshToken
                }, "Login successful")
            );
    } catch (error) {
        console.error('Login error:', {
            error: error.message,
            stack: error.stack,
            email: normalizedEmail,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
});

// Logout user
export const logoutUser = asynchandler(async (req, res) => {
    const accessToken = req.cookies?.accessToken || 
                        req.header("Authorization")?.replace("Bearer ", "");
    const refreshToken = req.cookies?.refreshToken;

    if (!accessToken) {
        throw new ApiError(400, "Access token is required");
    }

    let userId;
    try {
        const decodedToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
        userId = decodedToken._id;
    } catch (error) {
        throw new ApiError(401, "Invalid or expired access token");
    }

    // Deactivate all active sessions
    await Session.updateMany(
        { userId, isActive: true },
        { isActive: false }
    );

    // Blacklist tokens
    await TokenManager.blacklistToken(accessToken, 'LOGOUT');
    if (refreshToken) {
        await TokenManager.blacklistToken(refreshToken, 'LOGOUT');
    }

    // Log the logout
    await AuditLog.create({
        userId,
        action: 'LOGOUT',
        status: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Clear cookies
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, null, "Logged out successfully"));
});

// Update user profile
export const updateUserProfile = asynchandler(async (req, res) => {
    try {
        const { username, email } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        let emailChanged = false;

        // Update username
        if (username) {
            const existingUser = await User.findOne({ 
                username: username.toLowerCase(), 
                _id: { $ne: user._id } 
            });
            if (existingUser) {
                throw new ApiError(409, "Username is already taken");
            }
            user.username = username.toLowerCase();
        }

        // Update email
        if (email && email.toLowerCase() !== user.email) {
            const existingUser = await User.findOne({ 
                email: email.toLowerCase(), 
                _id: { $ne: user._id } 
            });
            if (existingUser) {
                throw new ApiError(409, "Email is already taken");
            }
            user.email = email.toLowerCase();
            user.isVerified = false;
            emailChanged = true;
        }

        await user.save();

        // Send verification email if email was changed
        if (emailChanged) {
            const newAccessToken = await TokenManager.generateAccessToken(user);
            await AuthService.sendVerificationEmail(user, newAccessToken);
        }

        // Log update
        await AuditLog.create({
            userId: user._id,
            action: 'PROFILE_UPDATE',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    user: {
                        id: user._id,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        isVerified: user.isVerified
                    }
                },
                emailChanged 
                    ? "Profile updated. Verification email sent to new address." 
                    : "Profile updated successfully"
            )
        );
    } catch (error) {
        console.error('Error updating profile:', error);
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(500, "Failed to update profile");
    }
});


// Delete user account
export const deleteAccount = asynchandler(async (req, res) => {
    const { password } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Password is incorrect");
    }

    // Soft delete
    user.isActive = false;
    user.deactivatedAt = new Date();
    user.isVerified = false;
    user.lockUntil = null;
    await user.save();

    // Deactivate all sessions
    await Session.updateMany(
        { userId: user._id, isActive: true },
        { isActive: false }
    );

    // Blacklist current tokens
    const accessToken = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    const refreshToken = req.cookies?.refreshToken;

    if (accessToken) await TokenManager.blacklistToken(accessToken, 'DELETE_ACCOUNT');
    if (refreshToken) await TokenManager.blacklistToken(refreshToken, 'DELETE_ACCOUNT');

    // Audit log
    await AuditLog.create({
        userId: user._id,
        action: 'DELETE_ACCOUNT',
        status: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Clear cookies
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, null, "Account deleted successfully"));
});


// Verify email and complete registration
export const verifyEmail = asynchandler(async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        throw new ApiError(400, "Email and verification code are required");
    }

    const normalizedEmail = email.toLowerCase().replace(/\.(?=.*@gmail\.com)/g, '');

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [
                { email: normalizedEmail },
                { email: email.toLowerCase() }
            ]
        });
        
        if (existingUser) {
            throw new ApiError(409, "User already exists");
        }

        // Find temporary user
        const tempUser = await TempUser.findOne({ 
            $or: [
                { email: normalizedEmail },
                { email: email.toLowerCase() }
            ]
        });
        
        if (!tempUser) {
            throw new ApiError(400, "No pending verification found for this email. Please register first.");
        }

        // Check verification attempts
        if (tempUser.hasExceededVerificationAttempts()) {
            await TempUser.deleteOne({ _id: tempUser._id });
            throw new ApiError(429, "Too many verification attempts. Please register again.");
        }

        // Check if code has expired
        if (Date.now() > new Date(tempUser.verificationCodeExpires).getTime()) {
            await tempUser.incrementVerificationAttempts();
            throw new ApiError(410, "Verification code expired. Please request a new code.");
        }

        // Verify the code
        if (code !== tempUser.verificationCode) {
            await tempUser.incrementVerificationAttempts();
            throw new ApiError(400, "Invalid verification code");
        }

        // Create permanent user
        const user = new User({
            username: tempUser.username,
            email: normalizedEmail,
            password: tempUser.plainPassword,
            isVerified: true
        });

        await user.save();

        // Verify password was properly hashed
        const isPasswordValid = await user.comparePassword(tempUser.plainPassword);
        if (!isPasswordValid) {
            await User.deleteOne({ _id: user._id });
            throw new ApiError(500, "Failed to create user account. Please try again.");
        }

        // Delete temporary user
        await TempUser.deleteOne({ _id: tempUser._id });

        // Log successful verification
        await AuditLog.create({
            userId: user._id,
            action: 'REGISTER',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        return res.status(200).json(
            new ApiResponse(200, null, "Email verified successfully. Registration completed.")
        );
    } catch (error) {
        console.error('Verification error:', error);
        throw error;
    }
});

// Forgot Password
export const forgotPassword = asynchandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const normalizedEmail = email.toLowerCase();

    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });

    // Always respond the same way to prevent enumeration
    const genericMessage = "If an account exists with this email, you will receive a password reset link.";

    if (!user) {
        return res.status(200).json(new ApiResponse(200, null, genericMessage));
    }

    try {
        // Generate reset token (JWT or random token)
        const accessToken = await PasswordResetManager.generateAccessToken(user);

        // Create password reset URL
        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${accessToken}`;

        // Send email with reset link
        await emailService.sendPasswordResetEmail(user, resetUrl);

        // Log audit
        await AuditLog.create({
            userId: user._id,
            action: 'PASSWORD_RESET_REQUEST',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        return res.status(200).json(
            new ApiResponse(200, null, genericMessage)
        );
    } catch (error) {
        console.error("Error in forgotPassword:", error.message);

        // Log audit failure
        await AuditLog.create({
            userId: user._id,
            action: 'PASSWORD_RESET_REQUEST',
            status: 'FAILURE',
            error: error.message,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(500, "Failed to process password reset request");
    }
});


// Reset Password
export const resetPassword = asynchandler(async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    
    if (!token) {
        throw new ApiError(400, "Reset token is required");
    }

    if (!password) {
        throw new ApiError(400, "New password is required");
    }

    if (password !== confirmPassword) {
        throw new ApiError(400, "Passwords do not match");
    }

    // Optional: Enforce password strength
    if (password.length < 8 || !/[A-Z]/.test(password)) {
        throw new ApiError(400, "Password must be at least 8 characters and include an uppercase letter");
    }

    try {
        // Reset password and get user info for audit log
        const user = await PasswordResetManager.resetPassword(token, password);
       

          if (!user) {
        throw new ApiError(400, "Invalid or expired reset token");
    }
        // Log success
        await AuditLog.create({
            userId: user._id,
            action: 'PASSWORD_RESET',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        return res.status(200).json(
            new ApiResponse(200, null, "Password has been reset successfully")
        );
    } catch (error) {
        console.error('Reset password error:', error);
         const user = await PasswordResetManager.resetPassword(token, password);

        // Only include userId if user is defined
    const auditLogData = {
        action: 'PASSWORD_RESET',
        status: 'FAILURE',
        error: error.message,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    };
    if (typeof user !== 'undefined' && user && user._id) {
        auditLogData.userId = user._id;
    }

    await AuditLog.create(auditLogData);

        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(500, "Failed to reset password");
    }
});


// Change password (for logged-in users)
export const changePassword = asynchandler(async (req, res) => {
    const { previousPassword, password, confirmPassword } = req.body;

    if (!previousPassword || !password || !confirmPassword) {
        throw new ApiError(400, "Please fill all required fields");
    }

    if (password !== confirmPassword) {
        throw new ApiError(400, "New password and confirm password do not match");
    }

    // Optional: Password strength validation
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        throw new ApiError(400, "Password must be at least 8 characters, include an uppercase letter and a number");
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.password) {
        throw new ApiError(400, "User password is missing");
    }

    const isPasswordCorrect = await user.comparePassword(previousPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Previous password is incorrect");
    }

    user.password = password;
    await user.save();  // validateBeforeSave defaults to true, which is safer

    // Optional: Audit log for password change
    await AuditLog.create({
        userId: user._id,
        action: 'PASSWORD_CHANGE',
        status: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    return res.status(200).json(
        new ApiResponse(200, null, "Password updated successfully")
    );
});

// Get user sessions
export const getSessions = asynchandler(async (req, res) => {

       if (!req.user || !req.user._id) {
        throw new ApiError(401, "Unauthorized access");
    }

   const sessions = await Session.find({ 
        userId: req.user._id,
        isActive: true 
    })
    .select("createdAt userAgent ipAddress lastUsedAt")
    .sort({ lastUsedAt: -1 });


     await AuditLog.create({
        userId: req.user._id,
        action: 'SESSION_LIST',
        status: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    return res.status(200).json(
        new ApiResponse(200, sessions, "Sessions retrieved successfully")
    );
});

// Revoke session
export const revokeSession = asynchandler(async (req, res) => {
    const { sessionId } = req.params;

    if (!req.user || !req.user._id) {
        throw new ApiError(401, "Unauthorized");
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        throw new ApiError(400, "Invalid session ID format");
    }

    const anySession = await Session.findById(sessionId);
    console.log('Session found:', anySession);

    if (!anySession) {
        throw new ApiError(404, "Session not found");
    }

    if (anySession.userId.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to revoke this session");
    }

    if (!anySession.isActive) {
        throw new ApiError(400, "Session is already inactive");
    }

    await anySession.deactivate();

    if (anySession.refreshToken) {
        await TokenManager.blacklistToken(anySession.refreshToken);
    }

    await AuditLog.create({
        userId: req.user._id,
        action: 'SESSION_REVOKE',
        status: 'SUCCESS',
        metadata: { sessionId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    return res.status(200).json(
        new ApiResponse(200, null, "Session revoked successfully")
    );
});


// Revoke all sessions
export const revokeAllSessions = asynchandler(async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(401, "Unauthorized");
    }

    try {
        // Find all active sessions
        const sessions = await Session.find({ userId: req.user._id, isActive: true });

        // Blacklist refresh tokens
        for (const session of sessions) {
            if (session.refreshToken) {
                await TokenManager.blacklistToken(session.refreshToken);
            }
        }

        // Deactivate sessions
        await Session.updateMany(
            { userId: req.user._id, isActive: true },
            { isActive: false }
        );

        // Log audit trail
        await AuditLog.create({
            userId: req.user._id,
            action: 'REVOKE_ALL_SESSIONS',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        return res.status(200).json(
            new ApiResponse(200, null, "All sessions revoked successfully")
        );
    } catch (error) {
        console.error("Error in revokeAllSessions:", error);

        await AuditLog.create({
            userId: req.user?._id,
            action: 'REVOKE_ALL_SESSIONS',
            status: 'FAILURE',
            error: error?.message,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        throw new ApiError(500, error?.message || "Error revoking sessions");
    }
});


// Get user profile
export const getUserProfile = asynchandler(async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(401, "Unauthorized");
    }

    try {
        const user = await User.findById(req.user._id)
            .select('-password -refreshToken -__v -verificationToken -otp -otpExpiry');

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        await AuditLog.create({
            userId: req.user._id,
            action: 'VIEW_PROFILE',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        return res.status(200).json(
            new ApiResponse(200, user, "User profile retrieved successfully")
        );
    } catch (error) {
        console.error("Error in getUserProfile:", error);

        await AuditLog.create({
            userId: req.user?._id,
            action: 'VIEW_PROFILE',
            status: 'FAILURE',
            error: error?.message,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        throw new ApiError(500, error?.message || "Error retrieving user profile");
    }
});


// Refresh access token
export const refreshAccessToken = asynchandler(async (req, res) => {
    try {
        // Get refresh token from cookies or request body
        const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        console.log('Incoming refresh token:', incomingRefreshToken ? 'Present' : 'Missing');

        if (!incomingRefreshToken) {
            throw new ApiError(401, "Refresh token is required");
        }

        try {
            // Verify the refresh token
            const decodedToken = jwt.verify(
                incomingRefreshToken,
                process.env.REFRESH_TOKEN_SECRET
            );
            console.log('Token decoded successfully for user:', decodedToken._id);

            // Find user
            const user = await User.findById(decodedToken?._id);
            if (!user) {
                throw new ApiError(401, "Invalid refresh token - user not found");
            }

            // Check if the refresh token exists in an active session
            const session = await Session.findOne({
                userId: user._id,
                refreshToken: incomingRefreshToken,
                isActive: true
            });

            if (!session) {
                throw new ApiError(401, "Refresh token is expired or used");
            }

            // Generate new tokens
            const { accessToken, refreshToken: newRefreshToken } = await TokenManager.generateTokens(user);

            // Update the session with the new refresh token
            session.refreshToken = newRefreshToken;
            await session.save();

            const options = {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production"
            };

            return res
                .status(200)
                .cookie("accessToken", accessToken, options)
                .cookie("refreshToken", newRefreshToken, options)
                .json(
                    new ApiResponse(
                        200,
                        { accessToken, refreshToken: newRefreshToken },
                        "Access token refreshed successfully"
                    )
                );
        } catch (jwtError) {
            console.error('JWT verification error:', jwtError);
            if (jwtError.name === 'TokenExpiredError') {
                throw new ApiError(401, "Refresh token has expired");
            }
            if (jwtError.name === 'JsonWebTokenError') {
                throw new ApiError(401, "Invalid refresh token");
            }
            throw jwtError;
        }
    } catch (error) {
        console.error('Refresh token error:', error);
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(401, "Failed to refresh access token");
    }
});

// Privacy policy
export const privacypolicy = asynchandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, {
            policy: "Your privacy policy content here"
        }, "Privacy policy retrieved successfully")
    );
});

// Resend verification code
export const resendVerificationCode = asynchandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const normalizedEmail = email.toLowerCase();
    const tempUser = await TempUser.findOne({ email: normalizedEmail });

    if (!tempUser) {
        throw new ApiError(404, "No pending verification found for this email");
    }

    // Generate new verification code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update temporary user with new code
    tempUser.verificationCode = verificationCode;
    tempUser.verificationCodeExpires = verificationExpiry;
    await tempUser.save();

    // Send new verification email
    await EmailVerificationManager.sendVerificationEmail(tempUser, `Your new verification code is: ${verificationCode}`);

    // Log resend attempt
    await AuditLog.create({
        userId: tempUser._id,
        action: 'EMAIL_VERIFICATION_ATTEMPT',
        status: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    return res.status(200).json(
        new ApiResponse(200, null, "New verification code sent successfully")
    );
});
 