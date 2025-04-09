import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Typography,
  Tabs,
  Tab,
  Paper,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

export const GitHubSync = ({ socket, roomId }) => {
  const [repositories, setRepositories] = useState([]);
  const [issues, setIssues] = useState([]);
  const [projects, setProjects] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addRepoDialog, setAddRepoDialog] = useState(false);
  const [newRepoOwner, setNewRepoOwner] = useState('');
  const [newRepoName, setNewRepoName] = useState('');

  useEffect(() => {
    socket.on('githubRepositoryAdded', ({ repository }) => {
      setRepositories(prev => [...prev, repository]);
    });

    socket.on('githubRepositoryRemoved', ({ owner, repo }) => {
      setRepositories(prev => prev.filter(r => !(r.owner === owner && r.repo === repo)));
    });

    socket.on('githubIssuesSynced', ({ issues }) => {
      setIssues(issues);
    });

    socket.on('githubProjectsSynced', ({ projects }) => {
      setProjects(projects);
    });

    socket.on('githubMilestonesSynced', ({ milestones }) => {
      setMilestones(milestones);
    });

    return () => {
      socket.off('githubRepositoryAdded');
      socket.off('githubRepositoryRemoved');
      socket.off('githubIssuesSynced');
      socket.off('githubProjectsSynced');
      socket.off('githubMilestonesSynced');
    };
  }, [socket]);

  const handleAddRepository = async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve, reject) => {
        socket.emit('addGitHubRepository', {
          roomId,
          owner: newRepoOwner,
          repo: newRepoName
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
      setAddRepoDialog(false);
      setNewRepoOwner('');
      setNewRepoName('');
    } catch (err) {
      setError(err.message || 'Failed to add repository');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRepository = async (owner, repo) => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve, reject) => {
        socket.emit('removeGitHubRepository', { roomId, owner, repo }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      setError(err.message || 'Failed to remove repository');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (owner, repo) => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        new Promise((resolve, reject) => {
          socket.emit('syncGitHubIssues', { roomId, owner, repo }, (response) => {
            if (response.success) resolve(response);
            else reject(new Error(response.error));
          });
        }),
        new Promise((resolve, reject) => {
          socket.emit('syncGitHubProjects', { roomId, owner, repo }, (response) => {
            if (response.success) resolve(response);
            else reject(new Error(response.error));
          });
        }),
        new Promise((resolve, reject) => {
          socket.emit('syncGitHubMilestones', { roomId, owner, repo }, (response) => {
            if (response.success) resolve(response);
            else reject(new Error(response.error));
          });
        })
      ]);
    } catch (err) {
      setError(err.message || 'Failed to sync data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">GitHub Synchronization</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddRepoDialog(true)}
        >
          Add Repository
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={selectedTab}
          onChange={(_, newValue) => setSelectedTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Repositories" />
          <Tab label="Issues" />
          <Tab label="Projects" />
          <Tab label="Milestones" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {selectedTab === 0 && (
            <List>
              {repositories.map(({ owner, repo }) => (
                <ListItem
                  key={`${owner}/${repo}`}
                  secondaryAction={
                    <Box>
                      <IconButton onClick={() => handleSync(owner, repo)} disabled={loading}>
                        <RefreshIcon />
                      </IconButton>
                      <IconButton onClick={() => handleRemoveRepository(owner, repo)} disabled={loading}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText primary={`${owner}/${repo}`} />
                </ListItem>
              ))}
            </List>
          )}

          {selectedTab === 1 && (
            <List>
              {issues.map(issue => (
                <ListItem key={issue.number}>
                  <ListItemText
                    primary={issue.title}
                    secondary={`#${issue.number} - ${issue.state} - Updated: ${new Date(issue.updated_at).toLocaleDateString()}`}
                  />
                  <Chip label={issue.state} color={issue.state === 'open' ? 'success' : 'default'} />
                </ListItem>
              ))}
            </List>
          )}

          {selectedTab === 2 && (
            <List>
              {projects.map(project => (
                <ListItem key={project.number}>
                  <ListItemText
                    primary={project.title}
                    secondary={`#${project.number} - ${project.state}`}
                  />
                  <Chip label={project.state} />
                </ListItem>
              ))}
            </List>
          )}

          {selectedTab === 3 && (
            <List>
              {milestones.map(milestone => (
                <ListItem key={milestone.number}>
                  <ListItemText
                    primary={milestone.title}
                    secondary={`#${milestone.number} - ${milestone.state} - Due: ${milestone.due_on ? new Date(milestone.due_on).toLocaleDateString() : 'No due date'}`}
                  />
                  <Chip label={milestone.state} color={milestone.state === 'open' ? 'success' : 'default'} />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Paper>

      <Dialog open={addRepoDialog} onClose={() => setAddRepoDialog(false)}>
        <DialogTitle>Add GitHub Repository</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Owner"
            fullWidth
            value={newRepoOwner}
            onChange={(e) => setNewRepoOwner(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Repository"
            fullWidth
            value={newRepoName}
            onChange={(e) => setNewRepoName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddRepoDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAddRepository}
            disabled={loading || !newRepoOwner || !newRepoName}
          >
            {loading ? <CircularProgress size={24} /> : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};