# Authentication Microservice

A secure authentication service built with Node.js, Express, and MongoDB.

## Features

- User authentication with email/password
- OAuth integration (Google, GitHub)
- JWT-based session management
- MongoDB for data storage
- Redis for caching
- Health monitoring
- Docker support
- Render deployment ready

## Prerequisites

- Node.js 18+
- MongoDB
- Redis
- Docker (optional)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/SynchubbAuth.git
cd SynchubbAuth/Authentication
```

2. Install dependencies:
```bash
npm install
```

3. Create .env file:
```bash
cp .env.example .env
```

4. Update environment variables in .env

## Development

```bash
npm run dev
```

## Production

### Docker
```bash
docker build -t auth-service .
docker run -p 8000:8000 --env-file .env auth-service
```

### Render
1. Push to GitHub
2. Create new Web Service on Render
3. Connect GitHub repository
4. Configure environment variables
5. Deploy

## API Endpoints

- POST /auth/register - User registration
- POST /auth/login - User login
- GET /auth/google - Google OAuth
- GET /auth/github - GitHub OAuth
- GET /health - Health check

## Health Check

The service includes a health check endpoint that monitors:
- MongoDB connection
- Application status
- System metrics

## License

This project is licensed under the ISC License. 