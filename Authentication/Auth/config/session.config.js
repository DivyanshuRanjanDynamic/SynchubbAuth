import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
import { logger } from '../utils/logger.js';

// Create Redis client
const redisClient = createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    database: parseInt(process.env.REDIS_DB || '0'),
    legacyMode: true,
    socket: {
        // Only use TLS in production, not in local development
        tls: process.env.NODE_ENV === 'production',
        rejectUnauthorized: false
    }
});

redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    logger.info('Connected to Redis');
});

// Initialize Redis store
const redisStore = new RedisStore({
    client: redisClient,
    prefix: 'auth:',
    ttl: 86400 // 24 hours
});

// Session configuration
const sessionConfig = {
    store: redisStore,
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
    }
};

export default sessionConfig; 