import Queue from 'bull';
import { logger } from '../utils/logger.js';

// Parse Redis URL to get connection details
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

// Extract host and port from URL
const redisUrl = new URL(REDIS_URL);
const redisHost = redisUrl.hostname;
const redisPort = redisUrl.port || 6379;

// Create queues
export const contentQueue = new Queue('content-processing', {
    redis: {
        url: REDIS_URL,
        password: REDIS_PASSWORD
    }
});

// Process content queue
contentQueue.process('process-content', async (job) => {
    try {
        const { contentId, type } = job.data;
        logger.info(`Processing content ${contentId} of type ${type}`);
        
        // Add your content processing logic here
        // For example: generate thumbnails, process video, etc.
        
        logger.info(`Content ${contentId} processed successfully`);
    } catch (error) {
        logger.error('Error processing content:', error);
        throw error;
    }
});

// Initialize queues
export const initializeQueues = async () => {
    try {
        // Clear existing jobs
        await contentQueue.empty();
        
        // Add queue event handlers
        contentQueue.on('completed', (job) => {
            logger.info(`Job ${job.id} completed`);
        });

        contentQueue.on('failed', (job, error) => {
            logger.error(`Job ${job.id} failed:`, error);
        });

        contentQueue.on('error', (error) => {
            logger.error('Content queue error:', error);
        });

        return true;
    } catch (error) {
        logger.error('Failed to initialize queues:', error);
        return false;
    }
}; 