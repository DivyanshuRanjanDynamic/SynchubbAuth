# Frontend Developer Guide for ContentSharing Microservice

## Overview

This guide is designed to help frontend developers integrate with the ContentSharing microservice. It provides information on authentication, API usage, and best practices for building a frontend application that interacts with this service.

## Authentication Flow

The ContentSharing microservice uses JWT (JSON Web Tokens) for authentication. Here's how to implement the authentication flow in your frontend application:

### 1. User Login

1. Send a POST request to the Authentication service:
   ```
   POST https://your-auth-service-url.com/api/auth/login
   ```

   Request body:
   ```json
   {
     "email": "user@example.com",
     "password": "userpassword"
   }
   ```

2. Store the JWT token in localStorage or a secure cookie:
   ```javascript
   // Example using localStorage
   localStorage.setItem('token', response.data.token);
   ```

### 2. Include the Token in API Requests

Add the token to the Authorization header for all API requests to the ContentSharing service:

```javascript
// Example using fetch
const fetchContent = async (contentId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`https://your-content-sharing-service-url.com/api/content/${contentId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.json();
};
```

### 3. Handle Token Expiration

The JWT token has an expiration time. When the token expires, you should redirect the user to the login page:

```javascript
// Example using axios interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## API Integration Examples

### Uploading Content

```javascript
// Example using FormData and fetch
const uploadContent = async (file, title, description, tags, visibility) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  
  formData.append('file', file);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('tags', tags.join(','));
  formData.append('visibility', visibility);
  
  const response = await fetch('https://your-content-sharing-service-url.com/api/content/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
};
```

### Fetching User's Content

```javascript
// Example using axios
const fetchUserContent = async (page = 1, limit = 10) => {
  const token = localStorage.getItem('token');
  
  const response = await axios.get('https://your-content-sharing-service-url.com/api/content/user', {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    params: {
      page,
      limit
    }
  });
  
  return response.data;
};
```

### Searching Public Content

```javascript
// Example using axios
const searchPublicContent = async (query, page = 1, limit = 10) => {
  const response = await axios.get('https://your-content-sharing-service-url.com/api/content/search', {
    params: {
      q: query,
      page,
      limit
    }
  });
  
  return response.data;
};
```

## WebSocket Integration

The ContentSharing service provides real-time notifications via WebSocket. Here's how to integrate it:

```javascript
// Example using Socket.IO client
import { io } from 'socket.io-client';

const connectWebSocket = (userId) => {
  const socket = io('wss://your-content-sharing-service-url.com');
  
  // Join user's room
  socket.emit('join', { userId });
  
  // Listen for content created event
  socket.on('content:created', (data) => {
    console.log('New content created:', data);
    // Update UI or show notification
  });
  
  // Listen for content updated event
  socket.on('content:updated', (data) => {
    console.log('Content updated:', data);
    // Update UI or show notification
  });
  
  // Listen for content deleted event
  socket.on('content:deleted', (data) => {
    console.log('Content deleted:', data);
    // Update UI or show notification
  });
  
  return socket;
};
```

## Error Handling

Always handle API errors gracefully:

```javascript
// Example using try-catch
const fetchContent = async (contentId) => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`https://your-content-sharing-service-url.com/api/content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching content:', error);
    // Show error message to user
    showErrorMessage(error.message);
  }
};
```

## Best Practices

1. **Token Management**:
   - Store tokens securely (preferably in HttpOnly cookies)
   - Implement token refresh mechanism
   - Clear tokens on logout

2. **Error Handling**:
   - Always handle API errors
   - Show user-friendly error messages
   - Log errors for debugging

3. **Loading States**:
   - Show loading indicators during API calls
   - Implement skeleton screens for better UX

4. **Pagination**:
   - Implement infinite scrolling or pagination controls
   - Cache paginated results

5. **File Upload**:
   - Show upload progress
   - Validate file types and sizes
   - Implement retry mechanism for failed uploads

6. **Real-time Updates**:
   - Use WebSocket for real-time notifications
   - Implement reconnection logic
   - Show connection status to users

## Example React Component

Here's an example of a React component that integrates with the ContentSharing service:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ContentList = () => {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const fetchContents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get('https://your-content-sharing-service-url.com/api/content/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          page,
          limit: 10
        }
      });
      
      const { items, total, pages } = response.data.data;
      
      setContents(prev => [...prev, ...items]);
      setHasMore(page < pages);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch contents');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchContents();
  }, [page]);
  
  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  return (
    <div className="content-list">
      {contents.map(content => (
        <div key={content.id} className="content-item">
          <h3>{content.title}</h3>
          <p>{content.description}</p>
          <img src={content.fileUrl} alt={content.title} />
          <div className="tags">
            {content.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      ))}
      
      {loading && <div className="loading">Loading...</div>}
      
      {hasMore && !loading && (
        <button onClick={loadMore}>Load More</button>
      )}
    </div>
  );
};

export default ContentList;
```

## Troubleshooting

If you encounter issues with the API:

1. **Check Network Requests**:
   - Use browser developer tools to inspect network requests
   - Verify request headers and body
   - Check response status and body

2. **Verify Authentication**:
   - Ensure the token is valid and not expired
   - Check if the token is correctly included in the Authorization header

3. **Check API Documentation**:
   - Refer to the API documentation for correct endpoint usage
   - Verify request and response formats

4. **Contact Backend Team**:
   - If issues persist, contact the backend team with detailed information
   - Include request and response data for debugging

## Resources

- [API Documentation](https://your-content-sharing-service-url.com/api-docs)
- [JWT Authentication](https://jwt.io/introduction)
- [Socket.IO Client Documentation](https://socket.io/docs/v4/client-api/)
- [Axios Documentation](https://axios-http.com/docs/intro) 