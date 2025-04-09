import { redisClient } from '../config/security.js';

class CacheService {
    constructor() {
        this.client = redisClient;
    }

    async set(key, value, expiry = 3600) {
        try {
            const stringValue = JSON.stringify(value);
            await this.client.set(key, stringValue, {
                EX: expiry
            });
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    async get(key) {
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    async delete(key) {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }

    async clear() {
        try {
            await this.client.flushAll();
            return true;
        } catch (error) {
            console.error('Cache clear error:', error);
            return false;
        }
    }

    // Cache user data
    async cacheUser(userId, userData, expiry = 3600) {
        const key = `user:${userId}`;
        return this.set(key, userData, expiry);
    }

    // Get cached user data
    async getCachedUser(userId) {
        const key = `user:${userId}`;
        return this.get(key);
    }

    // Cache session data
    async cacheSession(sessionId, sessionData, expiry = 86400) {
        const key = `session:${sessionId}`;
        return this.set(key, sessionData, expiry);
    }

    // Get cached session data
    async getCachedSession(sessionId) {
        const key = `session:${sessionId}`;
        return this.get(key);
    }
}

export const cacheService = new CacheService(); 