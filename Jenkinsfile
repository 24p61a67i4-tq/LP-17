pipeline {
    agent any

    environment {
        IMAGE_NAME     = 'oneclick-devops'
        CONTAINER_NAME = 'oneclick-devops-app'
        HOST_PORT      = '8085'
        CONTAINER_PORT = '3000'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code from GitHub repository...'
                checkout scm
            }
        }

        stage('Validate') {
            steps {
                echo 'Validating required application and Docker files...'
                bat '''
                    if not exist index.html (
                        echo ERROR: index.html is missing!
                        exit /b 1
                    )
                    if not exist style.css (
                        echo ERROR: style.css is missing!
                        exit /b 1
                    )
                    if not exist script.js (
                        echo ERROR: script.js is missing!
                        exit /b 1
                    )
                    if not exist server.js (
                        echo ERROR: server.js is missing!
                        exit /b 1
                    )
                    if not exist package.json (
                        echo ERROR: package.json is missing!
                        exit /b 1
                    )
                    if not exist Dockerfile (
                        echo ERROR: Dockerfile is missing!
                        exit /b 1
                    )
                    echo SUCCESS: All required files are present.
                '''
            }
        }

        stage('Docker Build') {
            steps {
                echo "Building Docker image: ${IMAGE_NAME}:${BUILD_NUMBER} and ${IMAGE_NAME}:latest..."
                bat "docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('Docker Run / Deployment') {
            steps {
                echo "Deploying container: ${CONTAINER_NAME} on host port ${HOST_PORT}..."
                bat """
                    docker stop ${CONTAINER_NAME} 2>nul || echo No active container to stop
                    docker rm ${CONTAINER_NAME} 2>nul || echo No existing container to remove
                    docker run -d --name ${CONTAINER_NAME} -p ${HOST_PORT}:${CONTAINER_PORT} ${IMAGE_NAME}:${BUILD_NUMBER}
                """
            }
        }

        stage('Application Verification') {
            steps {
                echo "Verifying application availability at http://localhost:${HOST_PORT}..."
                sleep(time: 3, unit: 'SECONDS')
                bat """
                    curl -s -f -o nul http://localhost:${HOST_PORT} || (
                        echo ERROR: Application verification failed at http://localhost:${HOST_PORT}
                        exit /b 1
                    )
                    echo SUCCESS: Application responded with HTTP 200 OK.
                """
            }
        }
    }

    post {
        always {
            echo "Pipeline run completed for build #${BUILD_NUMBER}."
        }
        success {
            echo "SUCCESS: Build #${BUILD_NUMBER} deployed successfully. Live at http://localhost:${HOST_PORT}"
        }
        failure {
            echo "FAILURE: Build #${BUILD_NUMBER} failed. Review console output for troubleshooting."
        }
        cleanup {
            echo "Cleaning up dangling Docker images..."
            bat "docker image prune -f 2>nul || echo Cleanup completed"
        }
    }
}
