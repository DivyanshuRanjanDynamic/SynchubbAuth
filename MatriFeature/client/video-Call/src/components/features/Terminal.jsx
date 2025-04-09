import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  useTheme
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { socketService } from '../../services/socket';
import { terminalService } from '../../services/api';
import { XTerm } from 'xterm-for-react';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const Terminal = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentRoom } = useSelector(state => state.room);
  const xtermRef = useRef(null);
  const fitAddon = new FitAddon();
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    // Subscribe to terminal updates
    socketService.on('terminal:output', handleTerminalOutput);
    return () => {
      socketService.off('terminal:output', handleTerminalOutput);
    };
  }, []);

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.terminal.loadAddon(fitAddon);
      fitAddon.fit();
      xtermRef.current.terminal.writeln('Welcome to the collaborative terminal!');
      xtermRef.current.terminal.writeln('Type your commands below:');
    }
  }, []);

  const handleTerminalOutput = (output) => {
    if (xtermRef.current) {
      xtermRef.current.terminal.write(output);
    }
  };

  const handleCommandSubmit = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (!command.trim()) return;

      // Add command to history
      setCommandHistory(prev => [...prev, command]);
      setHistoryIndex(-1);

      try {
        // Send command to server
        socketService.sendTerminalCommand({
          roomId: currentRoom.id,
          command: command
        });

        // Clear input
        setCommand('');
      } catch (error) {
        console.error('Error executing command:', error);
        if (xtermRef.current) {
          xtermRef.current.terminal.writeln(`Error: ${error.message}`);
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
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
        <Typography variant="h6">Terminal</Typography>
      </Paper>

      <Paper
        elevation={3}
        sx={{
          flex: 1,
          overflow: 'hidden',
          p: 2
        }}
      >
        <XTerm
          ref={xtermRef}
          options={{
            theme: {
              background: theme.palette.background.paper,
              foreground: theme.palette.text.primary
            },
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'monospace'
          }}
        />
      </Paper>

      <Paper
        elevation={3}
        sx={{
          p: 2,
          mt: 2
        }}
      >
        <TextField
          fullWidth
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleCommandSubmit}
          placeholder="Enter command..."
          variant="outlined"
          InputProps={{
            startAdornment: (
              <Typography
                sx={{
                  mr: 1,
                  color: theme.palette.primary.main
                }}
              >
                $
              </Typography>
            )
          }}
        />
      </Paper>
    </Box>
  );
};

export default Terminal; 