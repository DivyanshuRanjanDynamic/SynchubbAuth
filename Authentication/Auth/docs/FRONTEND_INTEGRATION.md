# Frontend Integration Guide

## Setup

1. **Environment Variables**
```env
REACT_APP_API_URL=https://localhost:8000/api/auth
REACT_APP_CLIENT_URL=http://localhost:3000
```

2. **Install Dependencies**
```bash
npm install axios react-router-dom @reduxjs/toolkit react-redux
```

## Authentication Flow

### 1. Registration
```javascript
import axios from 'axios';

const register = async (userData) => {
    try {
        const response = await axios.post(
            `${process.env.REACT_APP_API_URL}/register`,
            userData
        );
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};
```

### 2. Login
```javascript
const login = async (credentials) => {
    try {
        const response = await axios.post(
            `${process.env.REACT_APP_API_URL}/login`,
            credentials,
            { withCredentials: true }
        );
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};
```

### 3. Protected Routes
```javascript
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children }) => {
    const isAuthenticated = // check from your auth state
    
    return isAuthenticated ? children : <Navigate to="/login" />;
};
```

## Token Management

### 1. Axios Interceptor Setup
```javascript
import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL,
    withCredentials: true
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                const response = await axios.post(
                    `${process.env.REACT_APP_API_URL}/refresh-token`,
                    {},
                    { withCredentials: true }
                );
                
                const { accessToken } = response.data.data;
                localStorage.setItem('accessToken', accessToken);
                
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                // Handle refresh token failure
                localStorage.removeItem('accessToken');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        
        return Promise.reject(error);
    }
);
```

## Redux Setup

### 1. Auth Slice
```javascript
import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null
    },
    reducers: {
        loginSuccess: (state, action) => {
            state.user = action.payload.user;
            state.isAuthenticated = true;
            state.loading = false;
            state.error = null;
        },
        logout: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.error = null;
        },
        // ... other reducers
    }
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
```

### 2. Store Configuration
```javascript
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer
    }
});
```

## Example Components

### 1. Login Component
```javascript
import { useDispatch } from 'react-redux';
import { loginSuccess } from './authSlice';

const Login = () => {
    const dispatch = useDispatch();
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await login(credentials);
            dispatch(loginSuccess(response.data));
            // Redirect to dashboard
        } catch (error) {
            // Handle error
        }
    };
    
    return (
        // Your login form JSX
    );
};
```

### 2. Protected Component
```javascript
import { useSelector } from 'react-redux';

const Dashboard = () => {
    const { user } = useSelector((state) => state.auth);
    
    return (
        <div>
            <h1>Welcome, {user.username}</h1>
            {/* Dashboard content */}
        </div>
    );
};
```

## Error Handling

### 1. Global Error Handler
```javascript
const ErrorBoundary = ({ children }) => {
    const [error, setError] = useState(null);
    
    if (error) {
        return (
            <div>
                <h2>Something went wrong</h2>
                <p>{error.message}</p>
                <button onClick={() => setError(null)}>Try again</button>
            </div>
        );
    }
    
    return children;
};
```

### 2. API Error Handling
```javascript
const handleApiError = (error) => {
    if (error.response) {
        switch (error.response.status) {
            case 401:
                // Handle unauthorized
                break;
            case 403:
                // Handle forbidden
                break;
            case 429:
                // Handle rate limiting
                break;
            default:
                // Handle other errors
        }
    }
};
```

## Best Practices

1. **Token Storage**
   - Store access token in memory or secure storage
   - Never store tokens in localStorage in production
   - Use httpOnly cookies for refresh tokens

2. **Security**
   - Implement CSRF protection
   - Use secure and httpOnly flags for cookies
   - Validate all user input
   - Implement proper error handling

3. **Performance**
   - Implement request caching where appropriate
   - Use debouncing for search inputs
   - Implement proper loading states

4. **User Experience**
   - Show loading states during API calls
   - Implement proper error messages
   - Provide feedback for user actions
   - Handle token expiration gracefully 