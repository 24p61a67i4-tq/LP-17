/* =============================================
   ONECLICK DEVOPS - AUTOMATED TEST SUITE
   Integration & Unit Verification
============================================= */

const http = require('http');
const { startServer, stopServer } = require('./server');
const { getNextDeploymentNumber } = require('./src/services/deploymentService');

const TEST_PORT = 3055;

function request(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch (e) {
                    parsed = body;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

async function runTestSuite() {
    console.log('====================================================');
    console.log('  ONECLICK DEVOPS - RUNNING AUTOMATED TEST SUITE    ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✓ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ✗ FAIL: ${name}`);
            console.error(`    ↳ Error: ${err.message}`);
            failed++;
        }
    }

    try {
        // Start test server instance
        await startServer(TEST_PORT);

        // 1. Health Endpoint Tests
        await test('GET /api/health returns 200 UP and system telemetry', async () => {
            const res = await request('/api/health');
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(res.body.status === 'UP', `Expected status UP, got ${res.body.status}`);
            assert(res.body.database === 'connected', `Expected database connected`);
            assert(res.headers['x-content-type-options'] === 'nosniff', `Security header missing`);
        });

        // 2. Dashboard Tests
        await test('GET /api/dashboard returns stats and status lists', async () => {
            const res = await request('/api/dashboard');
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(res.body.stats !== undefined, 'Stats object missing');
            assert(typeof res.body.stats.projects === 'number', 'Projects count should be number');
            assert(Array.isArray(res.body.recentDeployments), 'Recent deployments should be an array');
            assert(Array.isArray(res.body.systemStatus), 'System status should be an array');
        });

        // 3. Projects API Tests
        let createdProjectId = null;
        const testProjectName = `Test Service ${Date.now()}`;

        await test('GET /api/projects lists initial seed projects', async () => {
            const res = await request('/api/projects');
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(Array.isArray(res.body), 'Should return array');
            assert(res.body.length >= 3, 'Should have at least 3 initial projects');
        });

        await test('POST /api/projects successfully creates a new project', async () => {
            const res = await request('/api/projects', 'POST', {
                name: testProjectName,
                description: 'Automated test suite microservice',
                repo_url: 'https://github.com/oneclick/test-service',
                icon: '⚡'
            });
            assert(res.status === 201, `Expected 201, got ${res.status}`);
            assert(res.body.name === testProjectName, `Name mismatch`);
            assert(res.body.id !== undefined, 'ID missing');
            createdProjectId = res.body.id;
        });

        await test('POST /api/projects rejects duplicate project names with 409 Conflict', async () => {
            const res = await request('/api/projects', 'POST', {
                name: testProjectName
            });
            assert(res.status === 409, `Expected 409, got ${res.status}`);
            assert(res.body.error !== undefined, 'Error response missing');
        });

        await test('POST /api/projects rejects blank names with 400 Bad Request', async () => {
            const res = await request('/api/projects', 'POST', { name: '   ' });
            assert(res.status === 400, `Expected 400, got ${res.status}`);
        });

        // 4. Environments API Tests
        let createdEnvId = null;

        await test('POST /api/environments provisions an environment', async () => {
            const res = await request('/api/environments', 'POST', {
                project_name: testProjectName,
                environment: 'Staging',
                cloud: 'AWS',
                region: 'India - Hyderabad',
                instance: 'Small',
                description: 'Automated test staging environment'
            });
            assert(res.status === 201, `Expected 201, got ${res.status}`);
            assert(res.body.environment === 'Staging', 'Environment mismatch');
            assert(res.body.endpoint_url !== undefined, 'Endpoint URL missing');
            createdEnvId = res.body.id;
        });

        await test('POST /api/environments rejects missing project with 400', async () => {
            const res = await request('/api/environments', 'POST', { environment: 'Staging' });
            assert(res.status === 400, `Expected 400, got ${res.status}`);
        });

        await test('GET /api/environments lists all active environments', async () => {
            const res = await request('/api/environments');
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const found = res.body.find(e => e.id === createdEnvId);
            assert(found !== undefined, 'Created environment not in list');
        });

        await test('DELETE /api/environments/:id tears down the environment', async () => {
            const res = await request(`/api/environments/${createdEnvId}`, 'DELETE');
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const check = await request(`/api/environments`);
            assert(!check.body.some(e => e.id === createdEnvId), 'Environment should have been deleted');
        });

        await test('DELETE /api/environments/:id returns 404 for unknown ID', async () => {
            const res = await request('/api/environments/non-existent-id', 'DELETE');
            assert(res.status === 404, `Expected 404, got ${res.status}`);
        });

        // 5. Deployments API Tests
        let createdDepId = null;

        await test('Pre-condition: Seeded deployments DEP-001, DEP-002, DEP-003 exist', async () => {
            const res = await request('/api/deployments');
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(Array.isArray(res.body), 'Deployments should be an array');

            const dep001 = res.body.find(d => d.dep_number === 'DEP-001');
            const dep002 = res.body.find(d => d.dep_number === 'DEP-002');
            const dep003 = res.body.find(d => d.dep_number === 'DEP-003');

            assert(dep001 !== undefined, 'DEP-001 should exist in seeded deployments');
            assert(dep001.project_name === 'Web Application', 'DEP-001 project name mismatch');
            assert(dep002 !== undefined, 'DEP-002 should exist in seeded deployments');
            assert(dep003 !== undefined, 'DEP-003 should exist in seeded deployments');
        });

        await test('POST /api/deployments launches deployment pipeline when DEP-001, DEP-002, DEP-003 exist', async () => {
            const res = await request('/api/deployments', 'POST', {
                project_name: testProjectName,
                environment: 'Development',
                version: 'v2.0.0'
            });
            assert(res.status === 201, `Expected 201, got ${res.status}`);
            assert(res.body.dep_number.startsWith('DEP-'), 'DEP number format invalid');
            assert(!['DEP-001', 'DEP-002', 'DEP-003'].includes(res.body.dep_number), `New deployment collided with seeded dep numbers: ${res.body.dep_number}`);
            assert(res.body.status === 'Building', 'Initial status should be Building');
            createdDepId = res.body.id;
        });

        await test('POST /api/deployments creates multiple deployments sequentially with guaranteed unique dep_numbers', async () => {
            const createdNumbers = new Set();
            const iterations = 4;

            for (let i = 0; i < iterations; i++) {
                const res = await request('/api/deployments', 'POST', {
                    project_name: testProjectName,
                    environment: 'Testing',
                    version: `v2.1.${i}`
                });
                assert(res.status === 201, `Expected 201 on sequential iteration ${i}, got ${res.status}`);
                const num = res.body.dep_number;
                assert(/^DEP-\d{3,}$/.test(num), `Invalid dep_number format: ${num}`);
                assert(!createdNumbers.has(num), `Duplicate dep_number created across sequence: ${num}`);
                createdNumbers.add(num);
            }

            assert(createdNumbers.size === iterations, `Expected ${iterations} distinct deployment numbers, got ${createdNumbers.size}`);

            // Ensure none of the newly created deployment numbers collide with seeded deployments
            for (const num of createdNumbers) {
                assert(!['DEP-001', 'DEP-002', 'DEP-003'].includes(num), `Sequential number collided with seeded numbers: ${num}`);
            }
        });

        await test('Original seeded deployments remain unchanged after all deployment creations', async () => {
            const res = await request('/api/deployments');
            assert(res.status === 200, `Expected 200, got ${res.status}`);

            const dep001 = res.body.find(d => d.dep_number === 'DEP-001');
            const dep002 = res.body.find(d => d.dep_number === 'DEP-002');
            const dep003 = res.body.find(d => d.dep_number === 'DEP-003');

            assert(dep001 !== undefined, 'DEP-001 must still exist');
            assert(dep001.project_name === 'Web Application', 'DEP-001 project name was modified');
            assert(dep002 !== undefined, 'DEP-002 must still exist');
            assert(dep003 !== undefined, 'DEP-003 must still exist');
        });

        await test('Unit test: getNextDeploymentNumber generates next safe sequence without colliding with existing items', async () => {
            const next1 = getNextDeploymentNumber();
            const next2 = getNextDeploymentNumber();
            assert(next1.startsWith('DEP-'), `Invalid prefix: ${next1}`);
            assert(next2.startsWith('DEP-'), `Invalid prefix: ${next2}`);
            assert(next1 !== next2, `Successive getNextDeploymentNumber calls must generate distinct numbers: ${next1} vs ${next2}`);

            const num1 = parseInt(next1.replace('DEP-', ''), 10);
            const num2 = parseInt(next2.replace('DEP-', ''), 10);
            assert(num2 > num1, `Sequential deployment numbers should increase: ${num1} -> ${num2}`);
        });

        await test('POST /api/deployments rejects non-existent project with 404', async () => {
            const res = await request('/api/deployments', 'POST', {
                project_name: 'This Project Never Exists 9999'
            });
            assert(res.status === 404, `Expected 404, got ${res.status}`);
        });

        await test('GET /api/deployments/:id returns deployment details', async () => {
            const res = await request(`/api/deployments/${createdDepId}`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(res.body.id === createdDepId, 'ID mismatch');
        });

        await test('GET /api/deployments/:id returns 404 for missing deployment', async () => {
            const res = await request('/api/deployments/fake-dep-id');
            assert(res.status === 404, `Expected 404, got ${res.status}`);
        });

        await test('PATCH /api/deployments/:id/status updates deployment state', async () => {
            const res = await request(`/api/deployments/${createdDepId}/status`, 'PATCH', {
                status: 'Success'
            });
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(res.body.status === 'Success', 'Status did not update to Success');
        });

        await test('PATCH /api/deployments/:id/status rejects invalid status values with 400', async () => {
            const res = await request(`/api/deployments/${createdDepId}/status`, 'PATCH', {
                status: 'INVALID_STATUS'
            });
            assert(res.status === 400, `Expected 400, got ${res.status}`);
        });

        // 6. Logs API Tests
        await test('GET /api/logs retrieves chronological logs', async () => {
            const res = await request('/api/logs');
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(Array.isArray(res.body), 'Logs must be an array');
            assert(res.body.length > 0, 'Logs should not be empty');
        });

        await test('POST /api/logs adds an audit log entry', async () => {
            const res = await request('/api/logs', 'POST', {
                message: 'Automated test suite audit verification',
                level: 'info'
            });
            assert(res.status === 201, `Expected 201, got ${res.status}`);
            assert(res.body.message === 'Automated test suite audit verification', 'Message mismatch');
        });

        await test('GET /api/logs?search=filters logs correctly', async () => {
            const res = await request('/api/logs?search=audit+verification');
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(res.body.length > 0, 'Search should return matching logs');
        });

        // 7. Settings API Tests
        await test('GET /api/settings returns configuration map', async () => {
            const res = await request('/api/settings');
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(res.body.github !== undefined, 'GitHub setting missing');
        });

        await test('PUT /api/settings updates configuration key', async () => {
            const res = await request('/api/settings', 'PUT', {
                key: 'docker',
                value: 'Running v29.7'
            });
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(res.body.value === 'Running v29.7', 'Value mismatch');

            const check = await request('/api/settings');
            assert(check.body.docker === 'Running v29.7', 'Updated setting not persisted');
        });

        // 8. Delete Project Cleanup
        await test('DELETE /api/projects/:id cleans up the test project', async () => {
            const res = await request(`/api/projects/${createdProjectId}`, 'DELETE');
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const check = await request('/api/projects');
            assert(!check.body.some(p => p.id === createdProjectId), 'Project should be deleted');
        });

        // 9. Error and Security Tests
        await test('GET /api/unknown-route returns structured 404 JSON', async () => {
            const res = await request('/api/unknown-endpoint-test');
            assert(res.status === 404, `Expected 404, got ${res.status}`);
            assert(res.body.error !== undefined, 'Structured error missing');
            assert(res.body.error.status === 404, 'Status in error payload mismatch');
        });

    } finally {
        await stopServer();
    }

    console.log('\n====================================================');
    console.log(`  TEST RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTestSuite().catch(err => {
    console.error('[TEST SUITE CRASH]:', err);
    process.exit(1);
});
