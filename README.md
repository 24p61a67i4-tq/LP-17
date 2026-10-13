# OneClick DevOps – Environment Provisioning & Deployment System

An automated, centralized DevOps orchestration dashboard for provisioning cloud environments, tracking application projects, and executing safe continuous deployment pipelines.

---

## 1. Project Title
**OneClick DevOps** (LP-17) – Environment Provisioning & Deployment System.

---

## 2. Problem Statement
Modern application development requires managing multiple environments (Development, Testing, Staging, Production) across different cloud infrastructures. Engineers and project teams often face:
* Fragmented toolsets requiring separate access to cloud consoles, CI/CD tools, container engines, and terminal logs.
* High risk of configuration errors and accidental credential exposure when deploying applications manually.
* Lack of unified visibility into project statuses, active environments, deployment history, and pipeline health.
* Complex setup overhead for internal developer platforms.

---

## 3. Project Objective
To provide a lightweight, single-pane-of-glass web dashboard that enables:
* Seamless registration and management of software application projects.
* Declarative provisioning and automated teardown of cloud environments.
* Safe, automated triggering of end-to-end continuous deployment workflows.
* Real-time visibility into pipeline stages, deployment logs, and system integration health.
* Production-ready containerization and CI/CD pipelines via Docker and Jenkins.

---

## 4. Features
* **Interactive Dashboard**: Real-time aggregate statistics (total projects, environments, deployments, and overall deployment success rate) with recent deployment tracking.
* **Project Lifecycle Management**: Create, view, search, and delete application projects with associated Git repositories, container configurations, and metadata.
* **Environment Provisioning**: Declarative configuration of environments across Cloud Providers (AWS, Azure, Google Cloud), Regions, and Compute Sizing, complete with automated network allocation (internal DNS endpoint and private IP generation).
* **Environment Teardown**: One-click termination and de-provisioning of active environments.
* **Predefined CI/CD Deployment Workflows**: End-to-end asynchronous deployment lifecycle with non-blocking server execution across 6 automated stages:
  1. `SOURCE_CHECKOUT`
  2. `DEPENDENCY_CHECK`
  3. `UNIT_TEST`
  4. `CONTAINER_BUILD`
  5. `ENVIRONMENT_DEPLOY`
  6. `HEALTH_CHECK`
* **Console Logs Terminal**: Colorized audit logging with live search filtering, auto-scroll, and log-clearing capability.
* **Live Status Polling**: Automatic polling of ongoing deployments without requiring page reloads or relying on fragile client timers.
* **System Integration Status**: Real-time connectivity and status indicators for GitHub, Jenkins, Docker, and Terraform.

---

## 5. Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Client Tier (Browser SPA)                       │
│                     index.html | style.css | script.js                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST API (JSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Application Server Tier                         │
│                    Node.js + Express 4 (server.js)                     │
│                                                                        │
│   ┌────────────────────┬────────────────────┬────────────────────┐    │
│   │ Security Headers   │  Rate Limiting     │  Input Validator   │    │
│   └────────────────────┴────────────────────┴────────────────────┘    │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │                 Modular Route Controllers                    │    │
│   │  /health | /dashboard | /projects | /environments | ...     │    │
│   └──────────────────────────────┬───────────────────────────────┘    │
│                                  │                                     │
│   ┌──────────────────────────────┴───────────────────────────────┐    │
│   │                  DevOps Service Orchestrators                │    │
│   │   deploymentService.js       │    provisioningService.js     │    │
│   └──────────────────────────────┬───────────────────────────────┘    │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Database Storage Tier                         │
│               sql.js (WebAssembly SQLite) + File Persistence          │
│                       data/oneclick.sqlite                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Technology Stack
* **Frontend**: HTML5, Vanilla CSS3 (Custom Dark Theme, Flexbox/Grid, Responsive Design), Vanilla JavaScript (ES6+, Fetch API).
* **Backend Runtime**: Node.js (v18+).
* **Web Framework**: Express.js (v4.18.2).
* **Database**: `sql.js` (SQLite compiled to WebAssembly with synchronous file persistence).
* **Security & Utility**: Native security headers middleware, in-memory sliding-window rate limiting, input sanitization, Node `crypto` for UUIDs.
* **Containerization**: Docker (Multi-stage/Alpine-based `node:18-alpine` with healthcheck and volume persistence).
* **Continuous Integration**: Jenkins (Declarative pipeline in `Jenkinsfile` with cross-platform `bat`/`sh` support).

---

## 7. Project Structure
```text
LP-17/
├── data/                          # Persistent SQLite database storage (Volume-Mountable)
│   └── oneclick.sqlite
├── src/
│   ├── config.js                  # Centralized configuration & environment variables
│   ├── db.js                      # Database adapter, schema migrations, and seed data
│   ├── middleware/
│   │   ├── security.js            # Security headers, rate limiting, and sanitization
│   │   └── errorHandler.js        # Centralized JSON error handling & 404 router
│   ├── routes/
│   │   ├── health.js              # GET /api/health
│   │   ├── dashboard.js           # GET /api/dashboard
│   │   ├── projects.js            # GET, POST, DELETE /api/projects
│   │   ├── environments.js        # GET, POST, DELETE /api/environments
│   │   ├── deployments.js         # GET, POST, PATCH /api/deployments
│   │   ├── logs.js                # GET, POST, DELETE /api/logs
│   │   └── settings.js            # GET, PUT /api/settings
│   └── services/
│       ├── deploymentService.js   # Predefined CI/CD pipeline orchestrator
│       └── provisioningService.js # Cloud environment lifecycle orchestrator
├── server.js                      # Express server entrypoint
├── index.html                     # Frontend dashboard SPA
├── style.css                      # Design system and theme stylesheet
├── script.js                      # Frontend client controller & API connector
├── test_backend.js                # Automated end-to-end integration test suite
├── Dockerfile                     # Production-ready Docker container specification
├── .dockerignore                  # Docker build context exclusion list
├── Jenkinsfile                    # Cross-platform Jenkins CI/CD pipeline
├── .gitignore                     # Git version control exclusions
├── package.json                   # Project manifest and scripts
└── README.md                      # Complete technical documentation
```

---

## 8. Installation
Ensure you have **Node.js 18+** installed on your system.

```bash
# Clone or navigate to the project directory
cd LP-17

# Install dependencies
npm install
```

---

## 9. Environment Variables
The application runs out-of-the-box with zero mandatory environment variables. You can customize runtime behaviors via the following:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP service port |
| `NODE_ENV` | `development` | Runtime mode (`development` or `production`) |
| `DB_PATH` | `data/oneclick.sqlite` | Filepath for persistent SQLite storage |
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated for specific domains) |
| `RATE_LIMIT_MAX` | `600` | Max API requests permitted per minute per IP |
| `JENKINS_URL` | `http://localhost:8080` | URL for external Jenkins controller |
| `JENKINS_USER` | `""` | Optional Jenkins API username |
| `JENKINS_TOKEN` | `""` | Optional Jenkins API token |

---

## 10. Running Locally
```bash
# Start the server
npm start

# Or run using node directly
node server.js
```
Open your browser and navigate to:
```text
http://localhost:3000
```

---

## 11. Running with Docker

### 1. Build the Docker Image
```bash
docker build -t oneclick-devops .
```

### 2. Run the Container with Persistent Storage
```bash
# Create a Docker volume for database persistence
docker volume create oneclick_data

# Run container mapping host port 8085 to container port 3000
docker run -d \
  --name oneclick-devops-app \
  -p 8085:3000 \
  -v oneclick_data:/app/data \
  oneclick-devops
```

### 3. Verify Container Availability
```bash
# Check container status and health
docker ps

# Check application healthcheck probe
curl http://localhost:8085/api/health
```
Access the application at `http://localhost:8085`.

---

## 12. API Documentation

All endpoints return JSON and adhere to standard HTTP status codes.

### Health Check
* `GET /api/health`
  * **Status**: `200 OK`
  * **Response**:
    ```json
    {
      "status": "UP",
      "app": "OneClick DevOps",
      "version": "1.0.0",
      "uptime_seconds": 124,
      "database": "connected",
      "memory": { "heapUsedMB": 32, "rssMB": 54 }
    }
    ```

### Dashboard
* `GET /api/dashboard`
  * **Status**: `200 OK`
  * **Response**: Contains aggregate counts (`projects`, `environments`, `deployments`, `successRate`), recent deployments, and system integrations.

### Projects
* `GET /api/projects`: List all registered projects.
* `POST /api/projects`: Create a new project.
  * **Body**: `{ "name": "API Gateway", "description": "Routing gateway", "repo_url": "https://github.com/...", "icon": "⚡" }`
  * **Status**: `201 Created` (`409 Conflict` if name already exists, `400` if invalid).
* `DELETE /api/projects/:id`: Remove a project by UUID.
  * **Status**: `200 OK` (`404 Not Found` if non-existent).

### Environments
* `GET /api/environments`: List all active environments.
* `POST /api/environments`: Provision a new environment.
  * **Body**: `{ "project_name": "Web Application", "environment": "Staging", "cloud": "AWS", "region": "India - Hyderabad", "instance": "Small" }`
  * **Status**: `201 Created`.
* `DELETE /api/environments/:id`: Teardown and de-provision an environment.
  * **Status**: `200 OK`.

### Deployments
* `GET /api/deployments`: List all deployments.
* `POST /api/deployments`: Launch a deployment workflow.
  * **Body**: `{ "project_name": "Web Application", "environment": "Production", "version": "v1.5.0" }`
  * **Status**: `201 Created` (Transitions asynchronously: `Building` ➔ `Deploying` ➔ `Success`).
* `GET /api/deployments/:id`: Inspect deployment details and current stage.
* `PATCH /api/deployments/:id/status`: Update status (`Success`, `Running`, `Failed`).

### Logs
* `GET /api/logs?limit=50&search=keyword`: Fetch system logs with optional search filtering.
* `POST /api/logs`: Append an audit log entry.
* `DELETE /api/logs`: Clear console logs.

### Settings
* `GET /api/settings`: Retrieve integration key-value configurations.
* `PUT /api/settings`: Upsert an integration setting (`{ "key": "jenkins", "value": "Online" }`).

---

## 13. Database Design

Implemented with SQLite (`sql.js`).

### Tables
1. **`projects`**:
   * `id` (TEXT, PK): Unique UUID
   * `name` (TEXT, UNIQUE): Project identifier
   * `description` (TEXT): Overview
   * `repo_url` (TEXT): Linked repository
   * `docker` (TEXT): Container status ('Enabled'/'Disabled')
   * `status` (TEXT): Project status ('Active')
   * `icon` (TEXT): Display emoji
   * `created_at`, `updated_at` (TEXT): ISO timestamps
2. **`environments`**:
   * `id` (TEXT, PK): Unique UUID
   * `project_id` (TEXT): Foreign project reference
   * `project_name` (TEXT): Denormalized project name
   * `environment` (TEXT): 'Development', 'Testing', 'Staging', 'Production'
   * `cloud` (TEXT): 'AWS', 'Azure', 'Google Cloud'
   * `region` (TEXT): Target geographic zone
   * `instance` (TEXT): 'Small', 'Medium', 'Large'
   * `status` (TEXT): 'Running', 'Provisioning', 'Failed'
   * `endpoint_url` (TEXT): Assigned DNS access URL
   * `ip_address` (TEXT): Assigned internal IP
   * `created_at`, `updated_at` (TEXT)
3. **`deployments`**:
   * `id` (TEXT, PK): Unique UUID
   * `dep_number` (TEXT, UNIQUE): Formatted number (`DEP-001`)
   * `project_name` (TEXT): Associated project
   * `environment` (TEXT): Target tier
   * `version` (TEXT): Semantic release tag
   * `status` (TEXT): 'Pending', 'Building', 'Deploying', 'Success', 'Failed'
   * `current_stage` (TEXT): Active pipeline milestone
   * `duration_ms` (INTEGER): Pipeline execution duration in milliseconds
   * `commit_hash` (TEXT): Git commit SHA
   * `created_at`, `completed_at` (TEXT)
4. **`logs`**:
   * `id` (INTEGER, PK, AUTOINCREMENT): Sequential log ID
   * `deployment_id` (TEXT, NULLABLE): Associated deployment ID
   * `message` (TEXT): Audit log message
   * `level` (TEXT): 'info', 'success', 'warning', 'error'
   * `source` (TEXT): 'system', 'deployer', 'cloud-infra', 'pipeline'
   * `created_at` (TEXT)
5. **`settings`**:
   * `key` (TEXT, PK): Setting name
   * `value` (TEXT): Setting value
   * `updated_at` (TEXT)

---

## 14. Jenkins Pipeline

The project includes a **declarative, cross-platform `Jenkinsfile`** designed to run seamlessly on both Windows agents (using `bat`) and Linux/Kubernetes agents (using `sh`):

### Pipeline Stages
1. **Checkout**: Pulls latest revision from SCM.
2. **Install Dependencies**: Executes `npm ci || npm install` to prepare build dependencies.
3. **Test Suite**: Executes `npm test`. **Fails the build if any test fails!**
4. **Docker Build**: Compiles Docker image tagged with both `${BUILD_NUMBER}` and `latest`.
5. **Container Deployment**: Gracefully stops existing containers and launches the updated container with persistent volume mounting (`-v oneclick_data:/app/data`).
6. **Health Check & Verification**: Probes `http://localhost:${HOST_PORT}/api/health` via `curl` to confirm HTTP 200 OK before marking the release successful.
7. **Post Actions**: Automatic cleanup of dangling Docker layers via `docker image prune -f`.

---

## 15. CI/CD Workflow

```
[Git Commit / Push]
        │
        ▼
[Jenkins SCM Trigger] ────► [npm install] ────► [npm test]
                                                    │
                      ┌─────────────────────────────┴─────────────────────────────┐
                      ▼                                                           ▼
                (Tests Pass)                                                (Tests Fail)
                      │                                                           │
                      ▼                                                           ▼
             [docker build]                                              [Build Failed ✗]
                      │                                                   (Stops Pipeline)
                      ▼
             [docker run -d]
           (-v oneclick_data)
                      │
                      ▼
        [Health Check: /api/health]
                      │
                      ▼
             [Deploy Successful ✓]
```

---

## 16. Testing

An automated integration and unit test suite is provided in `test_backend.js`.

### Run Automated Tests
```bash
npm test
```

### Test Coverage Highlights
* **Health Check**: Verifies `/api/health` status `UP`, uptime, database connection, and security headers.
* **Projects API**: Verifies listing, creation, duplicate rejection (409), validation checks (400), and deletion.
* **Environments API**: Verifies provisioning, missing field validation, active listing, and teardown (200 & 404).
* **Deployments API**: Verifies pipeline initiation, sequential `DEP-XXX` generation, initial `Building` state, non-existent project rejection (404), and status updates.
* **Logs API**: Verifies chronological retrieval, search query filtering, and log purge operations.
* **Settings API**: Verifies key retrieval and configuration updates.
* **Security & Error Handling**: Verifies 404 JSON structuring on unmapped routes and header enforcement.

---

## 17. Security
* **No Arbitrary Command Execution**: All deployment and provisioning actions are handled via predefined, validated JavaScript service workflows. No raw user strings are passed to OS shell processes (`exec` / `spawn`).
* **Input Sanitization**: All user inputs (names, descriptions, URLs) are stripped of HTML/script injection tokens.
* **SQL Injection Protection**: All SQLite queries use strict parameterized bindings (`?`).
* **Security Response Headers**: Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`, and `Referrer-Policy`.
* **Rate Limiting**: Integrated sliding-window rate limiter preventing API abuse and denial-of-service hammering.
* **Non-Root Docker Execution**: Docker container drops root privileges and executes under the dedicated `node` user (`USER node`).
* **No Stack Trace Leaks**: Production responses return sanitized, friendly JSON error messages with internal stack traces suppressed.

---

## 18. Deployment Instructions

### Production Deployment via Docker Compose (Optional) or Docker CLI
```bash
# 1. Pull or build the image
docker build -t oneclick-devops:latest .

# 2. Ensure persistent volume exists
docker volume create oneclick_data

# 3. Launch container in production mode
docker run -d \
  --name oneclick-devops \
  --restart always \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -v oneclick_data:/app/data \
  oneclick-devops:latest
```

---

## 19. Troubleshooting

### 1. `npm install` permission errors on Windows PowerShell
If running scripts is restricted in PowerShell:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
```
Or execute commands using `cmd /c "npm install"`.

### 2. Docker daemon connection failure
If `docker build` reports `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`:
* Ensure **Docker Desktop** is launched and the Linux engine has finished starting up in your system tray.

### 3. Port conflict (Port 3000 already in use)
Specify an alternate port via the `PORT` environment variable:
```bash
PORT=8080 node server.js
```

---

## 20. Limitations & Future Improvements
* **Real Cloud Credential Integration**: Currently, environment provisioning simulates cloud network setup and resource allocation milestones. Future iterations can integrate with HashiCorp Terraform CLI or AWS/Azure SDKs using encrypted cloud credentials.
* **Jenkins Webhook Callbacks**: Live polling is implemented for deployment tracking. Future versions can accept incoming webhook notifications directly from remote Jenkins instances to update deployment statuses.
* **User Authentication & RBAC**: The system operates with an administrative profile. Adding JWT/session authentication with role-based access control (Admin, Developer, Viewer) will enable multi-user enterprise deployments.
* **WebSocket Log Streaming**: Logs are currently retrieved via rapid polling and query endpoints. A WebSocket (`ws://`) or Server-Sent Events (`/api/logs/stream`) interface can provide sub-second log line streaming.
