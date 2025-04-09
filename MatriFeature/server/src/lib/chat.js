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

class Chat {
    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        });
        this.initializeRedisPubSub();
    }

    async initializeRedisPubSub() {
        await this.redis.subscribe('chat-messages', (err) => {
            if (err) {
                logger.error('Failed to subscribe to chat messages:', err);
            }
        });

        this.redis.on('message', (channel, message) => {
            if (channel === 'chat-messages') {
                this.handleChatMessage(JSON.parse(message));
            }
        });
    }

    async createChat(roomId, userId, settings = {}) {
        try {
            const chatId = uuidv4();
            const chat = {
                id: chatId,
                roomId,
                creatorId: userId,
                settings: {
                    allowEdit: settings.allowEdit || true,
                    allowDelete: settings.allowDelete || true,
                    maxMessageLength: settings.maxMessageLength || 1000,
                    ...settings
                },
                createdAt: Date.now(),
                participants: new Set([userId]),
                messages: []
            };

            // Store chat in Redis
            await this.redis.hset(`chat:${chatId}`, chat);
            await this.redis.sadd(`room:${roomId}:chats`, chatId);

            logger.info(`Created chat ${chatId} in room ${roomId}`);
            return { success: true, chat };
        } catch (error) {
            logger.error(`Failed to create chat in room ${roomId}:`, error);
            throw error;
        }
    }

    async sendMessage(roomId, chatId, userId, content, type = 'text') {
        try {
            const chat = await this.redis.hgetall(`chat:${chatId}`);
            if (!chat) {
                throw new Error('Chat not found');
            }

            if (!chat.participants.includes(userId)) {
                throw new Error('User is not a participant in this chat');
            }

            if (content.length > chat.settings.maxMessageLength) {
                throw new Error('Message exceeds maximum length');
            }

            const messageId = uuidv4();
            const message = {
                id: messageId,
                chatId,
                userId,
                content,
                type,
                timestamp: Date.now(),
                status: 'sent'
            };

            // Store message in Redis
            await this.redis.rpush(`chat:${chatId}:messages`, JSON.stringify(message));

            // Notify room about new message
            await this.redis.publish('chat-messages', JSON.stringify({
                type: 'message_sent',
                roomId,
                chatId,
                message
            }));

            logger.info(`Sent message ${messageId} in chat ${chatId}`);
            return { success: true, message };
        } catch (error) {
            logger.error(`Failed to send message in chat ${chatId}:`, error);
            throw error;
        }
    }

    async editMessage(roomId, chatId, userId, messageId, newContent) {
        try {
            const chat = await this.redis.hgetall(`chat:${chatId}`);
            if (!chat) {
                throw new Error('Chat not found');
            }

            if (!chat.settings.allowEdit) {
                throw new Error('Editing messages is not allowed in this chat');
            }

            // Get all messages
            const messages = await this.redis.lrange(`chat:${chatId}:messages`, 0, -1);
            const messageIndex = messages.findIndex(msg => JSON.parse(msg).id === messageId);

            if (messageIndex === -1) {
                throw new Error('Message not found');
            }

            const message = JSON.parse(messages[messageIndex]);
            if (message.userId !== userId) {
                throw new Error('Only the message sender can edit the message');
            }

            // Update message
            const updatedMessage = {
                ...message,
                content: newContent,
                edited: true,
                lastEdited: Date.now()
            };

            // Replace message in list
            await this.redis.lset(`chat:${chatId}:messages`, messageIndex, JSON.stringify(updatedMessage));

            // Notify room about message edit
            await this.redis.publish('chat-messages', JSON.stringify({
                type: 'message_edited',
                roomId,
                chatId,
                message: updatedMessage
            }));

            logger.info(`Edited message ${messageId} in chat ${chatId}`);
            return { success: true, message: updatedMessage };
        } catch (error) {
            logger.error(`Failed to edit message ${messageId} in chat ${chatId}:`, error);
            throw error;
        }
    }

    async deleteMessage(roomId, chatId, userId, messageId) {
        try {
            const chat = await this.redis.hgetall(`chat:${chatId}`);
            if (!chat) {
                throw new Error('Chat not found');
            }

            if (!chat.settings.allowDelete) {
                throw new Error('Deleting messages is not allowed in this chat');
            }

            // Get all messages
            const messages = await this.redis.lrange(`chat:${chatId}:messages`, 0, -1);
            const messageIndex = messages.findIndex(msg => JSON.parse(msg).id === messageId);

            if (messageIndex === -1) {
                throw new Error('Message not found');
            }

            const message = JSON.parse(messages[messageIndex]);
            if (message.userId !== userId && chat.creatorId !== userId) {
                throw new Error('Only the message sender or chat creator can delete the message');
            }

            // Remove message
            await this.redis.lrem(`chat:${chatId}:messages`, 1, messages[messageIndex]);

            // Notify room about message deletion
            await this.redis.publish('chat-messages', JSON.stringify({
                type: 'message_deleted',
                roomId,
                chatId,
                messageId
            }));

            logger.info(`Deleted message ${messageId} from chat ${chatId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to delete message ${messageId} from chat ${chatId}:`, error);
            throw error;
        }
    }

    async getMessages(chatId, limit = 50, before = null) {
        try {
            const messages = await this.redis.lrange(`chat:${chatId}:messages`, 0, -1);
            const parsedMessages = messages.map(msg => JSON.parse(msg));

            if (before) {
                const beforeIndex = parsedMessages.findIndex(msg => msg.id === before);
                if (beforeIndex !== -1) {
                    parsedMessages.splice(beforeIndex);
                }
            }

            return {
                success: true,
                messages: parsedMessages.slice(-limit)
            };
        } catch (error) {
            logger.error(`Failed to get messages for chat ${chatId}:`, error);
            throw error;
        }
    }

    async addParticipant(roomId, chatId, userId, newUserId) {
        try {
            const chat = await this.redis.hgetall(`chat:${chatId}`);
            if (!chat) {
                throw new Error('Chat not found');
            }

            if (chat.creatorId !== userId) {
                throw new Error('Only the chat creator can add participants');
            }

            if (chat.participants.includes(newUserId)) {
                throw new Error('User is already a participant');
            }

            // Add participant
            await this.redis.sadd(`chat:${chatId}:participants`, newUserId);

            // Notify room about new participant
            await this.redis.publish('chat-messages', JSON.stringify({
                type: 'participant_added',
                roomId,
                chatId,
                userId: newUserId
            }));

            logger.info(`Added participant ${newUserId} to chat ${chatId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to add participant to chat ${chatId}:`, error);
            throw error;
        }
    }

    async removeParticipant(roomId, chatId, userId, removeUserId) {
        try {
            const chat = await this.redis.hgetall(`chat:${chatId}`);
            if (!chat) {
                throw new Error('Chat not found');
            }

            if (chat.creatorId !== userId) {
                throw new Error('Only the chat creator can remove participants');
            }

            if (!chat.participants.includes(removeUserId)) {
                throw new Error('User is not a participant');
            }

            // Remove participant
            await this.redis.srem(`chat:${chatId}:participants`, removeUserId);

            // Notify room about removed participant
            await this.redis.publish('chat-messages', JSON.stringify({
                type: 'participant_removed',
                roomId,
                chatId,
                userId: removeUserId
            }));

            logger.info(`Removed participant ${removeUserId} from chat ${chatId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to remove participant from chat ${chatId}:`, error);
            throw error;
        }
    }

    async handleChatMessage(event) {
        const { type, roomId, chatId, ...data } = event;
        logger.info(`Received chat event: ${type} for chat ${chatId} in room ${roomId}`);
    }

    async cleanupChat(chatId) {
        try {
            await this.redis.del(`chat:${chatId}`);
            await this.redis.del(`chat:${chatId}:messages`);
            await this.redis.del(`chat:${chatId}:participants`);
            logger.info(`Cleaned up chat ${chatId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to cleanup chat ${chatId}:`, error);
            throw error;
        }
    }

    async close() {
        try {
            await this.redis.quit();
            logger.info('Closed Chat');
        } catch (error) {
            logger.error('Failed to close Chat:', error);
            throw error;
        }
    }
}

export default new Chat();
