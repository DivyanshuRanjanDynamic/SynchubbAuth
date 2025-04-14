import { createClient } from 'redis';
import { logger } from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

// Create Redis client
const redisClient = createClient({
    url: REDIS_URL,
    password: REDIS_PASSWORD,
    socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                logger.error('Redis max reconnection attempts reached');
                return new Error('Redis max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
        }
    }
});

redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    logger.info('Redis connection established');
});

redisClient.on('ready', () => {
    logger.info('Redis client ready');
});

redisClient.on('end', () => {
    logger.warn('Redis connection ended');
});

export const initializeRedis = async () => {
    try {
        await redisClient.connect();
        
        // Test the connection
        await redisClient.ping();
        logger.info('Redis connection test successful');
        return true;
    } catch (error) {
        logger.error('Redis connection failed:', error.message);
        return false;
    }
};

export { redisClient }; 