import jwt from 'jsonwebtoken';
import { asynchandler } from '../utils/asynchandler.js';
import { ApiError } from '../utils/apiError.js';
import { User } from '../model/user.model.js';

export const verifyJWT = asynchandler(async (req, res, next) => {
    try {
        // Skip authentication for health check endpoint
        if (req.path === '/api/auth/health') {
            return next();
        }

        // Get token from cookies or Authorization header
        const token = req.cookies?.accessToken || 
                     req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }

        // Verify token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // Find user
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid Access Token");
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        // Allow health check to pass even with invalid token
        if (req.path === '/api/auth/health') {
            return next();
        }
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});