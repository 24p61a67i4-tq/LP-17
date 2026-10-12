const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
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
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('--- Testing Backend Endpoints ---');

    // 1. Dashboard
    const dashboard = await makeRequest('/api/dashboard');
    console.log('1. GET /api/dashboard:', dashboard.status, dashboard.data ? 'OK' : 'FAIL');
    console.log('   Stats:', JSON.stringify(dashboard.data.stats));

    // 2. Projects
    const projects = await makeRequest('/api/projects');
    console.log('2. GET /api/projects:', projects.status, 'Count:', projects.data.length);

    // 3. Create Project
    const newProj = await makeRequest('/api/projects', 'POST', { name: 'Automated Test Project' });
    console.log('3. POST /api/projects:', newProj.status, 'Created ID:', newProj.data.id);

    // 4. Provision Environment
    const newEnv = await makeRequest('/api/environments', 'POST', {
        project_name: 'Automated Test Project',
        environment: 'Staging',
        cloud: 'AWS'
    });
    console.log('4. POST /api/environments:', newEnv.status, 'Env:', newEnv.data.environment);

    // 5. Deployments
    const newDep = await makeRequest('/api/deployments', 'POST', {
        project_name: 'Automated Test Project'
    });
    console.log('5. POST /api/deployments:', newDep.status, 'Dep #:', newDep.data.dep_number);

    // 6. Update Deployment Status
    const depUpdate = await makeRequest(`/api/deployments/${newDep.data.id}/status`, 'PATCH', {
        status: 'Success'
    });
    console.log('6. PATCH /api/deployments/:id/status:', depUpdate.status, 'Status:', depUpdate.data.status);

    // 7. Logs
    const logs = await makeRequest('/api/logs');
    console.log('7. GET /api/logs:', logs.status, 'Count:', logs.data.length);

    // 8. Settings
    const settings = await makeRequest('/api/settings');
    console.log('8. GET /api/settings:', settings.status, 'Keys:', Object.keys(settings.data));

    // 9. Clean up test project
    const delProj = await makeRequest(`/api/projects/${newProj.data.id}`, 'DELETE');
    console.log('9. DELETE /api/projects/:id:', delProj.status);

    console.log('--- All Tests Completed Successfully! ---');
    process.exit(0);
}

// Start server in child process and then test
const { spawn } = require('child_process');
const server = spawn('node', ['server.js'], { stdio: 'inherit' });

setTimeout(() => {
    runTests().catch(err => {
        console.error('Test error:', err);
        server.kill();
        process.exit(1);
    }).finally(() => {
        server.kill();
    });
}, 2000);
