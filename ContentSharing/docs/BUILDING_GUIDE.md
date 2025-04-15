# Building the ContentSharing Microservice from Scratch

This guide provides a step-by-step approach to building the ContentSharing microservice from scratch. It covers everything from initial setup to deployment, including architecture decisions, code implementation, and best practices.

## Table of Contents

1. [Project Planning](#project-planning)
2. [Environment Setup](#environment-setup)
3. [Project Structure](#project-structure)
4. [Database Design](#database-design)
5. [Authentication Integration](#authentication-integration)
6. [API Development](#api-development)
7. [File Upload Implementation](#file-upload-implementation)
8. [Real-time Notifications](#real-time-notifications)
9. [Background Processing](#background-processing)
10. [Testing](#testing)
11. [Documentation](#documentation)
12. [Deployment](#deployment)

## Project Planning

### Requirements Analysis

1. **Define Core Features**:
   - User authentication and authorization
   - File upload and storage
   - Content management (CRUD operations)
   - Content sharing and visibility control
   - Real-time notifications
   - Search functionality

2. **Technical Requirements**:
   - Scalable architecture
   - Secure file storage
   - Efficient content processing
   - Real-time capabilities
   - API documentation

3. **Non-functional Requirements**:
   - Performance optimization
   - Security best practices
   - Error handling
   - Logging and monitoring
   - Rate limiting

### Architecture Design

1. **Microservice Architecture**:
   - Separate ContentSharing service from Authentication service
   - Define clear boundaries and responsibilities
   - Plan for inter-service communication

2. **Technology Stack Selection**:
   - **Runtime**: Node.js (for JavaScript/TypeScript)
   - **Framework**: Express.js (for API development)
   - **Database**: MongoDB (for flexible document storage)
   - **Caching**: Redis (for session management and caching)
   - **File Storage**: Cloudinary (for cloud-based file storage)
   - **Authentication**: JWT (for stateless authentication)
   - **Real-time**: Socket.IO (for WebSocket communication)
   - **Background Processing**: Bull (for job queues)
   - **Documentation**: Swagger (for API documentation)
   - **Containerization**: Docker (for consistent environments)

## Environment Setup

### Development Environment

1. **Install Required Software**:
   ```bash
   # Install Node.js (v18 or higher)
   # Install MongoDB
   # Install Redis
   # Install Docker and Docker Compose
   ```

2. **Initialize Project**:
   ```bash
   # Create project directory
   mkdir ContentSharing
   cd ContentSharing
   
   # Initialize npm project
   npm init -y
   
   # Install core dependencies
   npm install express mongoose redis jsonwebtoken multer cloudinary socket.io bull cors helmet morgan dotenv
   
   # Install development dependencies
   npm install --save-dev nodemon jest supertest eslint prettier
   ```

3. **Create Basic Configuration**:
   ```bash
   # Create .env file
   touch .env
   
   # Create .gitignore file
   touch .gitignore
   echo "node_modules/
   .env
   logs/
   uploads/
   .DS_Store" > .gitignore
   ```

4. **Set Up Environment Variables**:
   ```
   # Server Configuration
   NODE_ENV=development
   PORT=8001
   
   # MongoDB Configuration
   MONGO_URI=mongodb://localhost:27017/contentDB
   
   # Redis Configuration
   REDIS_URL=redis://localhost:6379
   REDIS_PASSWORD=your_redis_password
   REDIS_DB=0
   
   # Authentication
   ACCESS_TOKEN_SECRET=your_access_token_secret
   ACCESS_TOKEN_EXPIRY=1hr
   
   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   
   # Client URL
   CLIENT_URL=http://localhost:3000
   ```

## Project Structure

1. **Create Directory Structure**:
   ```bash
   # Create main directories
   mkdir -p src/{config,controllers,middleware,models,routes,services,utils,workers}
   mkdir uploads logs docs
   
   # Create initial files
   touch src/index.js
   touch src/config/{database.js,redis.js,cloudinary.js}
   touch src/middleware/{auth.js,error.js,upload.js,rateLimiter.js}
   touch src/models/{content.js,user.js}
   touch src/routes/{content.js,user.js,health.js}
   touch src/services/{contentService.js,userService.js}
   touch src/utils/{logger.js,validators.js}
   touch src/workers/{queue.js,processors.js}
   ```

2. **Set Up Basic Server**:
   ```javascript
   // src/index.js
   const express = require('express');
   const cors = require('cors');
   const helmet = require('helmet');
   const morgan = require('morgan');
   const { createServer } = require('http');
   const { Server } = require('socket.io');
   const path = require('path');
   const dotenv = require('dotenv');
   
   // Load environment variables
   dotenv.config();
   
   // Import routes
   const healthRoutes = require('./routes/health');
   const contentRoutes = require('./routes/content');
   const userRoutes = require('./routes/user');
   
   // Import middleware
   const errorHandler = require('./middleware/error');
   const rateLimiter = require('./middleware/rateLimiter');
   
   // Import database connection
   const connectDB = require('./config/database');
   
   // Import Redis connection
   const connectRedis = require('./config/redis');
   
   // Import logger
   const logger = require('./utils/logger');
   
   // Create Express app
   const app = express();
   
   // Create HTTP server
   const httpServer = createServer(app);
   
   // Create Socket.IO server
   const io = new Server(httpServer, {
     cors: {
       origin: process.env.CLIENT_URL,
       methods: ['GET', 'POST']
     }
   });
   
   // Connect to MongoDB
   connectDB();
   
   // Connect to Redis
   connectRedis();
   
   // Middleware
   app.use(helmet());
   app.use(cors({
     origin: process.env.CLIENT_URL,
     credentials: true
   }));
   app.use(express.json());
   app.use(express.urlencoded({ extended: true }));
   app.use(morgan('dev'));
   app.use(rateLimiter);
   
   // Static files
   app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
   
   // Routes
   app.use('/api/v1/health', healthRoutes);
   app.use('/api/content', contentRoutes);
   app.use('/api/users', userRoutes);
   
   // Error handling
   app.use(errorHandler);
   
   // Socket.IO connection
   io.on('connection', (socket) => {
     logger.info(`Socket connected: ${socket.id}`);
     
     socket.on('join', (data) => {
       const { userId } = data;
       socket.join(`user:${userId}`);
       logger.info(`User ${userId} joined their room`);
     });
     
     socket.on('disconnect', () => {
       logger.info(`Socket disconnected: ${socket.id}`);
     });
   });
   
   // Start server
   const PORT = process.env.PORT || 8001;
   httpServer.listen(PORT, () => {
     logger.info(`Server running on port ${PORT}`);
   });
   
   // Export for testing
   module.exports = { app, httpServer };
   ```

## Database Design

1. **Define MongoDB Schemas**:
   ```javascript
   // src/models/content.js
   const mongoose = require('mongoose');
   
   const contentSchema = new mongoose.Schema({
     title: {
       type: String,
       required: true,
       trim: true
     },
     description: {
       type: String,
       trim: true
     },
     fileUrl: {
       type: String,
       required: true
     },
     fileType: {
       type: String,
       required: true
     },
     fileSize: {
       type: Number,
       required: true
     },
     tags: [{
       type: String,
       trim: true
     }],
     visibility: {
       type: String,
       enum: ['public', 'private'],
       default: 'private'
     },
     userId: {
       type: String,
       required: true,
       index: true
     },
     createdAt: {
       type: Date,
       default: Date.now
     },
     updatedAt: {
       type: Date,
       default: Date.now
     }
   });
   
   // Update timestamps on save
   contentSchema.pre('save', function(next) {
     this.updatedAt = Date.now();
     next();
   });
   
   // Create indexes
   contentSchema.index({ title: 'text', description: 'text' });
   contentSchema.index({ tags: 1 });
   contentSchema.index({ visibility: 1 });
   
   const Content = mongoose.model('Content', contentSchema);
   
   module.exports = Content;
   ```

   ```javascript
   // src/models/user.js
   const mongoose = require('mongoose');
   
   const userSchema = new mongoose.Schema({
     id: {
       type: String,
       required: true,
       unique: true
     },
     username: {
       type: String,
       required: true,
       trim: true
     },
     email: {
       type: String,
       required: true,
       trim: true,
       lowercase: true
     },
     firstName: {
       type: String,
       trim: true
     },
     lastName: {
       type: String,
       trim: true
     },
     profilePicture: {
       type: String
     },
     createdAt: {
       type: Date,
       default: Date.now
     },
     updatedAt: {
       type: Date,
       default: Date.now
     }
   });
   
   // Update timestamps on save
   userSchema.pre('save', function(next) {
     this.updatedAt = Date.now();
     next();
   });
   
   const User = mongoose.model('User', userSchema);
   
   module.exports = User;
   ```

2. **Set Up Database Connection**:
   ```javascript
   // src/config/database.js
   const mongoose = require('mongoose');
   const logger = require('../utils/logger');
   
   const connectDB = async () => {
     try {
       const conn = await mongoose.connect(process.env.MONGO_URI, {
         useNewUrlParser: true,
         useUnifiedTopology: true
       });
       
       logger.info(`MongoDB Connected: ${conn.connection.host}`);
     } catch (error) {
       logger.error(`Error connecting to MongoDB: ${error.message}`);
       process.exit(1);
     }
   };
   
   module.exports = connectDB;
   ```

## Authentication Integration

1. **Create Authentication Middleware**:
   ```javascript
   // src/middleware/auth.js
   const jwt = require('jsonwebtoken');
   const logger = require('../utils/logger');
   
   const authMiddleware = (req, res, next) => {
     try {
       // Get token from header
       const authHeader = req.headers.authorization;
       
       if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return res.status(401).json({
           success: false,
           error: {
             message: 'Authentication required',
             code: 'UNAUTHORIZED'
           }
         });
       }
       
       const token = authHeader.split(' ')[1];
       
       // Verify token
       const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
       
       // Add user to request
       req.user = decoded;
       
       next();
     } catch (error) {
       logger.error(`Authentication error: ${error.message}`);
       
       return res.status(401).json({
         success: false,
         error: {
           message: 'Invalid or expired token',
           code: 'UNAUTHORIZED'
         }
       });
     }
   };
   
   module.exports = authMiddleware;
   ```

2. **Create User Service**:
   ```javascript
   // src/services/userService.js
   const User = require('../models/user');
   const logger = require('../utils/logger');
   
   const getUserProfile = async (userId) => {
     try {
       const user = await User.findOne({ id: userId });
       
       if (!user) {
         throw new Error('User not found');
       }
       
       return user;
     } catch (error) {
       logger.error(`Error getting user profile: ${error.message}`);
       throw error;
     }
   };
   
   const updateUserProfile = async (userId, updateData) => {
     try {
       const user = await User.findOneAndUpdate(
         { id: userId },
         { $set: updateData },
         { new: true, runValidators: true }
       );
       
       if (!user) {
         throw new Error('User not found');
       }
       
       return user;
     } catch (error) {
       logger.error(`Error updating user profile: ${error.message}`);
       throw error;
     }
   };
   
   module.exports = {
     getUserProfile,
     updateUserProfile
   };
   ```

## API Development

1. **Create Health Check Route**:
   ```javascript
   // src/routes/health.js
   const express = require('express');
   const router = express.Router();
   
   router.get('/', (req, res) => {
     res.status(200).json({
       status: 'healthy'
     });
   });
   
   module.exports = router;
   ```

2. **Create Content Routes**:
   ```javascript
   // src/routes/content.js
   const express = require('express');
   const router = express.Router();
   const authMiddleware = require('../middleware/auth');
   const uploadMiddleware = require('../middleware/upload');
   const contentController = require('../controllers/contentController');
   
   // Apply auth middleware to all routes
   router.use(authMiddleware);
   
   // Content routes
   router.post('/upload', uploadMiddleware.single('file'), contentController.uploadContent);
   router.get('/:id', contentController.getContentById);
   router.put('/:id', contentController.updateContent);
   router.delete('/:id', contentController.deleteContent);
   router.get('/user', contentController.getUserContent);
   router.get('/search', contentController.searchContent);
   
   module.exports = router;
   ```

3. **Create User Routes**:
   ```javascript
   // src/routes/user.js
   const express = require('express');
   const router = express.Router();
   const authMiddleware = require('../middleware/auth');
   const userController = require('../controllers/userController');
   
   // Apply auth middleware to all routes
   router.use(authMiddleware);
   
   // User routes
   router.get('/profile', userController.getUserProfile);
   router.put('/profile', userController.updateUserProfile);
   
   module.exports = router;
   ```

4. **Create Content Controller**:
   ```javascript
   // src/controllers/contentController.js
   const contentService = require('../services/contentService');
   const logger = require('../utils/logger');
   
   const uploadContent = async (req, res) => {
     try {
       if (!req.file) {
         return res.status(400).json({
           success: false,
           error: {
             message: 'No file uploaded',
             code: 'VALIDATION_ERROR'
           }
         });
       }
       
       const contentData = {
         title: req.body.title || req.file.originalname,
         description: req.body.description,
         fileUrl: req.file.path,
         fileType: req.file.mimetype,
         fileSize: req.file.size,
         tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
         visibility: req.body.visibility || 'private',
         userId: req.user.id
       };
       
       const content = await contentService.createContent(contentData);
       
       // Emit socket event
       req.app.get('io').to(`user:${req.user.id}`).emit('content:created', {
         id: content._id,
         title: content.title,
         userId: content.userId
       });
       
       res.status(201).json({
         success: true,
         data: content
       });
     } catch (error) {
       logger.error(`Error uploading content: ${error.message}`);
       
       res.status(500).json({
         success: false,
         error: {
           message: 'Error uploading content',
           code: 'INTERNAL_SERVER_ERROR'
         }
       });
     }
   };
   
   const getContentById = async (req, res) => {
     try {
       const content = await contentService.getContentById(req.params.id);
       
       // Check if content is public or belongs to the user
       if (content.visibility !== 'public' && content.userId !== req.user.id) {
         return res.status(403).json({
           success: false,
           error: {
             message: 'You do not have permission to view this content',
             code: 'FORBIDDEN'
           }
         });
       }
       
       res.status(200).json({
         success: true,
         data: content
       });
     } catch (error) {
       logger.error(`Error getting content: ${error.message}`);
       
       if (error.message === 'Content not found') {
         return res.status(404).json({
           success: false,
           error: {
             message: 'Content not found',
             code: 'NOT_FOUND'
           }
         });
       }
       
       res.status(500).json({
         success: false,
         error: {
           message: 'Error getting content',
           code: 'INTERNAL_SERVER_ERROR'
         }
       });
     }
   };
   
   const updateContent = async (req, res) => {
     try {
       const content = await contentService.getContentById(req.params.id);
       
       // Check if content belongs to the user
       if (content.userId !== req.user.id) {
         return res.status(403).json({
           success: false,
           error: {
             message: 'You do not have permission to update this content',
             code: 'FORBIDDEN'
           }
         });
       }
       
       const updateData = {
         title: req.body.title,
         description: req.body.description,
         tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : undefined,
         visibility: req.body.visibility
       };
       
       const updatedContent = await contentService.updateContent(req.params.id, updateData);
       
       // Emit socket event
       req.app.get('io').to(`user:${req.user.id}`).emit('content:updated', {
         id: updatedContent._id,
         title: updatedContent.title,
         userId: updatedContent.userId
       });
       
       res.status(200).json({
         success: true,
         data: updatedContent
       });
     } catch (error) {
       logger.error(`Error updating content: ${error.message}`);
       
       if (error.message === 'Content not found') {
         return res.status(404).json({
           success: false,
           error: {
             message: 'Content not found',
             code: 'NOT_FOUND'
           }
         });
       }
       
       res.status(500).json({
         success: false,
         error: {
           message: 'Error updating content',
           code: 'INTERNAL_SERVER_ERROR'
         }
       });
     }
   };
   
   const deleteContent = async (req, res) => {
     try {
       const content = await contentService.getContentById(req.params.id);
       
       // Check if content belongs to the user
       if (content.userId !== req.user.id) {
         return res.status(403).json({
           success: false,
           error: {
             message: 'You do not have permission to delete this content',
             code: 'FORBIDDEN'
           }
         });
       }
       
       await contentService.deleteContent(req.params.id);
       
       // Emit socket event
       req.app.get('io').to(`user:${req.user.id}`).emit('content:deleted', {
         id: req.params.id,
         userId: req.user.id
       });
       
       res.status(200).json({
         success: true,
         message: 'Content deleted successfully'
       });
     } catch (error) {
       logger.error(`Error deleting content: ${error.message}`);
       
       if (error.message === 'Content not found') {
         return res.status(404).json({
           success: false,
           error: {
             message: 'Content not found',
             code: 'NOT_FOUND'
           }
         });
       }
       
       res.status(500).json({
         success: false,
         error: {
           message: 'Error deleting content',
           code: 'INTERNAL_SERVER_ERROR'
         }
       });
     }
   };
   
   const getUserContent = async (req, res) => {
     try {
       const { page = 1, limit = 10, sort = 'createdAt', order = 'desc', visibility, tags } = req.query;
       
       const filter = { userId: req.user.id };
       
       if (visibility) {
         filter.visibility = visibility;
       }
       
       if (tags) {
         filter.tags = { $in: tags.split(',').map(tag => tag.trim()) };
       }
       
       const sortOptions = {};
       sortOptions[sort] = order === 'asc' ? 1 : -1;
       
       const contents = await contentService.getContents(
         filter,
         sortOptions,
         parseInt(page),
         parseInt(limit)
       );
       
       res.status(200).json({
         success: true,
         data: contents
       });
     } catch (error) {
       logger.error(`Error getting user content: ${error.message}`);
       
       res.status(500).json({
         success: false,
         error: {
           message: 'Error getting user content',
           code: 'INTERNAL_SERVER_ERROR'
         }
       });
     }
   };
   
   const searchContent = async (req, res) => {
     try {
       const { q, page = 1, limit = 10, sort = 'createdAt', order = 'desc', tags } = req.query;
       
       if (!q) {
         return res.status(400).json({
           success: false,
           error: {
             message: 'Search query is required',
             code: 'VALIDATION_ERROR'
           }
         });
       }
       
       const filter = { $text: { $search: q }, visibility: 'public' };
       
       if (tags) {
         filter.tags = { $in: tags.split(',').map(tag => tag.trim()) };
       }
       
       const sortOptions = {};
       sortOptions[sort] = order === 'asc' ? 1 : -1;
       
       const contents = await contentService.getContents(
         filter,
         sortOptions,
         parseInt(page),
         parseInt(limit)
       );
       
       res.status(200).json({
         success: true,
         data: contents
       });
     } catch (error) {
       logger.error(`Error searching content: ${error.message}`);
       
       res.status(500).json({
         success: false,
         error: {
           message: 'Error searching content',
           code: 'INTERNAL_SERVER_ERROR'
         }
       });
     }
   };
   
   module.exports = {
     uploadContent,
     getContentById,
     updateContent,
     deleteContent,
     getUserContent,
     searchContent
   };
   ```

5. **Create User Controller**:
   ```javascript
   // src/controllers/userController.js
   const userService = require('../services/userService');
   const logger = require('../utils/logger');
   
   const getUserProfile = async (req, res) => {
     try {
       const user = await userService.getUserProfile(req.user.id);
       
       res.status(200).json({
         success: true,
         data: user
       });
     } catch (error) {
       logger.error(`Error getting user profile: ${error.message}`);
       
       if (error.message === 'User not found') {
         return res.status(404).json({
           success: false,
           error: {
             message: 'User not found',
             code: 'NOT_FOUND'
           }
         });
       }
       
       res.status(500).json({
         success: false,
         error: {
           message: 'Error getting user profile',
           code: 'INTERNAL_SERVER_ERROR'
         }
       });
     }
   };
   
   const updateUserProfile = async (req, res) => {
     try {
       const updateData = {
         firstName: req.body.firstName,
         lastName: req.body.lastName,
         profilePicture: req.body.profilePicture
       };
       
       const user = await userService.updateUserProfile(req.user.id, updateData);
       
       res.status(200).json({
         success: true,
         data: user
       });
     } catch (error) {
       logger.error(`Error updating user profile: ${error.message}`);
       
       if (error.message === 'User not found') {
         return res.status(404).json({
           success: false,
           error: {
             message: 'User not found',
             code: 'NOT_FOUND'
           }
         });
       }
       
       res.status(500).json({
         success: false,
         error: {
           message: 'Error updating user profile',
           code: 'INTERNAL_SERVER_ERROR'
         }
       });
     }
   };
   
   module.exports = {
     getUserProfile,
     updateUserProfile
   };
   ```

## File Upload Implementation

1. **Set Up Cloudinary Configuration**:
   ```javascript
   // src/config/cloudinary.js
   const cloudinary = require('cloudinary').v2;
   const logger = require('../utils/logger');
   
   cloudinary.config({
     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
     api_key: process.env.CLOUDINARY_API_KEY,
     api_secret: process.env.CLOUDINARY_API_SECRET
   });
   
   module.exports = cloudinary;
   ```

2. **Create Upload Middleware**:
   ```javascript
   // src/middleware/upload.js
   const multer = require('multer');
   const path = require('path');
   const fs = require('fs');
   const logger = require('../utils/logger');
   
   // Create uploads directory if it doesn't exist
   const uploadDir = path.join(__dirname, '../../uploads');
   if (!fs.existsSync(uploadDir)) {
     fs.mkdirSync(uploadDir, { recursive: true });
   }
   
   // Configure multer for file upload
   const storage = multer.diskStorage({
     destination: (req, file, cb) => {
       cb(null, uploadDir);
     },
     filename: (req, file, cb) => {
       const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
       cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
     }
   });
   
   // File filter
   const fileFilter = (req, file, cb) => {
     // Allow images, videos, and documents
     const allowedTypes = [
       'image/jpeg',
       'image/png',
       'image/gif',
       'video/mp4',
       'video/quicktime',
       'application/pdf',
       'application/msword',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
     ];
     
     if (allowedTypes.includes(file.mimetype)) {
       cb(null, true);
     } else {
       cb(new Error('Invalid file type. Only images, videos, and documents are allowed.'), false);
     }
   };
   
   // Create multer upload instance
   const upload = multer({
     storage,
     fileFilter,
     limits: {
       fileSize: 10 * 1024 * 1024 // 10MB
     }
   });
   
   module.exports = upload;
   ```

3. **Create Content Service**:
   ```javascript
   // src/services/contentService.js
   const Content = require('../models/content');
   const cloudinary = require('../config/cloudinary');
   const logger = require('../utils/logger');
   const fs = require('fs');
   const path = require('path');
   
   const createContent = async (contentData) => {
     try {
       // Upload file to Cloudinary
       const result = await cloudinary.uploader.upload(contentData.fileUrl, {
         resource_type: 'auto',
         folder: 'content'
       });
       
       // Update file URL to Cloudinary URL
       contentData.fileUrl = result.secure_url;
       
       // Create content in database
       const content = new Content(contentData);
       await content.save();
       
       // Delete local file
       fs.unlinkSync(contentData.fileUrl);
       
       return content;
     } catch (error) {
       logger.error(`Error creating content: ${error.message}`);
       throw error;
     }
   };
   
   const getContentById = async (id) => {
     try {
       const content = await Content.findById(id);
       
       if (!content) {
         throw new Error('Content not found');
       }
       
       return content;
     } catch (error) {
       logger.error(`Error getting content by ID: ${error.message}`);
       throw error;
     }
   };
   
   const updateContent = async (id, updateData) => {
     try {
       const content = await Content.findByIdAndUpdate(
         id,
         { $set: updateData },
         { new: true, runValidators: true }
       );
       
       if (!content) {
         throw new Error('Content not found');
       }
       
       return content;
     } catch (error) {
       logger.error(`Error updating content: ${error.message}`);
       throw error;
     }
   };
   
   const deleteContent = async (id) => {
     try {
       const content = await Content.findById(id);
       
       if (!content) {
         throw new Error('Content not found');
       }
       
       // Delete file from Cloudinary
       const publicId = content.fileUrl.split('/').pop().split('.')[0];
       await cloudinary.uploader.destroy(publicId);
       
       // Delete content from database
       await Content.findByIdAndDelete(id);
       
       return true;
     } catch (error) {
       logger.error(`Error deleting content: ${error.message}`);
       throw error;
     }
   };
   
   const getContents = async (filter, sort, page, limit) => {
     try {
       const skip = (page - 1) * limit;
       
       const contents = await Content.find(filter)
         .sort(sort)
         .skip(skip)
         .limit(limit);
       
       const total = await Content.countDocuments(filter);
       
       return {
         items: contents,
         total,
         page,
         limit,
         pages: Math.ceil(total / limit)
       };
     } catch (error) {
       logger.error(`Error getting contents: ${error.message}`);
       throw error;
     }
   };
   
   module.exports = {
     createContent,
     getContentById,
     updateContent,
     deleteContent,
     getContents
   };
   ```

## Real-time Notifications

1. **Set Up Socket.IO in Main Application**:
   ```javascript
   // In src/index.js
   // After creating the Socket.IO server
   
   // Make io accessible to routes
   app.set('io', io);
   
   // Socket.IO connection
   io.on('connection', (socket) => {
     logger.info(`Socket connected: ${socket.id}`);
     
     socket.on('join', (data) => {
       const { userId } = data;
       socket.join(`user:${userId}`);
       logger.info(`User ${userId} joined their room`);
     });
     
     socket.on('disconnect', () => {
       logger.info(`Socket disconnected: ${socket.id}`);
     });
   });
   ```

2. **Emit Events in Controllers**:
   ```javascript
   // In contentController.js
   // After creating, updating, or deleting content
   
   // Emit socket event
   req.app.get('io').to(`user:${req.user.id}`).emit('content:created', {
     id: content._id,
     title: content.title,
     userId: content.userId
   });
   ```

## Background Processing

1. **Set Up Redis for Queue**:
   ```javascript
   // src/config/redis.js
   const Redis = require('ioredis');
   const logger = require('../utils/logger');
   
   const redisClient = new Redis({
     host: process.env.REDIS_HOST || 'localhost',
     port: process.env.REDIS_PORT || 6379,
     password: process.env.REDIS_PASSWORD,
     db: process.env.REDIS_DB || 0
   });
   
   redisClient.on('connect', () => {
     logger.info('Redis connected');
   });
   
   redisClient.on('error', (error) => {
     logger.error(`Redis error: ${error.message}`);
   });
   
   module.exports = redisClient;
   ```

2. **Create Queue Configuration**:
   ```javascript
   // src/workers/queue.js
   const Queue = require('bull');
   const logger = require('../utils/logger');
   
   // Create queues
   const contentProcessingQueue = new Queue('content-processing', {
     redis: {
       host: process.env.REDIS_HOST || 'localhost',
       port: process.env.REDIS_PORT || 6379,
       password: process.env.REDIS_PASSWORD,
       db: process.env.REDIS_DB || 0
     }
   });
   
   // Add event listeners
   contentProcessingQueue.on('completed', (job) => {
     logger.info(`Job ${job.id} completed`);
   });
   
   contentProcessingQueue.on('failed', (job, error) => {
     logger.error(`Job ${job.id} failed: ${error.message}`);
   });
   
   module.exports = {
     contentProcessingQueue
   };
   ```

3. **Create Job Processors**:
   ```javascript
   // src/workers/processors.js
   const { contentProcessingQueue } = require('./queue');
   const logger = require('../utils/logger');
   
   // Process content
   contentProcessingQueue.process('process-content', async (job) => {
     try {
       const { contentId } = job.data;
       
       logger.info(`Processing content ${contentId}`);
       
       // Add content processing logic here
       
       return { success: true };
     } catch (error) {
       logger.error(`Error processing content: ${error.message}`);
       throw error;
     }
   });
   
   // Share content
   contentProcessingQueue.process('share-content', async (job) => {
     try {
       const { contentId, targetUsers } = job.data;
       
       logger.info(`Sharing content ${contentId} with users ${targetUsers.join(', ')}`);
       
       // Add content sharing logic here
       
       return { success: true };
     } catch (error) {
       logger.error(`Error sharing content: ${error.message}`);
       throw error;
     }
   });
   ```

## Testing

1. **Set Up Jest Configuration**:
   ```javascript
   // jest.config.js
   module.exports = {
     testEnvironment: 'node',
     testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
     collectCoverage: true,
     coverageDirectory: 'coverage',
     coverageReporters: ['text', 'lcov'],
     verbose: true
   };
   ```

2. **Create Test Scripts**:
   ```javascript
   // package.json
   "scripts": {
     "test": "jest",
     "test:watch": "jest --watch",
     "test:coverage": "jest --coverage"
   }
   ```

3. **Write Unit Tests**:
   ```javascript
   // __tests__/services/contentService.test.js
   const mongoose = require('mongoose');
   const { MongoMemoryServer } = require('mongodb-memory-server');
   const Content = require('../../src/models/content');
   const contentService = require('../../src/services/contentService');
   
   let mongoServer;
   
   beforeAll(async () => {
     mongoServer = await MongoMemoryServer.create();
     const mongoUri = mongoServer.getUri();
     await mongoose.connect(mongoUri, {
       useNewUrlParser: true,
       useUnifiedTopology: true
     });
   });
   
   afterAll(async () => {
     await mongoose.disconnect();
     await mongoServer.stop();
   });
   
   beforeEach(async () => {
     await Content.deleteMany({});
   });
   
   describe('Content Service', () => {
     describe('createContent', () => {
       it('should create a new content', async () => {
         const contentData = {
           title: 'Test Content',
           description: 'Test Description',
           fileUrl: 'https://example.com/test.jpg',
           fileType: 'image/jpeg',
           fileSize: 1024,
           tags: ['test'],
           visibility: 'public',
           userId: 'user123'
         };
         
         const content = await contentService.createContent(contentData);
         
         expect(content.title).toBe(contentData.title);
         expect(content.description).toBe(contentData.description);
         expect(content.fileUrl).toBe(contentData.fileUrl);
         expect(content.fileType).toBe(contentData.fileType);
         expect(content.fileSize).toBe(contentData.fileSize);
         expect(content.tags).toEqual(contentData.tags);
         expect(content.visibility).toBe(contentData.visibility);
         expect(content.userId).toBe(contentData.userId);
       });
     });
     
     // Add more tests for other service methods
   });
   ```

## Documentation

1. **Set Up Swagger Documentation**:
   ```javascript
   // src/config/swagger.js
   const swaggerJsdoc = require('swagger-jsdoc');
   const swaggerUi = require('swagger-ui-express');
   
   const options = {
     definition: {
       openapi: '3.0.0',
       info: {
         title: 'ContentSharing API',
         version: '1.0.0',
         description: 'API documentation for the ContentSharing microservice'
       },
       servers: [
         {
           url: `http://localhost:${process.env.PORT || 8001}`,
           description: 'Development server'
         }
       ],
       components: {
         securitySchemes: {
           bearerAuth: {
             type: 'http',
             scheme: 'bearer',
             bearerFormat: 'JWT'
           }
         }
       },
       security: [
         {
           bearerAuth: []
         }
       ]
     },
     apis: ['./src/routes/*.js']
   };
   
   const specs = swaggerJsdoc(options);
   
   module.exports = {
     serve: swaggerUi.serve,
     setup: swaggerUi.setup(specs)
   };
   ```

2. **Add Swagger to Express App**:
   ```javascript
   // In src/index.js
   const swagger = require('./config/swagger');
   
   // Swagger documentation
   app.use('/api-docs', swagger.serve, swagger.setup);
   ```

3. **Document API Routes**:
   ```javascript
   // In src/routes/content.js
   /**
    * @swagger
    * /api/content/upload:
    *   post:
    *     summary: Upload a new file
    *     tags: [Content]
    *     security:
    *       - bearerAuth: []
    *     requestBody:
    *       required: true
    *       content:
    *         multipart/form-data:
    *           schema:
    *             type: object
    *             properties:
    *               file:
    *                 type: string
    *                 format: binary
    *               title:
    *                 type: string
    *               description:
    *                 type: string
    *               tags:
    *                 type: string
    *               visibility:
    *                 type: string
    *                 enum: [public, private]
    *     responses:
    *       201:
    *         description: Content created successfully
    *       400:
    *         description: Invalid request
    *       401:
    *         description: Unauthorized
    *       500:
    *         description: Server error
    */
   router.post('/upload', uploadMiddleware.single('file'), contentController.uploadContent);
   ```

## Deployment

1. **Create Dockerfile**:
   ```dockerfile
   # Dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   COPY package*.json ./
   
   RUN npm install
   
   COPY . .
   
   RUN mkdir -p uploads
   
   EXPOSE 8001
   
   HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
     CMD wget --no-verbose --tries=1 --spider http://localhost:8001/api/v1/health || exit 1
   
   CMD ["npm", "start"]
   ```

2. **Create Docker Compose File**:
   ```yaml
   # docker-compose.yml
   version: '3.8'
   
   services:
     content-sharing:
       build: .
       ports:
         - "8001:8001"
       environment:
         - NODE_ENV=development
         - PORT=8001
         - MONGO_URI=mongodb://mongo:27017/contentDB
         - REDIS_URL=redis://redis:6379
         - REDIS_PASSWORD=your_redis_password
         - REDIS_DB=0
         - ACCESS_TOKEN_SECRET=your_access_token_secret
         - ACCESS_TOKEN_EXPIRY=1hr
         - CLOUDINARY_CLOUD_NAME=your_cloud_name
         - CLOUDINARY_API_KEY=your_api_key
         - CLOUDINARY_API_SECRET=your_api_secret
         - CLIENT_URL=http://localhost:3000
       depends_on:
         - mongo
         - redis
       volumes:
         - ./uploads:/app/uploads
       restart: unless-stopped
   
     mongo:
       image: mongo:latest
       ports:
         - "27017:27017"
       volumes:
         - mongo-data:/data/db
       restart: unless-stopped
   
     redis:
       image: redis:alpine
       ports:
         - "6379:6379"
       command: redis-server --requirepass your_redis_password
       volumes:
         - redis-data:/data
       restart: unless-stopped
   
   volumes:
     mongo-data:
     redis-data:
   ```

3. **Create Deployment Scripts**:
   ```javascript
   // package.json
   "scripts": {
     "start": "node src/index.js",
     "dev": "nodemon src/index.js",
     "test": "jest",
     "test:watch": "jest --watch",
     "test:coverage": "jest --coverage",
     "lint": "eslint .",
     "format": "prettier --write .",
     "docker:build": "docker build -t content-sharing .",
     "docker:run": "docker run -p 8001:8001 content-sharing",
     "docker:compose": "docker-compose up -d",
     "docker:compose:down": "docker-compose down"
   }
   ```

## Conclusion

This guide has walked you through the process of building a ContentSharing microservice from scratch. By following these steps, you've created a robust, scalable, and secure service that can handle file uploads, content management, and real-time notifications.

The microservice architecture allows for independent deployment and scaling, while the integration with the Authentication service ensures secure access to resources. The use of modern technologies like Node.js, Express, MongoDB, Redis, and Socket.IO provides a solid foundation for building a high-performance application.

Remember that this is just a starting point. As your application grows, you may need to add more features, optimize performance, or enhance security. The modular architecture makes it easy to extend and maintain the codebase as requirements evolve. 