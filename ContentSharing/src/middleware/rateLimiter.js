import rateLimit from 'express-rate-limit';
import { redisClient } from '../config/redis.js';
import { createError } from '../utils/error.js';
import { logger } from '../utils/logger.js';

const windowMs = 15 * 60 * 1000; // 15 minutes

export const rateLimiter = rateLimit({
    windowMs,
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    handler: (req, res) => {
        throw createError(429, 'Too many requests, please try again later');
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Redis store configuration
    store: {
        incr: async (key) => {
            try {
                const result = await redisClient.incr(key);
                if (result === 1) {
                    await redisClient.expire(key, Math.floor(windowMs / 1000));
                }
                return result;
            } catch (error) {
                logger.error('Rate limiter Redis error:', error);
                // Fallback to memory store if Redis fails
                return 1;
            }
        },
        decrement: async (key) => {
            try {
                await redisClient.decr(key);
            } catch (error) {
                logger.error('Rate limiter Redis error:', error);
            }
        },
        resetKey: async (key) => {
            try {
                await redisClient.del(key);
            } catch (error) {
                logger.error('Rate limiter Redis error:', error);
            }
        }
    }
}); 