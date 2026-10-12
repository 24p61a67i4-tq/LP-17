# Node.js runtime for Express backend + static frontend serving
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --production

# Copy application files
COPY server.js index.html style.css script.js ./

# Expose application port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
