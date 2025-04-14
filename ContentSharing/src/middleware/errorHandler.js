import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
    logger.error('Error:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    const errors = err.errors || [];

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            errors: errors.length > 0 ? errors : undefined,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
}; 