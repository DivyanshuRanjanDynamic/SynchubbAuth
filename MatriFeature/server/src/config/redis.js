import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

// Create Redis client
export const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3
});

// Handle Redis connection events
redis.on('connect', () => {
    logger.info('Redis client connected');
});

redis.on('error', (error) => {
    logger.error('Redis client error:', error);
});

redis.on('close', () => {
    logger.warn('Redis client connection closed');
});

redis.on('reconnecting', () => {
    logger.info('Redis client reconnecting...');
});

// Test Redis connection
export const testRedisConnection = async () => {
    try {
        await redis.ping();
        logger.info('Redis connection test successful');
        return true;
    } catch (error) {
        logger.error('Redis connection test failed:', error);
        return false;
    }
}; 