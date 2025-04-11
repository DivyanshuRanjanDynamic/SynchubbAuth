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

## Local Development with Docker Compose

This project includes a Docker Compose setup for local development, which allows you to run the Authentication service along with its dependencies (MongoDB and Redis) in isolated containers.

### Prerequisites

- Docker and Docker Compose installed on your machine
- Git (for cloning the repository)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Authentication
   ```

2. **Create a .env.local file**
   ```bash
   cp .env.example .env.local
   ```
   Edit the .env.local file with your OAuth credentials and email configuration.

3. **Start the services**
   ```bash
   docker-compose up -d
   ```
   This will start the Authentication service, MongoDB, and Redis in detached mode.

4. **View logs**
   ```bash
   docker-compose logs -f
   ```
   This will show the logs from all services. Press Ctrl+C to exit.

5. **Stop the services**
   ```bash
   docker-compose down
   ```
   This will stop and remove all containers, but preserve the data volumes.

6. **Stop the services and remove volumes**
   ```bash
   docker-compose down -v
   ```
   This will stop and remove all containers and data volumes.

### Accessing the Services

- **Authentication Service**: http://localhost:8000
- **MongoDB**: mongodb://localhost:27017
- **Redis**: redis://localhost:6379 (password: 9955823240)

### Development Workflow

1. Make changes to your code
2. The changes will be automatically reflected in the container due to the volume mount
3. The service will automatically restart due to nodemon

### Troubleshooting

- **Port conflicts**: If you have other services running on ports 8000, 27017, or 6379, you can change the port mappings in the docker-compose.yml file.
- **Container not starting**: Check the logs with `docker-compose logs -f auth-service`
- **Database connection issues**: Ensure MongoDB is running with `docker-compose ps`

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