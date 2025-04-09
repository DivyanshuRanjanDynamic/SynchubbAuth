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

class Poll {
    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        });
        this.polls = new Map();
        this.initializeRedisPubSub();
    }

    async initializeRedisPubSub() {
        await this.redis.subscribe('poll-updates', (err) => {
            if (err) {
                logger.error('Failed to subscribe to poll updates:', err);
            }
        });

        this.redis.on('message', (channel, message) => {
            if (channel === 'poll-updates') {
                this.handlePollUpdate(JSON.parse(message));
            }
        });
    }

    async createPoll(roomId, userId, question, options, settings = {}) {
        try {
            const pollId = uuidv4();
            const poll = {
                id: pollId,
                roomId,
                creatorId: userId,
                question,
                options: options.map(option => ({
                    id: uuidv4(),
                    text: option,
                    votes: 0
                })),
                settings: {
                    multipleChoice: settings.multipleChoice || false,
                    anonymous: settings.anonymous || false,
                    endTime: settings.endTime || null,
                    ...settings
                },
                createdAt: Date.now(),
                status: 'active',
                totalVotes: 0
            };

            // Store poll in Redis
            await this.redis.hset(`poll:${pollId}`, poll);
            await this.redis.sadd(`room:${roomId}:polls`, pollId);

            // Notify room about new poll
            await this.redis.publish('poll-updates', JSON.stringify({
                type: 'poll_created',
                roomId,
                pollId,
                poll
            }));

            logger.info(`Created poll ${pollId} in room ${roomId}`);
            return { success: true, poll };
        } catch (error) {
            logger.error(`Failed to create poll in room ${roomId}:`, error);
            throw error;
        }
    }

    async vote(roomId, pollId, userId, optionIds) {
        try {
            const poll = await this.redis.hgetall(`poll:${pollId}`);
            if (!poll || poll.status !== 'active') {
                throw new Error('Poll not found or not active');
            }

            if (!poll.settings.multipleChoice && optionIds.length > 1) {
                throw new Error('Multiple choice not allowed for this poll');
            }

            // Check if user has already voted
            const hasVoted = await this.redis.sismember(`poll:${pollId}:voters`, userId);
            if (hasVoted && !poll.settings.allowChange) {
                throw new Error('User has already voted and changes are not allowed');
            }

            // Update votes
            for (const optionId of optionIds) {
                await this.redis.hincrby(`poll:${pollId}:options`, optionId, 1);
            }

            // Add user to voters set
            await this.redis.sadd(`poll:${pollId}:voters`, userId);

            // Update total votes
            const totalVotes = await this.redis.hincrby(`poll:${pollId}`, 'totalVotes', 1);

            // Get updated poll data
            const updatedPoll = await this.getPoll(pollId);

            // Notify room about vote
            await this.redis.publish('poll-updates', JSON.stringify({
                type: 'vote_cast',
                roomId,
                pollId,
                userId: poll.settings.anonymous ? null : userId,
                optionIds,
                poll: updatedPoll
            }));

            logger.info(`User ${userId} voted in poll ${pollId}`);
            return { success: true, poll: updatedPoll };
        } catch (error) {
            logger.error(`Failed to process vote in poll ${pollId}:`, error);
            throw error;
        }
    }

    async getPoll(pollId) {
        try {
            const poll = await this.redis.hgetall(`poll:${pollId}`);
            if (!poll) {
                throw new Error('Poll not found');
            }

            // Get options with vote counts
            const options = await this.redis.hgetall(`poll:${pollId}:options`);
            poll.options = Object.entries(options).map(([id, votes]) => ({
                id,
                votes: parseInt(votes)
            }));

            return poll;
        } catch (error) {
            logger.error(`Failed to get poll ${pollId}:`, error);
            throw error;
        }
    }

    async getRoomPolls(roomId) {
        try {
            const pollIds = await this.redis.smembers(`room:${roomId}:polls`);
            const polls = await Promise.all(pollIds.map(id => this.getPoll(id)));
            return { success: true, polls };
        } catch (error) {
            logger.error(`Failed to get polls for room ${roomId}:`, error);
            throw error;
        }
    }

    async endPoll(roomId, pollId, userId) {
        try {
            const poll = await this.redis.hgetall(`poll:${pollId}`);
            if (!poll) {
                throw new Error('Poll not found');
            }

            if (poll.creatorId !== userId) {
                throw new Error('Only the poll creator can end the poll');
            }

            await this.redis.hset(`poll:${pollId}`, 'status', 'ended');

            // Get final poll data
            const finalPoll = await this.getPoll(pollId);

            // Notify room about poll end
            await this.redis.publish('poll-updates', JSON.stringify({
                type: 'poll_ended',
                roomId,
                pollId,
                poll: finalPoll
            }));

            logger.info(`Poll ${pollId} ended in room ${roomId}`);
            return { success: true, poll: finalPoll };
        } catch (error) {
            logger.error(`Failed to end poll ${pollId}:`, error);
            throw error;
        }
    }

    async handlePollUpdate(event) {
        const { type, roomId, pollId, ...data } = event;
        logger.info(`Received poll update: ${type} for poll ${pollId} in room ${roomId}`);
    }

    async cleanupPoll(pollId) {
        try {
            await this.redis.del(`poll:${pollId}`);
            await this.redis.del(`poll:${pollId}:options`);
            await this.redis.del(`poll:${pollId}:voters`);
            logger.info(`Cleaned up poll ${pollId}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to cleanup poll ${pollId}:`, error);
            throw error;
        }
    }

    async close() {
        try {
            await this.redis.quit();
            logger.info('Closed Poll');
        } catch (error) {
            logger.error('Failed to close Poll:', error);
            throw error;
        }
    }
}

export default new Poll(); 