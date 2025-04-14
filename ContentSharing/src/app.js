import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { connectDB } from './config/mongodb.js';
import { initializeRedis } from './config/redis.js';
import { logger } from './utils/logger.js';
import contentRoutes from './routes/contentRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/content', contentRoutes);

// Error handling
app.use(errorHandler);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Initialize connections and start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // Initialize MongoDB
        const mongoConnected = await connectDB();
        if (!mongoConnected) {
            throw new Error('Failed to connect to MongoDB');
        }

        // Initialize Redis
        const redisConnected = await initializeRedis();
        if (!redisConnected) {
            logger.warn('Failed to connect to Redis - some features may be limited');
        }

        // Start server
        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export { app }; 