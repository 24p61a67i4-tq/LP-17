/* =============================================
   ONECLICK DEVOPS - PROJECTS ROUTE
============================================= */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { sanitizeString } = require('../middleware/security');

/**
 * GET /api/projects - List all projects
 */
router.get('/', (req, res, next) => {
    try {
        const projects = db.queryAll('SELECT * FROM projects ORDER BY created_at DESC, name ASC');
        res.json(projects);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/projects - Register a new project
 */
router.post('/', (req, res, next) => {
    try {
        const { name, description, repo_url, docker, icon } = req.body || {};

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({
                error: { message: 'Project name is required.', status: 400 }
            });
        }

        const cleanName = sanitizeString(name);
        if (cleanName.length < 2 || cleanName.length > 60) {
            return res.status(400).json({
                error: { message: 'Project name must be between 2 and 60 characters.', status: 400 }
            });
        }

        // Check for duplicate name
        const existing = db.queryGet('SELECT id FROM projects WHERE LOWER(name) = LOWER(?)', [cleanName]);
        if (existing) {
            return res.status(409).json({
                error: { message: `Project with name '${cleanName}' already exists.`, status: 409 }
            });
        }

        const id = db.uuidv4();
        const cleanDesc = sanitizeString(description) || 'New application project created using OneClick DevOps.';
        const cleanRepo = sanitizeString(repo_url) || '';
        const cleanDocker = docker === 'Disabled' ? 'Disabled' : 'Enabled';
        const cleanIcon = sanitizeString(icon) || '📦';

        db.run(
            `INSERT INTO projects (id, name, description, repo_url, docker, icon)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, cleanName, cleanDesc, cleanRepo, cleanDocker, cleanIcon]
        );

        db.run(
            'INSERT INTO logs (message, level, source) VALUES (?, ?, ?)',
            [`Project '${cleanName}' created successfully.`, 'info', 'projects']
        );

        const project = db.queryGet('SELECT * FROM projects WHERE id = ?', [id]);
        res.status(201).json(project);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/projects/:id - Remove a project
 */
router.delete('/:id', (req, res, next) => {
    try {
        const { id } = req.params;
        const project = db.queryGet('SELECT * FROM projects WHERE id = ?', [id]);

        if (!project) {
            return res.status(404).json({
                error: { message: 'Project not found.', status: 404 }
            });
        }

        db.run('DELETE FROM projects WHERE id = ?', [id]);

        db.run(
            'INSERT INTO logs (message, level, source) VALUES (?, ?, ?)',
            [`Project '${project.name}' deleted.`, 'info', 'projects']
        );

        res.json({ message: `Project '${project.name}' deleted successfully.` });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
