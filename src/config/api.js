const API_BASE_URL = process.env.REACT_APP_API_URL;

export const API_CONFIG = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
};

export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  LOGOUT: `${API_BASE_URL}/auth/logout`,
  GOOGLE_LOGIN: `${API_BASE_URL}/auth/google`,
  GITHUB_LOGIN: `${API_BASE_URL}/auth/github`,
  VERIFY_TOKEN: `${API_BASE_URL}/auth/verify-token`,
  REFRESH_TOKEN: `${API_BASE_URL}/auth/refresh-token`,
}; 