import express from 'express';
import authRoutes from './Auth/routes/auth.route.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
export const app = express();
import passport from './Auth/passport.js';

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const corsOptions = {
    origin: process.env.CLIENT_URL,
    credentials: true
};
app.use(cors(corsOptions));
app.use(cookieParser());

// Session configuration
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api/auth", authRoutes);

// Error handling middleware (moved after routes)
app.use(async (err, req, res, next) => {
    console.error('Error Stack:', err.stack);
    console.error('Request Method:', req.method);
    console.error('Request URL:', req.url);
    console.error('Session State:', JSON.stringify(req.session));
    
    res.status(err.status || 500).json({
        error: {
            status: err.status || 500,
            message: err.message || 'Internal Server Error'
        },
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

