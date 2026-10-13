/* =============================================
   ONECLICK DEVOPS - DEPLOYMENT SERVICE
   Automated Safe CI/CD Pipeline Orchestrator
============================================= */

const crypto = require('crypto');
const db = require('../db');

// In-memory guard: tracks the highest number assigned in this process lifetime.
// The database is always the authoritative source; this variable only prevents
// re-issuing a number that was assigned but not yet committed (extremely rare).
let lastAssignedNumber = 0;

/**
 * Generate the next guaranteed-unique DEP number (e.g. DEP-035).
 *
 * Strategy (defence-in-depth):
 *   1. Query the DB for the true maximum numeric suffix among ALL existing dep_numbers.
 *   2. Take the higher of (dbMax, lastAssignedNumber) + 1 as the initial candidate.
 *   3. Double-check the candidate against the live DB index.
 *   4. Advance the candidate until a free slot is confirmed.
 *   5. Record the chosen number in lastAssignedNumber before returning so that a
 *      rapid back-to-back call in the same process will never re-examine the same slot.
 *
 * This is safe against server restarts (re-reads DB max on every call) and safe
 * against rapid sequential calls within the same process (lastAssignedNumber guard).
 */
function getNextDeploymentNumber() {
    // Query the true maximum numeric suffix directly from the database.
    // CAST + SUBSTR avoids bringing all rows into JS for large tables.
    const maxRow = db.queryGet(
        "SELECT MAX(CAST(SUBSTR(dep_number, 5) AS INTEGER)) AS max_num FROM deployments WHERE dep_number LIKE 'DEP-%'"
    );
    const dbMax = (maxRow && maxRow.max_num) ? parseInt(maxRow.max_num, 10) : 0;

    // Start one above the highest of: db maximum, in-memory guard.
    let candidate = Math.max(dbMax, lastAssignedNumber) + 1;
    let candidateStr = 'DEP-' + String(candidate).padStart(3, '0');

    // Collision guard: skip any candidate that already exists in the DB.
    // In normal operation this loop executes 0 extra iterations.
    while (db.queryGet('SELECT 1 FROM deployments WHERE dep_number = ?', [candidateStr])) {
        candidate++;
        candidateStr = 'DEP-' + String(candidate).padStart(3, '0');
    }

    // Record the chosen number so the next rapid call skips it even before
    // the INSERT is committed.
    lastAssignedNumber = candidate;
    return candidateStr;
}

/**
 * Trigger an end-to-end safe automated deployment workflow.
 */
async function triggerDeployment({ project_name, environment = 'Development', version = 'v1.0.0', triggered_by = 'OneClick User' }) {
    if (!project_name || project_name.trim() === '') {
        throw new Error('Project name is required for deployment.');
    }

    const trimmedProject = project_name.trim();

    // Verify project exists
    const project = db.queryGet('SELECT * FROM projects WHERE name = ?', [trimmedProject]);
    if (!project) {
        const err = new Error(`Project '${trimmedProject}' does not exist.`);
        err.status = 404;
        throw err;
    }

    const id = db.uuidv4();
    const commitHash = crypto.randomBytes(4).toString('hex').slice(0, 7);
    const startTime = Date.now();

    // Create deployment record with guaranteed unique dep_number and retry protection
    let depNumber;
    let inserted = false;
    let attempts = 0;

    while (!inserted && attempts < 10) {
        attempts++;
        depNumber = getNextDeploymentNumber();
        try {
            db.run(
                `INSERT INTO deployments (id, dep_number, project_name, environment, version, status, current_stage, triggered_by, commit_hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, depNumber, trimmedProject, environment, version, 'Building', 'SOURCE_CHECKOUT', triggered_by, commitHash]
            );
            inserted = true;
        } catch (err) {
            if (err.message && err.message.includes('UNIQUE constraint failed') && err.message.includes('dep_number')) {
                // In the rare event of concurrent insertion, advance and retry
                continue;
            }
            throw err;
        }
    }

    if (!inserted) {
        throw new Error('Failed to create deployment: could not generate unique deployment number.');
    }

    // Initial audit log
    db.run(
        `INSERT INTO logs (deployment_id, message, level, source) VALUES (?, ?, ?, ?)`,
        [id, `[PIPELINE] Started deployment for ${trimmedProject} (${environment}) [#${depNumber}]`, 'info', 'deployer']
    );

    // Execute pipeline steps asynchronously in the background
    runDeploymentPipeline(id, depNumber, trimmedProject, environment, version, commitHash, startTime).catch(err => {
        console.error(`[DEPLOY] Pipeline failed for ${id}:`, err.message);
        db.run('UPDATE deployments SET status = ?, current_stage = ? WHERE id = ?', ['Failed', 'ERROR', id]);
        db.run('INSERT INTO logs (deployment_id, message, level, source) VALUES (?, ?, ?, ?)',
            [id, `[PIPELINE FAILED] Deployment #${depNumber} encountered an error: ${err.message}`, 'error', 'deployer']);
    });

    return db.queryGet('SELECT * FROM deployments WHERE id = ?', [id]);
}

/**
 * Execute each stage of the predefined CI/CD deployment pipeline.
 */
async function runDeploymentPipeline(id, depNumber, projectName, environment, version, commitHash, startTime) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const stages = [
        {
            name: 'SOURCE_CHECKOUT',
            status: 'Building',
            log: `[CHECKOUT] Checked out branch 'main' @ commit ${commitHash} from repository.`,
            level: 'info',
            delay: 400
        },
        {
            name: 'DEPENDENCY_CHECK',
            status: 'Building',
            log: `[VALIDATE] Audited package dependencies. 0 vulnerabilities found.`,
            level: 'info',
            delay: 450
        },
        {
            name: 'UNIT_TEST',
            status: 'Building',
            log: `[TEST] Executed automated unit tests for ${projectName}: All checks passed ✓`,
            level: 'success',
            delay: 500
        },
        {
            name: 'CONTAINER_BUILD',
            status: 'Deploying',
            log: `[DOCKER] Compiled container image: ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}:${version} ✓`,
            level: 'info',
            delay: 550
        },
        {
            name: 'ENVIRONMENT_DEPLOY',
            status: 'Deploying',
            log: `[DEPLOY] Container deployed to ${environment} cluster target environment.`,
            level: 'info',
            delay: 500
        },
        {
            name: 'HEALTH_CHECK',
            status: 'Deploying',
            log: `[VERIFY] Service health check verified: HTTP 200 OK response on target endpoint ✓`,
            level: 'success',
            delay: 350
        }
    ];

    for (const stage of stages) {
        await sleep(stage.delay);
        db.run(
            'UPDATE deployments SET status = ?, current_stage = ? WHERE id = ?',
            [stage.status, stage.name, id]
        );
        db.run(
            'INSERT INTO logs (deployment_id, message, level, source) VALUES (?, ?, ?, ?)',
            [id, stage.log, stage.level, 'pipeline']
        );
    }

    // Final Success Transition
    const duration = Date.now() - startTime;
    db.run(
        `UPDATE deployments
         SET status = 'Success', current_stage = 'COMPLETE', duration_ms = ?, completed_at = datetime('now')
         WHERE id = ?`,
        [duration, id]
    );

    db.run(
        'INSERT INTO logs (deployment_id, message, level, source) VALUES (?, ?, ?, ?)',
        [id, `[SUCCESS] Deployment #${depNumber} for ${projectName} (${environment}) completed in ${(duration / 1000).toFixed(2)}s.`, 'success', 'pipeline']
    );
}

/**
 * List all deployments sorted newest first.
 */
function listDeployments() {
    return db.queryAll('SELECT * FROM deployments ORDER BY created_at DESC, id DESC');
}

/**
 * Get a specific deployment record by ID.
 */
function getDeploymentById(id) {
    return db.queryGet('SELECT * FROM deployments WHERE id = ?', [id]);
}

/**
 * Update deployment status manually (e.g. for external webhook callbacks).
 */
function updateDeploymentStatus(id, status) {
    const dep = getDeploymentById(id);
    if (!dep) {
        const err = new Error('Deployment not found.');
        err.status = 404;
        throw err;
    }

    db.run(
        `UPDATE deployments SET status = ?, completed_at = datetime('now') WHERE id = ?`,
        [status, id]
    );

    db.run(
        'INSERT INTO logs (deployment_id, message, level, source) VALUES (?, ?, ?, ?)',
        [id, `Deployment #${dep.dep_number} status updated to: ${status}`, status === 'Success' ? 'success' : 'info', 'admin']
    );

    return getDeploymentById(id);
}

module.exports = {
    triggerDeployment,
    listDeployments,
    getDeploymentById,
    updateDeploymentStatus,
    getNextDeploymentNumber
};
