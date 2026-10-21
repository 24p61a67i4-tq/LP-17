/* =============================================
   ONECLICK DEVOPS - APPLICATION SERVER
   Main Express Entrypoint
============================================= */

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config');
const db = require('./src/db');
const { securityHeaders, rateLimiter } = require('./src/middleware/security');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');

// Route Modules
const healthRoutes = require('./src/routes/health');
const dashboardRoutes = require('./src/routes/dashboard');
const projectsRoutes = require('./src/routes/projects');
const environmentsRoutes = require('./src/routes/environments');
const deploymentsRoutes = require('./src/routes/deployments');
const logsRoutes = require('./src/routes/logs');
const settingsRoutes = require('./src/routes/settings');

const app = express();

/* =============================================
   SECURITY & PARSING MIDDLEWARE
============================================= */

// Security HTTP headers
app.use(securityHeaders);

// CORS Policy Configuration
app.use(cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers with payload size bounds
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Rate limiting
app.use(rateLimiter);

// Serve static frontend assets
app.use(express.static(path.join(__dirname)));

/* =============================================
   REST API ROUTES
============================================= */

app.use('/api/health', healthRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/environments', environmentsRoutes);
app.use('/api/deployments', deploymentsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/settings', settingsRoutes);

/* =============================================
   FALLBACKS & ERROR HANDLING
============================================= */

// 404 handler for unknown /api/* endpoints
app.use(notFoundHandler);

// Single Page Application fallback for web navigation
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Centralized error handler
app.use(errorHandler);

/* =============================================
   SERVER BOOTSTRAP
============================================= */

let serverInstance = null;

async function startServer(port = config.port) {
    // 1. Initialize SQLite database & migrations
    await db.initDatabase();

    // 2. Start Express HTTP Listener
    return new Promise((resolve) => {
        serverInstance = app.listen(port, () => {
            const hostPort = config.hostPort || 8085;
            console.log('');
            console.log('  ⚡ OneClick DevOps Server is running!');
            console.log(`  🚀 Container URL: http://localhost:${port}`);
            console.log(`  🌐 Host URL:      http://localhost:${hostPort}`);
            console.log(`  🩺 Container Health: http://localhost:${port}/api/health`);
            console.log(`  🩺 Host Health:      http://localhost:${hostPort}/api/health`);
            console.log(`  💾 Database: SQLite (${config.dbPath})`);
            console.log(`  🛡️ Environment: ${config.env}`);
            console.log('');
            resolve(serverInstance);
        });
    });
}

function stopServer() {
    return new Promise((resolve) => {
        if (serverInstance) {
            db.saveDb();
            serverInstance.close(() => {
                console.log('[SERVER] Server closed gracefully.');
                serverInstance = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

// Graceful process shutdown handling
process.on('SIGINT', async () => {
    console.log('\n[SERVER] SIGINT received, shutting down gracefully...');
    await stopServer();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n[SERVER] SIGTERM received, shutting down gracefully...');
    await stopServer();
    process.exit(0);
});

// Run directly if not required as a module
if (require.main === module) {
    startServer().catch((err) => {
        console.error('[FATAL] Failed to start server:', err);
        process.exit(1);
    });
}

module.exports = {
    app,
    startServer,
    stopServer
};
