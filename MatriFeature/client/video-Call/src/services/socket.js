import { io } from 'socket.io-client';
import { store } from '../store';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000';

class SocketService {
  constructor() {
    this.socket = null;
    this.roomId = null;
    this.listeners = new Map();
  }

  connect() {
    const token = localStorage.getItem('accessToken');
    
    this.socket = io(SOCKET_URL, {
      auth: {
        token
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      store.dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      store.dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    this.socket.on('room:joined', (data) => {
      console.log('Joined room:', data);
      this.roomId = data.roomId;
      store.dispatch({ type: 'SET_ROOM_DATA', payload: data });
    });

    this.socket.on('room:left', () => {
      console.log('Left room');
      this.roomId = null;
      store.dispatch({ type: 'CLEAR_ROOM_DATA' });
    });

    this.socket.on('user:joined', (user) => {
      console.log('User joined:', user);
      store.dispatch({ type: 'ADD_PARTICIPANT', payload: user });
    });

    this.socket.on('user:left', (userId) => {
      console.log('User left:', userId);
      store.dispatch({ type: 'REMOVE_PARTICIPANT', payload: userId });
    });

    // Code collaboration events
    this.socket.on('code:update', (update) => {
      store.dispatch({ type: 'UPDATE_CODE', payload: update });
    });

    // Whiteboard events
    this.socket.on('whiteboard:update', (update) => {
      store.dispatch({ type: 'UPDATE_WHITEBOARD', payload: update });
    });

    // Chat events
    this.socket.on('chat:message', (message) => {
      store.dispatch({ type: 'ADD_MESSAGE', payload: message });
    });

    // Poll events
    this.socket.on('poll:update', (poll) => {
      store.dispatch({ type: 'UPDATE_POLL', payload: poll });
    });
  }

  joinRoom(roomId) {
    if (this.socket) {
      this.socket.emit('room:join', { roomId });
    }
  }

  leaveRoom() {
    if (this.socket && this.roomId) {
      this.socket.emit('room:leave', { roomId: this.roomId });
    }
  }

  sendCodeUpdate(update) {
    if (this.socket && this.roomId) {
      this.socket.emit('code:update', {
        roomId: this.roomId,
        ...update
      });
    }
  }

  sendWhiteboardUpdate(update) {
    if (this.socket && this.roomId) {
      this.socket.emit('whiteboard:update', {
        roomId: this.roomId,
        ...update
      });
    }
  }

  sendChatMessage(message) {
    if (this.socket && this.roomId) {
      this.socket.emit('chat:message', {
        roomId: this.roomId,
        message
      });
    }
  }

  createPoll(poll) {
    if (this.socket && this.roomId) {
      this.socket.emit('poll:create', {
        roomId: this.roomId,
        poll
      });
    }
  }

  voteOnPoll(pollId, optionId) {
    if (this.socket && this.roomId) {
      this.socket.emit('poll:vote', {
        roomId: this.roomId,
        pollId,
        optionId
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.roomId = null;
    }
  }
}

export const socketService = new SocketService(); 