import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  useTheme,
  CircularProgress
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { socketService } from '../../services/socket';
import { fileService } from '../../services/api';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DeleteIcon from '@mui/icons-material/Delete';

const FileShare = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentRoom } = useSelector(state => state.room);
  const { files } = useSelector(state => state.fileShare);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  useEffect(() => {
    // Subscribe to file updates
    socketService.on('file:update', handleFileUpdate);
    return () => {
      socketService.off('file:update', handleFileUpdate);
    };
  }, []);

  const handleFileUpdate = (update) => {
    dispatch({ type: 'UPDATE_FILES', payload: update });
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      formData.append('files', file);
      
      // Track upload progress
      setUploadProgress(prev => ({
        ...prev,
        [file.name]: 0
      }));
    }

    try {
      const response = await fileService.uploadFiles(currentRoom.id, formData, (progress) => {
        setUploadProgress(prev => ({
          ...prev,
          [progress.fileName]: progress.percentage
        }));
      });

      // Send file update to other users
      socketService.sendFileUpdate({
        roomId: currentRoom.id,
        files: response.files
      });

      dispatch({ type: 'ADD_FILES', payload: response.files });
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  const handleFileDownload = async (file) => {
    try {
      const response = await fileService.downloadFile(currentRoom.id, file.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleFileDelete = async (file) => {
    try {
      await fileService.deleteFile(currentRoom.id, file.id);
      dispatch({ type: 'REMOVE_FILE', payload: file.id });
      
      // Notify other users
      socketService.sendFileUpdate({
        roomId: currentRoom.id,
        action: 'delete',
        fileId: file.id
      });
    } catch (error) {
      console.error('Error deleting file:', error);
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
        <Typography variant="h6">File Share</Typography>
        <Button
          variant="contained"
          component="label"
          startIcon={<CloudUploadIcon />}
          disabled={uploading}
        >
          Upload Files
          <input
            type="file"
            multiple
            hidden
            onChange={handleFileUpload}
          />
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
          {files.map((file) => (
            <ListItem
              key={file.id}
              sx={{
                mb: 1,
                backgroundColor: theme.palette.background.paper,
                borderRadius: 1
              }}
            >
              <ListItemText
                primary={file.name}
                secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
              />
              <ListItemSecondaryAction>
                {uploadProgress[file.name] !== undefined ? (
                  <CircularProgress
                    variant="determinate"
                    value={uploadProgress[file.name]}
                    size={24}
                  />
                ) : (
                  <>
                    <IconButton
                      edge="end"
                      onClick={() => handleFileDownload(file)}
                    >
                      <CloudDownloadIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      onClick={() => handleFileDelete(file)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default FileShare; 