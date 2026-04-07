/**
 * Error Handler Middleware
 * Centralized error handling for the Express application
 */

/**
 * Global error handler middleware
 * Should be registered last in the middleware chain
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  // Determine status code
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.message.includes('API key')) {
    statusCode = 401;
  } else if (err.message.includes('quota')) {
    statusCode = 429;
  } else if (err.message.includes('Empty')) {
    statusCode = 400;
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    status: statusCode,
    timestamp: new Date().toISOString(),
  });
};

module.exports = errorHandler;
