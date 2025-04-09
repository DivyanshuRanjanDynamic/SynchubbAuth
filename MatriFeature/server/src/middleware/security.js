const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { monitoringService } = require('../services/monitoring');
const { logger } = require('../services/logger');
const config = require('../config/mediasoup');

// Rate limiter middleware
const rateLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  handler: (req, res) => {
    monitoringService.recordSecurityEvent({ type: 'rate_limit_exceeded' });
    res.status(429).json({
      error: 'Too many requests, please try again later'
    });
  }
});

// Authentication middleware
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      monitoringService.recordSecurityEvent({ type: 'auth_failure', reason: 'no_token' });
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    monitoringService.recordSecurityEvent({ type: 'auth_failure', reason: 'invalid_token' });
    logger.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// CORS middleware
const cors = (req, res, next) => {
  const origin = req.headers.origin;
  if (config.security.cors.origin === '*' || config.security.cors.origin.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', config.security.cors.methods.join(','));
    res.header('Access-Control-Allow-Headers', config.security.cors.allowedHeaders.join(','));
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  next();
};

// Input validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    try {
      const { error } = schema.validate(req.body);
      if (error) {
        monitoringService.recordSecurityEvent({ type: 'invalid_input', details: error.details });
        return res.status(400).json({ error: error.details[0].message });
      }
      next();
    } catch (error) {
      logger.error('Input validation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Room access control middleware
const checkRoomAccess = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Check if user has permission to access the room
    const hasAccess = await checkUserRoomAccess(userId, roomId);
    if (!hasAccess) {
      monitoringService.recordSecurityEvent({ type: 'unauthorized_room_access', userId, roomId });
      return res.status(403).json({ error: 'Access to room denied' });
    }

    next();
  } catch (error) {
    logger.error('Room access check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Media permissions middleware
const checkMediaPermissions = (req, res, next) => {
  const { action } = req.body;
  
  // Check if user has permission for the requested media action
  if (!hasMediaPermission(req.user, action)) {
    monitoringService.recordSecurityEvent({ 
      type: 'unauthorized_media_action', 
      userId: req.user.id, 
      action 
    });
    return res.status(403).json({ error: 'Media action not permitted' });
  }

  next();
};

// Helper function to check user room access
async function checkUserRoomAccess(userId, roomId) {
  // Implement your room access logic here
  // This could involve checking a database or other storage
  return true; // Placeholder
}

// Helper function to check media permissions
function hasMediaPermission(user, action) {
  // Implement your media permission logic here
  // This could involve checking user roles or other criteria
  return true; // Placeholder
}

module.exports = {
  rateLimiter,
  authenticate,
  cors,
  validateInput,
  checkRoomAccess,
  checkMediaPermissions
}; 