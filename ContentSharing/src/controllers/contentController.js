import Content from '../models/Content.js';
import { mediaService } from '../services/mediaService.js';
import { logger } from '../utils/logger.js';
import { createError } from '../utils/error.js';
import { redisClient } from '../config/redis.js';
import { contentQueue } from '../workers/queue.js';

// Cache duration in seconds
const CACHE_DURATION = 300; // 5 minutes

export const contentController = {
  // Create new content
  async createContent(req, res, next) {
    try {
      const { type, title, description, content, tags, visibility } = req.body;
      const author = req.user.id;

      let mediaData = {};
      if (type === 'image' || type === 'video') {
        if (!req.files || !req.files.media) {
          throw createError(400, 'Media file is required');
        }

        const file = req.files.media;
        mediaData = type === 'image' 
          ? await mediaService.processImage(file)
          : await mediaService.processVideo(file);
      }

      const newContent = new Content({
        author,
        type,
        title,
        description,
        content: type === 'blog' ? content : undefined,
        mediaUrl: mediaData.url,
        thumbnailUrl: mediaData.thumbnailUrl,
        tags,
        visibility,
        metadata: mediaData.metadata
      });

      await newContent.save();

      // Add to processing queue for additional tasks
      await contentQueue.add('process-content', {
        contentId: newContent._id,
        type: newContent.type
      });

      // Invalidate relevant caches
      await redisClient.del(`user:${author}:content`);
      await redisClient.del('feed:latest');

      res.status(201).json({
        success: true,
        data: newContent
      });
    } catch (error) {
      next(error);
    }
  },

  // Get content by ID
  async getContent(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Try to get from cache first
      const cachedContent = await redisClient.get(`content:${id}`);
      if (cachedContent) {
        return res.json({
          success: true,
          data: JSON.parse(cachedContent)
        });
      }

      const content = await Content.findById(id)
        .populate('author', 'username avatar')
        .populate('comments.user', 'username avatar');

      if (!content) {
        throw createError(404, 'Content not found');
      }

      // Check visibility
      if (content.visibility === 'private' && content.author._id.toString() !== userId) {
        throw createError(403, 'Access denied');
      }

      // Cache the result
      await redisClient.setEx(
        `content:${id}`,
        CACHE_DURATION,
        JSON.stringify(content)
      );

      res.json({
        success: true,
        data: content
      });
    } catch (error) {
      next(error);
    }
  },

  // Get user's content feed
  async getFeed(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      // Try to get from cache first
      const cacheKey = `feed:${userId}:${page}:${limit}`;
      const cachedFeed = await redisClient.get(cacheKey);
      if (cachedFeed) {
        return res.json({
          success: true,
          data: JSON.parse(cachedFeed)
        });
      }

      const content = await Content.find({
        $or: [
          { author: userId },
          { visibility: 'public' },
          { 'followers': userId }
        ]
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author', 'username avatar')
        .populate('comments.user', 'username avatar');

      // Cache the result
      await redisClient.setEx(
        cacheKey,
        CACHE_DURATION,
        JSON.stringify(content)
      );

      res.json({
        success: true,
        data: content
      });
    } catch (error) {
      next(error);
    }
  },

  // Update content
  async updateContent(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      const content = await Content.findById(id);
      if (!content) {
        throw createError(404, 'Content not found');
      }

      if (content.author.toString() !== userId) {
        throw createError(403, 'Not authorized to update this content');
      }

      // Handle media update if provided
      if (req.files && req.files.media) {
        const file = req.files.media;
        const mediaData = content.type === 'image'
          ? await mediaService.processImage(file)
          : await mediaService.processVideo(file);

        updates.mediaUrl = mediaData.url;
        if (content.type === 'video') {
          updates.thumbnailUrl = mediaData.thumbnailUrl;
        }
        updates.metadata = mediaData.metadata;
      }

      Object.assign(content, updates);
      await content.save();

      // Invalidate caches
      await redisClient.del(`content:${id}`);
      await redisClient.del(`user:${userId}:content`);
      await redisClient.del('feed:latest');

      res.json({
        success: true,
        data: content
      });
    } catch (error) {
      next(error);
    }
  },

  // Delete content
  async deleteContent(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const content = await Content.findById(id);
      if (!content) {
        throw createError(404, 'Content not found');
      }

      if (content.author.toString() !== userId) {
        throw createError(403, 'Not authorized to delete this content');
      }

      await content.remove();

      // Invalidate caches
      await redisClient.del(`content:${id}`);
      await redisClient.del(`user:${userId}:content`);
      await redisClient.del('feed:latest');

      res.json({
        success: true,
        data: {}
      });
    } catch (error) {
      next(error);
    }
  },

  // Like/Unlike content
  async toggleLike(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const content = await Content.findById(id);
      if (!content) {
        throw createError(404, 'Content not found');
      }

      const hasLiked = content.hasLiked(userId);
      if (hasLiked) {
        content.removeLike(userId);
      } else {
        content.addLike(userId);
      }

      await content.save();

      // Invalidate caches
      await redisClient.del(`content:${id}`);

      res.json({
        success: true,
        data: {
          liked: !hasLiked,
          likeCount: content.likeCount
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Add comment
  async addComment(req, res, next) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      const post = await Content.findById(id);
      if (!post) {
        throw createError(404, 'Content not found');
      }

      post.addComment(userId, content);
      await post.save();

      // Invalidate caches
      await redisClient.del(`content:${id}`);

      res.json({
        success: true,
        data: post.comments[post.comments.length - 1]
      });
    } catch (error) {
      next(error);
    }
  },

  // Share content
  async shareContent(req, res, next) {
    try {
      const { id } = req.params;
      const { platform } = req.body;
      const userId = req.user.id;

      const content = await Content.findById(id);
      if (!content) {
        throw createError(404, 'Content not found');
      }

      content.addShare(userId, platform);
      await content.save();

      // Add to queue for social media sharing
      await contentQueue.add('share-content', {
        contentId: content._id,
        platform,
        userId
      });

      res.json({
        success: true,
        data: {
          shared: true,
          shareCount: content.shareCount
        }
      });
    } catch (error) {
      next(error);
    }
  }
}; 