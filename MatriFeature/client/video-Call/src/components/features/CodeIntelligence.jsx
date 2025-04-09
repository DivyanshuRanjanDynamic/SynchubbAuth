import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  useTheme
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { socketService } from '../../services/socket';
import { codeIntelligenceService } from '../../services/api';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import CodeIcon from '@mui/icons-material/Code';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

const CodeIntelligence = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentRoom } = useSelector(state => state.room);
  const { errors, warnings, suggestions, codeMetrics } = useSelector(state => state.codeIntelligence);

  useEffect(() => {
    // Subscribe to code intelligence updates
    socketService.on('code-intelligence:update', handleCodeIntelligenceUpdate);
    return () => {
      socketService.off('code-intelligence:update', handleCodeIntelligenceUpdate);
    };
  }, []);

  const handleCodeIntelligenceUpdate = (update) => {
    dispatch({ type: 'UPDATE_CODE_INTELLIGENCE', payload: update });
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
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
        <Typography variant="h6">Code Intelligence</Typography>
      </Paper>

      <Box sx={{ display: 'flex', flex: 1, gap: 2 }}>
        {/* Errors and Warnings Panel */}
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>Issues</Typography>
          <List>
            {errors.map((error, index) => (
              <ListItem key={`error-${index}`}>
                <ListItemIcon>
                  {getSeverityIcon('error')}
                </ListItemIcon>
                <ListItemText
                  primary={error.message}
                  secondary={`Line ${error.line}: ${error.file}`}
                />
              </ListItem>
            ))}
            {warnings.map((warning, index) => (
              <ListItem key={`warning-${index}`}>
                <ListItemIcon>
                  {getSeverityIcon('warning')}
                </ListItemIcon>
                <ListItemText
                  primary={warning.message}
                  secondary={`Line ${warning.line}: ${warning.file}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Suggestions Panel */}
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>Suggestions</Typography>
          <List>
            {suggestions.map((suggestion, index) => (
              <ListItem key={`suggestion-${index}`}>
                <ListItemIcon>
                  <LightbulbIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={suggestion.message}
                  secondary={`Line ${suggestion.line}: ${suggestion.file}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Code Metrics Panel */}
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>Code Metrics</Typography>
          <List>
            {Object.entries(codeMetrics).map(([metric, value]) => (
              <ListItem key={metric}>
                <ListItemIcon>
                  <CodeIcon />
                </ListItemIcon>
                <ListItemText
                  primary={metric}
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      {typeof value === 'object' ? (
                        Object.entries(value).map(([key, val]) => (
                          <Chip
                            key={key}
                            label={`${key}: ${val}`}
                            size="small"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))
                      ) : (
                        <Chip
                          label={value}
                          size="small"
                        />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Box>
    </Box>
  );
};

export default CodeIntelligence; 