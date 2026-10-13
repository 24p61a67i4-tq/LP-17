/* =============================================
   ONECLICK DEVOPS - DASHBOARD ROUTE
============================================= */

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res, next) => {
    try {
        const projects = db.queryGet('SELECT COUNT(*) as count FROM projects');
        const environments = db.queryGet('SELECT COUNT(*) as count FROM environments');
        const deployments = db.queryGet('SELECT COUNT(*) as count FROM deployments');

        const totalDep = deployments ? deployments.count : 0;
        const successDep = db.queryGet("SELECT COUNT(*) as count FROM deployments WHERE status = 'Success'");
        const successCount = successDep ? successDep.count : 0;

        const successRate = totalDep > 0 ? Math.round((successCount / totalDep) * 100) : 100;

        const recentDeployments = db.queryAll(`
            SELECT id, dep_number, project_name, environment, version, status, current_stage, created_at
            FROM deployments
            ORDER BY created_at DESC, id DESC
            LIMIT 5
        `);

        const systemStatus = db.queryAll('SELECT key, value FROM settings');

        res.json({
            stats: {
                projects: projects ? projects.count : 0,
                environments: environments ? environments.count : 0,
                deployments: totalDep,
                successRate: successRate + '%'
            },
            recentDeployments,
            systemStatus
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
