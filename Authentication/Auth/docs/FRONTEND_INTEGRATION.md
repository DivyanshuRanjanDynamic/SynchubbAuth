# Frontend Integration Guide for React Vite

## Initial Setup

1. **Create a new Vite React project**
```bash
npm create vite@latest my-auth-app -- --template react
cd my-auth-app
```

2. **Install Required Dependencies**
```bash
npm install axios react-router-dom @reduxjs/toolkit react-redux @tanstack/react-query
```

3. **Environment Variables**
Create a `.env` file in your project root:
```env
VITE_API_URL=http://localhost:8000/api/auth
VITE_CLIENT_URL=http://localhost:5173
```

## Project Structure
```
src/
├── api/
│   ├── axios.js
│   └── auth.js
├── components/
│   ├── auth/
│   │   ├── LoginForm.jsx
│   │   ├── RegisterForm.jsx
│   │   └── ForgotPasswordForm.jsx
│   └── common/
│       ├── ProtectedRoute.jsx
│       └── ErrorBoundary.jsx
├── features/
│   └── auth/
│       ├── authSlice.js
│       └── authHooks.js
├── store/
│   └── store.js
└── App.jsx
```

## API Configuration

### 1. Axios Instance Setup
```javascript
// src/api/axios.js
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const response = await api.get('/refresh-token');
                const { accessToken } = response.data.data;
                localStorage.setItem('accessToken', accessToken);
                
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('accessToken');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
```

### 2. Auth API Functions
```javascript
// src/api/auth.js
import api from './axios';

export const authApi = {
    register: async (userData) => {
        const response = await api.post('/register', userData);
        return response.data;
    },

    login: async (credentials) => {
        const response = await api.post('/login', credentials);
        return response.data;
    },

    logout: async () => {
        const response = await api.post('/logout');
        return response.data;
    },

    getProfile: async () => {
        const response = await api.get('/me');
        return response.data;
    },

    updateProfile: async (profileData) => {
        const response = await api.put('/profile', profileData);
        return response.data;
    },

    changePassword: async (passwordData) => {
        const response = await api.post('/change-password', passwordData);
        return response.data;
    },

    forgotPassword: async (email) => {
        const response = await api.post('/forgot-password', { email });
        return response.data;
    },

    resetPassword: async (token, newPassword) => {
        const response = await api.post(`/reset-password/${token}`, { newPassword });
        return response.data;
    },

    verifyEmail: async (token) => {
        const response = await api.get(`/verify-email/${token}`);
        return response.data;
    },

    getSessions: async () => {
        const response = await api.get('/sessions');
        return response.data;
    },

    revokeSession: async (sessionId) => {
        const response = await api.delete(`/sessions/${sessionId}`);
        return response.data;
    },

    revokeAllSessions: async () => {
        const response = await api.delete('/sessions');
        return response.data;
    },

    deleteAccount: async () => {
        const response = await api.delete('/account');
        return response.data;
    }
};
```

## Redux Setup

### 1. Auth Slice
```javascript
// src/features/auth/authSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials: (state, action) => {
            state.user = action.payload.user;
            state.isAuthenticated = true;
            state.loading = false;
            state.error = null;
        },
        setLoading: (state, action) => {
            state.loading = action.payload;
        },
        setError: (state, action) => {
            state.error = action.payload;
            state.loading = false;
        },
        logout: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.error = null;
        },
    },
});

export const { setCredentials, setLoading, setError, logout } = authSlice.actions;
export default authSlice.reducer;
```

### 2. Store Configuration
```javascript
// src/store/store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
    },
});
```

## Custom Hooks

### 1. Auth Hooks
```javascript
// src/features/auth/authHooks.js
import { useDispatch, useSelector } from 'react-redux';
import { setCredentials, setLoading, setError, logout } from './authSlice';
import { authApi } from '../../api/auth';

export const useAuth = () => {
    const dispatch = useDispatch();
    const { user, isAuthenticated, loading, error } = useSelector((state) => state.auth);

    const login = async (credentials) => {
        try {
            dispatch(setLoading(true));
            const response = await authApi.login(credentials);
            dispatch(setCredentials(response.data));
            localStorage.setItem('accessToken', response.data.accessToken);
            return response;
        } catch (error) {
            dispatch(setError(error.response?.data?.message || 'Login failed'));
            throw error;
        }
    };

    const register = async (userData) => {
        try {
            dispatch(setLoading(true));
            const response = await authApi.register(userData);
            return response;
        } catch (error) {
            dispatch(setError(error.response?.data?.message || 'Registration failed'));
            throw error;
        }
    };

    const logoutUser = async () => {
        try {
            await authApi.logout();
            dispatch(logout());
            localStorage.removeItem('accessToken');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return {
        user,
        isAuthenticated,
        loading,
        error,
        login,
        register,
        logout: logoutUser,
    };
};
```

## Components

### 1. Protected Route Component
```javascript
// src/components/common/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/authHooks';

export const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};
```

### 2. Login Form Component
```javascript
// src/components/auth/LoginForm.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/authHooks';

export const LoginForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, loading, error } = useAuth();
    const [formData, setFormData] = useState({
        emailOrUsername: '',
        password: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(formData);
            const from = location.state?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            {error && <div className="error">{error}</div>}
            <div>
                <label htmlFor="emailOrUsername">Email or Username</label>
                <input
                    type="text"
                    id="emailOrUsername"
                    name="emailOrUsername"
                    value={formData.emailOrUsername}
                    onChange={handleChange}
                    required
                />
            </div>
            <div>
                <label htmlFor="password">Password</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                />
            </div>
            <button type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
            </button>
        </form>
    );
};
```

## OAuth Integration

### 1. Google OAuth
```javascript
// src/components/auth/GoogleLogin.jsx
export const GoogleLogin = () => {
    const handleGoogleLogin = () => {
        window.location.href = `${import.meta.env.VITE_API_URL}/google`;
    };

    return (
        <button onClick={handleGoogleLogin}>
            Login with Google
        </button>
    );
};
```

### 2. GitHub OAuth
```javascript
// src/components/auth/GitHubLogin.jsx
export const GitHubLogin = () => {
    const handleGitHubLogin = () => {
        window.location.href = `${import.meta.env.VITE_API_URL}/github`;
    };

    return (
        <button onClick={handleGitHubLogin}>
            Login with GitHub
        </button>
    );
};
```

### 3. OAuth Callback Handler
```javascript
// src/components/auth/OAuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/authHooks';

export const OAuthCallback = () => {
    const navigate = useNavigate();
    const { setCredentials } = useAuth();

    useEffect(() => {
        const token = new URLSearchParams(window.location.search).get('token');
        if (token) {
            localStorage.setItem('accessToken', token);
            // Fetch user profile and set credentials
            navigate('/dashboard');
        } else {
            navigate('/login');
        }
    }, [navigate]);

    return <div>Processing login...</div>;
};
```

## App Configuration

### 1. Main App Component
```javascript
// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { OAuthCallback } from './components/auth/OAuthCallback';
import { Dashboard } from './components/Dashboard';

function App() {
    return (
        <Provider store={store}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginForm />} />
                    <Route path="/register" element={<RegisterForm />} />
                    <Route path="/auth/callback" element={<OAuthCallback />} />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </BrowserRouter>
        </Provider>
    );
}

export default App;
```

## Error Handling

### 1. Global Error Boundary
```javascript
// src/components/common/ErrorBoundary.jsx
import { Component } from 'react';

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div>
                    <h2>Something went wrong</h2>
                    <p>{this.state.error?.message}</p>
                    <button onClick={() => window.location.reload()}>
                        Refresh Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
```

## Best Practices

1. **Token Storage**
   - Store access token in memory or secure storage
   - Use HttpOnly cookies for refresh tokens
   - Clear tokens on logout

2. **Security**
   - Implement CSRF protection
   - Use HTTPS in production
   - Sanitize user inputs
   - Implement rate limiting on the frontend

3. **State Management**
   - Use Redux for global auth state
   - Implement proper loading states
   - Handle errors gracefully

4. **User Experience**
   - Show loading indicators
   - Provide clear error messages
   - Implement proper form validation
   - Add remember me functionality

5. **Code Organization**
   - Separate concerns (API, state, components)
   - Use custom hooks for reusable logic
   - Implement proper TypeScript types
   - Follow consistent naming conventions

## Testing

1. **API Integration Tests**
```javascript
// src/api/__tests__/auth.test.js
import { authApi } from '../auth';

describe('Auth API', () => {
    it('should login successfully', async () => {
        const credentials = {
            emailOrUsername: 'test@example.com',
            password: 'password123',
        };
        const response = await authApi.login(credentials);
        expect(response.data).toHaveProperty('accessToken');
    });
});
```

2. **Component Tests**
```javascript
// src/components/auth/__tests__/LoginForm.test.jsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
    it('should handle login submission', async () => {
        const { getByLabelText, getByRole } = render(<LoginForm />);
        
        fireEvent.change(getByLabelText(/email/i), {
            target: { value: 'test@example.com' },
        });
        
        fireEvent.change(getByLabelText(/password/i), {
            target: { value: 'password123' },
        });
        
        fireEvent.click(getByRole('button', { name: /login/i }));
        
        await waitFor(() => {
            expect(window.location.pathname).toBe('/dashboard');
        });
    });
});
```

## Deployment

1. **Environment Configuration**
   - Use different environment variables for development and production
   - Set up proper CORS configuration
   - Configure proper API URLs

2. **Build Process**
```bash
# Development
npm run dev

# Production build
npm run build
```

3. **Deployment Checklist**
   - Update environment variables
   - Configure proper API endpoints
   - Set up proper CORS settings
   - Enable HTTPS
   - Configure proper error handling
   - Set up monitoring and logging 