# Middleware Directory

This directory contains middleware functions for the Content Sharing Microservice.

## Contents

### Authentication
- `authMiddleware.js` - JWT authentication
- `auth.js` - User authentication helpers

### Validation
- `validation.js` - Request data validation
- `upload.js` - File upload handling

### Security
- `rateLimiter.js` - Rate limiting
- `errorHandler.js` - Global error handling

## Features

1. Authentication & Authorization
   - JWT token validation
   - User role checking
   - Session management

2. Request Validation
   - Content validation
   - File type validation
   - Size limits

3. Security
   - Rate limiting
   - Error handling
   - Request sanitization

4. File Handling
   - File upload configuration
   - File type filtering
   - Size restrictions

## Example

```javascript
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateContent } from '../middleware/validation.js';
import { upload } from '../middleware/upload.js';

// Protected route with file upload
router.post('/content', 
  authMiddleware,
  upload.single('media'),
  validateContent,
  contentController.createContent
);
``` 