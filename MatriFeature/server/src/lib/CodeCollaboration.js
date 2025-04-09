import { createLogger } from 'winston';
import { format, transports } from 'winston';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

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

class CodeCollaboration extends EventEmitter {
    constructor() {
        super();
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        });
        this.collaborators = new Map();
        this.cursors = new Map();
        this.selections = new Map();
        this.initializeRedisPubSub();
    }

    async initializeRedisPubSub() {
        await this.redis.subscribe('code-collaboration', (err) => {
            if (err) {
                logger.error('Failed to subscribe to code collaboration events:', err);
            }
        });

        this.redis.on('message', (channel, message) => {
            if (channel === 'code-collaboration') {
                this.handleCollaborationEvent(JSON.parse(message));
            }
        });
    }

    async joinSession(userId, sessionId) {
        try {
            const sessionKey = `session:${sessionId}`;
            await this.redis.sadd(sessionKey, userId);
            
            this.collaborators.set(userId, {
                sessionId,
                joinedAt: Date.now(),
                lastActive: Date.now()
            });

            // Notify other collaborators
            await this.redis.publish('code-collaboration', JSON.stringify({
                type: 'user_joined',
                userId,
                sessionId,
                timestamp: Date.now()
            }));

            logger.info(`User ${userId} joined session ${sessionId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to join session ${sessionId}:`, error);
            throw error;
        }
    }

    async leaveSession(userId, sessionId) {
        try {
            const sessionKey = `session:${sessionId}`;
            await this.redis.srem(sessionKey, userId);
            
            this.collaborators.delete(userId);
            this.cursors.delete(userId);
            this.selections.delete(userId);

            // Notify other collaborators
            await this.redis.publish('code-collaboration', JSON.stringify({
                type: 'user_left',
                userId,
                sessionId,
                timestamp: Date.now()
            }));

            logger.info(`User ${userId} left session ${sessionId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to leave session ${sessionId}:`, error);
            throw error;
        }
    }

    async updateCursor(userId, sessionId, position) {
        try {
            this.cursors.set(userId, {
                position,
                updatedAt: Date.now()
            });

            // Notify other collaborators
            await this.redis.publish('code-collaboration', JSON.stringify({
                type: 'cursor_update',
                userId,
                sessionId,
                position,
                timestamp: Date.now()
            }));

            return { success: true };
        } catch (error) {
            logger.error(`Failed to update cursor for user ${userId}:`, error);
            throw error;
        }
    }

    async updateSelection(userId, sessionId, selection) {
        try {
            this.selections.set(userId, {
                selection,
                updatedAt: Date.now()
            });

            // Notify other collaborators
            await this.redis.publish('code-collaboration', JSON.stringify({
                type: 'selection_update',
                userId,
                sessionId,
                selection,
                timestamp: Date.now()
            }));

            return { success: true };
        } catch (error) {
            logger.error(`Failed to update selection for user ${userId}:`, error);
            throw error;
        }
    }

    async broadcastEdit(userId, sessionId, edit) {
        try {
            // Apply operational transform if needed
            const transformedEdit = await this.transformEdit(edit);

            // Notify other collaborators
            await this.redis.publish('code-collaboration', JSON.stringify({
                type: 'edit',
                userId,
                sessionId,
                edit: transformedEdit,
                timestamp: Date.now()
            }));

            return { success: true };
        } catch (error) {
            logger.error(`Failed to broadcast edit from user ${userId}:`, error);
            throw error;
        }
    }

    async transformEdit(edit) {
        // Implement operational transform logic here
        // This is a placeholder for the actual transformation logic
        return edit;
    }

    async getCollaborators(sessionId) {
        try {
            const sessionKey = `session:${sessionId}`;
            const collaborators = await this.redis.smembers(sessionKey);
            
            const collaboratorData = collaborators.map(userId => ({
                userId,
                cursor: this.cursors.get(userId),
                selection: this.selections.get(userId),
                ...this.collaborators.get(userId)
            }));

            return { success: true, collaborators: collaboratorData };
        } catch (error) {
            logger.error(`Failed to get collaborators for session ${sessionId}:`, error);
            throw error;
        }
    }

    async handleCollaborationEvent(event) {
        const { type, userId, sessionId, ...data } = event;

        switch (type) {
            case 'user_joined':
                this.emit('userJoined', { userId, sessionId, ...data });
                break;
            case 'user_left':
                this.emit('userLeft', { userId, sessionId, ...data });
                break;
            case 'cursor_update':
                this.emit('cursorUpdate', { userId, sessionId, ...data });
                break;
            case 'selection_update':
                this.emit('selectionUpdate', { userId, sessionId, ...data });
                break;
            case 'edit':
                this.emit('edit', { userId, sessionId, ...data });
                break;
            default:
                logger.warn(`Unknown collaboration event type: ${type}`);
        }
    }

    async close() {
        try {
            await this.redis.quit();
            logger.info('Closed CodeCollaboration');
        } catch (error) {
            logger.error('Failed to close CodeCollaboration:', error);
            throw error;
        }
    }
}

export default new CodeCollaboration();
