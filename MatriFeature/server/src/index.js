import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { errorHandler } from './middlewares/errorHandler.js';
import createRoomRoutes from './routes/rooms.js';
import healthRouter from './routes/health.js';
import Debugger from './lib/Debugger.js';
import EnhancedRoom from './lib/EnhancedRoom.js';
import WorkerManager from './lib/workerManager.js';
import Terminal from './lib/Terminal.js';
import GitManager from './lib/GitManager.js';
import CodeIntelligence from './lib/CodeIntelligence.js';
import MediasoupWorkerManager from './lib/MediasoupWorkerManager.js';
import MeetingRecorder from './lib/MeetingRecorder.js';
import TranscriptionService from './lib/TranscriptionService.js';
import Poll from './lib/Poll.js';
import Chat from './lib/chat.js';
import Whiteboard from './lib/Whiteboard.js';
import CodeCollaboration from './lib/CodeCollaboration.js';
import CodeManager from './lib/CodeManager.js';
import GitHubSync from './lib/GitHubSync.js';
import FileShare from './lib/FileShare.js';
import Notes from './lib/Notes.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { createLogger, format, transports } from 'winston';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import Redis from 'ioredis';
import { validateInput } from './middlewares/validation.js';
import { rateLimiter } from './middlewares/rateLimiter.js';
import { sessionManager } from './middlewares/sessionManager.js';

// Load environment variables
dotenv.config();

// Configure Winston logger
const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.simple()
    }));
}

// Initialize Redis for session management and rate limiting
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
});

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Rate limiting
app.use(rateLimiter);

// Session management
app.use(sessionManager(redis));

// Input validation
app.use(validateInput);

// Configure Socket.IO with Redis adapter for horizontal scaling
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    adapter: new RedisAdapter(redis)
});

const rooms = new Map();

// Room cleanup interval
const ROOM_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
setInterval(async () => {
    for (const [roomId, room] of rooms.entries()) {
        if (room.isInactive()) {
            await room.close();
            rooms.delete(roomId);
            logger.info(`Cleaned up inactive room: ${roomId}`);
        }
    }
}, ROOM_CLEANUP_INTERVAL);

// Token refresh mechanism
const refreshToken = async (socket) => {
    try {
        const response = await axios.post(`${process.env.AUTH_SERVICE_URL}/refresh-token`, {
            refreshToken: socket.handshake.auth.refreshToken
        });
        socket.emit('token-refreshed', { token: response.data.token });
    } catch (error) {
        logger.error('Token refresh failed:', error);
        socket.disconnect();
    }
};

// Authentication middleware with token refresh
const authenticateToken = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication token missing'));
        }

        // Verify token with auth service
        const response = await axios.get(`${process.env.AUTH_SERVICE_URL}/api/v1/auth/verify-token`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.valid) {
            socket.user = response.data.user;
            
            // Set up token refresh
            const tokenExpiry = jwt.decode(token).exp * 1000;
            const timeUntilExpiry = tokenExpiry - Date.now();
            
            if (timeUntilExpiry < 5 * 60 * 1000) { // Refresh if less than 5 minutes left
                await refreshToken(socket);
            }
            
            next();
        } else {
            next(new Error('Invalid token'));
        }
    } catch (error) {
        logger.error('Authentication failed:', error);
        next(new Error('Authentication failed'));
    }
};

io.use(authenticateToken);

// Routes
app.use('/api/health', healthRouter);
app.use('/api/rooms', createRoomRoutes(rooms));

// Error handling
app.use(errorHandler);

// Initialize Mediasoup workers
try {
    await MediasoupWorkerManager.initialize();
    logger.info('Mediasoup workers initialized successfully');
} catch (error) {
    logger.error('Failed to initialize Mediasoup workers:', error);
    process.exit(1);
}

// Initialize services
const transcriptionService = new TranscriptionService();
const meetingRecorder = new MeetingRecorder();
const codeCollaboration = new CodeCollaboration();
const codeManager = new CodeManager();
const gitHubSync = new GitHubSync();
const fileShare = new FileShare();
const notes = new Notes();

// Socket.IO event handlers
io.on('connection', async (socket) => {
    logger.info('Client connected:', socket.id);

    // Handle room creation
    socket.on('createRoom', async (callback) => {
        try {
            const roomId = uuidv4();
            const room = new EnhancedRoom(roomId, `Room ${roomId}`);
            await room.initialize();
            rooms.set(roomId, room);
            callback({ roomId });
    } catch (error) {
            logger.error('Room creation failed:', error);
      callback({ error: error.message });
    }
  });

    // Handle joining a room
    socket.on('joinRoom', async ({ roomId }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            await room.addParticipant(socket.user.id, socket);
            socket.join(roomId);
      callback({ success: true });
    } catch (error) {
            logger.error('Join room failed:', error);
      callback({ error: error.message });
    }
  });

    // Handle leaving a room
    socket.on('leaveRoom', async ({ roomId }, callback) => {
    try {
      const room = rooms.get(roomId);
            if (room) {
                await room.removeParticipant(socket.user.id);
                socket.leave(roomId);
            }
            callback({ success: true });
    } catch (error) {
            logger.error('Leave room failed:', error);
      callback({ error: error.message });
    }
  });

    // Handle WebRTC transport creation
    socket.on('createTransport', async ({ roomId, direction }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            const transport = direction === 'send' ? 
                await room.createSendTransport(socket.user.id) :
                await room.createRecvTransport(socket.user.id);

            callback({ transport });
    } catch (error) {
            logger.error('Transport creation failed:', error);
      callback({ error: error.message });
    }
  });

    // Handle WebRTC transport connection
    socket.on('connectTransport', async ({ roomId, transportId, dtlsParameters }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            await room.connectTransport(socket.user.id, transportId, dtlsParameters);
      callback({ success: true });
    } catch (error) {
            logger.error('Transport connection failed:', error);
      callback({ error: error.message });
    }
  });

    // Handle media production
    socket.on('produce', async ({ roomId, transportId, kind, rtpParameters }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            const producerId = await room.produce(socket.user.id, transportId, kind, rtpParameters);
            callback({ producerId });
    } catch (error) {
            logger.error('Media production failed:', error);
      callback({ error: error.message });
    }
  });

    // Handle media consumption
    socket.on('consume', async ({ roomId, producerId, rtpCapabilities }, callback) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            throw new Error('Room not found');
          }
    
            const consumer = await room.consume(socket.user.id, producerId, rtpCapabilities);
            callback({ consumer });
        } catch (error) {
            logger.error('Media consumption failed:', error);
          callback({ error: error.message });
        }
      });

    // Handle screen sharing
    socket.on('startScreenShare', async ({ roomId }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            await room.startScreenShare(socket.user.id);
            callback({ success: true });
    } catch (error) {
            logger.error('Screen share start failed:', error);
      callback({ error: error.message });
    }
  });

    // Handle screen sharing stop
    socket.on('stopScreenShare', async ({ roomId }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            await room.stopScreenShare(socket.user.id);
      callback({ success: true });
    } catch (error) {
            logger.error('Screen share stop failed:', error);
      callback({ error: error.message });
    }
  });

    // Handle meeting recording
  socket.on('startRecording', async ({ roomId }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            const recordingId = await meetingRecorder.startRecording(roomId, socket.user.id);
            callback({ success: true, recordingId });
    } catch (error) {
            logger.error('Recording start failed:', error);
      callback({ error: error.message });
    }
  });

    // Handle meeting recording stop
    socket.on('stopRecording', async ({ roomId, recordingId }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            await meetingRecorder.stopRecording(recordingId);
      callback({ success: true });
    } catch (error) {
            logger.error('Recording stop failed:', error);
      callback({ error: error.message });
    }
  });

    // Handle transcription start
    socket.on('startTranscription', async ({ roomId }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            await transcriptionService.startTranscription(roomId, socket.user.id);
        callback({ success: true });
      } catch (error) {
            logger.error('Transcription start failed:', error);
        callback({ error: error.message });
      }
    });

    // Handle transcription stop
    socket.on('stopTranscription', async ({ roomId }, callback) => {
        try {
            const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
  
            await transcriptionService.stopTranscription(roomId);
      callback({ success: true });
    } catch (error) {
            logger.error('Transcription stop failed:', error);
            callback({ error: error.message });
    }
  });
  
    // Handle poll creation
    socket.on('createPoll', async ({ roomId, question, options, settings }, callback) => {
    try {
            const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
  
            const poll = await Poll.createPoll(roomId, socket.user.id, question, options, settings);
      callback({ success: true, poll });
    } catch (error) {
            logger.error('Poll creation failed:', error);
            callback({ error: error.message });
    }
  });
  
    // Handle poll voting
    socket.on('vote', async ({ roomId, pollId, optionIds }, callback) => {
    try {
            const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
  
            const result = await Poll.vote(roomId, pollId, socket.user.id, optionIds);
            callback({ success: true, result });
    } catch (error) {
            logger.error('Vote failed:', error);
            callback({ error: error.message });
    }
  });
  
    // Handle whiteboard creation
    socket.on('createWhiteboard', async ({ roomId, settings }, callback) => {
    try {
            const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
  
            const whiteboard = await Whiteboard.createWhiteboard(roomId, socket.user.id, settings);
            callback({ success: true, whiteboard });
    } catch (error) {
            logger.error('Whiteboard creation failed:', error);
            callback({ error: error.message });
    }
  });
  
    // Handle whiteboard element addition
    socket.on('addWhiteboardElement', async ({ roomId, whiteboardId, element }, callback) => {
    try {
            const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
  
            const result = await Whiteboard.addElement(roomId, whiteboardId, socket.user.id, element);
      callback({ success: true, result });
    } catch (error) {
            logger.error('Whiteboard element addition failed:', error);
            callback({ error: error.message });
    }
  });

    // Handle chat message
    socket.on('sendMessage', async ({ roomId, chatId, content, type }, callback) => {
    try {
            const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            const message = await Chat.sendMessage(roomId, chatId, socket.user.id, content, type);
            callback({ success: true, message });
    } catch (error) {
            logger.error('Message sending failed:', error);
            callback({ error: error.message });
    }
  });

    // Handle chat message edit
    socket.on('editMessage', async ({ roomId, chatId, messageId, newContent }, callback) => {
    try {
            const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            const message = await Chat.editMessage(roomId, chatId, socket.user.id, messageId, newContent);
            callback({ success: true, message });
    } catch (error) {
            logger.error('Message edit failed:', error);
            callback({ error: error.message });
        }
    });

    // Handle chat message deletion
    socket.on('deleteMessage', async ({ roomId, chatId, messageId }, callback) => {
        try {
            const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

            await Chat.deleteMessage(roomId, chatId, socket.user.id, messageId);
      callback({ success: true });
    } catch (error) {
            logger.error('Message deletion failed:', error);
            callback({ error: error.message });
        }
    });

    // Code Collaboration handlers
    socket.on('joinCodeSession', async ({ roomId, filePath }, callback) => {
        try {
            await codeCollaboration.joinSession(roomId, socket.user.id, filePath);
      callback({ success: true });
    } catch (error) {
            logger.error('Code session join failed:', error);
            callback({ error: error.message });
        }
    });

    socket.on('leaveCodeSession', async ({ roomId }, callback) => {
        try {
            await codeCollaboration.leaveSession(roomId, socket.user.id);
      callback({ success: true });
    } catch (error) {
            logger.error('Code session leave failed:', error);
            callback({ error: error.message });
        }
    });

    socket.on('codeUpdate', async ({ roomId, filePath, changes }, callback) => {
        try {
            await codeCollaboration.broadcastEdit(roomId, socket.user.id, filePath, changes);
      callback({ success: true });
    } catch (error) {
            logger.error('Code update failed:', error);
            callback({ error: error.message });
        }
    });

    // Code Manager handlers
    socket.on('createProject', async ({ name, type }, callback) => {
        try {
            const project = await codeManager.createProject(socket.user.id, name, type);
            callback({ success: true, project });
    } catch (error) {
            logger.error('Project creation failed:', error);
            callback({ error: error.message });
        }
    });

    socket.on('saveFile', async ({ projectId, filePath, content }, callback) => {
        try {
            await codeManager.saveFile(projectId, filePath, content);
      callback({ success: true });
    } catch (error) {
            logger.error('File save failed:', error);
            callback({ error: error.message });
        }
    });

    // GitHub Sync handlers
    socket.on('syncToGitHub', async ({ projectId, repoName }, callback) => {
        try {
            const syncId = await gitHubSync.syncProjectToGitHub(projectId, socket.user.id, repoName);
            callback({ success: true, syncId });
    } catch (error) {
            logger.error('GitHub sync failed:', error);
            callback({ error: error.message });
        }
    });

    socket.on('syncFromGitHub', async ({ projectId, repoName }, callback) => {
        try {
            const syncId = await gitHubSync.syncGitHubToProject(projectId, socket.user.id, repoName);
            callback({ success: true, syncId });
    } catch (error) {
            logger.error('GitHub sync failed:', error);
            callback({ error: error.message });
        }
    });

    // File Share handlers
    socket.on('uploadFile', async ({ roomId, file }, callback) => {
        try {
            const fileUrl = await fileShare.uploadFile(roomId, socket.user.id, file);
            callback({ success: true, fileUrl });
    } catch (error) {
            logger.error('File upload failed:', error);
            callback({ error: error.message });
        }
    });

    socket.on('downloadFile', async ({ roomId, fileId }, callback) => {
        try {
            const file = await fileShare.downloadFile(roomId, fileId);
            callback({ success: true, file });
    } catch (error) {
            logger.error('File download failed:', error);
            callback({ error: error.message });
        }
    });

    // Notes handlers
    socket.on('createNote', async ({ roomId, content }, callback) => {
        try {
            const note = await notes.createNote(roomId, socket.user.id, content);
            callback({ success: true, note });
    } catch (error) {
            logger.error('Note creation failed:', error);
            callback({ error: error.message });
        }
    });

    socket.on('updateNote', async ({ roomId, noteId, content }, callback) => {
        try {
            const note = await notes.updateNote(roomId, noteId, socket.user.id, content);
            callback({ success: true, note });
    } catch (error) {
            logger.error('Note update failed:', error);
            callback({ error: error.message });
        }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        logger.info('Client disconnected:', socket.id);
        
        // Clean up resources
        for (const [roomId, room] of rooms.entries()) {
            if (room.hasParticipant(socket.user.id)) {
                await room.removeParticipant(socket.user.id);
                await codeCollaboration.leaveSession(roomId, socket.user.id);
                socket.leave(roomId);
            }
        }
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    
    try {
        // Close all rooms
        for (const room of rooms.values()) {
            await room.close();
        }
        
        // Close services
        await MediasoupWorkerManager.close();
        await transcriptionService.close();
        await meetingRecorder.close();
        await Poll.close();
        await Whiteboard.close();
        await Chat.close();
        await codeCollaboration.close();
        await codeManager.close();
        await gitHubSync.close();
        await fileShare.close();
        await notes.close();
        
        // Close Redis connection
        await redis.quit();
        
        // Close server
        server.close(() => {
            logger.info('Server closed');
            process.exit(0);
        });
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// Start server
const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
}); 
