import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';

export const sessionManager = (redis) => {
    return async (req, res, next) => {
        try {
            const sessionId = req.headers['x-session-id'] || req.cookies.sessionId;
            
            if (!sessionId) {
                return next();
            }

            // Get session data from Redis
            const sessionData = await redis.get(`session:${sessionId}`);
            
            if (!sessionData) {
                return next();
            }

            try {
                const session = JSON.parse(sessionData);
                
                // Check if session is expired
                if (session.expiresAt < Date.now()) {
                    await redis.del(`session:${sessionId}`);
                    return next();
                }

                // Attach session to request
                req.session = session;
                
                // Refresh session if it's about to expire
                if (session.expiresAt - Date.now() < 5 * 60 * 1000) { // 5 minutes
                    const newExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
                    await redis.setex(
                        `session:${sessionId}`,
                        24 * 60 * 60, // 24 hours in seconds
                        JSON.stringify({
                            ...session,
                            expiresAt: newExpiresAt
                        })
                    );
                }

                next();
            } catch (error) {
                logger.error('Session parsing error:', error);
                await redis.del(`session:${sessionId}`);
                next();
            }
        } catch (error) {
            logger.error('Session management error:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    };
};

// Create new session
export const createSession = async (userId, data = {}) => {
    try {
        const sessionId = require('crypto').randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        const session = {
            id: sessionId,
            userId,
            expiresAt,
            createdAt: Date.now(),
            ...data
        };

        await redis.setex(
            `session:${sessionId}`,
            24 * 60 * 60, // 24 hours in seconds
            JSON.stringify(session)
        );

        return session;
    } catch (error) {
        logger.error('Session creation error:', error);
        throw new ApiError(500, 'Failed to create session');
    }
};

// Destroy session
export const destroySession = async (sessionId) => {
    try {
        await redis.del(`session:${sessionId}`);
    } catch (error) {
        logger.error('Session destruction error:', error);
        throw new ApiError(500, 'Failed to destroy session');
    }
}; 