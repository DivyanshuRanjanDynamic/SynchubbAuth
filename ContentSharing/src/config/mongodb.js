import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://content-mongodb:27017/contentDB';

// Handle connection events
mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
});

export const initializeMongoDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        logger.info('MongoDB connection established');

        // Test the connection
        const isConnected = mongoose.connection.readyState === 1;
        if (!isConnected) {
            logger.error('MongoDB connection test failed');
            return false;
        }
        return true;
    } catch (error) {
        logger.error('MongoDB connection failed:', error);
        return false;
    }
};

// Export mongoose instance for use in models
export { mongoose }; 