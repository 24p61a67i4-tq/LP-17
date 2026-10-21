/* =============================================
   ONECLICK DEVOPS - SYSTEM CONFIGURATION
============================================= */

const path = require('path');

const config = {
    // Server Port (internal container listening port)
    port: parseInt(process.env.PORT || '3000', 10),

    // Host Port (external host mapped port for Docker)
    hostPort: parseInt(process.env.HOST_PORT || '8085', 10),

    // Node Environment
    env: process.env.NODE_ENV || 'development',

    // Database Storage Path (Volume-Mountable for Docker)
    dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'oneclick.sqlite'),

    // Legacy fallback database path for backward compatibility
    legacyDbPath: path.join(__dirname, '..', 'oneclick.sqlite'),

    // CORS Allowed Origins (Comma-separated or '*' for dev)
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',

    // Rate Limiting Config
    rateLimit: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '600', 10)
    },

    // Jenkins CI/CD Service URL & Credentials (configured via environment or settings table)
    jenkins: {
        url: process.env.JENKINS_URL || 'http://localhost:8080',
        user: process.env.JENKINS_USER || '',
        token: process.env.JENKINS_TOKEN || ''
    },

    // Application Metadata
    app: {
        name: 'OneClick DevOps',
        version: '1.0.0',
        description: 'Environment Provisioning & Deployment System'
    }
};

module.exports = config;
