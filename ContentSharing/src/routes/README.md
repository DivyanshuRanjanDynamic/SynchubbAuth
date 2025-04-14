# Routes Directory

This directory contains the route definitions for the Content Sharing Microservice.

## Contents

### contentRoutes.js
- Defines content-related endpoints
- Implements route middleware
- Handles request validation
- Manages file uploads

### userRoutes.js
- Defines user-related endpoints
- Handles user authentication
- Manages user preferences

## API Endpoints

### Content Routes
- `POST /api/content` - Create new content
- `GET /api/content/:id` - Get content by ID
- `GET /api/content/feed` - Get user's content feed
- `PUT /api/content/:id` - Update content
- `DELETE /api/content/:id` - Delete content
- `POST /api/content/:id/like` - Like/unlike content
- `POST /api/content/:id/comment` - Add comment
- `POST /api/content/:id/share` - Share content

### User Routes
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/:id/content` - Get user's content

## Example

```javascript
import express from 'express';
import { contentController } from '../controllers/contentController.js';
import { validateContent } from '../middleware/validation.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.post('/', upload.single('media'), validateContent, contentController.createContent);
router.get('/:id', contentController.getContent);
``` 