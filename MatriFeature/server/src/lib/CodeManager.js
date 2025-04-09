import { createLogger } from 'winston';
import { format, transports } from 'winston';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

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

class CodeManager {
    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        });
        this.codeCache = new Map();
        this.fileLocks = new Map();
        this.initializeRedisPubSub();
    }

    async initializeRedisPubSub() {
        await this.redis.subscribe('code-updates', (err) => {
            if (err) {
                logger.error('Failed to subscribe to code updates:', err);
            }
        });

        this.redis.on('message', (channel, message) => {
            if (channel === 'code-updates') {
                this.handleCodeUpdate(JSON.parse(message));
            }
        });
    }

    async createProject(projectId, initialFiles = {}) {
        try {
            const projectPath = path.join(process.env.PROJECTS_DIR || './projects', projectId);
            await fs.mkdir(projectPath, { recursive: true });

            for (const [filename, content] of Object.entries(initialFiles)) {
                await this.saveFile(projectId, filename, content);
            }

            await this.redis.hset(`project:${projectId}`, {
                createdAt: Date.now(),
                lastModified: Date.now(),
                status: 'active'
            });

            logger.info(`Created project ${projectId}`);
            return { success: true, projectId };
        } catch (error) {
            logger.error(`Failed to create project ${projectId}:`, error);
            throw error;
        }
    }

    async saveFile(projectId, filename, content, userId) {
        try {
            const filePath = path.join(process.env.PROJECTS_DIR || './projects', projectId, filename);
            const lockKey = `lock:${projectId}:${filename}`;

            // Try to acquire lock
            const lockAcquired = await this.redis.set(lockKey, userId, 'NX', 'EX', 30);
            if (!lockAcquired) {
                throw new Error('File is currently being edited by another user');
            }

            await fs.writeFile(filePath, content, 'utf8');
            await this.redis.hset(`project:${projectId}`, {
                lastModified: Date.now(),
                lastModifiedBy: userId
            });

            // Publish update to Redis
            await this.redis.publish('code-updates', JSON.stringify({
                projectId,
                filename,
                content,
                userId,
                timestamp: Date.now()
            }));

            // Release lock
            await this.redis.del(lockKey);

            logger.info(`Saved file ${filename} in project ${projectId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to save file ${filename} in project ${projectId}:`, error);
            throw error;
        }
    }

    async getFile(projectId, filename) {
        try {
            const filePath = path.join(process.env.PROJECTS_DIR || './projects', projectId, filename);
            const content = await fs.readFile(filePath, 'utf8');
            return { success: true, content };
        } catch (error) {
            logger.error(`Failed to get file ${filename} from project ${projectId}:`, error);
            throw error;
        }
    }

    async deleteFile(projectId, filename) {
        try {
            const filePath = path.join(process.env.PROJECTS_DIR || './projects', projectId, filename);
            await fs.unlink(filePath);
            await this.redis.hset(`project:${projectId}`, {
                lastModified: Date.now()
            });
            logger.info(`Deleted file ${filename} from project ${projectId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to delete file ${filename} from project ${projectId}:`, error);
            throw error;
        }
    }

    async listFiles(projectId) {
        try {
            const projectPath = path.join(process.env.PROJECTS_DIR || './projects', projectId);
            const files = await fs.readdir(projectPath);
            return { success: true, files };
        } catch (error) {
            logger.error(`Failed to list files in project ${projectId}:`, error);
            throw error;
        }
    }

    async handleCodeUpdate(message) {
        const { projectId, filename, content, userId, timestamp } = message;
        
        // Update local cache
        if (!this.codeCache.has(projectId)) {
            this.codeCache.set(projectId, new Map());
        }
        this.codeCache.get(projectId).set(filename, {
            content,
            lastModified: timestamp,
            lastModifiedBy: userId
        });

        // Notify connected clients
        // This would be handled by your WebSocket server
    }

    async cleanupProject(projectId) {
        try {
            const projectPath = path.join(process.env.PROJECTS_DIR || './projects', projectId);
            await fs.rm(projectPath, { recursive: true, force: true });
            await this.redis.del(`project:${projectId}`);
            this.codeCache.delete(projectId);
            logger.info(`Cleaned up project ${projectId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to cleanup project ${projectId}:`, error);
            throw error;
        }
    }

    async close() {
        try {
            await this.redis.quit();
            logger.info('Closed CodeManager');
        } catch (error) {
            logger.error('Failed to close CodeManager:', error);
            throw error;
        }
    }
}

export default new CodeManager();
