/* =============================================
   ONECLICK DEVOPS - DATABASE ADAPTER
   SQLite Engine powered by sql.js WebAssembly
============================================= */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

let dbInstance = null;
let sqlEngine = null;

const uuidv4 = () => crypto.randomUUID();

/**
 * Persist current WebAssembly memory database to disk.
 */
function saveDb() {
    if (!dbInstance) return;
    try {
        const targetDir = path.dirname(config.dbPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const data = dbInstance.export();
        const buffer = Buffer.from(data);

        let saved = false;
        let attempts = 0;
        while (!saved && attempts < 5) {
            attempts++;
            try {
                fs.writeFileSync(config.dbPath, buffer);
                saved = true;
            } catch (writeErr) {
                if (attempts >= 5) throw writeErr;
                const start = Date.now();
                while (Date.now() - start < 30) {} // Brief backoff for file lock release
            }
        }
    } catch (err) {
        console.error('[DB] Failed to persist database to disk:', err.message);
    }
}

/**
 * Execute a query returning all rows as JavaScript objects.
 */
function queryAll(sql, params = []) {
    if (!dbInstance) throw new Error('Database is not initialized');
    const stmt = dbInstance.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

/**
 * Execute a query returning a single row or null.
 */
function queryGet(sql, params = []) {
    if (!dbInstance) throw new Error('Database is not initialized');
    const stmt = dbInstance.prepare(sql);
    stmt.bind(params);
    let result = null;
    if (stmt.step()) {
        result = stmt.getAsObject();
    }
    stmt.free();
    return result;
}

/**
 * Execute an INSERT / UPDATE / DELETE query and auto-persist to disk.
 */
function run(sql, params = []) {
    if (!dbInstance) throw new Error('Database is not initialized');
    dbInstance.run(sql, params);
    saveDb();
}

/**
 * Initialize database, apply schema migrations and seed default data.
 */
async function initDatabase() {
    if (dbInstance) return dbInstance;

    sqlEngine = await initSqlJs();

    // Check if db exists at target path, or check legacy root path
    let loadedFromDisk = false;
    const targetDir = path.dirname(config.dbPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    if (fs.existsSync(config.dbPath)) {
        try {
            const buffer = fs.readFileSync(config.dbPath);
            dbInstance = new sqlEngine.Database(buffer);
            loadedFromDisk = true;
            console.log(`[DB] Loaded existing database from: ${config.dbPath}`);
        } catch (err) {
            console.warn(`[DB] Could not load ${config.dbPath}, attempting fallback.`, err.message);
        }
    } else if (fs.existsSync(config.legacyDbPath)) {
        try {
            const buffer = fs.readFileSync(config.legacyDbPath);
            dbInstance = new sqlEngine.Database(buffer);
            loadedFromDisk = true;
            console.log(`[DB] Migrated existing database from legacy path: ${config.legacyDbPath}`);
            saveDb(); // Save to new location
        } catch (err) {
            console.warn(`[DB] Could not read legacy db: ${err.message}`);
        }
    }

    if (!loadedFromDisk) {
        dbInstance = new sqlEngine.Database();
        console.log(`[DB] Initialized fresh SQLite database at: ${config.dbPath}`);
    }

    // Schema Migrations
    dbInstance.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            repo_url    TEXT DEFAULT '',
            docker      TEXT DEFAULT 'Enabled',
            status      TEXT DEFAULT 'Active',
            icon        TEXT DEFAULT '📦',
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
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
            endpoint_url TEXT DEFAULT '',
            ip_address   TEXT DEFAULT '',
            created_at   TEXT DEFAULT (datetime('now')),
            updated_at   TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS deployments (
            id            TEXT PRIMARY KEY,
            dep_number    TEXT NOT NULL UNIQUE,
            project_name  TEXT NOT NULL,
            environment   TEXT DEFAULT 'Development',
            version       TEXT DEFAULT 'v1.0.0',
            status        TEXT DEFAULT 'Pending',
            current_stage TEXT DEFAULT 'QUEUED',
            duration_ms   INTEGER DEFAULT 0,
            triggered_by  TEXT DEFAULT 'OneClick User',
            commit_hash   TEXT DEFAULT '',
            created_at    TEXT DEFAULT (datetime('now')),
            completed_at  TEXT DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS logs (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            deployment_id TEXT DEFAULT NULL,
            message       TEXT NOT NULL,
            level         TEXT DEFAULT 'info',
            source        TEXT DEFAULT 'system',
            created_at    TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key        TEXT PRIMARY KEY,
            value      TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );
    `);

    // Automatic Column Migrations for Backward Compatibility
    function addColumnIfMissing(table, col, def) {
        try {
            dbInstance.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
        } catch (e) {
            // Column already exists, safe to ignore
        }
    }

    addColumnIfMissing('projects', 'updated_at', "TEXT DEFAULT ''");
    addColumnIfMissing('environments', 'endpoint_url', "TEXT DEFAULT ''");
    addColumnIfMissing('environments', 'ip_address', "TEXT DEFAULT ''");
    addColumnIfMissing('environments', 'updated_at', "TEXT DEFAULT ''");
    addColumnIfMissing('deployments', 'current_stage', "TEXT DEFAULT 'QUEUED'");
    addColumnIfMissing('deployments', 'duration_ms', 'INTEGER DEFAULT 0');
    addColumnIfMissing('deployments', 'triggered_by', "TEXT DEFAULT 'OneClick User'");
    addColumnIfMissing('deployments', 'commit_hash', "TEXT DEFAULT ''");
    addColumnIfMissing('deployments', 'completed_at', 'TEXT DEFAULT NULL');
    addColumnIfMissing('logs', 'deployment_id', 'TEXT DEFAULT NULL');
    addColumnIfMissing('logs', 'source', "TEXT DEFAULT 'system'");
    addColumnIfMissing('settings', 'updated_at', "TEXT DEFAULT ''");

    // ---------------------------------------------------------------
    // Migration: Enforce UNIQUE constraint on deployments.dep_number
    //
    // Older DB files were created before the UNIQUE constraint was
    // added. We must:
    //   1. Rename any duplicate dep_numbers (preserving all records)
    //      so we can safely create a unique index.
    //   2. Create a UNIQUE INDEX IF NOT EXISTS on dep_number.
    //   3. Seed a persistent sequence counter in the settings table
    //      so getNextDeploymentNumber() always starts above the
    //      current maximum, surviving server restarts.
    // ---------------------------------------------------------------
    (function migrateDepNumberUniqueness() {
        try {
            // Step 1: Rename conflicting duplicate dep_numbers.
            // For each dep_number that appears more than once, keep
            // the original (lowest rowid) and rename later duplicates
            // to a guaranteed-unique sentinel so data is preserved.
            const dupGroups = queryAll(
                `SELECT dep_number FROM deployments
                 GROUP BY dep_number HAVING COUNT(*) > 1`
            );

            for (const grp of dupGroups) {
                const dupeNum = grp.dep_number;
                // Fetch all rows with this number, ordered oldest first.
                const conflicts = queryAll(
                    `SELECT rowid, id FROM deployments
                     WHERE dep_number = ? ORDER BY rowid ASC`,
                    [dupeNum]
                );
                // Skip the first (keep it), rename the rest.
                for (let i = 1; i < conflicts.length; i++) {
                    const row = conflicts[i];
                    // Build a unique name using the deployment UUID so
                    // it is deterministic and human-readable.
                    const suffix = String(row.id).slice(0, 8);
                    const renamed = `${dupeNum}-DUPE-${suffix}`;
                    dbInstance.run(
                        'UPDATE deployments SET dep_number = ? WHERE rowid = ?',
                        [renamed, row.rowid]
                    );
                    console.log(
                        `[DB] Duplicate dep_number '${dupeNum}' (rowid ${row.rowid}) ` +
                        `renamed to '${renamed}' to preserve record.`
                    );
                }
            }

            // Step 2: Add UNIQUE INDEX (no-op if already present).
            dbInstance.run(
                `CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_dep_number
                 ON deployments (dep_number)`
            );
        } catch (err) {
            console.warn('[DB] dep_number uniqueness migration warning:', err.message);
        }
    })();

    // ---------------------------------------------------------------
    // Seed / repair the persistent sequence counter.
    // Stored in settings as 'dep_number_seq'; always >= the highest
    // numeric DEP-NNN value in the deployments table.
    // ---------------------------------------------------------------
    (function initDepSequenceCounter() {
        try {
            const allNums = queryAll(
                `SELECT dep_number FROM deployments WHERE dep_number LIKE 'DEP-%'`
            );
            let maxSeen = 0;
            for (const row of allNums) {
                const m = String(row.dep_number).match(/^DEP-(\d+)$/);
                if (m) {
                    const n = parseInt(m[1], 10);
                    if (!isNaN(n) && n > maxSeen) maxSeen = n;
                }
            }

            const existing = queryGet(
                `SELECT value FROM settings WHERE key = 'dep_number_seq'`
            );
            if (!existing) {
                dbInstance.run(
                    `INSERT INTO settings (key, value) VALUES ('dep_number_seq', ?)`,
                    [String(maxSeen)]
                );
                console.log(`[DB] Initialised dep_number_seq counter at ${maxSeen}`);
            } else {
                // Repair: ensure the stored counter is not below current max.
                const stored = parseInt(existing.value, 10) || 0;
                if (maxSeen > stored) {
                    dbInstance.run(
                        `UPDATE settings SET value = ? WHERE key = 'dep_number_seq'`,
                        [String(maxSeen)]
                    );
                    console.log(`[DB] Repaired dep_number_seq counter: ${stored} → ${maxSeen}`);
                }
            }
        } catch (err) {
            console.warn('[DB] dep_number_seq init warning:', err.message);
        }
    })();

    saveDb();

    // Seed Demo Data if projects is empty
    const countResult = queryGet('SELECT COUNT(*) as count FROM projects');
    if (!countResult || countResult.count === 0) {
        console.log('[DB] Seeding baseline projects, environments, deployments, and settings...');

        // Projects
        run(`INSERT INTO projects (id, name, description, repo_url, icon) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), 'Web Application', 'React frontend application with Node.js backend.', 'https://github.com/oneclick/web-app', '🌐']);
        run(`INSERT INTO projects (id, name, description, repo_url, icon) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), 'Payment API', 'REST API service for secure checkout and payment processing.', 'https://github.com/oneclick/payment-api', '💳']);
        run(`INSERT INTO projects (id, name, description, repo_url, icon) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), 'Mobile API', 'Backend microservice API for iOS and Android applications.', 'https://github.com/oneclick/mobile-api', '📱']);

        // Environments
        run(`INSERT INTO environments (id, project_id, project_name, environment, cloud, region, instance, docker, endpoint_url, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'web-app', 'Web Application', 'Production', 'AWS', 'India - Hyderabad', 'Medium', 'Enabled', 'https://webapp.oneclick.internal', '10.0.1.14']);
        run(`INSERT INTO environments (id, project_id, project_name, environment, cloud, region, instance, docker, endpoint_url, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'pay-api', 'Payment API', 'Staging', 'AWS', 'India - Mumbai', 'Small', 'Enabled', 'https://pay-staging.oneclick.internal', '10.0.2.82']);

        // Deployments
        run(`INSERT INTO deployments (id, dep_number, project_name, environment, version, status, current_stage, duration_ms, commit_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'DEP-001', 'Web Application', 'Production', 'v1.4.2', 'Success', 'COMPLETE', 2410, 'a7d18b4']);
        run(`INSERT INTO deployments (id, dep_number, project_name, environment, version, status, current_stage, duration_ms, commit_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'DEP-002', 'Payment API', 'Staging', 'v2.1.0', 'Success', 'COMPLETE', 1890, '94e21a0']);
        run(`INSERT INTO deployments (id, dep_number, project_name, environment, version, status, current_stage, duration_ms, commit_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'DEP-003', 'Mobile API', 'Development', 'v1.8.0', 'Success', 'COMPLETE', 3120, 'c5f992e']);

        // Audit Logs
        run(`INSERT INTO logs (message, level, source) VALUES (?, ?, ?)`, ['OneClick DevOps Orchestrator started', 'info', 'system']);
        run(`INSERT INTO logs (message, level, source) VALUES (?, ?, ?)`, ['Checking Jenkins controller connectivity...', 'info', 'ci']);
        run(`INSERT INTO logs (message, level, source) VALUES (?, ?, ?)`, ['Jenkins service responding: HTTP 200', 'success', 'ci']);
        run(`INSERT INTO logs (message, level, source) VALUES (?, ?, ?)`, ['Checking Docker engine status...', 'info', 'docker']);
        run(`INSERT INTO logs (message, level, source) VALUES (?, ?, ?)`, ['Docker container platform verified', 'success', 'docker']);
        run(`INSERT INTO logs (message, level, source) VALUES (?, ?, ?)`, ['System operational and ready for deployment.', 'info', 'system']);

        // Settings
        run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['github', 'Connected']);
        run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['jenkins', 'Connected']);
        run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['docker', 'Running']);
        run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['terraform', 'Ready']);

        console.log('[DB] Seeding completed.');
    }

    return dbInstance;
}

module.exports = {
    initDatabase,
    queryAll,
    queryGet,
    run,
    saveDb,
    uuidv4
};
