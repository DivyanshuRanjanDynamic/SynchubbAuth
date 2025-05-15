import jwt from 'jsonwebtoken';
import { asynchandler } from '../utils/asynchandler.js';
import { ApiError } from '../utils/apiError.js';
import { User } from '../model/user.model.js';

// List of public routes that don't require authentication
const publicRoutes = [
    '/register',
    '/login',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/health',
    '/google',
    '/google/callback',
    '/github',
    '/github/callback'
];

export const verifyJWT = asynchandler(async (req, res, next) => {
    try {
        // Get the base path (remove /auth prefix if present)
        const basePath = req.path.startsWith('/auth') ? req.path.substring(5) : req.path;
        console.log('Verifying JWT for path:', basePath);

        // Check if the current route is public
        const isPublicRoute = publicRoutes.some(route => 
            basePath.startsWith(route)
        );

        // Skip authentication for public routes
        if (isPublicRoute) {
            console.log('Skipping JWT verification for public route:', basePath);
            return next();
        }

        // Get token from cookies or Authorization header
        const token = req.cookies?.accessToken || 
                     req.header("Authorization")?.replace("Bearer ", "");
        
        console.log('Token found:', token ? 'Yes' : 'No');
        console.log('Authorization header:', req.header("Authorization"));
        console.log('Cookies:', req.cookies);

        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }

        // Verify token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        console.log('Token decoded successfully for user:', decodedToken._id);

        // Find user
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid Access Token");
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('JWT verification error:', error);
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});