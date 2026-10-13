/**
 * Reproduce the exact HTTP 500 scenario:
 * DB has UNIQUE constraint, server restarts (lastAssignedNumber resets to 0),
 * and a deployment is created for a number that was previously soft-deleted or gaps exist.
 * 
 * Also tests the scenario described in the bug: running multiple sequential requests
 * where the DB write happens AFTER getNextDeploymentNumber but the write fails 
 * due to something the check missed.
 */
const initSqlJs = require('sql.js');

async function main() {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Create table WITH UNIQUE constraint (current schema)
    db.run(`CREATE TABLE deployments (
        id            TEXT PRIMARY KEY,
        dep_number    TEXT NOT NULL UNIQUE,
        project_name  TEXT NOT NULL,
        status        TEXT DEFAULT 'Pending'
    )`);

    // Seed DEP-001, 002, 003
    db.run("INSERT INTO deployments (id, dep_number, project_name) VALUES ('id1', 'DEP-001', 'Web App')");
    db.run("INSERT INTO deployments (id, dep_number, project_name) VALUES ('id2', 'DEP-002', 'Payment API')");
    db.run("INSERT INTO deployments (id, dep_number, project_name) VALUES ('id3', 'DEP-003', 'Mobile API')");

    // Simulate: server restarts, lastAssignedNumber = 0 (module-level reset)
    let lastAssignedNumber = 0;

    function queryAll(sql) {
        const stmt = db.prepare(sql);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
    }

    function queryGet(sql, params) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        let result = null;
        if (stmt.step()) result = stmt.getAsObject();
        stmt.free();
        return result;
    }

    // Current (broken) getNextDeploymentNumber
    function getNextDeploymentNumber_BROKEN() {
        const allDeps = queryAll('SELECT dep_number FROM deployments');
        let maxNum = 0;
        const existingNumbers = new Set();

        for (const row of allDeps) {
            if (row && row.dep_number) {
                const raw = String(row.dep_number).trim().toUpperCase();
                existingNumbers.add(raw);
                const match = raw.match(/DEP-(\d+)/i);
                if (match) {
                    const parsed = parseInt(match[1], 10);
                    if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
                }
            }
        }

        let candidate = Math.max(maxNum, lastAssignedNumber) + 1;
        let candidateStr = 'DEP-' + String(candidate).padStart(3, '0');

        while (existingNumbers.has(candidateStr) || queryGet('SELECT 1 FROM deployments WHERE dep_number = ?', [candidateStr])) {
            candidate++;
            candidateStr = 'DEP-' + String(candidate).padStart(3, '0');
        }

        lastAssignedNumber = candidate;
        return candidateStr;
    }

    // Simulate CONCURRENT requests (two calls happening before EITHER is inserted)
    // This happens when two async triggerDeployment calls both call getNextDeploymentNumber
    // before either completes the db.run INSERT
    console.log('=== Simulating concurrent deployment requests ===');
    
    // Call 1 gets DEP-004 (before any insert)
    const concurrentN1 = getNextDeploymentNumber_BROKEN();
    // Call 2 gets called BEFORE call 1 inserts (simulating the issue with the lastAssignedNumber)
    const concurrentN2 = getNextDeploymentNumber_BROKEN();

    console.log(`Concurrent call 1 got: ${concurrentN1}`);
    console.log(`Concurrent call 2 got: ${concurrentN2}`);
    console.log(`Duplicate: ${concurrentN1 === concurrentN2}`);

    // Now insert both
    try {
        db.run(`INSERT INTO deployments (id, dep_number, project_name) VALUES ('new-id1', '${concurrentN1}', 'Project A')`);
        console.log(`Inserted ${concurrentN1} OK`);
    } catch(e) {
        console.log(`FAILED inserting ${concurrentN1}: ${e.message}`);
    }

    try {
        db.run(`INSERT INTO deployments (id, dep_number, project_name) VALUES ('new-id2', '${concurrentN2}', 'Project B')`);
        console.log(`Inserted ${concurrentN2} OK`);
    } catch(e) {
        console.log(`FAILED inserting ${concurrentN2}: ${e.message}`);
    }

    // Reset and test what happens AFTER a previous server run accumulated numbers
    // Scenario: previous run created up to DEP-010, server restarts, lastAssignedNumber = 0
    // DB has DEP-001 through DEP-010
    const db2 = new SQL.Database();
    db2.run(`CREATE TABLE deployments (
        id TEXT PRIMARY KEY,
        dep_number TEXT NOT NULL UNIQUE,
        project_name TEXT NOT NULL
    )`);
    for (let i = 1; i <= 10; i++) {
        const num = 'DEP-' + String(i).padStart(3, '0');
        db2.run(`INSERT INTO deployments (id, dep_number, project_name) VALUES ('id${i}', '${num}', 'Project')`);
    }

    console.log('\n=== Simulating server restart with 10 existing deployments ===');
    let lastAssignedNumber2 = 0; // reset after restart

    function getNextFromDb2() {
        const stmt = db2.prepare('SELECT dep_number FROM deployments');
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();

        let maxNum = 0;
        const existingNumbers = new Set();
        for (const row of rows) {
            if (row && row.dep_number) {
                const raw = String(row.dep_number).trim().toUpperCase();
                existingNumbers.add(raw);
                const match = raw.match(/DEP-(\d+)/i);
                if (match) {
                    const parsed = parseInt(match[1], 10);
                    if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
                }
            }
        }

        let candidate = Math.max(maxNum, lastAssignedNumber2) + 1;
        let candidateStr = 'DEP-' + String(candidate).padStart(3, '0');
        while (existingNumbers.has(candidateStr)) {
            candidate++;
            candidateStr = 'DEP-' + String(candidate).padStart(3, '0');
        }
        lastAssignedNumber2 = candidate;
        return candidateStr;
    }

    const r1 = getNextFromDb2();
    const r2 = getNextFromDb2(); // Should be unique because lastAssignedNumber2 tracks
    console.log(`After restart: ${r1} and ${r2} - unique: ${r1 !== r2}`);

    db.close();
    db2.close();
}

main().catch(console.error);
