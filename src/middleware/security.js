/* =============================================
   ONECLICK DEVOPS - SECURITY MIDDLEWARE
============================================= */

const config = require('../config');

// In-memory rate limiting tracker
const requestLog = new Map();

/**
 * Applies security headers to all responses.
 */
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (config.env === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Disable X-Powered-By
    res.removeHeader('X-Powered-By');
    next();
}

/**
 * Sliding window rate limiting middleware.
 */
function rateLimiter(req, res, next) {
    // Only rate-limit API calls
    if (!req.path.startsWith('/api/')) {
        return next();
    }

    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const windowStart = now - config.rateLimit.windowMs;

    let timestamps = requestLog.get(ip) || [];
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= config.rateLimit.maxRequests) {
        return res.status(429).json({
            error: {
                message: 'Too many requests. Please slow down and try again later.',
                status: 429
            }
        });
    }

    timestamps.push(now);
    requestLog.set(ip, timestamps);
    next();
}

/**
 * Sanitizes user-provided strings to prevent script injection or malformed data.
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .trim();
}

module.exports = {
    securityHeaders,
    rateLimiter,
    sanitizeString
};
