import express from "express";
import { 
    registerUser,
    loginUser,
    logoutUser,
    resetPassword,
    changePassword,
    verifyEmail,
    forgotPassword,
    refreshAccessToken,
    getUserProfile,
    updateUserProfile,
    deleteAccount,
    getSessions,
    revokeSession,
    revokeAllSessions,
    privacypolicy,
    resendVerificationCode
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { loginLimiter, apiLimiter } from '../middleware/rateLimiter.js';
import { 
    validateLogin, 
    validateRegister, 
    validateRequest,
    validatePasswordReset,
    validateNewPassword,
    validateProfileUpdate,
    validateAccountDeletion 
} from '../middleware/validator.js';
import { checkRole } from '../middleware/rbac.js';
import { securityHeaders } from '../middleware/securityHeaders.js';
import passport from "passport";
import { User } from "../model/user.model.js";
import mongoose from "mongoose";

const router = express.Router();

// Apply security headers to all routes
router.use(securityHeaders);

// Public Routes
router.get("/health", async (req, res) => {
    try {
        // Check MongoDB connection
        const mongoStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
        
        // Check if the application is responding
        const appStatus = 'healthy';
        
        // Determine overall status
        const overallStatus = mongoStatus === 'healthy' && appStatus === 'healthy' ? 'healthy' : 'unhealthy';
        
        // Set appropriate status code
        const statusCode = overallStatus === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json({
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: {
                mongodb: {
                    status: mongoStatus,
                    connectionState: mongoose.connection.readyState
                },
                application: {
                    status: appStatus
                }
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.post("/register", 
    apiLimiter, 
    validateRegister, 
    validateRequest, 
    registerUser
);

router.post("/login",
    loginLimiter, 
    validateLogin, 
    validateRequest,
    loginUser
);

router.post("/verify-email",
    apiLimiter,
    verifyEmail
);

router.post("/resend-verification",
    apiLimiter,
    resendVerificationCode
);

router.post("/forgot-password",
    apiLimiter,
    validatePasswordReset,
    validateRequest,
    forgotPassword
);

router.post("/reset-password/:token",
    apiLimiter,
    validateNewPassword,
    validateRequest,
    resetPassword
);

router.get("/privacy-policy", privacypolicy);

// Social Authentication Routes
router.get("/google",
    (req, res, next) => {
        console.log('Initiating Google OAuth flow');
        passport.authenticate("google", { 
            scope: ["profile", "email"],
            prompt: "select_account"
        })(req, res, next);
    }
);

router.get("/google/callback",
    (req, res, next) => {
        console.log('Received Google callback');
        passport.authenticate("google", {
            failureRedirect: `${process.env.CLIENT_URL || 'https://www.synchubb.in'}/auth/login?error=google_auth_failed`,
            session: false
        })(req, res, next);
    },
    async (req, res) => {
        try {
            console.log('Processing Google callback');
            const user = await User.findOrCreateOAuthUser(req.user, 'google');
            const token = user.generateAccessToken();
            
            // Update last login
            user.lastLogin = new Date();
            await user.save();

            // Set auth token in cookie
            const options = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                domain: process.env.NODE_ENV === 'production' ? '.synchubb.in' : undefined
            };
            res.cookie('accessToken', token, options);

            // Redirect to dashboard
            console.log('Redirecting to dashboard');
            res.redirect(`${process.env.CLIENT_URL || 'https://www.synchubb.in'}/dashboard/home`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${process.env.CLIENT_URL || 'https://www.synchubb.in'}/auth/login?error=oauth_error`);
        }
    }
);

router.get("/github",
    (req, res, next) => {
        console.log('Initiating GitHub OAuth flow');
        passport.authenticate("github", {
            scope: ["user:email"]
        })(req, res, next);
    }
);

router.get("/github/callback",
    (req, res, next) => {
        console.log('Received GitHub callback');
        passport.authenticate("github", {
            failureRedirect: `${process.env.CLIENT_URL || 'https://www.synchubb.in'}/auth/login?error=github_auth_failed`,
            session: false
        })(req, res, next);
    },
    async (req, res) => {
        try {
            console.log('Processing GitHub callback');
            const user = await User.findOrCreateOAuthUser(req.user, 'github');
            const token = user.generateAccessToken();
            
            // Update last login
            user.lastLogin = new Date();
            await user.save();

            // Set auth token in cookie
            const options = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                domain: process.env.NODE_ENV === 'production' ? '.synchubb.in' : undefined
            };
            res.cookie('accessToken', token, options);

            // Redirect to dashboard
            console.log('Redirecting to dashboard');
            res.redirect(`${process.env.CLIENT_URL || 'https://www.synchubb.in'}/dashboard/home`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${process.env.CLIENT_URL || 'https://www.synchubb.in'}/auth/login?error=oauth_error`);
        }
    }
);

// Protected Routes (require authentication)
router.use(verifyJWT);

router.post("/logout",
    apiLimiter,
    logoutUser
);

router.post("/change-password",
    apiLimiter,
    validateNewPassword,
    validateRequest,
    changePassword
);

router.get("/refresh-token",
    apiLimiter,
    refreshAccessToken
);

router.get("/me",
    apiLimiter,
    getUserProfile
);

router.put("/profile",
    apiLimiter,
    validateProfileUpdate,
    validateRequest,
    updateUserProfile
);

router.delete("/account",
    apiLimiter,
    validateAccountDeletion,
    validateRequest,
    deleteAccount
);

// Session Management Routes
router.get("/sessions", 
    apiLimiter,
    checkRole(['user', 'admin']),
    getSessions
);

router.delete("/sessions/:sessionId",
    apiLimiter,
    checkRole(['user', 'admin']), 
    revokeSession
);

router.delete("/delete-all-sessions",
    apiLimiter,
    checkRole(['user', 'admin']), 
    revokeAllSessions
);

// Home route (protected)
router.get("/Home",
    verifyJWT,  // Protect this route
    (req, res) => {
        res.json({
            status: 'success',
            message: "Welcome to Home",
            data: {
                user: {
                    id: req.user._id,
                    username: req.user.username,
                    email: req.user.email,
                    role: req.user.role
                }
            }
        });
    }
);

// Error handling for undefined routes
router.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

export default router; 