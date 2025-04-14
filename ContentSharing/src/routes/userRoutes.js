import express from 'express';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Placeholder for user routes
router.get('/profile', (req, res) => {
    res.json({
        success: true,
        data: {
            user: req.user
        }
    });
});

export default router; 