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

// Register new user
export const registerUser = asynchandler(async (req, res) => {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            throw new ApiError(409, "User already exists");
        }

    // Create new user
        const user = await User.create({
            username: username.toLowerCase(),
            email,
            password
        });

    // Generate verification token and send email
    const verificationToken = await EmailVerificationManager.generateVerificationToken(user);
    await EmailVerificationManager.sendVerificationEmail(user, verificationToken);

    // Log registration
    await AuditLog.create({
        userId: user._id,
        action: 'REGISTER',
        status: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    return res.status(201).json(
        new ApiResponse(201, null, "Registration successful. Please check your email for verification.")
    );
});

// Login user
export const loginUser = asynchandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(401, "Invalid credentials");
    }

    // Check if account is locked
    if (user.isLocked()) {
        throw new ApiError(423, "Account is locked. Please try again later.");
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        await user.incrementLoginAttempts();
        throw new ApiError(401, "Invalid credentials");
    }

    // Reset login attempts
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

        // Generate tokens
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
});

// Logout user
export const logoutUser = asynchandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        throw new ApiError(400, "Refresh token is required");
    }

    // Find and deactivate session
    const session = await Session.findOne({ refreshToken });
    if (session) {
        await session.deactivate();
    }

    // Blacklist the refresh token
    await TokenManager.blacklistToken(refreshToken);

    // Log logout
    await AuditLog.create({
        userId: req.user._id,
        action: 'LOGOUT',
        status: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

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
    const { username, email, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Verify current password if changing password
    if (newPassword) {
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            throw new ApiError(401, "Current password is incorrect");
        }
        user.password = newPassword;
    }

    // Update other fields
    if (username) user.username = username.toLowerCase();
    if (email) user.email = email;

    await user.save();

    return res.status(200).json(
        new ApiResponse(200, {
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        }, "Profile updated successfully")
    );
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

    // Soft delete the user
    user.isActive = false;
    user.deactivatedAt = new Date();
    await user.save();

    // Deactivate all sessions
    await Session.updateMany(
        { userId: user._id, isActive: true },
        { isActive: false }
    );

    return res.status(200).json(
        new ApiResponse(200, null, "Account deleted successfully")
    );
});

// Verify email
export const verifyEmail = asynchandler(async (req, res) => {
    const { token } = req.params;
    await EmailVerificationManager.verifyEmail(token);

    return res.status(200).json(
        new ApiResponse(200, null, "Email verified successfully")
    );
});

// Forgot password
export const forgotPassword = asynchandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user) {
        const resetToken = await PasswordResetManager.generateResetToken(user);
        await PasswordResetManager.sendResetEmail(user, resetToken);
    }

    // Always return success to prevent email enumeration
    return res.status(200).json(
        new ApiResponse(200, null, "If an account exists with this email, you will receive a password reset link.")
    );
});

// Request password reset
export const requestPasswordReset = asynchandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    await PasswordResetManager.resetPassword(token, password);

    return res.status(200).json(
        new ApiResponse(200, null, "Password has been reset successfully")
    );
});

// Reset password with token
export const resetPasswordWithToken = asynchandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    await PasswordResetManager.resetPassword(token, password);

    return res.status(200).json(
        new ApiResponse(200, null, "Password has been reset successfully")
    );
});

// Change password (for logged-in users)
export const changePassword = asynchandler(async (req, res) => {
    const { previousPassword, newPassword, confirmPassword } = req.body;
    
    if (!previousPassword) {
        throw new ApiError(400, "Please fill all fields");
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
        throw new ApiError(400, "Unauthorized user");
    }

    if (!newPassword || !confirmPassword) {
        throw new ApiError(400, "Please fill both fields");
    }

    if (newPassword !== confirmPassword) {
        throw new ApiError(400, "Passwords do not match");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, "Password Updated Successfully", user)
    );
});

// Get user sessions
export const getSessions = asynchandler(async (req, res) => {
    const sessions = await Session.find({ 
        userId: req.user._id,
        isActive: true 
    });

    return res.status(200).json(
        new ApiResponse(200, sessions, "Sessions retrieved successfully")
    );
});

// Revoke session
export const revokeSession = asynchandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = await Session.findOne({ 
        _id: sessionId,
        userId: req.user._id 
    });

    if (!session) {
        throw new ApiError(404, "Session not found");
    }

    await session.deactivate();
    await TokenManager.blacklistToken(session.refreshToken);

    return res.status(200).json(
        new ApiResponse(200, null, "Session revoked successfully")
    );
});

// Revoke all sessions
export const revokeAllSessions = asynchandler(async (req, res) => {
    try {
        await Session.updateMany(
            { userId: req.user._id },
            { isActive: false }
        );

        return res.status(200).json(
            new ApiResponse(200, null, "All sessions revoked successfully")
        );
    } catch (error) {
        throw new ApiError(500, error?.message || "Error revoking sessions");
    }
});

// Get user profile
export const getUserProfile = asynchandler(async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -refreshToken');
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        return res.status(200).json(
            new ApiResponse(200, user, "User profile retrieved successfully")
        );
    } catch (error) {
        throw new ApiError(500, error?.message || "Error retrieving user profile");
    }
});

// Refresh access token
export const refreshAccessToken = asynchandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized request");
        }

        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const { accessToken, newRefreshToken } = await TokenManager.generateTokens(user._id);

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
                    "Access token refreshed"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
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
