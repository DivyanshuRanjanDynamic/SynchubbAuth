# ContentSharing Microservice

## Overview

The ContentSharing microservice is part of the Synchubb platform, providing functionality for users to upload, manage, and share content. It integrates with the Authentication service for user authentication and authorization.

## Features

- File upload and management
- Content processing and optimization
- Content sharing and visibility control
- Real-time notifications via WebSocket
- Rate limiting and caching
- API documentation with Swagger

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Caching**: Redis
- **File Storage**: Cloudinary
- **Authentication**: JWT
- **Documentation**: Swagger
- **Containerization**: Docker

## Prerequisites

- Node.js (v18 or higher)
- MongoDB
- Redis
- Docker and Docker Compose (for containerized deployment)
- Cloudinary account (for file storage)

## Installation

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/SynchubbAuth.git
   cd SynchubbAuth/ContentSharing
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration:
   ```
   NODE_ENV=development
   PORT=8001
   MONGO_URI=mongodb://localhost:27017/contentDB
   REDIS_URL=redis://localhost:6379
   REDIS_PASSWORD=your_redis_password
   REDIS_DB=0
   ACCESS_TOKEN_SECRET=your_access_token_secret
   ACCESS_TOKEN_EXPIRY=1hr
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLIENT_URL=http://localhost:3000
   ```

5. Start the service:
   ```bash
   npm start
   ```

### Docker Deployment

1. Build and start the containers:
   ```bash
   docker-compose up --build
   ```

2. The service will be available at `http://localhost:8001`

## API Documentation

API documentation is available at `/api-docs` when the service is running.

For detailed API documentation, see [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

## Frontend Integration

For frontend developers, see [FRONTEND_DEVELOPER_GUIDE.md](docs/FRONTEND_DEVELOPER_GUIDE.md).

## Project Structure

```
ContentSharing/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   ├── workers/          # Background workers
│   └── index.js          # Application entry point
├── uploads/              # Uploaded files (local storage)
├── logs/                 # Application logs
├── docs/                 # Documentation
├── docker/               # Docker-related files
├── .env                  # Environment variables
├── .env.example          # Example environment variables
├── .gitignore            # Git ignore file
├── docker-compose.yml    # Docker Compose configuration
├── Dockerfile            # Docker configuration
└── package.json          # Project dependencies
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment (development/production) | development |
| PORT | Server port | 8001 |
| MONGO_URI | MongoDB connection URI | mongodb://localhost:27017/contentDB |
| REDIS_URL | Redis connection URL | redis://localhost:6379 |
| REDIS_PASSWORD | Redis password | - |
| REDIS_DB | Redis database index | 0 |
| ACCESS_TOKEN_SECRET | JWT secret key | - |
| ACCESS_TOKEN_EXPIRY | JWT expiration time | 1hr |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name | - |
| CLOUDINARY_API_KEY | Cloudinary API key | - |
| CLOUDINARY_API_SECRET | Cloudinary API secret | - |
| CLIENT_URL | Frontend URL | http://localhost:3000 |

## API Endpoints

### Health Check
- `GET /api/v1/health` - Check if the service is running

### Content Management
- `POST /api/content/upload` - Upload a new file
- `GET /api/content/:id` - Get content by ID
- `PUT /api/content/:id` - Update content
- `DELETE /api/content/:id` - Delete content
- `GET /api/content/user` - Get user's content
- `GET /api/content/search` - Search public content

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

## WebSocket Events

- `join` - Join user's room
- `content:created` - Content created notification
- `content:updated` - Content updated notification
- `content:deleted` - Content deleted notification

## Error Handling

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

## Rate Limiting

The API is rate-limited to 100 requests per 15 minutes per IP address.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

Your Name - your.email@example.com

Project Link: [https://github.com/your-username/SynchubbAuth](https://github.com/your-username/SynchubbAuth) 