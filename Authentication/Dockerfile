# Use Node.js LTS version as base image
FROM node:20-alpine

# Set working directory to match project structure
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with verbose output
RUN npm install --verbose

# Copy source code
COPY . .

#Create a SSl certificate directory
RUN mkdir -p /app/Auth/server/ssl

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Expose the port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Start the application with debugging
CMD ["sh", "-c", "echo 'Starting application on port ${port}...' && node Auth/handleServerAndDatabase.js"]