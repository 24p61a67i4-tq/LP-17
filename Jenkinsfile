pipeline {
    agent any

    environment {
        IMAGE_NAME     = 'oneclick-devops'
        CONTAINER_NAME = 'oneclick-devops-app'
        HOST_PORT      = '8085'
        CONTAINER_PORT = '3000'
        VOLUME_NAME    = 'oneclick_data'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code from SCM repository...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing Node.js dependencies...'
                script {
                    if (isUnix()) {
                        sh 'npm --version'
                        sh 'npm ci || npm install'
                    } else {
                        bat 'npm --version'
                        bat 'npm ci || npm install'
                    }
                }
            }
        }

        stage('Test Suite') {
            steps {
                echo 'Executing automated integration and unit test suite...'
                script {
                    if (isUnix()) {
                        sh 'npm test'
                    } else {
                        bat 'npm test'
                    }
                }
            }
        }

        stage('Docker Build') {
            steps {
                echo "Building Docker image: ${IMAGE_NAME}:${BUILD_NUMBER} and ${IMAGE_NAME}:latest..."
                script {
                    if (isUnix()) {
                        sh "docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} -t ${IMAGE_NAME}:latest ."
                    } else {
                        bat "docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} -t ${IMAGE_NAME}:latest ."
                    }
                }
            }
        }

        stage('Container Deployment') {
            steps {
                echo "Deploying container: ${CONTAINER_NAME} on host port ${HOST_PORT}..."
                script {
                    if (isUnix()) {
                        sh """
                            docker stop ${CONTAINER_NAME} 2>/dev/null || true
                            docker rm ${CONTAINER_NAME} 2>/dev/null || true
                            docker volume create ${VOLUME_NAME} || true
                            docker run -d --name ${CONTAINER_NAME} -p ${HOST_PORT}:${CONTAINER_PORT} -v ${VOLUME_NAME}:/app/data ${IMAGE_NAME}:${BUILD_NUMBER}
                        """
                    } else {
                        bat """
                            docker stop ${CONTAINER_NAME} 2>nul || echo No active container to stop
                            docker rm ${CONTAINER_NAME} 2>nul || echo No existing container to remove
                            docker volume create ${VOLUME_NAME} 2>nul || echo Volume ready
                            docker run -d --name ${CONTAINER_NAME} -p ${HOST_PORT}:${CONTAINER_PORT} -v ${VOLUME_NAME}:/app/data ${IMAGE_NAME}:${BUILD_NUMBER}
                        """
                    }
                }
            }
        }

        stage('Health Check & Verification') {
            steps {
                echo "Verifying application availability at http://localhost:${HOST_PORT}/api/health..."
                sleep(time: 5, unit: 'SECONDS')
                script {
                    if (isUnix()) {
                        sh """
                            curl -s -f http://localhost:${HOST_PORT}/api/health || (
                                echo 'ERROR: Application health check failed at http://localhost:${HOST_PORT}/api/health'
                                exit 1
                            )
                            echo 'SUCCESS: Application health probe returned HTTP 200 OK.'
                        """
                    } else {
                        bat """
                            curl -s -f http://localhost:${HOST_PORT}/api/health || (
                                echo ERROR: Application health check failed at http://localhost:${HOST_PORT}/api/health
                                exit /b 1
                            )
                            echo SUCCESS: Application health probe returned HTTP 200 OK.
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            echo "CI/CD pipeline run finished for build #${BUILD_NUMBER}."
        }
        success {
            echo "SUCCESS: Build #${BUILD_NUMBER} deployed successfully. Service live at http://localhost:${HOST_PORT}"
        }
        failure {
            echo "FAILURE: Build #${BUILD_NUMBER} failed. Review console output for troubleshooting."
        }
        cleanup {
            echo "Cleaning up dangling Docker images..."
            script {
                if (isUnix()) {
                    sh 'docker image prune -f || true'
                } else {
                    bat 'docker image prune -f 2>nul || echo Cleanup completed'
                }
            }
        }
    }
}
