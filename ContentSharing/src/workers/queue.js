import Queue from 'bull';
import { logger } from '../utils/logger.js';

// Get Redis connection details from environment variables
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_DB = process.env.REDIS_DB || 0;

// Create queues
export const contentQueue = new Queue('content-processing', {
    redis: {
        url: REDIS_URL,
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD,
        db: REDIS_DB
    }
});

// Initialize queues
export const initializeQueues = async () => {
    try {
        // Add event listeners
        contentQueue.on('completed', (job) => {
            logger.info(`Job ${job.id} completed`);
        });

        contentQueue.on('failed', (job, err) => {
            logger.error(`Job ${job.id} failed:`, err);
        });

        // Process content
        contentQueue.process('process-content', async (job) => {
            const { contentId, type } = job.data;
            logger.info(`Processing content ${contentId} of type ${type}`);
            
            // Add your content processing logic here
            
            return { success: true };
        });

        // Process sharing
        contentQueue.process('share-content', async (job) => {
            const { contentId, platform, userId } = job.data;
            logger.info(`Sharing content ${contentId} on ${platform} by user ${userId}`);
            
            // Add your sharing logic here
            
            return { success: true };
        });

        logger.info('Queues initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize queues:', error);
        throw error;
    }
}; 