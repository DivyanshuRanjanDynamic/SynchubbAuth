import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

// Create rate limiter for API endpoints
export const apiLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rate-limit:api:'
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Please try again later'
        });
    }
});

// Create rate limiter for authentication endpoints
export const authLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rate-limit:auth:'
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many authentication attempts',
            message: 'Please try again later'
        });
    }
});

// Create rate limiter for socket connections
export const socketLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rate-limit:socket:'
    }),
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 connections per minute
    message: 'Too many socket connections, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Socket rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many socket connections',
            message: 'Please try again later'
        });
    }
}); 