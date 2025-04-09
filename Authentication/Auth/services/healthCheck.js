import mongoose from 'mongoose';
import { redisClient } from '../config/security.js';

class HealthCheckService {
    constructor() {
        this.startTime = Date.now();
    }

    async checkMongoDB() {
        try {
            const state = mongoose.connection.readyState;
            return {
                status: state === 1 ? 'healthy' : 'unhealthy',
                details: {
                    connectionState: this.getMongoStateString(state),
                    uptime: process.uptime(),
                    connections: mongoose.connections.length
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    async checkRedis() {
        try {
            const ping = await redisClient.ping();
            return {
                status: ping === 'PONG' ? 'healthy' : 'unhealthy',
                details: {
                    response: ping,
                    uptime: process.uptime()
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    async checkSystem() {
        return {
            status: 'healthy',
            details: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                nodeVersion: process.version,
                platform: process.platform
            }
        };
    }

    getMongoStateString(state) {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        return states[state] || 'unknown';
    }

    async getHealthStatus() {
        const [mongoStatus, redisStatus, systemStatus] = await Promise.all([
            this.checkMongoDB(),
            this.checkRedis(),
            this.checkSystem()
        ]);

        const overallStatus = 
            mongoStatus.status === 'healthy' && 
            redisStatus.status === 'healthy' && 
            systemStatus.status === 'healthy' 
                ? 'healthy' 
                : 'unhealthy';

        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: {
                mongodb: mongoStatus,
                redis: redisStatus,
                system: systemStatus
            }
        };
    }
}

export const healthCheckService = new HealthCheckService(); 