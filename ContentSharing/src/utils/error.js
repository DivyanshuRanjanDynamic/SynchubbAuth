/**
 * Create a custom error with status code and message
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Array} errors - Optional array of validation errors
 * @returns {Error} Custom error object
 */
export const createError = (statusCode, message, errors = []) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errors = errors;
  return error;
};

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const errors = err.errors || [];

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      errors: errors.length > 0 ? errors : undefined
    }
  });
}; 