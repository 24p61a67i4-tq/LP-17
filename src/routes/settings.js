/* =============================================
   ONECLICK DEVOPS - SETTINGS ROUTE
============================================= */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { sanitizeString } = require('../middleware/security');

/**
 * GET /api/settings - Fetch all integration settings
 */
router.get('/', (req, res, next) => {
    try {
        const rows = db.queryAll('SELECT key, value FROM settings');
        const settingsMap = {};
        rows.forEach(r => {
            settingsMap[r.key] = r.value;
        });
        res.json(settingsMap);
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/settings - Upsert an integration setting
 */
router.put('/', (req, res, next) => {
    try {
        const { key, value } = req.body || {};

        if (!key || typeof key !== 'string' || key.trim() === '') {
            return res.status(400).json({
                error: { message: 'Setting key is required.', status: 400 }
            });
        }

        if (value === undefined || value === null) {
            return res.status(400).json({
                error: { message: 'Setting value is required.', status: 400 }
            });
        }

        const cleanKey = sanitizeString(key).toLowerCase();
        const cleanValue = sanitizeString(String(value));

        const existing = db.queryGet('SELECT key FROM settings WHERE key = ?', [cleanKey]);
        if (existing) {
            db.run(
                'UPDATE settings SET value = ?, updated_at = datetime("now") WHERE key = ?',
                [cleanValue, cleanKey]
            );
        } else {
            db.run(
                'INSERT INTO settings (key, value) VALUES (?, ?)',
                [cleanKey, cleanValue]
            );
        }

        db.run(
            'INSERT INTO logs (message, level, source) VALUES (?, ?, ?)',
            [`Configuration for '${cleanKey}' updated to '${cleanValue}'.`, 'info', 'settings']
        );

        res.json({ key: cleanKey, value: cleanValue });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
