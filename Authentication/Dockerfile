# Use Node.js LTS version
FROM node:20-alpine

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create app directory and set permissions
WORKDIR /usr/src/app
RUN chown -R appuser:appgroup /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for development)
RUN npm install

# Copy source code
COPY --chown=appuser:appgroup . .

# Create SSL directory and set permissions
RUN mkdir -p server/ssl && \
    chown -R appuser:appgroup server/ssl

# Generate SSL certificates during build
RUN apk add --no-cache openssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout server/ssl/key.pem \
    -out server/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" && \
    chown -R appuser:appgroup server/ssl

# Switch to non-root user
USER appuser

# Expose the port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/auth/health || exit 1

# Start the application (default to development mode)
CMD ["npm", "run", "dev"] 