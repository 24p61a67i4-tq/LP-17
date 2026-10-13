/* =============================================
   ONECLICK DEVOPS - ENVIRONMENTS ROUTE
============================================= */

const express = require('express');
const router = express.Router();
const provisioningService = require('../services/provisioningService');
const { sanitizeString } = require('../middleware/security');

/**
 * GET /api/environments - List all environments
 */
router.get('/', (req, res, next) => {
    try {
        const environments = provisioningService.listEnvironments();
        res.json(environments);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/environments - Provision a new environment
 */
router.post('/', async (req, res, next) => {
    try {
        const {
            project_name,
            environment,
            cloud,
            region,
            instance,
            docker,
            description
        } = req.body || {};

        if (!project_name || typeof project_name !== 'string' || project_name.trim() === '') {
            return res.status(400).json({
                error: { message: 'Project name is required for provisioning.', status: 400 }
            });
        }

        const validEnvironments = ['Development', 'Testing', 'Staging', 'Production'];
        const selectedEnv = validEnvironments.includes(environment) ? environment : 'Development';

        const validClouds = ['AWS', 'Azure', 'Google Cloud'];
        const selectedCloud = validClouds.includes(cloud) ? cloud : 'AWS';

        const validRegions = ['India - Hyderabad', 'India - Mumbai', 'US East', 'Europe'];
        const selectedRegion = validRegions.includes(region) ? region : 'India - Hyderabad';

        const validInstances = ['Small', 'Medium', 'Large'];
        const selectedInstance = validInstances.includes(instance) ? instance : 'Small';

        const selectedDocker = docker === 'Disabled' ? 'Disabled' : 'Enabled';
        const cleanDesc = sanitizeString(description);

        const newEnv = await provisioningService.provisionEnvironment({
            project_name: sanitizeString(project_name),
            environment: selectedEnv,
            cloud: selectedCloud,
            region: selectedRegion,
            instance: selectedInstance,
            docker: selectedDocker,
            description: cleanDesc
        });

        res.status(201).json(newEnv);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/environments/:id - Teardown / Terminate an environment
 */
router.delete('/:id', (req, res, next) => {
    try {
        const result = provisioningService.terminateEnvironment(req.params.id);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
