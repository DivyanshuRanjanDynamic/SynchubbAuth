import { createLogger } from 'winston';
import { format, transports } from 'winston';
import { Model } from 'vosk';
import { Readable } from 'stream';
import fs from 'fs';
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

class TranscriptionService {
    constructor(roomId) {
        this.roomId = roomId;
        this.isTranscribing = false;
        this.model = null;
        this.recognizer = null;
        this.participants = new Map();
        this.transcriptionBuffer = [];
        this.tempDir = path.join(process.cwd(), 'temp', roomId);
        this.ensureTempDirectory();
    }

    ensureTempDirectory() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async initialize() {
        try {
            const modelPath = process.env.VOSK_MODEL_PATH || './models/vosk-model-small-en-us-0.15';
            
            if (!fs.existsSync(modelPath)) {
                throw new Error(`Vosk model not found at ${modelPath}`);
            }

            this.model = new Model(modelPath);
            this.recognizer = new this.model.KaldiRecognizer(16000);
            
            // Set up error handling for the recognizer
            this.recognizer.on('error', (error) => {
                logger.error(`Recognizer error in room ${this.roomId}:`, error);
            });

            logger.info(`Initialized transcription service for room ${this.roomId}`);
        } catch (error) {
            logger.error(`Failed to initialize transcription service:`, error);
            throw error;
        }
    }

    validateAudioFormat(audioStream) {
        // Check if the stream has the required properties
        if (!audioStream || typeof audioStream.on !== 'function') {
            throw new Error('Invalid audio stream: missing event emitter interface');
        }

        // Additional format validation can be added here
        // For example, checking sample rate, channels, etc.
    }

    async startTranscription() {
        try {
            if (this.isTranscribing) {
                throw new Error('Transcription already in progress');
            }

            if (!this.recognizer) {
                await this.initialize();
            }

            this.recognizer.on('result', (result) => {
                try {
                    const transcription = JSON.parse(result).text;
                    if (transcription) {
                        this.transcriptionBuffer.push({
                            text: transcription,
                            timestamp: new Date().toISOString(),
                            isFinal: true
                        });
                    }
                } catch (error) {
                    logger.error(`Failed to parse transcription result:`, error);
                }
            });

            this.isTranscribing = true;
            logger.info(`Started transcription for room ${this.roomId}`);

            return { success: true };
        } catch (error) {
            logger.error(`Failed to start transcription for room ${this.roomId}:`, error);
            throw error;
        }
    }

    async stopTranscription() {
        try {
            if (!this.isTranscribing) {
                throw new Error('No transcription in progress');
            }

            if (this.recognizer) {
                this.recognizer.removeAllListeners();
            }

            // Cleanup temporary files
            this.cleanupTempFiles();

            this.isTranscribing = false;
            logger.info(`Stopped transcription for room ${this.roomId}`);

            return { success: true };
        } catch (error) {
            logger.error(`Failed to stop transcription for room ${this.roomId}:`, error);
            throw error;
        }
    }

    addParticipantAudio(participantId, audioStream) {
        try {
            if (!this.isTranscribing) {
                throw new Error('Transcription not in progress');
            }

            this.validateAudioFormat(audioStream);

            const readable = new Readable({
                read() {}
            });

            audioStream.on('data', (chunk) => {
                try {
                    readable.push(chunk);
                } catch (error) {
                    logger.error(`Error pushing audio data for participant ${participantId}:`, error);
                }
            });

            audioStream.on('error', (error) => {
                logger.error(`Audio stream error for participant ${participantId}:`, error);
                this.removeParticipantAudio(participantId);
            });

            readable.pipe(this.recognizer);
            this.participants.set(participantId, readable);
            logger.info(`Added participant ${participantId} audio to transcription`);
        } catch (error) {
            logger.error(`Failed to add participant audio:`, error);
            throw error;
        }
    }

    removeParticipantAudio(participantId) {
        try {
            const readable = this.participants.get(participantId);
            if (readable) {
                readable.destroy();
                this.participants.delete(participantId);
                logger.info(`Removed participant ${participantId} audio from transcription`);
            }
        } catch (error) {
            logger.error(`Failed to remove participant audio:`, error);
            throw error;
        }
    }

    cleanupTempFiles() {
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(this.tempDir, file));
                }
                fs.rmdirSync(this.tempDir);
            }
        } catch (error) {
            logger.error(`Failed to cleanup temporary files:`, error);
        }
    }

    getTranscription() {
        return this.transcriptionBuffer;
    }

    clearTranscription() {
        this.transcriptionBuffer = [];
        logger.info(`Cleared transcription buffer for room ${this.roomId}`);
    }

    async exportTranscription(format = 'txt') {
        try {
            if (this.transcriptionBuffer.length === 0) {
                throw new Error('No transcription data available');
            }

            let content = '';
            switch (format) {
                case 'txt':
                    content = this.transcriptionBuffer
                        .map(entry => `${entry.timestamp}: ${entry.text}`)
                        .join('\n');
                    break;
                case 'json':
                    content = JSON.stringify(this.transcriptionBuffer, null, 2);
                    break;
                case 'srt':
                    content = this.transcriptionBuffer
                        .map((entry, index) => {
                            const startTime = new Date(entry.timestamp).toISOString().substr(11, 12);
                            return `${index + 1}\n${startTime} --> ${startTime}\n${entry.text}\n`;
                        })
                        .join('\n');
                    break;
                default:
                    throw new Error('Unsupported export format');
            }

            return {
                success: true,
                content,
                format
            };
        } catch (error) {
            logger.error(`Failed to export transcription for room ${this.roomId}:`, error);
            throw error;
        }
    }
}

export default TranscriptionService; 