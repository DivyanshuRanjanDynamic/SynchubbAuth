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
    origin: "",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization']
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
            domain: process.env.NODE_ENV === 'production' ? 'synchubb.in' : undefined
        },
        name: 'synchubb.sid'
    })
);

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.SERVER_URL}/auth/google/callback`,
            scope: ['profile', 'email']
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('Google OAuth callback received');
                return done(null, profile);
            } catch (error) {
                console.error('Google OAuth error:', error);
                return done(error, null);
            }
        }
    )
);

passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: `${process.env.SERVER_URL}/auth/github/callback`,
            scope: ['user:email']
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('GitHub OAuth callback received');
                return done(null, profile);
            } catch (error) {
                console.error('GitHub OAuth error:', error);
                return done(error, null);
            }
        }
    )
);

// Serialize user
passport.serializeUser((user, done) => {
    done(null, user);
});

// Deserialize user
passport.deserializeUser((user, done) => {
    done(null, user);
});

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

