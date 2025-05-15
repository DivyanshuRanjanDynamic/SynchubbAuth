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


    console.log(verificationToken);
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
    // Get both tokens
    const accessToken = req.cookies?.accessToken || 
                       req.header("Authorization")?.replace("Bearer ", "");
    const refreshToken = req.cookies?.refreshToken;

    if (!accessToken) {
        throw new ApiError(400, "Access token is required");
    }

    // Get user ID from the access token
    const decodedToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    const userId = decodedToken._id;

    // Deactivate all active sessions for this user
    await Session.updateMany(
        { userId, isActive: true },
        { isActive: false }
    );

    // Blacklist both tokens
    if (accessToken) {
        await TokenManager.blacklistToken(accessToken, 'LOGOUT');
    }
    if (refreshToken) {
        await TokenManager.blacklistToken(refreshToken, 'LOGOUT');
    }

    // Log logout
    await AuditLog.create({
        userId,
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
    try {
        const { username, email } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // Update profile fields
        if (username) {
            // Check if username is already taken
            const existingUser = await User.findOne({ 
                username: username.toLowerCase(),
                _id: { $ne: user._id }
            });
            if (existingUser) {
                throw new ApiError(409, "Username is already taken");
            }
            user.username = username.toLowerCase();
        }

        if (email) {
            // Check if email is already taken
            const existingUser = await User.findOne({ 
                email: email.toLowerCase(),
                _id: { $ne: user._id }
            });
            if (existingUser) {
                throw new ApiError(409, "Email is already taken");
            }
            user.email = email.toLowerCase();
            user.isVerified = false; // Reset verification status if email is changed
        }

        await user.save();

        // Log profile update
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
                "Profile updated successfully"
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

    if (!token) {
        throw new ApiError(400, "Verification token is required");
    }

    try {
        await EmailVerificationManager.verifyEmail(token);
        return res.status(200).json(
            new ApiResponse(200, null, "Email verified successfully")
        );
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(500, "Failed to verify email");
    }
});

// Forgot Password
export const forgotPassword = asynchandler(async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
        // Return success even if user not found to prevent email enumeration
        return res.status(200).json(
            new ApiResponse(200, null, "If an account exists with this email, you will receive a password reset link.")
        );
    }

    try {
        // Generate access token
        const accessToken = await PasswordResetManager.generateAccessToken(user);
        console.log('Generated access token for password reset');
        
        // Log the password reset request
        await AuditLog.create({
            userId: user._id,
            action: 'PASSWORD_RESET',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        return res.status(200).json(
            new ApiResponse(200, null, "You will receive a password reset link on your email.")
        );
    } catch (error) {
        console.error('Error in forgot password:', error);
        
        // Log the error
        await AuditLog.create({
            userId: user._id,
            action: 'PASSWORD_RESET',
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
    console.log('Request params:', req.params);
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    console.log('Token from params:', token);

    if (!token) {
        console.log('Token is missing in URL params');
        throw new ApiError(400, "Reset token is required");
    }

    if (!password) {
        throw new ApiError(400, "New password is required");
    }

    if (password !== confirmPassword) {
        throw new ApiError(400, "New password and confirm password do not match");
    }

    try {
        // Reset password using the access token from params
        await PasswordResetManager.resetPassword(token, password);

        return res.status(200).json(
            new ApiResponse(200, null, "Password has been reset successfully")
        );
    } catch (error) {
        console.error('Error in reset password:', error);
        
        // Log the error
        if (error instanceof ApiError) {
            await AuditLog.create({
                action: 'PASSWORD_RESET',
                status: 'FAILURE',
                error: error.message,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });
        }

        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(500, "Failed to reset password");
    }
});

// Change password (for logged-in users)
export const changePassword = asynchandler(async (req, res) => {
    console.log('Change password request received');
    console.log('Request body:', req.body);
    console.log('User from request:', req.user);

    const { previousPassword, password, confirmPassword } = req.body;
    
    if (!previousPassword) {
        throw new ApiError(400, "Please fill all fields");
    }

    const user = await User.findById(req.user._id).select("+password");
    console.log('User found in database:', user ? 'Yes' : 'No');
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.password) {
        throw new ApiError(400, "User password is missing");
    }

    const isPasswordCorrect = await user.comparePassword(previousPassword);
    console.log('Previous password correct:', isPasswordCorrect);
    
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Unauthorized user");
    }

    if (!password || !confirmPassword) {
        throw new ApiError(400, "Please fill both fields");
    }

    if (password !== confirmPassword) {
        throw new ApiError(400, "Passwords do not match");
    }

    user.password = password;
    await user.save({ validateBeforeSave: false });
    console.log('Password updated successfully for user:', user.email);

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
console.log(req.user._id);
    return res.status(200).json(
        new ApiResponse(200, sessions, "Sessions retrieved successfully")
    );
});

// Revoke session
export const revokeSession = asynchandler(async (req, res) => {
    const { sessionId } = req.params;
    console.log('Revoke Session Debug:', {
        sessionId,
        currentUserId: req.user._id,
        currentUserEmail: req.user.email
    });

    // First check if the session exists at all
    const anySession = await Session.findById(sessionId);
    console.log('Session found in database:', anySession ? {
        sessionId: anySession._id,
        userId: anySession.userId,
        isActive: anySession.isActive
    } : 'No session found');

    // Then check if it belongs to the current user
    const session = await Session.findOne({ 
        _id: sessionId,
        userId: req.user._id 
    });

    if (!session) {
        if (anySession) {
            console.log('Session exists but belongs to different user:', {
                sessionUserId: anySession.userId.toString(),
                currentUserId: req.user._id.toString(),
                isActive: anySession.isActive
            });
        } else {
            console.log('Session ID does not exist in database');
        }
        throw new ApiError(404, "Session not found");
    }

    console.log('Session found and belongs to current user:', {
        sessionId: session._id,
        userId: session.userId,
        isActive: session.isActive
    });

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
 