# Authentication Service API Documentation

## Base URL
```
https://localhost:8000/api/auth
```

## Authentication
- All protected routes require a valid JWT token in the Authorization header
- Format: `Authorization: Bearer <token>`
- Tokens are automatically set in cookies for web clients

## Rate Limiting
- Login attempts: 5 per 15 minutes
- API requests: 100 per 15 minutes
- Headers returned:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Endpoints

### Public Routes

#### 1. Register User
```http
POST /register
```
Request Body:
```json
{
    "username": "string",
    "email": "string",
    "password": "string"
}
```
Response:
```json
{
    "statusCode": 201,
    "data": null,
    "message": "Registration successful. Please check your email for verification."
}
```

#### 2. Login
```http
POST /login
```
Request Body:
```json
{
    "email": "string",
    "password": "string"
}
```
Response:
```json
{
    "statusCode": 200,
    "data": {
        "user": {
            "id": "string",
            "username": "string",
            "email": "string",
            "role": "string"
        },
        "accessToken": "string",
        "refreshToken": "string"
    },
    "message": "Login successful"
}
```

#### 3. Verify Email
```http
GET /verify-email/:token
```
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "Email verified successfully"
}
```

#### 4. Request Password Reset
```http
POST /forgot-password
```
Request Body:
```json
{
    "email": "string"
}
```
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "If an account exists with this email, you will receive a password reset link."
}
```

#### 5. Reset Password
```http
POST /reset-password/:token
```
Request Body:
```json
{
    "password": "string"
}
```
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "Password has been reset successfully"
}
```

### Protected Routes

#### 1. Get User Profile
```http
GET /me
```
Response:
```json
{
    "statusCode": 200,
    "data": {
        "id": "string",
        "username": "string",
        "email": "string",
        "role": "string"
    },
    "message": "User profile retrieved successfully"
}
```

#### 2. Update Profile
```http
PUT /profile
```
Request Body:
```json
{
    "username": "string",
    "email": "string",
    "currentPassword": "string",
    "newPassword": "string"
}
```
Response:
```json
{
    "statusCode": 200,
    "data": {
        "user": {
            "id": "string",
            "username": "string",
            "email": "string",
            "role": "string"
        }
    },
    "message": "Profile updated successfully"
}
```

#### 3. Change Password
```http
POST /change-password
```
Request Body:
```json
{
    "previousPassword": "string",
    "newPassword": "string",
    "confirmPassword": "string"
}
```
Response:
```json
{
    "statusCode": 200,
    "data": "Password Updated Successfully",
    "message": "Password changed successfully"
}
```

#### 4. Get Sessions
```http
GET /sessions
```
Response:
```json
{
    "statusCode": 200,
    "data": [
        {
            "id": "string",
            "deviceInfo": {
                "deviceType": "string",
                "ipAddress": "string"
            },
            "createdAt": "string",
            "lastActive": "string"
        }
    ],
    "message": "Sessions retrieved successfully"
}
```

#### 5. Revoke Session
```http
DELETE /sessions/:sessionId
```
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "Session revoked successfully"
}
```

#### 6. Revoke All Sessions
```http
DELETE /sessions
```
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "All sessions revoked successfully"
}
```

#### 7. Delete Account
```http
DELETE /account
```
Request Body:
```json
{
    "password": "string"
}
```
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "Account deleted successfully"
}
```

## Error Responses

All error responses follow this format:
```json
{
    "statusCode": number,
    "message": "string",
    "errors": [
        {
            "field": "string",
            "message": "string"
        }
    ]
}
```

Common error codes:
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 423: Locked
- 429: Too Many Requests
- 500: Internal Server Error 