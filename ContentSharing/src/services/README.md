# Services Directory

This directory contains service modules that handle specific business logic and external integrations.

## Contents

### mediaService.js
- Handles media file processing
- Manages file uploads to Cloudinary
- Processes images and videos
- Generates thumbnails

## Features

1. Image Processing
   - Resize and optimize images
   - Convert formats
   - Generate thumbnails

2. Video Processing
   - Video compression
   - Format conversion
   - Thumbnail generation
   - Metadata extraction

3. File Management
   - Cloudinary integration
   - File type validation
   - Size optimization
   - Error handling

## Example

```javascript
import { mediaService } from '../services/mediaService.js';

// Process and upload an image
const result = await mediaService.processImage(file);

// Process and upload a video
const videoResult = await mediaService.processVideo(file);
``` 