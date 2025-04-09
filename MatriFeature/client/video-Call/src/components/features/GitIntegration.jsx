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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  CircularProgress
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { socketService } from '../../services/socket';
import { gitService } from '../../services/api';
import GitHubIcon from '@mui/icons-material/GitHub';
import SyncIcon from '@mui/icons-material/Sync';
import CreateIcon from '@mui/icons-material/Create';
import DeleteIcon from '@mui/icons-material/Delete';

const GitIntegration = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentRoom } = useSelector(state => state.room);
  const { repositories, syncStatus } = useSelector(state => state.git);
  const [openDialog, setOpenDialog] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Subscribe to Git updates
    socketService.on('git:update', handleGitUpdate);
    return () => {
      socketService.off('git:update', handleGitUpdate);
    };
  }, []);

  const handleGitUpdate = (update) => {
    dispatch({ type: 'UPDATE_GIT', payload: update });
  };

  const handleCreateRepository = async () => {
    try {
      const response = await gitService.createRepository(currentRoom.id, {
        name: newRepoName
      });

      // Send Git update to other users
      socketService.sendGitUpdate({
        roomId: currentRoom.id,
        action: 'create',
        repository: response.repository
      });

      dispatch({ type: 'ADD_REPOSITORY', payload: response.repository });
      setOpenDialog(false);
      setNewRepoName('');
    } catch (error) {
      console.error('Error creating repository:', error);
    }
  };

  const handleSyncRepository = async (repoId) => {
    try {
      setSyncing(true);
      await gitService.syncRepository(currentRoom.id, repoId);
      
      // Send Git update to other users
      socketService.sendGitUpdate({
        roomId: currentRoom.id,
        action: 'sync',
        repositoryId: repoId
      });
    } catch (error) {
      console.error('Error syncing repository:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteRepository = async (repoId) => {
    try {
      await gitService.deleteRepository(currentRoom.id, repoId);
      
      // Send Git update to other users
      socketService.sendGitUpdate({
        roomId: currentRoom.id,
        action: 'delete',
        repositoryId: repoId
      });

      dispatch({ type: 'REMOVE_REPOSITORY', payload: repoId });
    } catch (error) {
      console.error('Error deleting repository:', error);
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
        <Typography variant="h6">Git Integration</Typography>
        <Button
          variant="contained"
          startIcon={<CreateIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Create Repository
        </Button>
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
          {repositories.map((repo) => (
            <ListItem
              key={repo.id}
              sx={{
                mb: 1,
                backgroundColor: theme.palette.background.paper,
                borderRadius: 1
              }}
            >
              <ListItemIcon>
                <GitHubIcon />
              </ListItemIcon>
              <ListItemText
                primary={repo.name}
                secondary={repo.url}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => handleSyncRepository(repo.id)}
                  disabled={syncing}
                >
                  {syncing ? (
                    <CircularProgress size={24} />
                  ) : (
                    <SyncIcon />
                  )}
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => handleDeleteRepository(repo.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Create New Repository</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Repository Name"
            fullWidth
            value={newRepoName}
            onChange={(e) => setNewRepoName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateRepository}
            variant="contained"
            disabled={!newRepoName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GitIntegration; 