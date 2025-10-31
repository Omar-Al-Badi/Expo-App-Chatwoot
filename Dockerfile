# Dockerfile for Chatwoot Chat Backend
FROM node:20-alpine

WORKDIR /app

# Copy backend-specific package file (only 4 dependencies instead of 50+)
COPY backend-package.json package.json

# Install dependencies - much faster with minimal packages
RUN npm install --omit=dev && npm cache clean --force

# Copy application files
COPY server.js ./

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]
