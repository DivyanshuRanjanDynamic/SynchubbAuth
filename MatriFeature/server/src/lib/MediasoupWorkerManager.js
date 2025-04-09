import { createLogger } from 'winston';
import { format, transports } from 'winston';
import mediasoup from 'mediasoup';
import os from 'os';
import Redis from 'ioredis';

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

class MediasoupWorkerManager {
    constructor() {
        this.workers = [];
        this.workerIndex = 0;
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        });
        this.healthCheckInterval = 30000; // 30 seconds
        this.workerStats = new Map();
        this.roomWorkerMap = new Map();
    }

    async initialize() {
        try {
            // Initialize Redis pub/sub
            await this.initializeRedisPubSub();

            // Create workers based on CPU cores
            const numWorkers = process.env.MEDIASOUP_NUM_WORKERS || os.cpus().length;
            for (let i = 0; i < numWorkers; i++) {
                await this.createWorker();
            }

            // Start health monitoring
            this.startHealthMonitoring();

            logger.info(`Initialized ${this.workers.length} Mediasoup workers`);
        } catch (error) {
            logger.error('Failed to initialize MediasoupWorkerManager:', error);
            throw error;
        }
    }

    async initializeRedisPubSub() {
        // Subscribe to worker events
        this.redis.subscribe('worker-events', (err) => {
            if (err) {
                logger.error('Failed to subscribe to worker events:', err);
            }
        });

        this.redis.on('message', (channel, message) => {
            if (channel === 'worker-events') {
                this.handleWorkerEvent(JSON.parse(message));
            }
        });
    }

    async createWorker() {
        try {
            const worker = await mediasoup.createWorker({
                logLevel: 'warn',
                logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
                rtcMinPort: process.env.MEDIASOUP_MIN_PORT || 40000,
                rtcMaxPort: process.env.MEDIASOUP_MAX_PORT || 49999
            });

            worker.on('died', async () => {
                logger.error(`Worker ${worker.pid} died, attempting to recover...`);
                await this.recoverWorker(worker);
            });

            this.workers.push(worker);
            this.workerStats.set(worker.pid, {
                pid: worker.pid,
                lastHealthCheck: Date.now(),
                status: 'active',
                load: 0,
                rooms: 0
            });

            logger.info(`Created Mediasoup worker with PID ${worker.pid}`);
            return worker;
        } catch (error) {
            logger.error('Failed to create Mediasoup worker:', error);
            throw error;
        }
    }

    async recoverWorker(failedWorker) {
        try {
            // Remove failed worker
            this.workers = this.workers.filter(w => w.pid !== failedWorker.pid);
            this.workerStats.delete(failedWorker.pid);

            // Reassign rooms to other workers
            const rooms = Array.from(this.roomWorkerMap.entries())
                .filter(([_, pid]) => pid === failedWorker.pid)
                .map(([roomId]) => roomId);

            for (const roomId of rooms) {
                const newWorker = this.getNextWorker();
                this.roomWorkerMap.set(roomId, newWorker.pid);
                await this.notifyRoomReassignment(roomId, newWorker.pid);
            }

            // Create new worker
            await this.createWorker();

            logger.info(`Recovered from worker ${failedWorker.pid} failure`);
        } catch (error) {
            logger.error(`Failed to recover worker ${failedWorker.pid}:`, error);
        }
    }

    startHealthMonitoring() {
        setInterval(async () => {
            for (const worker of this.workers) {
                try {
                    const stats = await worker.getResourceUsage();
                    const workerStat = this.workerStats.get(worker.pid);
                    
                    workerStat.load = stats.cpu / 100;
                    workerStat.lastHealthCheck = Date.now();
                    workerStat.rooms = Array.from(this.roomWorkerMap.values())
                        .filter(pid => pid === worker.pid).length;

                    // Publish worker stats to Redis
                    await this.redis.publish('worker-stats', JSON.stringify({
                        pid: worker.pid,
                        ...workerStat
                    }));

                    // Check if worker is overloaded
                    if (workerStat.load > 0.8) {
                        await this.handleWorkerOverload(worker);
                    }
                } catch (error) {
                    logger.error(`Health check failed for worker ${worker.pid}:`, error);
                    await this.recoverWorker(worker);
                }
            }
        }, this.healthCheckInterval);
    }

    async handleWorkerOverload(worker) {
        try {
            // Get rooms assigned to this worker
            const rooms = Array.from(this.roomWorkerMap.entries())
                .filter(([_, pid]) => pid === worker.pid)
                .map(([roomId]) => roomId);

            // Redistribute some rooms to less loaded workers
            const roomsToMove = Math.ceil(rooms.length * 0.3); // Move 30% of rooms
            for (let i = 0; i < roomsToMove; i++) {
                const roomId = rooms[i];
                const newWorker = this.getLeastLoadedWorker();
                this.roomWorkerMap.set(roomId, newWorker.pid);
                await this.notifyRoomReassignment(roomId, newWorker.pid);
            }

            logger.info(`Redistributed load from worker ${worker.pid}`);
        } catch (error) {
            logger.error(`Failed to handle worker overload:`, error);
        }
    }

    getLeastLoadedWorker() {
        return this.workers.reduce((leastLoaded, worker) => {
            const currentLoad = this.workerStats.get(worker.pid).load;
            const leastLoad = this.workerStats.get(leastLoaded.pid).load;
            return currentLoad < leastLoad ? worker : leastLoaded;
        });
    }

    getNextWorker() {
        const worker = this.workers[this.workerIndex];
        this.workerIndex = (this.workerIndex + 1) % this.workers.length;
        return worker;
    }

    async createRouter(roomId) {
        try {
            const worker = this.getNextWorker();
            const router = await worker.createRouter({
                mediaCodecs: [
                    {
                        kind: 'audio',
                        mimeType: 'audio/opus',
                        clockRate: 48000,
                        channels: 2
                    },
                    {
                        kind: 'video',
                        mimeType: 'video/VP8',
                        clockRate: 90000,
                        parameters: {
                            'x-google-start-bitrate': 1000
                        }
                    }
                ]
            });

            // Store room-worker mapping
            this.roomWorkerMap.set(roomId, worker.pid);

            // Update worker stats
            const workerStat = this.workerStats.get(worker.pid);
            workerStat.rooms++;

            logger.info(`Created router for room ${roomId} on worker ${worker.pid}`);
            return router;
        } catch (error) {
            logger.error(`Failed to create router for room ${roomId}:`, error);
            throw error;
        }
    }

    async createWebRtcTransport(router, options = {}) {
        try {
            const transport = await router.createWebRtcTransport({
                listenIps: [
                    {
                        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
                        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP
                    }
                ],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: 1000000,
                ...options
            });

            return {
                transport,
                params: {
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters
                }
            };
        } catch (error) {
            logger.error('Failed to create WebRTC transport:', error);
            throw error;
        }
    }

    async notifyRoomReassignment(roomId, newWorkerPid) {
        try {
            await this.redis.publish('room-reassignment', JSON.stringify({
                roomId,
                newWorkerPid,
                timestamp: Date.now()
            }));
        } catch (error) {
            logger.error(`Failed to notify room reassignment:`, error);
        }
    }

    handleWorkerEvent(event) {
        switch (event.type) {
            case 'worker-died':
                this.recoverWorker({ pid: event.pid });
                break;
            case 'worker-overloaded':
                this.handleWorkerOverload({ pid: event.pid });
                break;
            default:
                logger.warn(`Unknown worker event type: ${event.type}`);
        }
    }

    async close() {
        try {
            // Close all workers
            for (const worker of this.workers) {
                worker.close();
            }

            // Clear Redis connections
            await this.redis.quit();

            logger.info('Closed MediasoupWorkerManager');
        } catch (error) {
            logger.error('Failed to close MediasoupWorkerManager:', error);
            throw error;
        }
    }
}

export default new MediasoupWorkerManager(); 