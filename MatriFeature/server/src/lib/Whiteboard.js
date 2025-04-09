import { createLogger } from 'winston';
import { format, transports } from 'winston';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

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

class Whiteboard {
    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        });
        this.initializeRedisPubSub();
    }

    async initializeRedisPubSub() {
        await this.redis.subscribe('whiteboard-updates', (err) => {
            if (err) {
                logger.error('Failed to subscribe to whiteboard updates:', err);
            }
        });

        this.redis.on('message', (channel, message) => {
            if (channel === 'whiteboard-updates') {
                this.handleWhiteboardUpdate(JSON.parse(message));
            }
        });
    }

    async createWhiteboard(roomId, userId, settings = {}) {
        try {
            const whiteboardId = uuidv4();
            const whiteboard = {
                id: whiteboardId,
                roomId,
                creatorId: userId,
                settings: {
                    allowEdit: settings.allowEdit || true,
                    allowExport: settings.allowExport || true,
                    maxUndoSteps: settings.maxUndoSteps || 50,
                    ...settings
                },
                createdAt: Date.now(),
                elements: [],
                collaborators: new Set([userId])
            };

            // Store whiteboard in Redis
            await this.redis.hset(`whiteboard:${whiteboardId}`, whiteboard);
            await this.redis.sadd(`room:${roomId}:whiteboards`, whiteboardId);

            // Initialize undo stack
            await this.redis.lpush(`whiteboard:${whiteboardId}:undo`, JSON.stringify([]));

            logger.info(`Created whiteboard ${whiteboardId} in room ${roomId}`);
            return { success: true, whiteboard };
        } catch (error) {
            logger.error(`Failed to create whiteboard in room ${roomId}:`, error);
            throw error;
        }
    }

    async addElement(roomId, whiteboardId, userId, element) {
        try {
            const whiteboard = await this.redis.hgetall(`whiteboard:${whiteboardId}`);
            if (!whiteboard) {
                throw new Error('Whiteboard not found');
            }

            if (!whiteboard.settings.allowEdit) {
                throw new Error('Whiteboard is not editable');
            }

            const elementId = uuidv4();
            const newElement = {
                id: elementId,
                type: element.type,
                data: element.data,
                userId,
                timestamp: Date.now()
            };

            // Add element to whiteboard
            await this.redis.rpush(`whiteboard:${whiteboardId}:elements`, JSON.stringify(newElement));

            // Update undo stack
            const currentState = await this.getWhiteboardState(whiteboardId);
            await this.redis.lpush(`whiteboard:${whiteboardId}:undo`, JSON.stringify(currentState));

            // Notify room about new element
            await this.redis.publish('whiteboard-updates', JSON.stringify({
                type: 'element_added',
                roomId,
                whiteboardId,
                element: newElement
            }));

            logger.info(`Added element ${elementId} to whiteboard ${whiteboardId}`);
            return { success: true, element: newElement };
        } catch (error) {
            logger.error(`Failed to add element to whiteboard ${whiteboardId}:`, error);
            throw error;
        }
    }

    async updateElement(roomId, whiteboardId, userId, elementId, updates) {
        try {
            const whiteboard = await this.redis.hgetall(`whiteboard:${whiteboardId}`);
            if (!whiteboard) {
                throw new Error('Whiteboard not found');
            }

            if (!whiteboard.settings.allowEdit) {
                throw new Error('Whiteboard is not editable');
            }

            // Get all elements
            const elements = await this.redis.lrange(`whiteboard:${whiteboardId}:elements`, 0, -1);
            const elementIndex = elements.findIndex(el => JSON.parse(el).id === elementId);

            if (elementIndex === -1) {
                throw new Error('Element not found');
            }

            // Update element
            const element = JSON.parse(elements[elementIndex]);
            const updatedElement = {
                ...element,
                ...updates,
                lastModified: Date.now(),
                modifiedBy: userId
            };

            // Replace element in list
            await this.redis.lset(`whiteboard:${whiteboardId}:elements`, elementIndex, JSON.stringify(updatedElement));

            // Update undo stack
            const currentState = await this.getWhiteboardState(whiteboardId);
            await this.redis.lpush(`whiteboard:${whiteboardId}:undo`, JSON.stringify(currentState));

            // Notify room about element update
            await this.redis.publish('whiteboard-updates', JSON.stringify({
                type: 'element_updated',
                roomId,
                whiteboardId,
                element: updatedElement
            }));

            logger.info(`Updated element ${elementId} in whiteboard ${whiteboardId}`);
            return { success: true, element: updatedElement };
        } catch (error) {
            logger.error(`Failed to update element ${elementId} in whiteboard ${whiteboardId}:`, error);
            throw error;
        }
    }

    async deleteElement(roomId, whiteboardId, userId, elementId) {
        try {
            const whiteboard = await this.redis.hgetall(`whiteboard:${whiteboardId}`);
            if (!whiteboard) {
                throw new Error('Whiteboard not found');
            }

            if (!whiteboard.settings.allowEdit) {
                throw new Error('Whiteboard is not editable');
            }

            // Get all elements
            const elements = await this.redis.lrange(`whiteboard:${whiteboardId}:elements`, 0, -1);
            const elementIndex = elements.findIndex(el => JSON.parse(el).id === elementId);

            if (elementIndex === -1) {
                throw new Error('Element not found');
            }

            // Remove element
            await this.redis.lrem(`whiteboard:${whiteboardId}:elements`, 1, elements[elementIndex]);

            // Update undo stack
            const currentState = await this.getWhiteboardState(whiteboardId);
            await this.redis.lpush(`whiteboard:${whiteboardId}:undo`, JSON.stringify(currentState));

            // Notify room about element deletion
            await this.redis.publish('whiteboard-updates', JSON.stringify({
                type: 'element_deleted',
                roomId,
                whiteboardId,
                elementId
            }));

            logger.info(`Deleted element ${elementId} from whiteboard ${whiteboardId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to delete element ${elementId} from whiteboard ${whiteboardId}:`, error);
            throw error;
        }
    }

    async undo(roomId, whiteboardId, userId) {
        try {
            const whiteboard = await this.redis.hgetall(`whiteboard:${whiteboardId}`);
            if (!whiteboard) {
                throw new Error('Whiteboard not found');
            }

            if (!whiteboard.settings.allowEdit) {
                throw new Error('Whiteboard is not editable');
            }

            // Get previous state from undo stack
            const previousState = await this.redis.lpop(`whiteboard:${whiteboardId}:undo`);
            if (!previousState) {
                throw new Error('No more undo steps available');
            }

            // Update whiteboard with previous state
            await this.redis.del(`whiteboard:${whiteboardId}:elements`);
            const elements = JSON.parse(previousState);
            for (const element of elements) {
                await this.redis.rpush(`whiteboard:${whiteboardId}:elements`, JSON.stringify(element));
            }

            // Notify room about undo
            await this.redis.publish('whiteboard-updates', JSON.stringify({
                type: 'undo',
                roomId,
                whiteboardId,
                userId
            }));

            logger.info(`Undo performed on whiteboard ${whiteboardId} by user ${userId}`);
            return { success: true, elements };
        } catch (error) {
            logger.error(`Failed to undo on whiteboard ${whiteboardId}:`, error);
            throw error;
        }
    }

    async getWhiteboardState(whiteboardId) {
        try {
            const elements = await this.redis.lrange(`whiteboard:${whiteboardId}:elements`, 0, -1);
            return elements.map(el => JSON.parse(el));
        } catch (error) {
            logger.error(`Failed to get whiteboard state for ${whiteboardId}:`, error);
            throw error;
        }
    }

    async exportWhiteboard(whiteboardId, format = 'json') {
        try {
            const whiteboard = await this.redis.hgetall(`whiteboard:${whiteboardId}`);
            if (!whiteboard) {
                throw new Error('Whiteboard not found');
            }

            if (!whiteboard.settings.allowExport) {
                throw new Error('Export is not allowed for this whiteboard');
            }

            const elements = await this.getWhiteboardState(whiteboardId);
            const exportData = {
                id: whiteboardId,
                createdAt: whiteboard.createdAt,
                elements
            };

            if (format === 'json') {
                return { success: true, data: exportData };
            } else {
                throw new Error('Unsupported export format');
            }
        } catch (error) {
            logger.error(`Failed to export whiteboard ${whiteboardId}:`, error);
            throw error;
        }
    }

    async handleWhiteboardUpdate(event) {
        const { type, roomId, whiteboardId, ...data } = event;
        logger.info(`Received whiteboard update: ${type} for whiteboard ${whiteboardId} in room ${roomId}`);
    }

    async cleanupWhiteboard(whiteboardId) {
        try {
            await this.redis.del(`whiteboard:${whiteboardId}`);
            await this.redis.del(`whiteboard:${whiteboardId}:elements`);
            await this.redis.del(`whiteboard:${whiteboardId}:undo`);
            logger.info(`Cleaned up whiteboard ${whiteboardId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to cleanup whiteboard ${whiteboardId}:`, error);
            throw error;
        }
    }

    async close() {
        try {
            await this.redis.quit();
            logger.info('Closed Whiteboard');
        } catch (error) {
            logger.error('Failed to close Whiteboard:', error);
            throw error;
        }
    }
}

export default new Whiteboard();
