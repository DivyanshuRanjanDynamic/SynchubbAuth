import express from 'express';
import { healthCheck } from '../controllers/health.controller.js';

const router = express.Router();

// Health check endpoint - no authentication required
router.get("/health", healthCheck);

export default router; 