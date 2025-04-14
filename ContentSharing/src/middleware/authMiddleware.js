import jwt from 'jsonwebtoken';
import { createError } from '../utils/error.js';
import { logger } from '../utils/logger.js';

export const authMiddleware = async (req, res, next) => {
    try {
        // Skip authentication for health check endpoint
        if (req.path === '/health') {
            return next();
        }

        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw createError(401, 'No token provided');
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        
        // Attach user info to request
        req.user = {
            id: decoded._id,
            email: decoded.email,
            username: decoded.username,
            role: decoded.role
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            logger.error('Invalid token:', error.message);
            return next(createError(401, 'Invalid token'));
        }
        if (error.name === 'TokenExpiredError') {
            logger.error('Token expired:', error.message);
            return next(createError(401, 'Token expired'));
        }
        next(error);
    }
}; 