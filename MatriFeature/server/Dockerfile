# Use Node.js LTS version as base image
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    mongodb-tools

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Download and install Vosk model
RUN mkdir -p /app/models && \
    cd /app/models && \
    wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip && \
    unzip vosk-model-small-en-us-0.15.zip && \
    mv vosk-model-small-en-us-0.15 vosk-model && \
    rm vosk-model-small-en-us-0.15.zip

# Copy the entire project
COPY . .

# Create recordings directory
RUN mkdir -p /app/recordings && \
    chmod 755 /app/recordings

# Create .env file from example if it doesn't exist
RUN if [ ! -f .env ]; then cp .env.example .env; fi

# Expose the port the app runs on
EXPOSE 8001

# Start the application
CMD ["npm", "start"] 