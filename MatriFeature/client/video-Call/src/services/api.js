import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Handle refresh token failure (e.g., logout user)
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  }
};

export const roomService = {
  createRoom: async (roomData) => {
    const response = await api.post('/rooms', roomData);
    return response.data;
  },
  joinRoom: async (roomId) => {
    const response = await api.post(`/rooms/${roomId}/join`);
    return response.data;
  },
  leaveRoom: async (roomId) => {
    const response = await api.post(`/rooms/${roomId}/leave`);
    return response.data;
  },
  getRoomDetails: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}`);
    return response.data;
  }
};

export const codeService = {
  saveCode: async (roomId, codeData) => {
    const response = await api.post(`/rooms/${roomId}/code`, codeData);
    return response.data;
  },
  getCode: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}/code`);
    return response.data;
  }
};

export const fileService = {
  uploadFile: async (roomId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/rooms/${roomId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },
  getFiles: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}/files`);
    return response.data;
  }
};

export const whiteboardService = {
  saveDrawing: async (roomId, drawingData) => {
    const response = await api.post(`/rooms/${roomId}/whiteboard`, drawingData);
    return response.data;
  },
  getDrawing: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}/whiteboard`);
    return response.data;
  }
};

export const recordingService = {
  startRecording: async (roomId) => {
    const response = await api.post(`/rooms/${roomId}/recording/start`);
    return response.data;
  },
  stopRecording: async (roomId) => {
    const response = await api.post(`/rooms/${roomId}/recording/stop`);
    return response.data;
  },
  getRecording: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}/recording`);
    return response.data;
  }
};

export default api; 