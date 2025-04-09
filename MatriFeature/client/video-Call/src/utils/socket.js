import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  
  // Add custom socket.io event handlers
  extraHeaders: {
    'Access-Control-Allow-Origin': '*'
  }
});

// Socket event listeners
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Custom event handlers for video calling
socket.on('userJoined', ({ userId, username }) => {
  console.log(`User ${username} (${userId}) joined the room`);
});

socket.on('userLeft', ({ userId, username }) => {
  console.log(`User ${username} (${userId}) left the room`);
});

socket.on('newMessage', ({ userId, username, message }) => {
  console.log(`Message from ${username}: ${message}`);
});

// Export socket instance
export default socket; 