import { socketService } from './socket';
import { logger } from './logger';
import { useAuth } from '../hooks/useAuth';

class PermissionsService {
  constructor() {
    this.permissions = new Map();
    this.roomPermissions = new Map();
  }

  async initialize(userId, roomId) {
    try {
      // Fetch initial permissions from server
      const response = await socketService.request('permissions:get', { userId, roomId });
      this.permissions = new Map(Object.entries(response.permissions));
      this.roomPermissions = new Map(Object.entries(response.roomPermissions));
      
      // Set up permission update listener
      socketService.on('permissions:update', this.handlePermissionUpdate.bind(this));
      
      logger.info('Permissions service initialized');
    } catch (error) {
      logger.error('Failed to initialize permissions service:', error);
      throw error;
    }
  }

  handlePermissionUpdate({ userId, permissions, roomPermissions }) {
    if (permissions) {
      this.permissions = new Map(Object.entries(permissions));
    }
    if (roomPermissions) {
      this.roomPermissions = new Map(Object.entries(roomPermissions));
    }
  }

  async checkParticipantPermissions(participantId, roomId) {
    try {
      // Check if participant is allowed in the room
      const roomPermission = this.roomPermissions.get(roomId);
      if (!roomPermission || !roomPermission.allowedParticipants.includes(participantId)) {
        logger.warn(`Participant ${participantId} not allowed in room ${roomId}`);
        return false;
      }

      // Check participant's specific permissions
      const participantPermission = this.permissions.get(participantId);
      if (!participantPermission) {
        logger.warn(`No permissions found for participant ${participantId}`);
        return false;
      }

      // Verify required permissions
      const requiredPermissions = ['join', 'speak', 'listen'];
      const hasRequiredPermissions = requiredPermissions.every(permission => 
        participantPermission[permission]
      );

      if (!hasRequiredPermissions) {
        logger.warn(`Participant ${participantId} missing required permissions`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking participant permissions:', error);
      return false;
    }
  }

  async checkProducerPermissions(producerId, roomId, kind) {
    try {
      // Check if producer is allowed in the room
      const roomPermission = this.roomPermissions.get(roomId);
      if (!roomPermission || !roomPermission.allowedProducers.includes(producerId)) {
        logger.warn(`Producer ${producerId} not allowed in room ${roomId}`);
        return false;
      }

      // Check producer's specific permissions
      const producerPermission = this.permissions.get(producerId);
      if (!producerPermission) {
        logger.warn(`No permissions found for producer ${producerId}`);
        return false;
      }

      // Verify media-specific permissions
      const mediaPermission = kind === 'audio' ? 'produceAudio' : 'produceVideo';
      if (!producerPermission[mediaPermission]) {
        logger.warn(`Producer ${producerId} not allowed to produce ${kind}`);
        return false;
      }

      // Check quality restrictions
      if (producerPermission.maxQuality) {
        const currentQuality = await this.getCurrentQuality(producerId);
        if (currentQuality > producerPermission.maxQuality) {
          logger.warn(`Producer ${producerId} quality exceeds maximum allowed`);
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error checking producer permissions:', error);
      return false;
    }
  }

  async getCurrentQuality(producerId) {
    // Implementation to get current quality level
    // This could be based on bitrate, resolution, etc.
    return 'high'; // Placeholder
  }

  async requestPermission(permissionType, roomId) {
    try {
      const response = await socketService.request('permissions:request', {
        permissionType,
        roomId
      });
      return response.granted;
    } catch (error) {
      logger.error('Error requesting permission:', error);
      return false;
    }
  }

  cleanup() {
    socketService.off('permissions:update');
    this.permissions.clear();
    this.roomPermissions.clear();
  }
}

export const permissionsService = new PermissionsService(); 