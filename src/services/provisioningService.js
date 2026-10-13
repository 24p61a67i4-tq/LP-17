/* =============================================
   ONECLICK DEVOPS - PROVISIONING SERVICE
   Cloud Infrastructure Lifecycle Orchestrator
============================================= */

const db = require('../db');

/**
 * Provision an environment with realistic cloud infrastructure milestones.
 */
async function provisionEnvironment({
    project_name,
    environment = 'Development',
    cloud = 'AWS',
    region = 'India - Hyderabad',
    instance = 'Small',
    docker = 'Enabled',
    description = ''
}) {
    if (!project_name || project_name.trim() === '') {
        const err = new Error('Project name is required for provisioning.');
        err.status = 400;
        throw err;
    }

    const trimmedProject = project_name.trim();

    // Verify project exists
    const project = db.queryGet('SELECT * FROM projects WHERE name = ?', [trimmedProject]);
    const projectId = project ? project.id : 'custom';

    const id = db.uuidv4();
    const envSlug = environment.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const projSlug = trimmedProject.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Generate realistic internal network identifiers
    const subnet = cloud === 'AWS' ? '0' : (cloud === 'Azure' ? '1' : '2');
    const ipAddress = `10.${subnet}.${Math.floor(Math.random() * 100) + 10}.${Math.floor(Math.random() * 200) + 2}`;
    const endpointUrl = `https://${envSlug}-${projSlug}.internal.oneclick.dev`;

    // Insert record with status 'Provisioning'
    db.run(
        `INSERT INTO environments (id, project_id, project_name, environment, cloud, region, instance, docker, description, status, endpoint_url, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, projectId, trimmedProject, environment, cloud, region, instance, docker, description, 'Provisioning', endpointUrl, ipAddress]
    );

    // Initial audit log
    db.run(
        'INSERT INTO logs (message, level, source) VALUES (?, ?, ?)',
        [`[PROVISION] Initializing ${environment} environment creation for ${trimmedProject} on ${cloud} (${region})...`, 'info', 'cloud-infra']
    );

    // Run async milestones in the background
    runProvisioningMilestones(id, trimmedProject, environment, cloud, region, instance, endpointUrl).catch(err => {
        console.error(`[PROVISION] Infrastructure setup failed for ${id}:`, err.message);
        db.run('UPDATE environments SET status = ? WHERE id = ?', ['Failed', id]);
        db.run('INSERT INTO logs (message, level, source) VALUES (?, ?, ?)',
            [`[PROVISION ERROR] Environment setup failed: ${err.message}`, 'error', 'cloud-infra']);
    });

    return db.queryGet('SELECT * FROM environments WHERE id = ?', [id]);
}

/**
 * Executes infrastructure allocation milestones asynchronously.
 */
async function runProvisioningMilestones(id, projectName, environment, cloud, region, instance, endpointUrl) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const steps = [
        {
            log: `[IaaS] Allocating Virtual Private Cloud (VPC) & Subnets in ${region} [${cloud}]...`,
            level: 'info',
            delay: 350
        },
        {
            log: `[COMPUTE] Provisioning ${instance} virtual compute node with security group rules...`,
            level: 'info',
            delay: 450
        },
        {
            log: `[RUNTIME] Initializing container runtime engine & health daemons...`,
            level: 'info',
            delay: 400
        },
        {
            log: `[NETWORKING] Assigned internal endpoint: ${endpointUrl}`,
            level: 'success',
            delay: 300
        }
    ];

    for (const step of steps) {
        await sleep(step.delay);
        db.run(
            'INSERT INTO logs (message, level, source) VALUES (?, ?, ?)',
            [step.log, step.level, 'cloud-infra']
        );
    }

    // Set to Running
    db.run(
        `UPDATE environments SET status = 'Running', updated_at = datetime('now') WHERE id = ?`,
        [id]
    );

    db.run(
        'INSERT INTO logs (message, level, source) VALUES (?, ?, ?)',
        [`[SUCCESS] ${environment} environment for ${projectName} is active and ready for workloads ✓`, 'success', 'cloud-infra']
    );
}

/**
 * List all environments sorted newest first.
 */
function listEnvironments() {
    return db.queryAll('SELECT * FROM environments ORDER BY created_at DESC, id DESC');
}

/**
 * Get environment by ID.
 */
function getEnvironmentById(id) {
    return db.queryGet('SELECT * FROM environments WHERE id = ?', [id]);
}

/**
 * Terminate / Teardown an environment.
 */
function terminateEnvironment(id) {
    const env = getEnvironmentById(id);
    if (!env) {
        const err = new Error('Environment not found.');
        err.status = 404;
        throw err;
    }

    db.run('DELETE FROM environments WHERE id = ?', [id]);

    db.run(
        'INSERT INTO logs (message, level, source) VALUES (?, ?, ?)',
        [`[TEARDOWN] De-provisioned and terminated ${env.environment} environment for ${env.project_name}.`, 'info', 'cloud-infra']
    );

    return { message: `Environment '${env.environment}' for '${env.project_name}' successfully de-provisioned.` };
}

module.exports = {
    provisionEnvironment,
    listEnvironments,
    getEnvironmentById,
    terminateEnvironment
};
