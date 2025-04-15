import { useState, useEffect } from 'react';
import { AUTH_ENDPOINTS, API_CONFIG } from '../config/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Login function
  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await fetch(AUTH_ENDPOINTS.LOGIN, {
        method: 'POST',
        ...API_CONFIG,
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await fetch(AUTH_ENDPOINTS.LOGOUT, {
        method: 'POST',
        ...API_CONFIG,
      });
      setUser(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Google login function
  const loginWithGoogle = () => {
    window.location.href = AUTH_ENDPOINTS.GOOGLE_LOGIN;
  };

  // GitHub login function
  const loginWithGithub = () => {
    window.location.href = AUTH_ENDPOINTS.GITHUB_LOGIN;
  };

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(AUTH_ENDPOINTS.VERIFY_TOKEN, {
          ...API_CONFIG,
        });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  return {
    user,
    loading,
    error,
    login,
    logout,
    loginWithGoogle,
    loginWithGithub,
  };
}; 