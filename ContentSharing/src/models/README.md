# Models Directory

This directory contains the database models for the Content Sharing Microservice.

## Contents

### Content.js
- Defines the schema for content items
- Includes fields for:
  - Title, description, and content
  - Media URLs and types
  - User references
  - Timestamps
  - Visibility settings
  - Engagement metrics (likes, comments)

## Usage

Models are used to:
1. Define data structure
2. Validate data
3. Handle database operations
4. Define relationships between collections

## Example

```javascript
import { Content } from '../models/Content.js';

// Create new content
const content = new Content({
  title: 'My Post',
  description: 'Description',
  type: 'image',
  userId: 'user123'
});
``` 