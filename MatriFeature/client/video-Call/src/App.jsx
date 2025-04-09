import React, { useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useSelector, useDispatch } from 'react-redux';
import store from './store';
import MainLayout from './components/layout/MainLayout';
import theme from './theme';
import { authService } from './services/api';

// Import feature components
import VideoCall from './components/features/VideoCall';
import CodeEditor from './components/features/CodeEditor';
import Whiteboard from './components/features/Whiteboard';
import FileShare from './components/features/FileShare';
import Notes from './components/features/Notes';
import Terminal from './components/features/Terminal';
import Debugger from './components/features/Debugger';
import CodeIntelligence from './components/features/CodeIntelligence';
import GitIntegration from './components/features/GitIntegration';
import Recording from './components/features/Recording';
import Transcription from './components/features/Transcription';
import Settings from './components/features/Settings';
import Participants from './components/features/Participants';
import Login from './components/auth/Login';
import Register from './components/auth/Register';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useSelector(state => state.auth);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector(state => state.auth);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          const user = await authService.getProfile();
          dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        }
      } catch (error) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    };

    checkAuth();
  }, [dispatch]);

  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />

        {/* Protected Routes */}
        <Route path="/" element={
          <PrivateRoute>
            <MainLayout>
              <VideoCall />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/call" element={
          <PrivateRoute>
            <MainLayout>
              <VideoCall />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/screen-share" element={
          <PrivateRoute>
            <MainLayout>
              <VideoCall screenShare />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/code-editor" element={
          <PrivateRoute>
            <MainLayout>
              <CodeEditor />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/whiteboard" element={
          <PrivateRoute>
            <MainLayout>
              <Whiteboard />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/file-share" element={
          <PrivateRoute>
            <MainLayout>
              <FileShare />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/notes" element={
          <PrivateRoute>
            <MainLayout>
              <Notes />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/terminal" element={
          <PrivateRoute>
            <MainLayout>
              <Terminal />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/debugger" element={
          <PrivateRoute>
            <MainLayout>
              <Debugger />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/code-intelligence" element={
          <PrivateRoute>
            <MainLayout>
              <CodeIntelligence />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/git" element={
          <PrivateRoute>
            <MainLayout>
              <GitIntegration />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/recording" element={
          <PrivateRoute>
            <MainLayout>
              <Recording />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/transcription" element={
          <PrivateRoute>
            <MainLayout>
              <Transcription />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/settings" element={
          <PrivateRoute>
            <MainLayout>
              <Settings />
            </MainLayout>
          </PrivateRoute>
        } />

        <Route path="/participants" element={
          <PrivateRoute>
            <MainLayout>
              <Participants />
            </MainLayout>
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
};

const App = () => {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppContent />
      </ThemeProvider>
    </Provider>
  );
};

export default App; 