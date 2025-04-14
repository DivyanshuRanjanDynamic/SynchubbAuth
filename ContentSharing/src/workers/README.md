# Workers Directory

This directory contains background job processors and queue management for the Content Sharing Microservice.

## Contents

### queue.js
- Sets up job queues
- Defines job processors
- Manages background tasks
- Handles job scheduling

## Features

1. Queue Management
   - Redis-based queues
   - Job prioritization
   - Retry mechanisms
   - Error handling

2. Background Tasks
   - Content processing
   - Media optimization
   - Notification sending
   - Analytics processing

3. Job Types
   - Content processing jobs
   - Media conversion jobs
   - Notification jobs
   - Cleanup jobs

## Example

```javascript
import { contentQueue } from '../workers/queue.js';

// Add a job to the queue
await contentQueue.add('processContent', {
  contentId: '123',
  type: 'video',
  options: {
    priority: 'high'
  }
});
``` 