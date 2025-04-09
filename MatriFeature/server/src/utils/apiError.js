export class ApiError extends Error {
    constructor(statusCode, message, isOperational = true, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// Common API errors
export const errors = {
    // 400 Bad Request
    BAD_REQUEST: (message = 'Bad Request') => new ApiError(400, message),
    INVALID_INPUT: (message = 'Invalid input data') => new ApiError(400, message),
    VALIDATION_ERROR: (message = 'Validation error') => new ApiError(400, message),

    // 401 Unauthorized
    UNAUTHORIZED: (message = 'Unauthorized') => new ApiError(401, message),
    INVALID_TOKEN: (message = 'Invalid token') => new ApiError(401, message),
    TOKEN_EXPIRED: (message = 'Token expired') => new ApiError(401, message),

    // 403 Forbidden
    FORBIDDEN: (message = 'Forbidden') => new ApiError(403, message),
    ACCESS_DENIED: (message = 'Access denied') => new ApiError(403, message),

    // 404 Not Found
    NOT_FOUND: (message = 'Not Found') => new ApiError(404, message),
    RESOURCE_NOT_FOUND: (message = 'Resource not found') => new ApiError(404, message),

    // 409 Conflict
    CONFLICT: (message = 'Conflict') => new ApiError(409, message),
    DUPLICATE: (message = 'Duplicate entry') => new ApiError(409, message),

    // 429 Too Many Requests
    TOO_MANY_REQUESTS: (message = 'Too many requests') => new ApiError(429, message),

    // 500 Internal Server Error
    INTERNAL_SERVER_ERROR: (message = 'Internal Server Error') => new ApiError(500, message),
    DATABASE_ERROR: (message = 'Database error') => new ApiError(500, message),

    // 503 Service Unavailable
    SERVICE_UNAVAILABLE: (message = 'Service Unavailable') => new ApiError(503, message)
}; 