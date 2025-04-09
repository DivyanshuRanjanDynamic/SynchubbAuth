import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  useTheme,
  CircularProgress
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { socketService } from '../../services/socket';
import { recordingService } from '../../services/api';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';

const Recording = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentRoom } = useSelector(state => state.room);
  const { recordings, isRecording } = useSelector(state => state.recording);
  const [recordingStatus, setRecordingStatus] = useState('idle');

  useEffect(() => {
    // Subscribe to recording updates
    socketService.on('recording:update', handleRecordingUpdate);
    return () => {
      socketService.off('recording:update', handleRecordingUpdate);
    };
  }, []);

  const handleRecordingUpdate = (update) => {
    dispatch({ type: 'UPDATE_RECORDING', payload: update });
  };

  const handleStartRecording = async () => {
    try {
      setRecordingStatus('starting');
      await recordingService.startRecording(currentRoom.id);
      setRecordingStatus('recording');
      
      // Send recording update to other users
      socketService.sendRecordingUpdate({
        roomId: currentRoom.id,
        action: 'start'
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingStatus('idle');
    }
  };

  const handleStopRecording = async () => {
    try {
      setRecordingStatus('stopping');
      await recordingService.stopRecording(currentRoom.id);
      setRecordingStatus('idle');
      
      // Send recording update to other users
      socketService.sendRecordingUpdate({
        roomId: currentRoom.id,
        action: 'stop'
      });
    } catch (error) {
      console.error('Error stopping recording:', error);
      setRecordingStatus('recording');
    }
  };

  const handleDownloadRecording = async (recordingId) => {
    try {
      const response = await recordingService.downloadRecording(currentRoom.id, recordingId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recording-${recordingId}.mp4`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading recording:', error);
    }
  };

  const handleDeleteRecording = async (recordingId) => {
    try {
      await recordingService.deleteRecording(currentRoom.id, recordingId);
      
      // Send recording update to other users
      socketService.sendRecordingUpdate({
        roomId: currentRoom.id,
        action: 'delete',
        recordingId
      });

      dispatch({ type: 'REMOVE_RECORDING', payload: recordingId });
    } catch (error) {
      console.error('Error deleting recording:', error);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper
        elevation={3}
        sx={{
          p: 2,
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography variant="h6">Recording</Typography>
        {recordingStatus === 'idle' ? (
          <Button
            variant="contained"
            color="error"
            startIcon={<FiberManualRecordIcon />}
            onClick={handleStartRecording}
          >
            Start Recording
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<StopIcon />}
            onClick={handleStopRecording}
            disabled={recordingStatus === 'stopping'}
          >
            {recordingStatus === 'stopping' ? (
              <CircularProgress size={24} />
            ) : (
              'Stop Recording'
            )}
          </Button>
        )}
      </Paper>

      <Paper
        elevation={3}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2
        }}
      >
        <List>
          {recordings.map((recording) => (
            <ListItem
              key={recording.id}
              sx={{
                mb: 1,
                backgroundColor: theme.palette.background.paper,
                borderRadius: 1
              }}
            >
              <ListItemText
                primary={new Date(recording.createdAt).toLocaleString()}
                secondary={`Duration: ${recording.duration} seconds`}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => handleDownloadRecording(recording.id)}
                >
                  <DownloadIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => handleDeleteRecording(recording.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default Recording; 