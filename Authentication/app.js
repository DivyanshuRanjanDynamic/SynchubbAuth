// Import environment configuration first
import { env } from './config/env.js';

// Import other dependencies
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import authRoutes from './Auth/routes/auth.route.js';
import mongoose from 'mongoose';
import helmet from 'helmet';
import { User } from './Auth/model/user.model.js'; // Import User model
import { TokenManager } from './Auth/utils/tokenManager.js'; // Import TokenManager
import './Auth/passport.js'; // Import and execute the passport configuration

// Constants
export const DBNAME = 'AuthenticationSynchubbDb';

// Initialize express app
const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://www.synchubb.in", env.SERVER_URL, env.CLIENT_URL],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'", "https://www.synchubb.in"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
    origin: process.env.CLIENT_URL || 'https://www.synchubb.in',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Session configuration
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'your-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            domain: process.env.NODE_ENV === 'production' ? '.synchubb.in' : undefined
        },
        name: 'synchubb.sid'
    })
);

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Serialize user
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// OAuth Authentication Routes (Moved from auth.route.js to root level)
app.get("/google",
    (req, res, next) => {
        console.log('Initiating Google OAuth flow');
        passport.authenticate("google", { 
            scope: ["profile", "email"],
            prompt: "select_account"
        })(req, res, next);
    }
);

app.get("/google/callback",
    (req, res, next) => {
        console.log('--- ENTERING GOOGLE CALLBACK ROUTE HANDLER ---');
        console.log('Received Google callback');
        passport.authenticate("google", {
            failureRedirect: `${process.env.CLIENT_URL}/auth/login?error=google_auth_failed`,
            session: false // Crucial for stateless API usage
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

            // Redirect to dashboard (or wherever your frontend expects after login)
            console.log('Redirecting to dashboard');
            res.redirect(`${process.env.CLIENT_URL}/dashboard/home`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${process.env.CLIENT_URL}/auth/login?error=oauth_error`);
        }
    }
);

app.get("/github",
    (req, res, next) => {
        console.log('Initiating GitHub OAuth flow');
        passport.authenticate("github", {
            scope: ["user:email"]
        })(req, res, next);
    }
);

app.get("/github/callback",
    (req, res, next) => {
        console.log('--- ENTERING GITHUB CALLBACK ROUTE HANDLER ---');
        console.log('Received GitHub callback');
        passport.authenticate("github", {
            failureRedirect: `${process.env.CLIENT_URL}/auth/login?error=github_auth_failed`,
            session: false // Crucial for stateless API usage
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
            res.redirect(`${process.env.CLIENT_URL}/dashboard/home`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${process.env.CLIENT_URL}/auth/login?error=oauth_error`);
        }
    }
);

// Routes
app.use("/auth", authRoutes);

// Health check endpoint
app.get("/health", async (req, res) => {
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

export { app };

