import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import authRoutes from './Auth/routes/auth.route.js';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Constants
export const DBNAME = 'AuthenticationSynchubbDb';

// Initialize express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

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
            domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined
        },
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
            callbackURL: '/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            // Handle Google authentication
            return done(null, profile);
        }
    )
);

passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: '/auth/github/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            // Handle GitHub authentication
            return done(null, profile);
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

