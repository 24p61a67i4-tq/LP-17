/* =============================================
   ONECLICK DEVOPS - CLIENT JAVASCRIPT
   Production REST Client & UI Controller
============================================= */

const API_BASE = ''; // Same-origin REST API

let deploymentPollingTimer = null;
let logFilterDebounce = null;

/* =============================================
   NAVIGATION & TAB ROUTING
============================================= */

function showSection(sectionId, button) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(sec => sec.classList.remove('active'));

    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.classList.add('active');
    }

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.classList.remove('active'));

    if (button) {
        button.classList.add('active');
    } else {
        navButtons.forEach(btn => {
            if (btn.textContent.toLowerCase().includes(sectionId)) {
                btn.classList.add('active');
            }
        });
    }

    const titles = {
        dashboard: 'Dashboard',
        projects: 'Projects',
        provision: 'Provision Environment',
        deployments: 'Deployments',
        logs: 'Deployment Logs',
        settings: 'Settings'
    };
    const titleElem = document.getElementById('pageTitle');
    if (titleElem) {
        titleElem.innerText = titles[sectionId] || 'Dashboard';
    }

    // Refresh data for the active section
    if (sectionId === 'dashboard')   loadDashboard();
    if (sectionId === 'projects')    loadProjects();
    if (sectionId === 'provision')   { loadProjects(); loadEnvironments(); }
    if (sectionId === 'deployments') loadDeployments();
    if (sectionId === 'logs')        loadLogs();
    if (sectionId === 'settings')    loadSettings();
}

/* =============================================
   DASHBOARD
============================================= */

async function loadDashboard() {
    try {
        const res = await fetch(`${API_BASE}/api/dashboard`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();

        // Stats Cards
        safeSetText('projectCount', data.stats.projects);
        safeSetText('environmentCount', data.stats.environments);
        safeSetText('deploymentCount', data.stats.deployments);
        safeSetText('successRate', data.stats.successRate);

        // Recent Deployments Table
        const tbody = document.getElementById('deploymentTable');
        if (tbody) {
            tbody.innerHTML = '';
            if (!data.recentDeployments || data.recentDeployments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No deployments recorded yet.</td></tr>';
            } else {
                data.recentDeployments.forEach(dep => {
                    const statusClass = getStatusClass(dep.status);
                    const timeAgo = getTimeAgo(dep.created_at);
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><strong>${escapeHtml(dep.project_name)}</strong></td>
                        <td>${escapeHtml(dep.environment)}</td>
                        <td><span class="status ${statusClass}">${escapeHtml(dep.status)}</span></td>
                        <td>${timeAgo}</td>
                    `;
                    tbody.appendChild(row);
                });
            }
        }

        // System Status Indicators
        const statusContainer = document.getElementById('systemStatus');
        if (statusContainer && data.systemStatus) {
            statusContainer.innerHTML = '';
            data.systemStatus.forEach(s => {
                const div = document.createElement('div');
                div.innerHTML = `
                    <span>${capitalise(s.key)}</span>
                    <strong class="online">● ${escapeHtml(s.value)}</strong>
                `;
                statusContainer.appendChild(div);
            });
        }
    } catch (err) {
        console.error('[CLIENT] Failed to load dashboard:', err.message);
    }
}

/* =============================================
   PROJECTS
============================================= */

async function loadProjects() {
    try {
        const res = await fetch(`${API_BASE}/api/projects`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const projects = await res.json();

        const grid = document.getElementById('projectGrid');
        if (grid) {
            grid.innerHTML = '';
            if (projects.length === 0) {
                grid.innerHTML = '<p style="color:#94a3b8; grid-column: 1 / -1;">No projects registered yet. Click "+ Add Project" to create one.</p>';
            } else {
                projects.forEach(p => {
                    const card = document.createElement('div');
                    card.className = 'project-card';
                    card.innerHTML = `
                        <div class="project-top">
                            <div class="project-icon">${p.icon || '📦'}</div>
                            <span class="status success">${escapeHtml(p.status || 'Active')}</span>
                        </div>
                        <h3>${escapeHtml(p.name)}</h3>
                        <p>${escapeHtml(p.description || '')}</p>
                        <div class="project-info">
                            <span>🔗 ${p.repo_url ? 'GitHub Linked' : 'Local'}</span>
                            <span>🐳 Docker: ${escapeHtml(p.docker || 'Enabled')}</span>
                        </div>
                        <div class="project-actions">
                            <button class="secondary-btn" onclick="openDeployModal('${escapeJsString(p.name)}')">
                                🚀 Deploy
                            </button>
                            <button class="delete-btn" title="Delete Project" onclick="deleteProject('${p.id}', '${escapeJsString(p.name)}')">
                                🗑️
                            </button>
                        </div>
                    `;
                    grid.appendChild(card);
                });
            }
        }

        // Keep all project select dropdowns synchronized
        populateProjectDropdowns(projects);
    } catch (err) {
        console.error('[CLIENT] Failed to load projects:', err.message);
        showNotification('Failed to load projects from server.', 'error');
    }
}

function populateProjectDropdowns(projects) {
    const dropdownIds = ['projectName', 'deployModalProject'];
    dropdownIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '';
        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = p.name;
            select.appendChild(opt);
        });
        if (currentVal) select.value = currentVal;
    });
}

function openProjectModal() {
    const modal = document.getElementById('projectModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('modalProjectName').focus();
    }
}

function closeProjectModal() {
    const modal = document.getElementById('projectModal');
    if (modal) modal.classList.add('hidden');
    const form = document.getElementById('projectModalForm');
    if (form) form.reset();
}

// Project Modal Form Submit
document.addEventListener('DOMContentLoaded', () => {
    const projectForm = document.getElementById('projectModalForm');
    if (projectForm) {
        projectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('modalProjectName').value.trim();
            const description = document.getElementById('modalProjectDesc').value.trim();
            const repo_url = document.getElementById('modalProjectRepo').value.trim();
            const icon = document.getElementById('modalProjectIcon').value;

            try {
                const res = await fetch(`${API_BASE}/api/projects`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description, repo_url, icon })
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error ? data.error.message : 'Failed to create project');
                }

                showNotification(`Project '${name}' created successfully!`);
                closeProjectModal();
                loadProjects();
                loadDashboard();
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    }
});

async function deleteProject(id, name) {
    if (!confirm(`Are you sure you want to delete project '${name}'? This cannot be undone.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error ? data.error.message : 'Failed to delete project');
        }

        showNotification(`Project '${name}' deleted.`);
        loadProjects();
        loadDashboard();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

/* =============================================
   PROVISION ENVIRONMENT
============================================= */

// Provision Form Submit Handler
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('provisionForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const projectName = document.getElementById('projectName').value;
            const environment = document.getElementById('environment').value;
            const cloud       = document.getElementById('cloud').value;
            const region      = document.getElementById('region') ? document.getElementById('region').value : 'India - Hyderabad';
            const instance    = document.getElementById('instance') ? document.getElementById('instance').value : 'Small';
            const docker      = document.getElementById('docker') ? document.getElementById('docker').value : 'Enabled';
            const description = document.getElementById('envDescription') ? document.getElementById('envDescription').value.trim() : '';

            const statusDiv = document.getElementById('provisionStatus');
            const title     = document.getElementById('provisionTitle');
            const message   = document.getElementById('provisionMessage');

            if (statusDiv) {
                statusDiv.classList.remove('hidden', 'provision-success');
                if (title) title.innerText = 'Provisioning Environment...';
                if (message) message.innerText = `Allocating ${environment} environment on ${cloud} (${region})...`;
            }

            try {
                const res = await fetch(`${API_BASE}/api/environments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_name: projectName,
                        environment,
                        cloud,
                        region,
                        instance,
                        docker,
                        description
                    })
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error ? data.error.message : 'Provisioning failed');
                }

                if (title) title.innerText = 'Environment Created Successfully ✓';
                if (message) message.innerText = `${projectName} (${environment}) is active on ${cloud}. Endpoint: ${data.endpoint_url || 'Assigned'}`;
                if (statusDiv) statusDiv.classList.add('provision-success');

                showNotification(`${projectName} (${environment}) provisioned!`);
                loadEnvironments();
                loadDashboard();
            } catch (err) {
                if (title) title.innerText = 'Provisioning Failed ✗';
                if (message) message.innerText = err.message;
                showNotification(err.message, 'error');
            }
        });
    }
});

async function loadEnvironments() {
    try {
        const res = await fetch(`${API_BASE}/api/environments`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const environments = await res.json();

        const tbody = document.getElementById('environmentsTable');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (environments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">No active environments found.</td></tr>';
            return;
        }

        environments.forEach(env => {
            const statusClass = env.status === 'Running' ? 'success' : 'running';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${escapeHtml(env.environment)}</strong></td>
                <td>${escapeHtml(env.project_name)}</td>
                <td>${escapeHtml(env.cloud)} / ${escapeHtml(env.region)}</td>
                <td>${escapeHtml(env.instance)}</td>
                <td><code style="color:#38bdf8; font-size:12px;">${escapeHtml(env.endpoint_url || '10.0.x.x')}</code></td>
                <td><span class="status ${statusClass}">${escapeHtml(env.status)}</span></td>
                <td>
                    <button class="delete-btn" onclick="terminateEnvironment('${env.id}', '${escapeJsString(env.environment)}', '${escapeJsString(env.project_name)}')">
                        Terminate
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error('[CLIENT] Failed to load environments:', err.message);
    }
}

async function terminateEnvironment(id, envName, projName) {
    if (!confirm(`Are you sure you want to terminate ${envName} environment for ${projName}?`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/environments/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ? data.error.message : 'Termination failed');

        showNotification(`${envName} environment for ${projName} terminated.`);
        loadEnvironments();
        loadDashboard();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

/* =============================================
   DEPLOYMENTS
============================================= */

function openDeployModal(preselectedProject = '') {
    const modal = document.getElementById('deployModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    const select = document.getElementById('deployModalProject');
    if (select && preselectedProject) {
        select.value = preselectedProject;
    }
}

function closeDeployModal() {
    const modal = document.getElementById('deployModal');
    if (modal) modal.classList.add('hidden');
}

// Deploy Modal Form Submit
document.addEventListener('DOMContentLoaded', () => {
    const deployForm = document.getElementById('deployModalForm');
    if (deployForm) {
        deployForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const projectName = document.getElementById('deployModalProject').value;
            const environment = document.getElementById('deployModalEnv').value;
            const version     = document.getElementById('deployModalVersion').value.trim() || 'v1.0.0';

            closeDeployModal();
            triggerDeployment(projectName, environment, version);
        });
    }
});

async function triggerDeployment(projectName, environment = 'Development', version = 'v1.0.0') {
    try {
        showNotification(`Starting deployment for ${projectName} (${environment})...`);

        const res = await fetch(`${API_BASE}/api/deployments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_name: projectName,
                environment,
                version
            })
        });

        const deployment = await res.json();
        if (!res.ok) {
            throw new Error(deployment.error ? deployment.error.message : 'Failed to launch deployment');
        }

        showNotification(`Deployment #${deployment.dep_number} initiated!`);
        loadDeployments();
        loadDashboard();

        // Start live polling to follow server-side pipeline progress
        startPollingDeployments();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

async function loadDeployments() {
    try {
        const res = await fetch(`${API_BASE}/api/deployments`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const deployments = await res.json();

        const tbody = document.getElementById('allDeployments');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (deployments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No deployments recorded yet.</td></tr>';
            return;
        }

        let hasActiveDeployments = false;

        deployments.forEach(dep => {
            if (dep.status === 'Building' || dep.status === 'Deploying' || dep.status === 'Running') {
                hasActiveDeployments = true;
            }

            const statusClass = getStatusClass(dep.status);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>#${escapeHtml(dep.dep_number)}</strong></td>
                <td>${escapeHtml(dep.project_name)}</td>
                <td>${escapeHtml(dep.environment)}</td>
                <td><code>${escapeHtml(dep.version)}</code></td>
                <td>
                    <span class="status ${statusClass}">
                        ${escapeHtml(dep.status)} ${dep.current_stage && dep.status !== 'Success' && dep.status !== 'Failed' ? `(${escapeHtml(dep.current_stage)})` : ''}
                    </span>
                </td>
                <td>
                    <button class="small-btn" onclick="viewLogs()">Logs</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Continue polling if deployments are actively running
        if (hasActiveDeployments) {
            startPollingDeployments();
        } else if (deploymentPollingTimer) {
            clearInterval(deploymentPollingTimer);
            deploymentPollingTimer = null;
        }
    } catch (err) {
        console.error('[CLIENT] Failed to load deployments:', err.message);
    }
}

function startPollingDeployments() {
    if (deploymentPollingTimer) return;
    deploymentPollingTimer = setInterval(() => {
        loadDeployments();
        loadDashboard();
    }, 1500);
}

/* =============================================
   LOGS
============================================= */

async function loadLogs(searchQuery = '') {
    try {
        let url = `${API_BASE}/api/logs?limit=80`;
        if (searchQuery && searchQuery.trim() !== '') {
            url += `&search=${encodeURIComponent(searchQuery.trim())}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const logs = await res.json();

        const terminalBody = document.querySelector('.terminal-body');
        if (!terminalBody) return;

        terminalBody.innerHTML = '';
        if (logs.length === 0) {
            terminalBody.innerHTML = '<p style="color:#64748b;">No logs recorded yet.</p>';
            return;
        }

        logs.forEach(log => {
            const p = document.createElement('p');
            const timeStr = formatLogTime(log.created_at);

            if (log.level === 'success') {
                p.className = 'success-text';
                p.textContent = `✓ [${timeStr}] ${log.message}`;
            } else if (log.level === 'error') {
                p.style.color = '#ef4444';
                p.textContent = `✗ [${timeStr}] ${log.message}`;
            } else {
                p.innerHTML = `<span class="green-text">$</span> [${timeStr}] ${escapeHtml(log.message)}`;
            }

            terminalBody.appendChild(p);
        });

        terminalBody.scrollTop = terminalBody.scrollHeight;
    } catch (err) {
        console.error('[CLIENT] Failed to load logs:', err.message);
    }
}

function filterLogs() {
    clearTimeout(logFilterDebounce);
    logFilterDebounce = setTimeout(() => {
        const input = document.getElementById('logSearchInput');
        loadLogs(input ? input.value : '');
    }, 300);
}

async function clearLogs() {
    try {
        const res = await fetch(`${API_BASE}/api/logs`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        loadLogs();
        showNotification('Console logs cleared.');
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

/* =============================================
   SETTINGS
============================================= */

async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const settings = await res.json();

        const container = document.getElementById('settingsContainer');
        if (!container) return;

        container.innerHTML = '';

        const settingsConfig = {
            github:    { title: 'GitHub Integration',  desc: 'Connected to source code repositories and webhooks.' },
            jenkins:   { title: 'Jenkins CI/CD',       desc: 'Continuous Integration & build pipeline controller.' },
            docker:    { title: 'Docker Platform',     desc: 'Local container runtime and image registry daemon.' },
            terraform: { title: 'Terraform Engine',    desc: 'Infrastructure-as-Code state and cloud provider manager.' }
        };

        Object.keys(settings).forEach(key => {
            const config = settingsConfig[key] || {
                title: capitalise(key),
                desc: 'Integrated system configuration.'
            };

            const div = document.createElement('div');
            div.className = 'setting';
            div.innerHTML = `
                <div>
                    <h3>${escapeHtml(config.title)}</h3>
                    <p>${escapeHtml(config.desc)}</p>
                </div>
                <span class="status success">${escapeHtml(settings[key])}</span>
            `;
            container.appendChild(div);
        });
    } catch (err) {
        console.error('[CLIENT] Failed to load settings:', err.message);
    }
}

/* =============================================
   NOTIFICATION TOASTS
============================================= */

function showNotification(message, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notif = document.createElement('div');
    notif.className = 'notification';
    if (type === 'error') {
        notif.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
        notif.style.boxShadow = '0 8px 30px rgba(239, 68, 68, 0.4)';
    }
    notif.textContent = message;

    document.body.appendChild(notif);

    setTimeout(() => notif.classList.add('show'), 10);
    setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => notif.remove(), 300);
    }, 3200);
}

/* =============================================
   HELPERS & UTILITIES
============================================= */

function viewLogs() {
    showSection('logs');
}

function safeSetText(elemId, text) {
    const elem = document.getElementById(elemId);
    if (elem) elem.innerText = text;
}

function getStatusClass(status) {
    if (status === 'Success' || status === 'Active' || status === 'Running') return 'success';
    if (status === 'Building' || status === 'Deploying' || status === 'Pending') return 'running';
    return 'failed';
}

function getTimeAgo(dateStr) {
    if (!dateStr) return 'Just now';
    const now = new Date();
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60)   return `${diff <= 0 ? 1 : diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function formatLogTime(dateStr) {
    if (!dateStr) return new Date().toLocaleTimeString();
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return isNaN(date.getTime()) ? new Date().toLocaleTimeString() : date.toLocaleTimeString();
}

function capitalise(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeJsString(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

/* =============================================
   BOOTSTRAP
============================================= */

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadProjects();
});
