import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

class MediaService {
  async processImage(file) {
    try {
      // Process image with sharp directly from buffer
      const processedBuffer = await sharp(file.buffer)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Get image metadata
      const metadata = await sharp(processedBuffer).metadata();

      // Upload to Cloudinary
      const { url, publicId } = await uploadToCloudinary(
        processedBuffer,
        'images',
        {
          resource_type: 'image',
          quality: 'auto',
          fetch_format: 'auto'
        }
      );

      return {
        url,
        publicId,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: metadata.size
        }
      };
    } catch (error) {
      logger.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

  async processVideo(file) {
    try {
      // Process video with FFmpeg from buffer
      const processedVideoBuffer = await this.processVideoBuffer(file.buffer);
      const thumbnailBuffer = await this.generateThumbnailFromBuffer(file.buffer);

      // Get video metadata
      const metadata = await this.getVideoMetadataFromBuffer(processedVideoBuffer);

      // Upload to Cloudinary
      const [videoResult, thumbnailResult] = await Promise.all([
        uploadToCloudinary(
          processedVideoBuffer,
          'videos',
          {
            resource_type: 'video',
            chunk_size: 6000000 // 6MB chunks for better upload performance
          }
        ),
        uploadToCloudinary(
          thumbnailBuffer,
          'thumbnails',
          {
            resource_type: 'image',
            quality: 'auto',
            fetch_format: 'auto'
          }
        )
      ]);

      return {
        url: videoResult.url,
        publicId: videoResult.publicId,
        thumbnailUrl: thumbnailResult.url,
        thumbnailPublicId: thumbnailResult.publicId,
        metadata: {
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: metadata.size
        }
      };
    } catch (error) {
      logger.error('Error processing video:', error);
      throw new Error('Failed to process video');
    }
  }

  async generateThumbnailFromBuffer(videoBuffer) {
    return new Promise((resolve, reject) => {
      const tempInputPath = `/tmp/${uuidv4()}.mp4`;
      const tempOutputPath = `/tmp/${uuidv4()}.jpg`;

      // Write buffer to temp file (required by ffmpeg)
      require('fs').writeFileSync(tempInputPath, videoBuffer);

      ffmpeg(tempInputPath)
        .screenshots({
          timestamps: ['00:00:01'],
          filename: tempOutputPath,
          size: '320x240'
        })
        .on('end', () => {
          // Read the thumbnail and clean up temp files
          const thumbnailBuffer = require('fs').readFileSync(tempOutputPath);
          require('fs').unlinkSync(tempInputPath);
          require('fs').unlinkSync(tempOutputPath);
          resolve(thumbnailBuffer);
        })
        .on('error', (err) => {
          // Clean up temp files on error
          require('fs').unlinkSync(tempInputPath);
          require('fs').unlinkSync(tempOutputPath);
          reject(err);
        });
    });
  }

  async processVideoBuffer(videoBuffer) {
    return new Promise((resolve, reject) => {
      const tempInputPath = `/tmp/${uuidv4()}.mp4`;
      const tempOutputPath = `/tmp/${uuidv4()}.mp4`;

      // Write buffer to temp file (required by ffmpeg)
      require('fs').writeFileSync(tempInputPath, videoBuffer);

      ffmpeg(tempInputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('1280x720')
        .videoBitrate('1000k')
        .audioBitrate('128k')
        .outputOptions([
          '-movflags +faststart',
          '-profile:v main',
          '-level 3.0'
        ])
        .output(tempOutputPath)
        .on('end', () => {
          // Read the processed video and clean up temp files
          const processedBuffer = require('fs').readFileSync(tempOutputPath);
          require('fs').unlinkSync(tempInputPath);
          require('fs').unlinkSync(tempOutputPath);
          resolve(processedBuffer);
        })
        .on('error', (err) => {
          // Clean up temp files on error
          require('fs').unlinkSync(tempInputPath);
          require('fs').unlinkSync(tempOutputPath);
          reject(err);
        })
        .run();
    });
  }

  async getVideoMetadataFromBuffer(videoBuffer) {
    return new Promise((resolve, reject) => {
      const tempPath = `/tmp/${uuidv4()}.mp4`;
      
      // Write buffer to temp file (required by ffmpeg)
      require('fs').writeFileSync(tempPath, videoBuffer);

      ffmpeg.ffprobe(tempPath, (err, metadata) => {
        // Clean up temp file
        require('fs').unlinkSync(tempPath);

        if (err) return reject(err);

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          duration: metadata.format.duration,
          width: videoStream.width,
          height: videoStream.height,
          format: metadata.format.format_name,
          size: metadata.format.size
        });
      });
    });
  }
}

export const mediaService = new MediaService(); 