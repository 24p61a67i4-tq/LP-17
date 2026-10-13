/* =============================================
   ONECLICK DEVOPS - LOGS ROUTE
============================================= */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { sanitizeString } = require('../middleware/security');

/**
 * GET /api/logs - Fetch system & deployment logs
 */
router.get('/', (req, res, next) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const search = req.query.search ? sanitizeString(req.query.search) : null;

        let logs;
        if (search) {
            logs = db.queryAll(
                `SELECT * FROM logs WHERE message LIKE ? ORDER BY id DESC LIMIT ?`,
                [`%${search}%`, limit]
            );
        } else {
            logs = db.queryAll(
                `SELECT * FROM logs ORDER BY id DESC LIMIT ?`,
                [limit]
            );
        }

        // Return in chronological display order
        res.json(logs.reverse());
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/logs - Append a log entry
 */
router.post('/', (req, res, next) => {
    try {
        const { message, level, source } = req.body || {};

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({
                error: { message: 'Log message is required.', status: 400 }
            });
        }

        const validLevels = ['info', 'success', 'warning', 'error'];
        const cleanLevel = validLevels.includes(level) ? level : 'info';
        const cleanMsg = sanitizeString(message);
        const cleanSource = sanitizeString(source) || 'system';

        db.run(
            'INSERT INTO logs (message, level, source) VALUES (?, ?, ?)',
            [cleanMsg, cleanLevel, cleanSource]
        );

        const latest = db.queryGet('SELECT * FROM logs ORDER BY id DESC LIMIT 1');
        res.status(201).json(latest);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/logs - Clear logs
 */
router.delete('/', (req, res, next) => {
    try {
        db.run('DELETE FROM logs');
        db.run(
            'INSERT INTO logs (message, level, source) VALUES (?, ?, ?)',
            ['Console logs cleared.', 'info', 'system']
        );
        res.json({ message: 'Logs successfully cleared.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
