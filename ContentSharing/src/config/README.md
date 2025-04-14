# Config Directory

This directory contains configuration files for various services and integrations used in the Content Sharing Microservice.

## Contents

### mongodb.js
- MongoDB connection configuration
- Connection options
- Event handlers
- Initialization function

### redis.js
- Redis client configuration
- Connection settings
- Event handlers
- Initialization function

### swagger.js
- API documentation configuration
- OpenAPI/Swagger setup
- API endpoint documentation
- Security schemes

## Features

1. Database Configuration
   - MongoDB connection settings
   - Redis connection settings
   - Connection pooling
   - Error handling

2. API Documentation
   - OpenAPI 3.0 specification
   - Endpoint documentation
   - Authentication documentation
   - Example requests/responses

3. Service Configuration
   - Environment variables
   - Connection strings
   - Security settings
   - Performance tuning

## Example

```javascript
import { initializeMongoDB } from '../config/mongodb.js';
import { initializeRedis } from '../config/redis.js';

// Initialize MongoDB
await initializeMongoDB();

// Initialize Redis
await initializeRedis();
``` 