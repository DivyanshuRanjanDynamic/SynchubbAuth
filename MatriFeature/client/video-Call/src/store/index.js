import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';

// Initial states
const initialAuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null
};

const initialRoomState = {
  currentRoom: null,
  participants: [],
  connectionStatus: false,
  mediaStatus: {
    mic: true,
    camera: true,
    screenShare: false,
    recording: false
  }
};

const initialCodeState = {
  currentFile: null,
  content: '',
  collaborators: []
};

const initialWhiteboardState = {
  drawings: [],
  currentTool: 'pen',
  color: '#000000',
  size: 2
};

const initialChatState = {
  messages: [],
  unreadCount: 0
};

const initialPollState = {
  activePoll: null,
  polls: []
};

// Reducers
const authReducer = (state = initialAuthState, action) => {
  switch (action.type) {
    case 'LOGIN_REQUEST':
      return { ...state, loading: true, error: null };
    case 'LOGIN_SUCCESS':
      return { ...state, isAuthenticated: true, user: action.payload, loading: false };
    case 'LOGIN_FAILURE':
      return { ...state, loading: false, error: action.payload };
    case 'LOGOUT':
      return initialAuthState;
    default:
      return state;
  }
};

const roomReducer = (state = initialRoomState, action) => {
  switch (action.type) {
    case 'SET_ROOM_DATA':
      return { ...state, currentRoom: action.payload };
    case 'CLEAR_ROOM_DATA':
      return { ...state, currentRoom: null, participants: [] };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'ADD_PARTICIPANT':
      return { ...state, participants: [...state.participants, action.payload] };
    case 'REMOVE_PARTICIPANT':
      return { ...state, participants: state.participants.filter(p => p.id !== action.payload) };
    case 'TOGGLE_MIC':
      return { ...state, mediaStatus: { ...state.mediaStatus, mic: !state.mediaStatus.mic } };
    case 'TOGGLE_CAMERA':
      return { ...state, mediaStatus: { ...state.mediaStatus, camera: !state.mediaStatus.camera } };
    case 'TOGGLE_SCREEN_SHARE':
      return { ...state, mediaStatus: { ...state.mediaStatus, screenShare: !state.mediaStatus.screenShare } };
    case 'TOGGLE_RECORDING':
      return { ...state, mediaStatus: { ...state.mediaStatus, recording: !state.mediaStatus.recording } };
    default:
      return state;
  }
};

const codeReducer = (state = initialCodeState, action) => {
  switch (action.type) {
    case 'SET_CURRENT_FILE':
      return { ...state, currentFile: action.payload };
    case 'UPDATE_CODE':
      return { ...state, content: action.payload.content };
    case 'ADD_COLLABORATOR':
      return { ...state, collaborators: [...state.collaborators, action.payload] };
    case 'REMOVE_COLLABORATOR':
      return { ...state, collaborators: state.collaborators.filter(c => c.id !== action.payload) };
    default:
      return state;
  }
};

const whiteboardReducer = (state = initialWhiteboardState, action) => {
  switch (action.type) {
    case 'UPDATE_WHITEBOARD':
      return { ...state, drawings: [...state.drawings, action.payload] };
    case 'SET_TOOL':
      return { ...state, currentTool: action.payload };
    case 'SET_COLOR':
      return { ...state, color: action.payload };
    case 'SET_SIZE':
      return { ...state, size: action.payload };
    case 'CLEAR_WHITEBOARD':
      return { ...state, drawings: [] };
    default:
      return state;
  }
};

const chatReducer = (state = initialChatState, action) => {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_UNREAD_COUNT':
      return { ...state, unreadCount: action.payload };
    case 'CLEAR_CHAT':
      return { ...state, messages: [], unreadCount: 0 };
    default:
      return state;
  }
};

const pollReducer = (state = initialPollState, action) => {
  switch (action.type) {
    case 'CREATE_POLL':
      return { ...state, activePoll: action.payload };
    case 'UPDATE_POLL':
      return { ...state, polls: [...state.polls, action.payload] };
    case 'END_POLL':
      return { ...state, activePoll: null };
    default:
      return state;
  }
};

// Combine reducers
const rootReducer = combineReducers({
  auth: authReducer,
  room: roomReducer,
  code: codeReducer,
  whiteboard: whiteboardReducer,
  chat: chatReducer,
  poll: pollReducer
});

// Create store
const store = createStore(rootReducer, applyMiddleware(thunk));

export default store; 