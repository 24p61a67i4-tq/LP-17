/* =============================================
   ONECLICK DEVOPS - DEPLOYMENTS ROUTE
============================================= */

const express = require('express');
const router = express.Router();
const deploymentService = require('../services/deploymentService');
const { sanitizeString } = require('../middleware/security');

/**
 * GET /api/deployments - List all deployments
 */
router.get('/', (req, res, next) => {
    try {
        const deployments = deploymentService.listDeployments();
        res.json(deployments);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/deployments - Trigger a deployment workflow
 */
router.post('/', async (req, res, next) => {
    try {
        const { project_name, environment, version, triggered_by } = req.body || {};

        if (!project_name || typeof project_name !== 'string' || project_name.trim() === '') {
            return res.status(400).json({
                error: { message: 'Project name is required for deployment.', status: 400 }
            });
        }

        const validEnvironments = ['Development', 'Testing', 'Staging', 'Production'];
        const selectedEnv = validEnvironments.includes(environment) ? environment : 'Development';

        const deployment = await deploymentService.triggerDeployment({
            project_name: sanitizeString(project_name),
            environment: selectedEnv,
            version: sanitizeString(version) || 'v1.0.0',
            triggered_by: sanitizeString(triggered_by) || 'OneClick User'
        });

        res.status(201).json(deployment);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/deployments/:id - Fetch deployment details
 */
router.get('/:id', (req, res, next) => {
    try {
        const deployment = deploymentService.getDeploymentById(req.params.id);
        if (!deployment) {
            return res.status(404).json({
                error: { message: 'Deployment record not found.', status: 404 }
            });
        }
        res.json(deployment);
    } catch (err) {
        next(err);
    }
});

/**
 * PATCH /api/deployments/:id/status - Update deployment status
 */
router.patch('/:id/status', (req, res, next) => {
    try {
        const { status } = req.body || {};
        const validStatuses = ['Running', 'Building', 'Deploying', 'Success', 'Failed'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                error: { message: `Valid status required (${validStatuses.join(', ')}).`, status: 400 }
            });
        }

        const updated = deploymentService.updateDeploymentStatus(req.params.id, status);
        res.json(updated);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
