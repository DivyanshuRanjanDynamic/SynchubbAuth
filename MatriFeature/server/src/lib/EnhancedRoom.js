import { v4 as uuidv4 } from 'uuid';
import { createLogger } from 'winston';
import { format, transports } from 'winston';
import MediasoupWorkerManager from './MediasoupWorkerManager.js';
import Room from './Room.js';

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

class EnhancedRoom extends Room {
    constructor(roomId, roomName, maxParticipants = 50) {
        super(roomId, roomName);
        this.maxParticipants = maxParticipants;
        this.participants = new Map();
        this.router = null;
        this.producers = new Map();
        this.consumers = new Map();
        this.transports = new Map();
        this.whiteboard = {
            elements: [],
            users: new Map()
        };
        this.notes = new Map();
        this.polls = new Map();
        this.screenSharing = new Map();
        this.recorder = null;
        this.transcriptionService = null;
        this.lastActivity = new Date();
    }

    async initialize() {
        try {
            await super.initialize();
            this.router = await MediasoupWorkerManager.createRouter();
            logger.info(`Room ${this.roomId} initialized with router`);
        } catch (error) {
            logger.error(`Failed to initialize room ${this.roomId}:`, error);
            throw error;
        }
    }

    async addParticipant(participantId, socket) {
        try {
            if (this.participants.size >= this.maxParticipants) {
                throw new Error('Room is full');
            }

            const sendTransport = await this.createWebRtcTransport(participantId, 'send');
            const recvTransport = await this.createWebRtcTransport(participantId, 'recv');

            this.transports.set(participantId, {
                send: sendTransport,
                recv: recvTransport
            });

            this.participants.set(participantId, {
                socket,
                sendTransport,
                recvTransport,
                producers: new Map(),
                consumers: new Map()
            });

            this.lastActivity = new Date();
            logger.info(`Added participant ${participantId} to room ${this.roomId}`);

            return { sendTransport, recvTransport };
        } catch (error) {
            logger.error(`Failed to add participant ${participantId} to room ${this.roomId}:`, error);
            throw error;
        }
    }

    async removeParticipant(participantId) {
        try {
            const participant = this.participants.get(participantId);
            if (!participant) return;

            // Close all producers
            for (const producer of participant.producers.values()) {
                producer.close();
            }

            // Close all consumers
            for (const consumer of participant.consumers.values()) {
                consumer.close();
            }

            // Close transports
            if (participant.sendTransport) {
                participant.sendTransport.close();
            }
            if (participant.recvTransport) {
                participant.recvTransport.close();
            }

            // Remove from maps
            this.participants.delete(participantId);
            this.producers.delete(participantId);
            this.consumers.delete(participantId);
            this.transports.delete(participantId);
            this.screenSharing.delete(participantId);

            this.lastActivity = new Date();
            logger.info(`Removed participant ${participantId} from room ${this.roomId}`);

            // Cleanup room if empty
            if (this.participants.size === 0) {
                await this.close();
            }
        } catch (error) {
            logger.error(`Failed to remove participant ${participantId} from room ${this.roomId}:`, error);
            throw error;
        }
    }

    async close() {
        try {
            // Close all participants
            for (const participantId of this.participants.keys()) {
                await this.removeParticipant(participantId);
            }

            // Close router
            if (this.router) {
                this.router.close();
            }

            // Stop recording if active
            if (this.recorder && this.recorder.isRecording) {
                await this.recorder.stopRecording();
            }

            // Stop transcription if active
            if (this.transcriptionService && this.transcriptionService.isTranscribing) {
                await this.transcriptionService.stopTranscription();
            }

            logger.info(`Closed room ${this.roomId}`);
        } catch (error) {
            logger.error(`Failed to close room ${this.roomId}:`, error);
            throw error;
        }
    }

    async createWebRtcTransport(participantId, direction) {
        try {
            const transport = await this.router.createWebRtcTransport({
                listenIps: [
                    {
                        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
                        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP
                    }
                ],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: 1000000
            });

            transport.on('dtlsstatechange', (dtlsState) => {
                if (dtlsState === 'closed') {
                    logger.warn(`Transport ${transport.id} closed for participant ${participantId}`);
                }
            });

            transport.on('close', () => {
                logger.info(`Transport ${transport.id} closed for participant ${participantId}`);
            });

            return transport;
        } catch (error) {
            logger.error(`Failed to create WebRTC transport for participant ${participantId}:`, error);
            throw error;
        }
    }

    // Whiteboard methods
    addWhiteboardElement(userId, element) {
        const elementId = uuidv4();
        this.whiteboard.elements.push({
            id: elementId,
            userId,
            ...element
        });
        this.broadcast('whiteboard-update', {
            type: 'add',
            element: { id: elementId, userId, ...element }
        });
    }

    updateWhiteboardElement(elementId, updates) {
        const element = this.whiteboard.elements.find(e => e.id === elementId);
        if (element) {
            Object.assign(element, updates);
            this.broadcast('whiteboard-update', {
                type: 'update',
                elementId,
                updates
            });
        }
    }

    // Notes methods
    addNote(userId, content) {
        const noteId = uuidv4();
        this.notes.set(noteId, {
            id: noteId,
            userId,
            content,
            timestamp: Date.now()
        });
        this.broadcast('note-added', {
            noteId,
            userId,
            content
        });
    }

    // Poll methods
    createPoll(userId, question, options) {
        const pollId = uuidv4();
        this.polls.set(pollId, {
            id: pollId,
            userId,
            question,
            options: options.map(option => ({
                text: option,
                votes: 0
            })),
            voters: new Set()
        });
        this.broadcast('poll-created', {
            pollId,
            question,
            options
        });
    }

    voteOnPoll(userId, pollId, optionIndex) {
        const poll = this.polls.get(pollId);
        if (poll && !poll.voters.has(userId)) {
            poll.options[optionIndex].votes++;
            poll.voters.add(userId);
            this.broadcast('poll-updated', {
                pollId,
                options: poll.options
            });
        }
    }

    // Screen sharing methods
    async startScreenShare(userId, producerId) {
        this.screenSharing.set(userId, producerId);
        this.broadcast('screen-sharing-started', {
            userId,
            producerId
        });
    }

    stopScreenShare(userId) {
        this.screenSharing.delete(userId);
        this.broadcast('screen-sharing-stopped', {
            userId
        });
    }

    getParticipantCount() {
        return this.participants.size;
    }

    getRoomInfo() {
        return {
            roomId: this.roomId,
            name: this.name,
            participantCount: this.participants.size,
            maxParticipants: this.maxParticipants,
            lastActivity: this.lastActivity,
            features: {
                whiteboard: true,
                notes: true,
                polls: true,
                screenSharing: true,
                recording: !!this.recorder,
                transcription: !!this.transcriptionService
            }
        };
    }
}

export default EnhancedRoom; 