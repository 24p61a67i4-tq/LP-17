/* =============================================
   ONECLICK DEVOPS - HEALTH ROUTE
============================================= */

const express = require('express');
const router = express.Router();
const config = require('../config');
const db = require('../db');

router.get('/', (req, res) => {
    let dbStatus = 'connected';
    try {
        db.queryGet('SELECT 1 as test');
    } catch (err) {
        dbStatus = 'disconnected';
    }

    const healthData = {
        status: dbStatus === 'connected' ? 'UP' : 'DEGRADED',
        app: config.app.name,
        version: config.app.version,
        environment: config.env,
        uptime_seconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: dbStatus,
        memory: {
            heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
        }
    };

    const statusCode = dbStatus === 'connected' ? 200 : 503;
    res.status(statusCode).json(healthData);
});

module.exports = router;
