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

# Create SSL directory
RUN mkdir -p /app/Auth/server/ssl

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8000
ENV SERVER_URL=https://localhost:8000
ENV CLIENT_URL=https://www.synchubb.com
ENV SESSION_SECRET=your_session_secret
ENV GOOGLE_CLIENT_ID=1075886016697-qs5svce9mkl01kt7ukv3g1ooq555fkn7.apps.googleusercontent.com
ENV GOOGLE_CLIENT_SECRET=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
ENV GITHUB_CLIENT_ID=Ov23liylfwydkt30CJlW
ENV GITHUB_CLIENT_SECRET=8c470aa89eb2f17423bbf287b21925d3193a8526
ENV MONGODB_URI=mongodb+srv://synchubb:dIq6eykHzNmudAmo@cluster0.6su60.mongodb.net/authDB
ENV REDIS_URL=rediss://red-cvre1vp5pdvs738ftbbg:6vucRyk0j5zIHL0OhSrgd9ptpCBHtSWO@oregon-keyvalue.render.com:6379
ENV REDIS_PASSWORD=9955823240
ENV REDIS_DB=0 
ENV EMAIL_SERVICE=gmail
ENV EMAIL_USERNAME=synchubb2@gmail.com
ENV ACCESS_TOKEN_EXPIRY=1h
ENV ACCESS_TOKEN_SECRET=divsync
ENV REFRESH_TOKEN_EXPIRY=5d
ENV REFRESH_TOKEN_SECRET=divsyncujjwal

# Expose the port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Start the application with debugging
CMD ["sh", "-c", "echo 'Starting application on port ${PORT}...' && node Auth/handleServerAndDatabase.js"]