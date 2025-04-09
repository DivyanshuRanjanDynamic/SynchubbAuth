import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';

export const validateInput = (req, res, next) => {
    try {
        // Validate request body
        if (req.body) {
            // Remove any potential XSS payloads
            Object.keys(req.body).forEach(key => {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = req.body[key].replace(/<[^>]*>/g, '');
                }
            });
        }

        // Validate request parameters
        if (req.params) {
            Object.keys(req.params).forEach(key => {
                if (typeof req.params[key] === 'string') {
                    req.params[key] = req.params[key].replace(/[^a-zA-Z0-9-_]/g, '');
                }
            });
        }

        // Validate request query
        if (req.query) {
            Object.keys(req.query).forEach(key => {
                if (typeof req.query[key] === 'string') {
                    req.query[key] = req.query[key].replace(/[^a-zA-Z0-9-_]/g, '');
                }
            });
        }

        // Validate content type
        if (req.method === 'POST' || req.method === 'PUT') {
            const contentType = req.headers['content-type'];
            if (!contentType || !contentType.includes('application/json')) {
                throw new ApiError(400, 'Content-Type must be application/json');
            }
        }

        // Validate request size
        const contentLength = parseInt(req.headers['content-length']);
        if (contentLength > 10 * 1024 * 1024) { // 10MB limit
            throw new ApiError(413, 'Request entity too large');
        }

        next();
    } catch (error) {
        logger.error('Validation error:', error);
        next(error);
    }
}; 