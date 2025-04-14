# Utils Directory

This directory contains utility functions and helper modules used throughout the Content Sharing Microservice.

## Contents

### cloudinary.js
- Cloudinary configuration
- File upload functions
- File deletion functions
- URL generation

### logger.js
- Logging configuration
- Log levels
- Format settings
- Output handling

### error.js
- Error handling utilities
- Custom error classes
- Error formatting
- Error responses

## Features

1. Cloudinary Integration
   - File upload
   - File deletion
   - URL generation
   - Error handling

2. Logging
   - Multiple log levels
   - Structured logging
   - Error tracking
   - Performance monitoring

3. Error Handling
   - Custom error types
   - Error formatting
   - HTTP error responses
   - Error logging

## Example

```javascript
import { logger } from '../utils/logger.js';
import { createError } from '../utils/error.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

// Log an error
logger.error('Operation failed', { error });

// Create and throw a custom error
throw createError(400, 'Invalid input');

// Upload a file to Cloudinary
const result = await uploadToCloudinary(fileBuffer, 'images');
``` 