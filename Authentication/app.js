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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
const isProd = process.env.NODE_ENV === 'production';
app.use(cors({
    origin: [ process.env.CLIENT_URL , "https://www.synchubb.in" , "http://localhost:5173","http://localhost:8080","https://synchubb-matri-frontend.vercel.app/dashboard/maitri"] ,
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
            secure: isProd,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: isProd ? 'none' : 'lax',
            domain: isProd ? '.synchubb.in' : undefined
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
        console.log('Request headers:', req.headers);
        passport.authenticate("google", { 
            scope: ["profile", "email"],
            prompt: "select_account"
        })(req, res, next);
    }
);

app.get("/auth/google/callback",
    (req, res, next) => {
        console.log('--- ENTERING GOOGLE CALLBACK ROUTE HANDLER ---');
        console.log('Received Google callback');
        console.log('Callback query params:', req.query);
        passport.authenticate("google", {
            failureRedirect: `${process.env.CLIENT_URL}/auth/login?error=google_auth_failed`,
            session: false
        })(req, res, next);
    },
    async (req, res) => {
        try {
            console.log('Processing Google callback');
            console.log('User from passport:', req.user);
            
            // Note: Passport strategy should return a user object from the DB
            const user = req.user;
            
            // Generate a token

            const {accessToken, refreshToken}= await TokenManager.generateTokens(user);
            
            // Update last login
            user.lastLogin = new Date();
            await user.save({ validateBeforeSave: false });

            // Redirect to the frontend callback URL with the token
            const redirectUrl = `${env.CLIENT_URL}/auth/callback?token=${accessToken}`;
            console.log(`Redirecting to: ${redirectUrl}`);
            res.redirect(redirectUrl);
            
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${env.CLIENT_URL}/auth/login?error=oauth_processing_failed`);
        }
    }
);

app.get("/github",
    (req, res, next) => {
        console.log('Initiating GitHub OAuth flow');
        console.log('Request headers:', req.headers);
        passport.authenticate("github", {
            scope: ["user:email"]
        })(req, res, next);
    }
);

app.get("/auth/github/callback",
    (req, res, next) => {
        console.log('--- ENTERING GITHUB CALLBACK ROUTE HANDLER ---');
        console.log('Received GitHub callback');
        console.log('Callback query params:', req.query);
        passport.authenticate("github", {
            failureRedirect: `${process.env.CLIENT_URL}/auth/login?error=github_auth_failed`,
            session: false
        })(req, res, next);
    },
    async (req, res) => {
        try {
            console.log('Processing GitHub callback');
            console.log('User from passport:', req.user);
            
            // Note: Passport strategy should return a user object from the DB
            const user = req.user;

            // Generate a token
            const {accessToken, refreshToken}= await  TokenManager.generateTokens(user);

            // Update last login
            user.lastLogin = new Date();
            await user.save({ validateBeforeSave: false });

            // Redirect to the frontend callback URL with the token
            const redirectUrl = `${env.CLIENT_URL}/auth/callback?token=${accessToken}`;
            console.log(`Redirecting to: ${redirectUrl}`);
            res.redirect(redirectUrl);
            
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${env.CLIENT_URL}/auth/login?error=oauth_processing_failed`);
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

