# ContentSharing Microservice API Documentation

## Overview

The ContentSharing microservice provides APIs for managing and sharing content, including files, images, and other media. This service integrates with the Authentication service for user authentication and authorization.

## Base URL

```
https://your-content-sharing-service-url.com/api
```

## Authentication

All API endpoints (except health check) require authentication using JWT tokens.

### Authentication Header

Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### Health Check

Check if the service is running.

```
GET /api/v1/health
```

**Response:**

```json
{
  "status": "healthy"
}
```

### Content Management

#### Upload Content

Upload a new file or content.

```
POST /api/content/upload
```

**Request:**

- Content-Type: `multipart/form-data`
- Body:
  - `file`: The file to upload (required)
  - `title`: Title of the content (optional)
  - `description`: Description of the content (optional)
  - `tags`: Comma-separated tags (optional)
  - `visibility`: `public` or `private` (default: `private`)

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "content_id",
    "title": "Content Title",
    "description": "Content Description",
    "fileUrl": "https://storage-url.com/path/to/file",
    "fileType": "image/jpeg",
    "fileSize": 1024,
    "tags": ["tag1", "tag2"],
    "visibility": "public",
    "userId": "user_id",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

#### Get Content by ID

Retrieve content by its ID.

```
GET /api/content/:id
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "content_id",
    "title": "Content Title",
    "description": "Content Description",
    "fileUrl": "https://storage-url.com/path/to/file",
    "fileType": "image/jpeg",
    "fileSize": 1024,
    "tags": ["tag1", "tag2"],
    "visibility": "public",
    "userId": "user_id",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

#### Update Content

Update content details.

```
PUT /api/content/:id
```

**Request:**

```json
{
  "title": "Updated Title",
  "description": "Updated Description",
  "tags": ["updated", "tags"],
  "visibility": "public"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "content_id",
    "title": "Updated Title",
    "description": "Updated Description",
    "fileUrl": "https://storage-url.com/path/to/file",
    "fileType": "image/jpeg",
    "fileSize": 1024,
    "tags": ["updated", "tags"],
    "visibility": "public",
    "userId": "user_id",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

#### Delete Content

Delete content by ID.

```
DELETE /api/content/:id
```

**Response:**

```json
{
  "success": true,
  "message": "Content deleted successfully"
}
```

#### List User's Content

Get a list of content created by the authenticated user.

```
GET /api/content/user
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `sort`: Sort field (default: `createdAt`)
- `order`: Sort order (`asc` or `desc`, default: `desc`)
- `visibility`: Filter by visibility (`public` or `private`)
- `tags`: Filter by tags (comma-separated)

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "content_id_1",
        "title": "Content Title 1",
        "description": "Content Description 1",
        "fileUrl": "https://storage-url.com/path/to/file1",
        "fileType": "image/jpeg",
        "fileSize": 1024,
        "tags": ["tag1", "tag2"],
        "visibility": "public",
        "userId": "user_id",
        "createdAt": "2023-01-01T00:00:00.000Z",
        "updatedAt": "2023-01-01T00:00:00.000Z"
      },
      {
        "id": "content_id_2",
        "title": "Content Title 2",
        "description": "Content Description 2",
        "fileUrl": "https://storage-url.com/path/to/file2",
        "fileType": "image/png",
        "fileSize": 2048,
        "tags": ["tag3", "tag4"],
        "visibility": "private",
        "userId": "user_id",
        "createdAt": "2023-01-02T00:00:00.000Z",
        "updatedAt": "2023-01-02T00:00:00.000Z"
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

#### Search Public Content

Search for public content.

```
GET /api/content/search
```

**Query Parameters:**

- `q`: Search query
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `sort`: Sort field (default: `createdAt`)
- `order`: Sort order (`asc` or `desc`, default: `desc`)
- `tags`: Filter by tags (comma-separated)

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "content_id_1",
        "title": "Content Title 1",
        "description": "Content Description 1",
        "fileUrl": "https://storage-url.com/path/to/file1",
        "fileType": "image/jpeg",
        "fileSize": 1024,
        "tags": ["tag1", "tag2"],
        "visibility": "public",
        "userId": "user_id_1",
        "createdAt": "2023-01-01T00:00:00.000Z",
        "updatedAt": "2023-01-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

### User Management

#### Get User Profile

Get the profile of the authenticated user.

```
GET /api/users/profile
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "username": "username",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "profilePicture": "https://storage-url.com/path/to/profile.jpg",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

#### Update User Profile

Update the profile of the authenticated user.

```
PUT /api/users/profile
```

**Request:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "profilePicture": "https://storage-url.com/path/to/profile.jpg"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "username": "username",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "profilePicture": "https://storage-url.com/path/to/profile.jpg",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

## Error Responses

All API endpoints return error responses in the following format:

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

### Common Error Codes

- `UNAUTHORIZED`: Authentication required or token invalid
- `FORBIDDEN`: User does not have permission to perform the action
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Request validation failed
- `INTERNAL_SERVER_ERROR`: Server error

## Rate Limiting

The API is rate-limited to 100 requests per 15 minutes per IP address. When the rate limit is exceeded, the API returns a 429 Too Many Requests response.

## WebSocket API

The service also provides a WebSocket API for real-time notifications.

### WebSocket Connection

```
wss://your-content-sharing-service-url.com
```

### Events

#### Join User Room

Join a user's room to receive notifications.

```json
{
  "event": "join",
  "data": {
    "userId": "user_id"
  }
}
```

#### Content Created

Notification when content is created.

```json
{
  "event": "content:created",
  "data": {
    "id": "content_id",
    "title": "Content Title",
    "userId": "user_id"
  }
}
```

#### Content Updated

Notification when content is updated.

```json
{
  "event": "content:updated",
  "data": {
    "id": "content_id",
    "title": "Updated Title",
    "userId": "user_id"
  }
}
```

#### Content Deleted

Notification when content is deleted.

```json
{
  "event": "content:deleted",
  "data": {
    "id": "content_id",
    "userId": "user_id"
  }
}
```

## API Documentation UI

The API documentation is also available through Swagger UI at:

```
https://your-content-sharing-service-url.com/api-docs
``` 