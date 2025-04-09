import { createLogger } from 'winston';
import { format, transports } from 'winston';
import Redis from 'ioredis';
import { Octokit } from '@octokit/rest';
import { createTokenAuth } from '@octokit/auth-token';
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

class GitHubSync {
    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        });
        this.syncJobs = new Map();
        this.initializeRedisPubSub();
    }

    async initializeRedisPubSub() {
        await this.redis.subscribe('github-sync', (err) => {
            if (err) {
                logger.error('Failed to subscribe to GitHub sync events:', err);
            }
        });

        this.redis.on('message', (channel, message) => {
            if (channel === 'github-sync') {
                this.handleSyncEvent(JSON.parse(message));
            }
        });
    }

    async authenticateUser(accessToken) {
        try {
            const auth = createTokenAuth(accessToken);
            const { token } = await auth();
            return new Octokit({ auth: token });
        } catch (error) {
            logger.error('GitHub authentication failed:', error);
            throw error;
        }
    }

    async createRepository(userId, repoName, description = '') {
        try {
            const octokit = await this.authenticateUser(userId);
            const response = await octokit.repos.createForAuthenticatedUser({
                name: repoName,
                description,
                private: true
            });

            await this.redis.hset(`repo:${response.data.id}`, {
                name: repoName,
                owner: userId,
                createdAt: Date.now(),
                lastSynced: Date.now()
            });

            logger.info(`Created GitHub repository ${repoName}`);
            return { success: true, repo: response.data };
        } catch (error) {
            logger.error(`Failed to create GitHub repository ${repoName}:`, error);
            throw error;
        }
    }

    async syncProjectToGitHub(projectId, userId, repoName, branch = 'main') {
        try {
            const syncId = uuidv4();
            this.syncJobs.set(syncId, {
                status: 'in_progress',
                progress: 0,
                lastUpdated: Date.now()
            });

            const octokit = await this.authenticateUser(userId);
            
            // Get project files
            const files = await this.redis.hgetall(`project:${projectId}:files`);
            
            // Create or update files in GitHub
            for (const [filename, content] of Object.entries(files)) {
                try {
                    await octokit.repos.createOrUpdateFileContents({
                        owner: userId,
                        repo: repoName,
                        path: filename,
                        message: `Update ${filename}`,
                        content: Buffer.from(content).toString('base64'),
                        branch
                    });

                    // Update progress
                    const progress = (Object.keys(files).indexOf(filename) + 1) / Object.keys(files).length * 100;
                    this.updateSyncProgress(syncId, progress);
                } catch (error) {
                    logger.error(`Failed to sync file ${filename}:`, error);
                    throw error;
                }
            }

            this.syncJobs.set(syncId, {
                status: 'completed',
                progress: 100,
                lastUpdated: Date.now()
            });

            await this.redis.hset(`repo:${repoName}`, {
                lastSynced: Date.now()
            });

            logger.info(`Synced project ${projectId} to GitHub repository ${repoName}`);
            return { success: true, syncId };
        } catch (error) {
            logger.error(`Failed to sync project ${projectId} to GitHub:`, error);
            throw error;
        }
    }

    async syncGitHubToProject(repoName, userId, projectId, branch = 'main') {
        try {
            const syncId = uuidv4();
            this.syncJobs.set(syncId, {
                status: 'in_progress',
                progress: 0,
                lastUpdated: Date.now()
            });

            const octokit = await this.authenticateUser(userId);
            
            // Get repository contents
            const { data: contents } = await octokit.repos.getContent({
                owner: userId,
                repo: repoName,
                path: '',
                ref: branch
            });

            // Process each file
            for (const item of contents) {
                if (item.type === 'file') {
                    try {
                        const { data: file } = await octokit.repos.getContent({
                            owner: userId,
                            repo: repoName,
                            path: item.path,
                            ref: branch
                        });

                        const content = Buffer.from(file.content, 'base64').toString();
                        await this.redis.hset(`project:${projectId}:files`, {
                            [item.path]: content
                        });

                        // Update progress
                        const progress = (contents.indexOf(item) + 1) / contents.length * 100;
                        this.updateSyncProgress(syncId, progress);
                    } catch (error) {
                        logger.error(`Failed to sync file ${item.path}:`, error);
                        throw error;
                    }
                }
            }

            this.syncJobs.set(syncId, {
                status: 'completed',
                progress: 100,
                lastUpdated: Date.now()
            });

            await this.redis.hset(`project:${projectId}`, {
                lastSynced: Date.now()
            });

            logger.info(`Synced GitHub repository ${repoName} to project ${projectId}`);
            return { success: true, syncId };
        } catch (error) {
            logger.error(`Failed to sync GitHub repository ${repoName}:`, error);
            throw error;
        }
    }

    updateSyncProgress(syncId, progress) {
        const job = this.syncJobs.get(syncId);
        if (job) {
            job.progress = progress;
            job.lastUpdated = Date.now();
            this.syncJobs.set(syncId, job);

            // Publish progress update
            this.redis.publish('github-sync', JSON.stringify({
                syncId,
                progress,
                status: job.status
            }));
        }
    }

    async getSyncStatus(syncId) {
        const job = this.syncJobs.get(syncId);
        if (!job) {
            throw new Error('Sync job not found');
        }
        return job;
    }

    async handleSyncEvent(event) {
        // Handle sync events from Redis
        // This could include notifications from GitHub webhooks
        logger.info('Received GitHub sync event:', event);
    }

    async close() {
        try {
            await this.redis.quit();
            logger.info('Closed GitHubSync');
        } catch (error) {
            logger.error('Failed to close GitHubSync:', error);
            throw error;
        }
    }
}

export default new GitHubSync();
