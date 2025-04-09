// routes/roomRoutes.js
import express from 'express';
import  AppError  from '../middlewares/errorHandler.js';

export default function  createRoomRoutes (rooms){
  const router = express.Router();

  // Get all active rooms
  router.get('/', (req, res) => {
    const roomStats = Array.from(rooms.values()).map(room => room.getStats());
    res.json({
      status: 'success',
      data: {
        rooms: roomStats
      }
    });
  });

  // Get specific room
  router.get('/:roomId', (req, res, next) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      return next(new AppError('Room not found', 404));
    }

    res.json({
      status: 'success',
      data: {
        room: room.getStats()
      }
    });
  });

  // Get room chat messages
  router.get('/:roomId/messages', (req, res, next) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      return next(new AppError('Room not found', 404));
    }

    const limit = parseInt(req.query.limit) || 50;
    const messages = room.getChatMessages(limit);

    res.json({
      status: 'success',
      data: {
        messages
      }
    });
  });

  // Delete inactive rooms (admin only)
  router.delete('/cleanup', (req, res, next) => {
    const inactivityThreshold = parseInt(req.query.threshold) || 3600000; // 1 hour default
    const now = Date.now();
    let deletedCount = 0;

    for (const [roomId, room] of rooms.entries()) {
      const inactiveTime = now - room.lastActivity.getTime();
      if (inactiveTime > inactivityThreshold && room.peers.size === 0) {
        room.closeAll();
        rooms.delete(roomId);
        deletedCount++;
      }
    }

    res.json({
      status: 'success',
      data: {
        deletedCount
      }
    });
  });

  return router;
};

// Removed duplicate export default statement
