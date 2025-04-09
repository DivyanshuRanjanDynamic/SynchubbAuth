import express from "express";
import { 
    registerUser,
    loginUser,
    logoutUser,
    resetPasswordWithToken,
    changePassword,
    verifyEmail,
    requestPasswordReset,
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
import { validateLogin, validateRegister, validateRequest } from '../middleware/validator.js';
import { checkRole } from '../middleware/rbac.js';
import { securityHeaders } from '../middleware/securityHeaders.js';
import passport from "passport";

const router = express.Router();

// Apply security headers to all routes
router.use(securityHeaders);

// Public Routes
router.post("/register", apiLimiter, validateRegister, validateRequest, registerUser);
router.post("/login",loginLimiter, validateLogin, validateRequest,loginUser);
router.get("/verify-email/:token",apiLimiter,verifyEmail);
router.post("/forgot-password",apiLimiter,requestPasswordReset);
router.post("/reset-password/:token",apiLimiter,resetPasswordWithToken);
router.get("/privacy-policy",privacypolicy);
// Social Authentication Routes
router.get("/google",
    passport.authenticate("google", { 
        scope: ["profile", "email"],
        prompt: "select_account" // Forces account selection
    })
);
router.get("/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/login",
        session: false
    }),
    (req, res) => {
        // Generate tokens and redirect with them
        const token = req.user.generateAccessToken();
        res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
    }
);
router.get("/github",
    passport.authenticate("github", {
        scope: ["user:email"]
    })
);
router.get("/github/callback",
    passport.authenticate("github", {
        failureRedirect: "/login",
        session: false
    }),
    (req, res) => {
        // Generate tokens and redirect with them
        const token = req.user.generateAccessToken();
        res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
    }
);
// Protected Routes (require authentication)
router.use(verifyJWT); // All routes below this will require authentication
router.post("/logout",apiLimiter,logoutUser);
router.post("/change-password",apiLimiter,changePassword);
router.get("/refresh-token",apiLimiter,refreshAccessToken);
router.get("/me",apiLimiter,getUserProfile);
router.put("/profile",apiLimiter,updateUserProfile);
router.delete("/account",apiLimiter,deleteAccount);
router.get("/sessions", apiLimiter,checkRole(['user', 'admin']),getSessions);
router.delete("/sessions/:sessionId",apiLimiter,checkRole(['user', 'admin']), revokeSession);
router.delete("/sessions",apiLimiter,checkRole(['user', 'admin']), revokeAllSessions);
// Home route (protected)
router.get("/home",
    apiLimiter,
    (req, res) => {
        res.json({
            message: "Welcome to the home page",
            user: {
                id: req.user._id,
                username: req.user.username,
                email: req.user.email,
                role: req.user.role
            }
        });
    }
);

export default router; 