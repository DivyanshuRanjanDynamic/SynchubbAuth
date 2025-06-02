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
    privacypolicy
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

const router = express.Router();

// Apply security headers to all routes
router.use(securityHeaders);

// Public Routes
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

router.get("/verify-email",
    apiLimiter,
    verifyEmail
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
            failureRedirect: `${process.env.CLIENT_URL}/login?error=google_auth_failed`,
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
                secure: process.env.NODE_ENV === 'production'
            };
            res.cookie('accessToken', token, options);

            // Redirect to Home route
            console.log('Redirecting to Home route');
            res.redirect('/auth/Home');
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_error`);
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
            failureRedirect: `${process.env.CLIENT_URL}/login?error=github_auth_failed`,
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
                secure: process.env.NODE_ENV === 'production'
            };
            res.cookie('accessToken', token, options);

            // Redirect to Home route
            console.log('Redirecting to Home route');
            res.redirect('/auth/Home');
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_error`);
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