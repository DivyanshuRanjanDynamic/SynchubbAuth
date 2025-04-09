# Authentication Service API Documentation

## Base URL
```
http://localhost:8000/api/auth
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
    "password": "string",
    "role": "string"
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
    "emailOrUsername": "string",
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
    "newPassword": "string"
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

#### 6. Get Privacy Policy
```http
GET /privacy-policy
```
Response:
```json
{
    "statusCode": 200,
    "data": {
        "content": "string"
    },
    "message": "Privacy policy retrieved successfully"
}
```

#### 7. Google OAuth
```http
GET /google
```
Description: Initiates Google OAuth flow
Response: Redirects to Google login page

```http
GET /google/callback
```
Description: Google OAuth callback
Response: Redirects to frontend with token: `${CLIENT_URL}/auth/callback?token=<access_token>`

#### 8. GitHub OAuth
```http
GET /github
```
Description: Initiates GitHub OAuth flow
Response: Redirects to GitHub login page

```http
GET /github/callback
```
Description: GitHub OAuth callback
Response: Redirects to frontend with token: `${CLIENT_URL}/auth/callback?token=<access_token>`

### Protected Routes

#### 1. Logout
```http
POST /logout
```
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "Logged out successfully"
}
```

#### 2. Get User Profile
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

#### 3. Update Profile
```http
PUT /profile
```
Request Body:
```json
{
    "username": "string",
    "email": "string"
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

#### 4. Change Password
```http
POST /change-password
```
Request Body:
```json
{
    "oldPassword": "string",
    "newPassword": "string"
}
```
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "Password changed successfully"
}
```

#### 5. Refresh Token
```http
GET /refresh-token
```
Response:
```json
{
    "statusCode": 200,
    "data": {
        "accessToken": "string"
    },
    "message": "Token refreshed successfully"
}
```

#### 6. Get Sessions
```http
GET /sessions
```
Description: Requires 'user' or 'admin' role
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

#### 7. Revoke Session
```http
DELETE /sessions/:sessionId
```
Description: Requires 'user' or 'admin' role
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "Session revoked successfully"
}
```

#### 8. Revoke All Sessions
```http
DELETE /sessions
```
Description: Requires 'user' or 'admin' role
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "All sessions revoked successfully"
}
```

#### 9. Delete Account
```http
DELETE /account
```
Response:
```json
{
    "statusCode": 200,
    "data": null,
    "message": "Account deleted successfully"
}
```

#### 10. Home
```http
GET /home
```
Response:
```json
{
    "message": "Welcome to the home page",
    "user": {
        "id": "string",
        "username": "string",
        "email": "string",
        "role": "string"
    }
}
```

## Error Responses
All endpoints may return the following error responses:

```json
{
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Error message description"
}
```

```json
{
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Invalid or expired token"
}
```

```json
{
    "statusCode": 403,
    "error": "Forbidden",
    "message": "Insufficient permissions"
}
```

```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Resource not found"
}
```

```json
{
    "statusCode": 429,
    "error": "Too Many Requests",
    "message": "Rate limit exceeded"
}
```

```json
{
    "statusCode": 500,
    "error": "Internal Server Error",
    "message": "Something went wrong"
}
``` 