/* =============================================
   ONECLICK DEVOPS - BACKEND SERVER
   Express + SQLite (powered by sql.js)
============================================= */

const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'oneclick.sqlite');

const uuidv4 = () => crypto.randomUUID();

/* =============================================
   MIDDLEWARE
============================================= */

app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname)));

/* =============================================
   START SERVER & DATABASE INITIALIZATION
============================================= */

async function main() {
    const SQL = await initSqlJs();

    let db;
    if (fs.existsSync(DB_FILE)) {
        try {
            const filebuffer = fs.readFileSync(DB_FILE);
            db = new SQL.Database(filebuffer);
            console.log('Existing SQLite database loaded successfully.');
        } catch (err) {
            console.warn('Could not read existing DB file, creating a fresh database.', err);
            db = new SQL.Database();
        }
    } else {
        db = new SQL.Database();
        console.log('New SQLite database initialized.');
    }

    // Helper to persist database to disk
    function saveDb() {
        try {
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(DB_FILE, buffer);
        } catch (err) {
            console.error('Failed to save database to disk:', err);
        }
    }

    // Helper functions for SQL queries
    function queryAll(sql, params = []) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }

    function queryGet(sql, params = []) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        let result = null;
        if (stmt.step()) {
            result = stmt.getAsObject();
        }
        stmt.free();
        return result;
    }

    function run(sql, params = []) {
        db.run(sql, params);
        saveDb();
    }

    // Create database schema
    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT DEFAULT '',
            repo_url    TEXT DEFAULT '',
            docker      TEXT DEFAULT 'Enabled',
            status      TEXT DEFAULT 'Active',
            icon        TEXT DEFAULT '📦',
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS environments (
            id           TEXT PRIMARY KEY,
            project_id   TEXT NOT NULL,
            project_name TEXT NOT NULL,
            environment  TEXT NOT NULL,
            cloud        TEXT DEFAULT 'AWS',
            region       TEXT DEFAULT 'India - Hyderabad',
            instance     TEXT DEFAULT 'Small',
            docker       TEXT DEFAULT 'Enabled',
            description  TEXT DEFAULT '',
            status       TEXT DEFAULT 'Running',
            created_at   TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS deployments (
            id           TEXT PRIMARY KEY,
            dep_number   TEXT NOT NULL,
            project_name TEXT NOT NULL,
            environment  TEXT DEFAULT 'Development',
            version      TEXT DEFAULT 'v1.0.0',
            status       TEXT DEFAULT 'Running',
            created_at   TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS logs (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            message    TEXT NOT NULL,
            level      TEXT DEFAULT 'info',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);
    saveDb();

    // Seed default data if empty
    const projectCount = queryGet('SELECT COUNT(*) as count FROM projects');
    if (!projectCount || projectCount.count === 0) {
        console.log('Seeding initial demo data...');

        // Seed Projects
        run(`INSERT INTO projects (id, name, description, icon) VALUES (?, ?, ?, ?)`,
            [uuidv4(), 'Web Application', 'React frontend application with Node.js backend.', '🌐']);
        run(`INSERT INTO projects (id, name, description, icon) VALUES (?, ?, ?, ?)`,
            [uuidv4(), 'Payment API', 'REST API service for payment processing.', '💳']);
        run(`INSERT INTO projects (id, name, description, icon) VALUES (?, ?, ?, ?)`,
            [uuidv4(), 'Mobile API', 'Backend API for mobile applications.', '📱']);

        // Seed Environments
        run(`INSERT INTO environments (id, project_id, project_name, environment, cloud, region, instance, docker) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'web-app', 'Web Application', 'Production', 'AWS', 'India - Hyderabad', 'Medium', 'Enabled']);
        run(`INSERT INTO environments (id, project_id, project_name, environment, cloud, region, instance, docker) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'pay-api', 'Payment API', 'Staging', 'AWS', 'India - Mumbai', 'Small', 'Enabled']);

        // Seed Deployments
        run(`INSERT INTO deployments (id, dep_number, project_name, environment, version, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'DEP-001', 'Web Application', 'Production', 'v1.4.2', 'Success']);
        run(`INSERT INTO deployments (id, dep_number, project_name, environment, version, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'DEP-002', 'Payment API', 'Staging', 'v2.1.0', 'Success']);
        run(`INSERT INTO deployments (id, dep_number, project_name, environment, version, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'DEP-003', 'Mobile API', 'Development', 'v1.8.0', 'Running']);

        // Seed Logs
        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, ['OneClick DevOps System Started', 'info']);
        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, ['Checking Jenkins connection...', 'info']);
        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, ['Jenkins connected successfully', 'success']);
        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, ['Checking Docker...', 'info']);
        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, ['Docker service is running', 'success']);
        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, ['System ready for deployment.', 'info']);

        // Seed Settings
        run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['github', 'Connected']);
        run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['jenkins', 'Connected']);
        run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['docker', 'Running']);
        run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['terraform', 'Ready']);

        console.log('Database seeded successfully.');
    }

    /* =============================================
       API ROUTES - DASHBOARD
    ============================================= */

    app.get('/api/dashboard', (req, res) => {
        const projects = queryGet('SELECT COUNT(*) as count FROM projects');
        const environments = queryGet('SELECT COUNT(*) as count FROM environments');
        const deployments = queryGet('SELECT COUNT(*) as count FROM deployments');

        const totalDep = deployments ? deployments.count : 0;
        const successDep = queryGet("SELECT COUNT(*) as count FROM deployments WHERE status = 'Success'");
        const successCount = successDep ? successDep.count : 0;

        const successRate = totalDep > 0 ? Math.round((successCount / totalDep) * 100) : 100;

        const recentDeployments = queryAll(`
            SELECT dep_number, project_name, environment, status, created_at
            FROM deployments
            ORDER BY created_at DESC
            LIMIT 5
        `);

        const systemStatus = queryAll('SELECT key, value FROM settings');

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
    });

    /* =============================================
       API ROUTES - PROJECTS
    ============================================= */

    app.get('/api/projects', (req, res) => {
        const projects = queryAll('SELECT * FROM projects ORDER BY created_at DESC');
        res.json(projects);
    });

    app.post('/api/projects', (req, res) => {
        const { name, description, icon } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Project name is required.' });
        }

        const id = uuidv4();
        const projectName = name.trim();
        const projectDesc = description || 'New application project created using OneClick DevOps.';
        const projectIcon = icon || '📦';

        run(
            `INSERT INTO projects (id, name, description, icon) VALUES (?, ?, ?, ?)`,
            [id, projectName, projectDesc, projectIcon]
        );

        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, [
            `Project '${projectName}' created.`,
            'info'
        ]);

        const project = queryGet('SELECT * FROM projects WHERE id = ?', [id]);
        res.status(201).json(project);
    });

    app.delete('/api/projects/:id', (req, res) => {
        const project = queryGet('SELECT * FROM projects WHERE id = ?', [req.params.id]);

        if (!project) {
            return res.status(404).json({ error: 'Project not found.' });
        }

        run('DELETE FROM projects WHERE id = ?', [req.params.id]);

        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, [
            `Project '${project.name}' deleted.`,
            'info'
        ]);

        res.json({ message: 'Project deleted.' });
    });

    /* =============================================
       API ROUTES - ENVIRONMENTS / PROVISION
    ============================================= */

    app.get('/api/environments', (req, res) => {
        const environments = queryAll('SELECT * FROM environments ORDER BY created_at DESC');
        res.json(environments);
    });

    app.post('/api/environments', (req, res) => {
        const {
            project_name,
            environment,
            cloud,
            region,
            instance,
            docker,
            description
        } = req.body;

        if (!project_name || !environment) {
            return res.status(400).json({ error: 'Project name and environment are required.' });
        }

        const project = queryGet('SELECT * FROM projects WHERE name = ?', [project_name]);
        const projectId = project ? project.id : 'custom';
        const id = uuidv4();

        const selectedCloud = cloud || 'AWS';
        const selectedRegion = region || 'India - Hyderabad';
        const selectedInstance = instance || 'Small';
        const selectedDocker = docker || 'Enabled';
        const envDesc = description || '';

        run(
            `INSERT INTO environments (id, project_id, project_name, environment, cloud, region, instance, docker, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, projectId, project_name, environment, selectedCloud, selectedRegion, selectedInstance, selectedDocker, envDesc]
        );

        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, [
            `Starting environment provisioning for ${project_name}`,
            'info'
        ]);
        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, [
            `Creating ${environment} environment on ${selectedCloud}...`,
            'info'
        ]);
        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, [
            `Environment provisioned successfully for ${project_name} (${environment})`,
            'success'
        ]);

        const env = queryGet('SELECT * FROM environments WHERE id = ?', [id]);
        res.status(201).json(env);
    });

    /* =============================================
       API ROUTES - DEPLOYMENTS
    ============================================= */

    app.get('/api/deployments', (req, res) => {
        const deployments = queryAll('SELECT * FROM deployments ORDER BY created_at DESC');
        res.json(deployments);
    });

    app.post('/api/deployments', (req, res) => {
        const { project_name, environment, version } = req.body;

        if (!project_name) {
            return res.status(400).json({ error: 'Project name is required.' });
        }

        const id = uuidv4();

        // Calculate next DEP number
        const lastDep = queryGet('SELECT dep_number FROM deployments ORDER BY created_at DESC LIMIT 1');
        let nextNum = 1;
        if (lastDep && lastDep.dep_number) {
            const match = lastDep.dep_number.match(/DEP-(\d+)/);
            if (match) {
                nextNum = parseInt(match[1], 10) + 1;
            }
        }

        const depNumber = 'DEP-' + String(nextNum).padStart(3, '0');
        const envName = environment || 'Development';
        const depVersion = version || 'v1.0.0';

        run(
            `INSERT INTO deployments (id, dep_number, project_name, environment, version, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, depNumber, project_name, envName, depVersion, 'Running']
        );

        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, [
            `Starting deployment for ${project_name} (#${depNumber})`,
            'info'
        ]);

        const deployment = queryGet('SELECT * FROM deployments WHERE id = ?', [id]);
        res.status(201).json(deployment);
    });

    app.patch('/api/deployments/:id/status', (req, res) => {
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required.' });
        }

        const deployment = queryGet('SELECT * FROM deployments WHERE id = ?', [req.params.id]);

        if (!deployment) {
            return res.status(404).json({ error: 'Deployment not found.' });
        }

        run('UPDATE deployments SET status = ? WHERE id = ?', [status, req.params.id]);

        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, [
            `${deployment.project_name} (#${deployment.dep_number}) status changed to ${status}`,
            status === 'Success' ? 'success' : 'info'
        ]);

        const updated = queryGet('SELECT * FROM deployments WHERE id = ?', [req.params.id]);
        res.json(updated);
    });

    /* =============================================
       API ROUTES - LOGS
    ============================================= */

    app.get('/api/logs', (req, res) => {
        const limit = parseInt(req.query.limit, 10) || 50;
        const logs = queryAll(`SELECT * FROM logs ORDER BY id DESC LIMIT ?`, [limit]);
        res.json(logs.reverse());
    });

    app.post('/api/logs', (req, res) => {
        const { message, level } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Log message is required.' });
        }

        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, [message, level || 'info']);
        const latest = queryGet(`SELECT * FROM logs ORDER BY id DESC LIMIT 1`);
        res.status(201).json(latest);
    });

    app.delete('/api/logs', (req, res) => {
        run('DELETE FROM logs');
        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, ['Logs cleared.', 'info']);
        res.json({ message: 'Logs cleared.' });
    });

    /* =============================================
       API ROUTES - SETTINGS
    ============================================= */

    app.get('/api/settings', (req, res) => {
        const rows = queryAll('SELECT key, value FROM settings');
        const settings = {};
        rows.forEach(r => {
            settings[r.key] = r.value;
        });
        res.json(settings);
    });

    app.put('/api/settings', (req, res) => {
        const { key, value } = req.body;

        if (!key || !value) {
            return res.status(400).json({ error: 'Key and value are required.' });
        }

        // Upsert setting
        const existing = queryGet('SELECT * FROM settings WHERE key = ?', [key]);
        if (existing) {
            run('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
        } else {
            run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
        }

        run(`INSERT INTO logs (message, level) VALUES (?, ?)`, [
            `Setting '${key}' updated to '${value}'`,
            'info'
        ]);

        res.json({ key, value });
    });

    /* =============================================
       SPA FALLBACK ROUTE
    ============================================= */

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    /* =============================================
       LISTEN
    ============================================= */

    app.listen(PORT, () => {
        console.log('');
        console.log('  ⚡ OneClick DevOps Server is running!');
        console.log(`  🚀 URL: http://localhost:${PORT}`);
        console.log('  💾 Database: SQLite (oneclick.sqlite)');
        console.log('');
    });
}

main().catch(err => {
    console.error('Fatal error starting server:', err);
    process.exit(1);
});
