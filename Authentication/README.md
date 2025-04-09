# Authentication Microservice

A secure and scalable authentication microservice built with Node.js, Express, and MongoDB.

## Features

- User Registration & Login
- Email Verification
- Password Reset
- Session Management
- Social Authentication (Google, GitHub)
- Role-Based Access Control
- Rate Limiting
- Security Headers
- Audit Logging

## Prerequisites

- Node.js (v18 or higher)
- MongoDB
- Docker (optional)
- SSL Certificates (for production)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
NODE_ENV=development
PORT=8000
MONGODB_URI=mongodb://localhost:27017/auth
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
EMAIL_SERVICE=your_email_service
EMAIL_USERNAME=your_email_username
EMAIL_PASSWORD=your_email_password
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/auth-service.git
cd auth-service
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
docker build -t auth-service .
```

2. Run with Docker Compose:
```bash
docker-compose up
```

## API Documentation

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for detailed API endpoints and usage.

## Frontend Integration

See [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) for frontend integration guidelines.

## Security Considerations

- Always use HTTPS in production
- Keep your environment variables secure
- Regularly update dependencies
- Monitor for security vulnerabilities
- Use strong passwords and secrets
- Implement rate limiting
- Enable CORS appropriately

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 