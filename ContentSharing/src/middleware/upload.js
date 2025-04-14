import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createError } from '../utils/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

  if (req.path.includes('/content')) {
    // For content uploads
    if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createError(400, 'Invalid file type. Only images and videos are allowed.'), false);
    }
  } else {
    // For other uploads (e.g., profile pictures)
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createError(400, 'Invalid file type. Only images are allowed.'), false);
    }
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1 // Maximum 1 file per request
  }
}); 