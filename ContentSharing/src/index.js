import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import swaggerUi from 'swagger-ui-express';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import contentRoutes from './routes/contentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { initializeRedis } from './config/redis.js';
import { initializeMongoDB } from './config/mongodb.js';
import { initializeQueues } from './workers/queue.js';
import { swaggerSpec } from './config/swagger.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (before rate limiter)
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Apply rate limiter to all routes except health check
app.use((req, res, next) => {
  if (req.path === '/api/v1/health') {
    return next();
  }
  rateLimiter(req, res, next);
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Content Sharing API Documentation'
}));

// Static files
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// Routes
app.use('/api/content', authMiddleware, contentRoutes);
app.use('/api/users', authMiddleware, userRoutes);

// Error handling
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);

  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });

  // Handle real-time notifications
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
    logger.info(`User ${userId} joined their room`);
  });
});

// Initialize services
const initializeServices = async () => {
  try {
    // Initialize MongoDB
    const mongoInitialized = await initializeMongoDB();
    if (!mongoInitialized) {
      throw new Error('MongoDB initialization failed');
    }

    // Initialize Redis
    const redisInitialized = await initializeRedis();
    if (!redisInitialized) {
      throw new Error('Redis initialization failed');
    }

    // Initialize queues
    await initializeQueues();
    logger.info('Queues initialized');

    // Start server
    const PORT = process.env.PORT || 8001;
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
};

// Start the application
initializeServices();

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
  process.exit(1);
}); 