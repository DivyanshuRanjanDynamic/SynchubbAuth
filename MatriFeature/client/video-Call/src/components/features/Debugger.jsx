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
  useTheme
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { socketService } from '../../services/socket';
import { debuggerService } from '../../services/api';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const Debugger = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentRoom } = useSelector(state => state.room);
  const { breakpoints, variables, callStack } = useSelector(state => state.debugger);
  const [isDebugging, setIsDebugging] = useState(false);
  const [currentLine, setCurrentLine] = useState(null);

  useEffect(() => {
    // Subscribe to debugger updates
    socketService.on('debugger:update', handleDebuggerUpdate);
    return () => {
      socketService.off('debugger:update', handleDebuggerUpdate);
    };
  }, []);

  const handleDebuggerUpdate = (update) => {
    switch (update.type) {
      case 'breakpoint':
        dispatch({ type: 'UPDATE_BREAKPOINTS', payload: update.breakpoints });
        break;
      case 'variables':
        dispatch({ type: 'UPDATE_VARIABLES', payload: update.variables });
        break;
      case 'callStack':
        dispatch({ type: 'UPDATE_CALL_STACK', payload: update.callStack });
        break;
      case 'currentLine':
        setCurrentLine(update.line);
        break;
      default:
        break;
    }
  };

  const handleStartDebugging = async () => {
    try {
      await debuggerService.startDebugging(currentRoom.id);
      setIsDebugging(true);
    } catch (error) {
      console.error('Error starting debugging:', error);
    }
  };

  const handleStopDebugging = async () => {
    try {
      await debuggerService.stopDebugging(currentRoom.id);
      setIsDebugging(false);
      setCurrentLine(null);
    } catch (error) {
      console.error('Error stopping debugging:', error);
    }
  };

  const handlePauseDebugging = async () => {
    try {
      await debuggerService.pauseDebugging(currentRoom.id);
    } catch (error) {
      console.error('Error pausing debugging:', error);
    }
  };

  const handleResumeDebugging = async () => {
    try {
      await debuggerService.resumeDebugging(currentRoom.id);
    } catch (error) {
      console.error('Error resuming debugging:', error);
    }
  };

  const handleToggleBreakpoint = async (line) => {
    try {
      if (breakpoints.includes(line)) {
        await debuggerService.removeBreakpoint(currentRoom.id, line);
      } else {
        await debuggerService.addBreakpoint(currentRoom.id, line);
      }
    } catch (error) {
      console.error('Error toggling breakpoint:', error);
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
        <Typography variant="h6">Debugger</Typography>
        <Box>
          {!isDebugging ? (
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={handleStartDebugging}
            >
              Start Debugging
            </Button>
          ) : (
            <>
              <Button
                variant="contained"
                startIcon={<PauseIcon />}
                onClick={handlePauseDebugging}
                sx={{ mr: 1 }}
              >
                Pause
              </Button>
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={handleResumeDebugging}
                sx={{ mr: 1 }}
              >
                Resume
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                onClick={handleStopDebugging}
              >
                Stop
              </Button>
            </>
          )}
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', flex: 1, gap: 2 }}>
        {/* Variables Panel */}
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>Variables</Typography>
          <List>
            {Object.entries(variables).map(([name, value]) => (
              <ListItem key={name}>
                <ListItemText
                  primary={name}
                  secondary={JSON.stringify(value)}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Call Stack Panel */}
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>Call Stack</Typography>
          <List>
            {callStack.map((frame, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={frame.function}
                  secondary={`Line ${frame.line}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Breakpoints Panel */}
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>Breakpoints</Typography>
          <List>
            {breakpoints.map((line) => (
              <ListItem key={line}>
                <ListItemText primary={`Line ${line}`} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => handleToggleBreakpoint(line)}
                  >
                    <RemoveIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      </Box>
    </Box>
  );
};

export default Debugger; 