import { v2 as cloudinary } from 'cloudinary';
import { logger } from './logger.js';
import { createError } from './error.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a file to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} folder - The folder in Cloudinary where the file will be stored
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} - The upload result containing URL and public_id
 */
export const uploadToCloudinary = async (fileBuffer, folder, options = {}) => {
  try {
    return new Promise((resolve, reject) => {
      let resourceType = 'auto';
      if ((options.mimetype && options.mimetype === 'application/pdf') || (options.filename && options.filename.match(/\.pdf$/i))) {
        resourceType = 'raw';
      }
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          ...options
        },
        (error, result) => {
          if (error) {
            logger.error('Error uploading to Cloudinary:', error);
            reject(createError(500, 'Failed to upload file to Cloudinary'));
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id
            });
          }
        }
      );

      // Convert buffer to stream and pipe to Cloudinary
      const bufferStream = require('stream').Readable.from(fileBuffer);
      bufferStream.pipe(uploadStream);
    });
  } catch (error) {
    logger.error('Error in uploadToCloudinary:', error);
    throw createError(500, 'Failed to upload file to Cloudinary');
  }
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - The public ID of the file to delete
 * @returns {Promise<void>}
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    logger.error('Error deleting from Cloudinary:', error);
    throw createError(500, 'Failed to delete file from Cloudinary');
  }
};

/**
 * Generate a signed URL for a Cloudinary resource
 * @param {string} publicId - The public ID of the resource
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>} - The signed URL
 */
export const getSignedUrl = async (publicId, expiresIn = 3600) => {
  try {
    return cloudinary.utils.private_download_url(publicId, 'mp4', {
      expires_at: Math.floor(Date.now() / 1000) + expiresIn
    });
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    throw createError(500, 'Failed to generate signed URL');
  }
}; 