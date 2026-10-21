# =============================================
# ONECLICK DEVOPS - PRODUCTION DOCKERFILE
# Node.js 18 Alpine Lightweight Runtime
# =============================================

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Configure production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST_PORT=8085
ENV DB_PATH=/app/data/oneclick.sqlite

# Create directory for persistent volume mounts and set permissions
RUN mkdir -p /app/data && chown -R node:node /app

# Install dependencies using package manifests
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy backend source modules and frontend assets
COPY server.js ./
COPY src/ ./src/
COPY index.html style.css script.js ./

# Set ownership to unprivileged user
RUN chown -R node:node /app

# Switch to unprivileged non-root user
USER node

# Expose internal HTTP service port
EXPOSE 3000

# Declare persistent data volume mount point
VOLUME ["/app/data"]

# Container Healthcheck probe
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application server
CMD ["node", "server.js"]
