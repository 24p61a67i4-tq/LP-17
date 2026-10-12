/* =========================================
   ONECLICK DEVOPS JAVASCRIPT
   Connected to Express Backend API
========================================= */

const API_BASE = '';  // Same origin


/* =========================================
   NAVIGATION
========================================= */

function showSection(sectionId, button) {

    // Hide all sections
    var sections = document.querySelectorAll(".section");

    sections.forEach(function(section) {
        section.classList.remove("active");
    });


    // Show selected section
    var selectedSection = document.getElementById(sectionId);

    if (selectedSection) {
        selectedSection.classList.add("active");
    }


    // Remove active from navigation buttons
    var buttons = document.querySelectorAll(".nav-btn");

    buttons.forEach(function(btn) {
        btn.classList.remove("active");
    });


    // Add active to clicked button
    if (button) {
        button.classList.add("active");
    } else {
        // Find matching nav button
        buttons.forEach(function(btn) {
            if (btn.textContent.toLowerCase().includes(sectionId)) {
                btn.classList.add("active");
            }
        });
    }


    // Update page title
    var titles = {
        dashboard:   "Dashboard",
        projects:    "Projects",
        provision:   "Provision Environment",
        deployments: "Deployments",
        logs:        "Deployment Logs",
        settings:    "Settings"
    };

    document.getElementById("pageTitle").innerText =
        titles[sectionId] || "Dashboard";


    // Refresh data when switching sections
    if (sectionId === 'dashboard')   loadDashboard();
    if (sectionId === 'projects')    loadProjects();
    if (sectionId === 'deployments') loadDeployments();
    if (sectionId === 'logs')        loadLogs();
    if (sectionId === 'settings')    loadSettings();
}


/* =========================================
   DASHBOARD - Load Stats & Recent Data
========================================= */

function loadDashboard() {

    fetch(API_BASE + '/api/dashboard')
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {

            // Update stat cards
            document.getElementById("projectCount").innerText =
                data.stats.projects;

            document.getElementById("environmentCount").innerText =
                data.stats.environments;

            document.getElementById("deploymentCount").innerText =
                data.stats.deployments;

            document.getElementById("successRate").innerText =
                data.stats.successRate;


            // Update recent deployments table
            var tbody = document.getElementById("deploymentTable");
            tbody.innerHTML = '';

            data.recentDeployments.forEach(function(dep) {

                var statusClass = dep.status === 'Success'
                    ? 'success'
                    : (dep.status === 'Running' ? 'running' : 'failed');

                var timeAgo = getTimeAgo(dep.created_at);

                var row = document.createElement("tr");

                row.innerHTML =
                    '<td>' + dep.project_name + '</td>' +
                    '<td>' + dep.environment + '</td>' +
                    '<td><span class="status ' + statusClass + '">' +
                        dep.status +
                    '</span></td>' +
                    '<td>' + timeAgo + '</td>';

                tbody.appendChild(row);
            });


            // Update system status
            var statusContainer =
                document.getElementById("systemStatus");

            if (statusContainer) {

                statusContainer.innerHTML = '';

                data.systemStatus.forEach(function(s) {

                    var div = document.createElement("div");

                    div.innerHTML =
                        '<span>' + capitalise(s.key) + '</span>' +
                        '<strong class="online">● ' + s.value + '</strong>';

                    statusContainer.appendChild(div);
                });
            }
        })
        .catch(function(err) {
            console.error('Failed to load dashboard:', err);
        });
}


/* =========================================
   PROJECTS - Load & Create
========================================= */

function loadProjects() {

    fetch(API_BASE + '/api/projects')
        .then(function(response) {
            return response.json();
        })
        .then(function(projects) {

            var grid = document.getElementById("projectGrid");
            grid.innerHTML = '';

            projects.forEach(function(project) {

                var card = document.createElement("div");
                card.className = "project-card";

                card.innerHTML =
                    '<div class="project-top">' +
                        '<div class="project-icon">' + project.icon + '</div>' +
                        '<span class="status success">' + project.status + '</span>' +
                    '</div>' +
                    '<h3>' + project.name + '</h3>' +
                    '<p>' + project.description + '</p>' +
                    '<div class="project-info">' +
                        '<span>🔗 GitHub</span>' +
                        '<span>🐳 Docker</span>' +
                    '</div>' +
                    '<div class="project-actions">' +
                        '<button class="secondary-btn" ' +
                            'onclick="deployProject(\'' + escapeQuotes(project.name) + '\')">' +
                            '🚀 Deploy' +
                        '</button>' +
                        '<button class="delete-btn" ' +
                            'onclick="deleteProject(\'' + project.id + '\', \'' + escapeQuotes(project.name) + '\')">' +
                            '🗑️' +
                        '</button>' +
                    '</div>';

                grid.appendChild(card);
            });

            // Also update the provision form dropdown
            updateProjectDropdown(projects);
        })
        .catch(function(err) {
            console.error('Failed to load projects:', err);
        });
}


function addProject() {

    var name = prompt("Enter project name:");

    if (!name || name.trim() === '') {
        return;
    }

    fetch(API_BASE + '/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(project) {
        loadProjects();
        loadDashboard();
    })
    .catch(function(err) {
        console.error('Failed to add project:', err);
        alert('Failed to add project.');
    });
}


function deleteProject(id, name) {

    if (!confirm('Delete project "' + name + '"?')) {
        return;
    }

    fetch(API_BASE + '/api/projects/' + id, {
        method: 'DELETE'
    })
    .then(function(response) {
        return response.json();
    })
    .then(function() {
        loadProjects();
        loadDashboard();
    })
    .catch(function(err) {
        console.error('Failed to delete project:', err);
    });
}


function updateProjectDropdown(projects) {

    var select = document.getElementById("projectName");

    if (!select) return;

    select.innerHTML = '';

    projects.forEach(function(project) {

        var option = document.createElement("option");
        option.value = project.name;
        option.textContent = project.name;

        select.appendChild(option);
    });
}


/* =========================================
   PROVISION ENVIRONMENT
========================================= */

document.getElementById("provisionForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();

        var projectName = document.getElementById("projectName").value;
        var environment = document.getElementById("environment").value;
        var cloud       = document.getElementById("cloud").value;
        var region      = document.getElementById("region").value;
        var instance    = document.getElementById("instance").value;
        var docker      = document.getElementById("docker").value;
        var description = document.getElementById("envDescription").value;


        var statusDiv = document.getElementById("provisionStatus");
        var title     = document.getElementById("provisionTitle");
        var message   = document.getElementById("provisionMessage");


        // Show loading status
        statusDiv.classList.remove("hidden");
        statusDiv.classList.remove("provision-success");

        title.innerText   = "Provisioning Environment...";
        message.innerText = "Creating " + environment + " environment on " + cloud + "...";


        // Send to backend API
        fetch(API_BASE + '/api/environments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_name: projectName,
                environment:  environment,
                cloud:        cloud,
                region:       region,
                instance:     instance,
                docker:       docker,
                description:  description
            })
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(env) {

            // Simulate slight delay for UX
            setTimeout(function() {

                title.innerText =
                    "Environment Created Successfully ✓";

                message.innerText =
                    projectName + " - " + environment +
                    " environment is now running on " + cloud + ".";

                statusDiv.classList.add("provision-success");

                // Refresh dashboard stats
                loadDashboard();

            }, 1500);
        })
        .catch(function(err) {

            title.innerText   = "Provisioning Failed ✗";
            message.innerText = "Error: " + err.message;

            console.error('Provision error:', err);
        });
    });


/* =========================================
   DEPLOYMENTS - Load & Create
========================================= */

function loadDeployments() {

    fetch(API_BASE + '/api/deployments')
        .then(function(response) {
            return response.json();
        })
        .then(function(deployments) {

            var tbody = document.getElementById("allDeployments");
            tbody.innerHTML = '';

            deployments.forEach(function(dep) {

                var statusClass = dep.status === 'Success'
                    ? 'success'
                    : (dep.status === 'Running' ? 'running' : 'failed');

                var row = document.createElement("tr");

                row.innerHTML =
                    '<td>#' + dep.dep_number + '</td>' +
                    '<td>' + dep.project_name + '</td>' +
                    '<td>' + dep.environment + '</td>' +
                    '<td>' + dep.version + '</td>' +
                    '<td><span class="status ' + statusClass + '">' +
                        dep.status +
                    '</span></td>' +
                    '<td>' +
                        '<button class="small-btn" onclick="viewLogs()">Logs</button>' +
                    '</td>';

                tbody.appendChild(row);
            });
        })
        .catch(function(err) {
            console.error('Failed to load deployments:', err);
        });
}


function deployProject(projectName) {

    fetch(API_BASE + '/api/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            project_name: projectName,
            environment: 'Development',
            version: 'v1.0.0'
        })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(deployment) {

        // Show notification
        showNotification('Deployment started for ' + projectName);

        // Refresh deployment list
        loadDeployments();
        loadDashboard();


        // Simulate deployment completing after 3 seconds
        setTimeout(function() {

            fetch(API_BASE + '/api/deployments/' + deployment.id + '/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Success' })
            })
            .then(function() {

                showNotification(projectName + ' deployed successfully!');

                loadDeployments();
                loadDashboard();
            });

        }, 3000);
    })
    .catch(function(err) {
        console.error('Failed to deploy:', err);
        alert('Failed to deploy ' + projectName);
    });
}


/* =========================================
   LOGS - Load, Add & Clear
========================================= */

function loadLogs() {

    fetch(API_BASE + '/api/logs')
        .then(function(response) {
            return response.json();
        })
        .then(function(logs) {

            var terminalBody =
                document.querySelector(".terminal-body");

            terminalBody.innerHTML = '';

            logs.forEach(function(log) {

                var p = document.createElement("p");

                if (log.level === 'success') {
                    p.className = 'success-text';
                    p.textContent = '✓ ' + log.message;
                } else {
                    p.innerHTML =
                        '<span class="green-text">$</span> ' +
                        formatLogTime(log.created_at) + ' - ' +
                        log.message;
                }

                terminalBody.appendChild(p);
            });

            // Scroll to bottom
            terminalBody.scrollTop = terminalBody.scrollHeight;
        })
        .catch(function(err) {
            console.error('Failed to load logs:', err);
        });
}


function clearLogs() {

    fetch(API_BASE + '/api/logs', {
        method: 'DELETE'
    })
    .then(function() {
        loadLogs();
    })
    .catch(function(err) {
        console.error('Failed to clear logs:', err);
    });
}


/* =========================================
   SETTINGS - Load & Update
========================================= */

function loadSettings() {

    fetch(API_BASE + '/api/settings')
        .then(function(response) {
            return response.json();
        })
        .then(function(settings) {

            var container =
                document.getElementById("settingsContainer");

            if (!container) return;

            container.innerHTML = '';

            var settingsConfig = {
                github:    { title: 'GitHub Integration',  desc: 'Connect your GitHub repositories.' },
                jenkins:   { title: 'Jenkins',             desc: 'Continuous Integration server.' },
                docker:    { title: 'Docker',              desc: 'Container platform.' },
                terraform: { title: 'Terraform',           desc: 'Infrastructure provisioning tool.' }
            };

            Object.keys(settings).forEach(function(key) {

                var config = settingsConfig[key] || {
                    title: capitalise(key),
                    desc: ''
                };

                var div = document.createElement("div");
                div.className = "setting";

                div.innerHTML =
                    '<div>' +
                        '<h3>' + config.title + '</h3>' +
                        '<p>' + config.desc + '</p>' +
                    '</div>' +
                    '<span class="status success">' +
                        settings[key] +
                    '</span>';

                container.appendChild(div);
            });
        })
        .catch(function(err) {
            console.error('Failed to load settings:', err);
        });
}


/* =========================================
   NOTIFICATIONS
========================================= */

function showNotification(message) {

    // Remove existing notification if any
    var existing = document.querySelector('.notification');
    if (existing) existing.remove();

    var notif = document.createElement("div");
    notif.className = "notification";
    notif.textContent = message;

    document.body.appendChild(notif);

    // Trigger animation
    setTimeout(function() {
        notif.classList.add("show");
    }, 10);

    // Auto-hide after 3 seconds
    setTimeout(function() {
        notif.classList.remove("show");

        setTimeout(function() {
            notif.remove();
        }, 300);
    }, 3000);
}


/* =========================================
   HELPER FUNCTIONS
========================================= */

function viewLogs() {
    showSection("logs");
}


function getTimeAgo(dateStr) {

    var now  = new Date();
    var date = new Date(dateStr + 'Z'); // SQLite stores UTC
    var diff = Math.floor((now - date) / 1000);

    if (diff < 60)   return diff + ' sec ago';
    if (diff < 3600)  return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hour ago';

    return Math.floor(diff / 86400) + ' days ago';
}


function formatLogTime(dateStr) {

    var date = new Date(dateStr + 'Z');

    return date.toLocaleTimeString();
}


function capitalise(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}


function escapeQuotes(str) {
    return str.replace(/'/g, "\\'");
}


/* =========================================
   PAGE LOAD - Initialise from Backend
========================================= */

document.addEventListener("DOMContentLoaded", function() {

    // Load dashboard data from API
    loadDashboard();

    // Pre-load projects for provision dropdown
    fetch(API_BASE + '/api/projects')
        .then(function(response) {
            return response.json();
        })
        .then(function(projects) {
            updateProjectDropdown(projects);
        })
        .catch(function(err) {
            console.error('Failed to load initial projects:', err);
        });
});
