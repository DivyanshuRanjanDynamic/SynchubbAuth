import express from 'express';
import { contentController } from '../controllers/contentController.js';
import { validateContent } from '../middleware/validation.js';
import { upload } from '../middleware/upload.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// Content creation and management
router.post('/', 
  upload.single('media'),
  validateContent,
  contentController.createContent
);

router.get('/:id', contentController.getContent);
router.get('/feed', contentController.getFeed);
router.put('/:id', 
  upload.single('media'),
  validateContent,
  contentController.updateContent
);
router.delete('/:id', contentController.deleteContent);

// Social interactions
router.post('/:id/like', contentController.toggleLike);
router.post('/:id/comment', contentController.addComment);
router.post('/:id/share', contentController.shareContent);

export default router; 