import { createWriteStream } from 'fs';
import { join } from 'path';
import { createLogger } from 'winston';

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

class MeetingRecorder {
    constructor(roomId) {
        this.roomId = roomId;
        this.isRecording = false;
        this.recordingPath = join(process.cwd(), 'recordings', roomId);
        this.recordingStream = null;
        this.participants = new Map();
    }

    async startRecording() {
        try {
            if (this.isRecording) {
                throw new Error('Recording already in progress');
            }

            // Create recordings directory if it doesn't exist
            if (!fs.existsSync('recordings')) {
                fs.mkdirSync('recordings');
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `recording-${timestamp}.webm`;
            this.recordingStream = createWriteStream(join(this.recordingPath, filename));

            this.isRecording = true;
            logger.info(`Started recording for room ${this.roomId}`);

            return { success: true, filename };
        } catch (error) {
            logger.error(`Failed to start recording for room ${this.roomId}:`, error);
            throw error;
        }
    }

    async stopRecording() {
        try {
            if (!this.isRecording) {
                throw new Error('No recording in progress');
            }

            if (this.recordingStream) {
                this.recordingStream.end();
                this.recordingStream = null;
            }

            this.isRecording = false;
            logger.info(`Stopped recording for room ${this.roomId}`);

            return { success: true };
        } catch (error) {
            logger.error(`Failed to stop recording for room ${this.roomId}:`, error);
            throw error;
        }
    }

    addParticipantStream(participantId, stream) {
        if (!this.isRecording) {
            throw new Error('Recording not in progress');
        }

        this.participants.set(participantId, stream);
        logger.info(`Added participant ${participantId} stream to recording`);
    }

    removeParticipantStream(participantId) {
        this.participants.delete(participantId);
        logger.info(`Removed participant ${participantId} stream from recording`);
    }

    async getRecordingList() {
        try {
            if (!fs.existsSync(this.recordingPath)) {
                return [];
            }

            const files = await fs.promises.readdir(this.recordingPath);
            return files.map(file => ({
                filename: file,
                path: join(this.recordingPath, file),
                size: fs.statSync(join(this.recordingPath, file)).size
            }));
        } catch (error) {
            logger.error(`Failed to get recording list for room ${this.roomId}:`, error);
            throw error;
        }
    }

    async deleteRecording(filename) {
        try {
            const filePath = join(this.recordingPath, filename);
            if (!fs.existsSync(filePath)) {
                throw new Error('Recording file not found');
            }

            await fs.promises.unlink(filePath);
            logger.info(`Deleted recording ${filename} for room ${this.roomId}`);

            return { success: true };
        } catch (error) {
            logger.error(`Failed to delete recording ${filename} for room ${this.roomId}:`, error);
            throw error;
        }
    }
}

export default MeetingRecorder; 