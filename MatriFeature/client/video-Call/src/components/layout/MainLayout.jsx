import React, { useEffect } from 'react';
import { Box, useTheme } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { socketService } from '../../services/socket';
import { roomService } from '../../services/api';

const MainLayout = ({ children }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { currentRoom, connectionStatus, mediaStatus } = useSelector(state => state.room);
  const { isAuthenticated, user } = useSelector(state => state.auth);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Connect to socket server
    socketService.connect();

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, navigate]);

  const handleToggleMic = async () => {
    dispatch({ type: 'TOGGLE_MIC' });
    if (currentRoom) {
      await roomService.updateMediaStatus(currentRoom.id, { mic: !mediaStatus.mic });
    }
  };

  const handleToggleCamera = async () => {
    dispatch({ type: 'TOGGLE_CAMERA' });
    if (currentRoom) {
      await roomService.updateMediaStatus(currentRoom.id, { camera: !mediaStatus.camera });
    }
  };

  const handleToggleScreenShare = async () => {
    dispatch({ type: 'TOGGLE_SCREEN_SHARE' });
    if (currentRoom) {
      await roomService.updateMediaStatus(currentRoom.id, { screenShare: !mediaStatus.screenShare });
    }
  };

  const handleToggleRecording = async () => {
    dispatch({ type: 'TOGGLE_RECORDING' });
    if (currentRoom) {
      if (mediaStatus.recording) {
        await roomService.stopRecording(currentRoom.id);
      } else {
        await roomService.startRecording(currentRoom.id);
      }
    }
  };

  const handleLeaveRoom = async () => {
    if (currentRoom) {
      await roomService.leaveRoom(currentRoom.id);
      socketService.leaveRoom();
      dispatch({ type: 'CLEAR_ROOM_DATA' });
      navigate('/');
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: theme.palette.background.default
    }}>
      <Header 
        roomName={currentRoom?.name || 'No Room'}
        userName={user?.username || 'Guest'}
        onLeaveRoom={handleLeaveRoom}
      />
      
      <Box sx={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        <Sidebar />
        
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          backgroundColor: theme.palette.background.default
        }}>
          {children}
        </Box>
      </Box>

      <Footer
        connectionStatus={connectionStatus}
        micStatus={mediaStatus.mic}
        cameraStatus={mediaStatus.camera}
        screenShareStatus={mediaStatus.screenShare}
        recordingStatus={mediaStatus.recording}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleRecording={handleToggleRecording}
      />
    </Box>
  );
};

export default MainLayout; 