// routes/roomRoutes.js
import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import AppError from '../middlewares/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';

const createRoomRoutes = (rooms) => {
  const router = express.Router();

  // Authentication middleware
  const authenticateToken = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Authentication token missing' });
      }

      // Verify token with auth service
      const response = await axios.get(`${process.env.AUTH_SERVICE_URL}/api/v1/auth/verify-token`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.valid) {
        req.user = response.data.user;
        next();
      } else {
        res.status(401).json({ error: 'Invalid token' });
      }
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  };

  // Get all rooms
  router.get('/', authenticateToken, (req, res) => {
    const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
      id,
      name: room.name,
      participantCount: room.getParticipantCount(),
      features: {
        videoCall: true,
        whiteboard: true,
        notes: true,
        polls: true,
        screenShare: true
      }
    }));
    res.json(roomList);
  });

  // Get room details
  router.get('/:roomId', authenticateToken, (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      id: req.params.roomId,
      name: room.name,
      participants: room.getParticipants(),
      features: {
        videoCall: true,
        whiteboard: true,
        notes: true,
        polls: true,
        screenShare: true
      }
    });
  });

  // Create a new room
  router.post('/', authenticateToken, (req, res) => {
    const { name } = req.body;
    const roomId = uuidv4();
    const room = new EnhancedRoom(roomId, name || `Room ${roomId}`);
    rooms.set(roomId, room);
    res.status(201).json({ roomId, name: room.name });
  });

  // Delete a room
  router.delete('/:roomId', authenticateToken, (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    rooms.delete(req.params.roomId);
    res.json({ message: 'Room deleted successfully' });
  });

  // Get room whiteboard state
  router.get('/:roomId/whiteboard', authenticateToken, (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(room.whiteboard.elements);
  });

  // Get room notes
  router.get('/:roomId/notes', authenticateToken, (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(Array.from(room.notes.values()));
  });

  // Get room polls
  router.get('/:roomId/polls', authenticateToken, (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(Array.from(room.polls.values()));
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

export default createRoomRoutes;
