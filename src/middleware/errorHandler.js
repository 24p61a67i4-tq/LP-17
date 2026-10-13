/* =============================================
   ONECLICK DEVOPS - ERROR HANDLING MIDDLEWARE
============================================= */

const config = require('../config');

/**
 * Handle 404 for unmapped API endpoints.
 */
function notFoundHandler(req, res, next) {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            error: {
                message: `Endpoint ${req.method} ${req.path} not found.`,
                status: 404,
                timestamp: new Date().toISOString()
            }
        });
    }
    next();
}

/**
 * Centralized error handler.
 */
function errorHandler(err, req, res, next) {
    const status = err.status || err.statusCode || 500;
    const isProd = config.env === 'production';

    // Log internally for debugging
    console.error(`[ERROR] [${new Date().toISOString()}] ${req.method} ${req.url}:`, err.message);
    if (!isProd && err.stack) {
        console.error(err.stack);
    }

    res.status(status).json({
        error: {
            message: isProd && status === 500
                ? 'Internal server error occurred. Please contact the administrator.'
                : (err.message || 'An unexpected error occurred.'),
            status: status,
            timestamp: new Date().toISOString()
        }
    });
}

module.exports = {
    notFoundHandler,
    errorHandler
};
