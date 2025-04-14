# Controllers Directory

This directory contains the business logic controllers for the Content Sharing Microservice.

## Contents

### contentController.js
- Handles all content-related operations
- Implements CRUD operations
- Manages content interactions (likes, comments, shares)
- Handles media processing
- Implements caching strategies

## Features

1. Content Management
   - Create new content
   - Retrieve content
   - Update content
   - Delete content

2. Social Interactions
   - Like/unlike content
   - Add comments
   - Share content

3. Media Processing
   - Image optimization
   - Video processing
   - Thumbnail generation

4. Performance
   - Redis caching
   - Background processing
   - Rate limiting

## Example

```javascript
import { contentController } from '../controllers/contentController.js';

// Create new content
const newContent = await contentController.createContent(req, res);

// Get content feed
const feed = await contentController.getFeed(req, res);
``` 