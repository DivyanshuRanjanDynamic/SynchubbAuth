# MatriFeature Microservice

A microservice for handling matrimonial features and functionality.

## Features

- User Profile Management
- Matchmaking Algorithm
- Search and Filter
- Communication Features
- Privacy Controls
- Admin Dashboard

## Prerequisites

- Node.js (v18 or higher)
- MongoDB
- Docker (optional)
- Authentication Service (required for user verification)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
NODE_ENV=development
PORT=8001
MONGODB_URI=mongodb://localhost:27018/matrifeature
AUTH_SERVICE_URL=http://localhost:8000
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1h
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/matrifeature.git
cd matrifeature
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Docker Setup

1. Build the Docker image:
```bash
docker build -t matrifeature-service .
```

2. Run with Docker Compose:
```bash
docker-compose up
```

## API Documentation

The API documentation will be available at `/api/v1/matri/docs` when the service is running.

## Development

- The service runs on port 8001
- MongoDB runs on port 27018
- Authentication service should be running on port 8000

## Testing

Run tests using:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 