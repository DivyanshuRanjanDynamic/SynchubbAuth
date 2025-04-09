import React from 'react';
import { 
  Box, 
  Typography, 
  IconButton,
  useTheme,
  Tooltip
} from '@mui/material';
import {
  Wifi,
  WifiOff,
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  ScreenShare,
  ScreenShareOff,
  FiberManualRecord,
  Stop
} from '@mui/icons-material';

const Footer = ({ 
  connectionStatus, 
  micStatus, 
  cameraStatus, 
  screenShareStatus,
  recordingStatus,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleRecording
}) => {
  const theme = useTheme();

  return (
    <Box sx={{
      height: 48,
      borderTop: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: 2
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Tooltip title={connectionStatus ? "Connected" : "Disconnected"}>
          <IconButton color={connectionStatus ? "success" : "error"}>
            {connectionStatus ? <Wifi /> : <WifiOff />}
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title={micStatus ? "Mute" : "Unmute"}>
          <IconButton 
            color={micStatus ? "primary" : "error"}
            onClick={onToggleMic}
          >
            {micStatus ? <Mic /> : <MicOff />}
          </IconButton>
        </Tooltip>

        <Tooltip title={cameraStatus ? "Turn off camera" : "Turn on camera"}>
          <IconButton 
            color={cameraStatus ? "primary" : "error"}
            onClick={onToggleCamera}
          >
            {cameraStatus ? <Videocam /> : <VideocamOff />}
          </IconButton>
        </Tooltip>

        <Tooltip title={screenShareStatus ? "Stop sharing" : "Start sharing"}>
          <IconButton 
            color={screenShareStatus ? "primary" : "default"}
            onClick={onToggleScreenShare}
          >
            {screenShareStatus ? <ScreenShare /> : <ScreenShareOff />}
          </IconButton>
        </Tooltip>

        <Tooltip title={recordingStatus ? "Stop recording" : "Start recording"}>
          <IconButton 
            color={recordingStatus ? "error" : "default"}
            onClick={onToggleRecording}
          >
            {recordingStatus ? <FiberManualRecord /> : <Stop />}
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          MatriFeature v1.0.0
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer; 