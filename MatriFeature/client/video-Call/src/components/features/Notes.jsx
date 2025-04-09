import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  useTheme
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { socketService } from '../../services/socket';
import { notesService } from '../../services/api';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';

const Notes = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentRoom } = useSelector(state => state.room);
  const { notes } = useSelector(state => state.notes);
  const [editingNote, setEditingNote] = useState(null);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    // Subscribe to note updates
    socketService.on('notes:update', handleNotesUpdate);
    return () => {
      socketService.off('notes:update', handleNotesUpdate);
    };
  }, []);

  const handleNotesUpdate = (update) => {
    dispatch({ type: 'UPDATE_NOTES', payload: update });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      const response = await notesService.addNote(currentRoom.id, {
        content: newNote
      });

      // Send note update to other users
      socketService.sendNotesUpdate({
        roomId: currentRoom.id,
        action: 'add',
        note: response.note
      });

      dispatch({ type: 'ADD_NOTE', payload: response.note });
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleUpdateNote = async (note) => {
    try {
      const response = await notesService.updateNote(currentRoom.id, note.id, {
        content: note.content
      });

      // Send note update to other users
      socketService.sendNotesUpdate({
        roomId: currentRoom.id,
        action: 'update',
        note: response.note
      });

      dispatch({ type: 'UPDATE_NOTE', payload: response.note });
      setEditingNote(null);
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await notesService.deleteNote(currentRoom.id, noteId);

      // Send note update to other users
      socketService.sendNotesUpdate({
        roomId: currentRoom.id,
        action: 'delete',
        noteId
      });

      dispatch({ type: 'REMOVE_NOTE', payload: noteId });
    } catch (error) {
      console.error('Error deleting note:', error);
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
        <Typography variant="h6">Notes</Typography>
      </Paper>

      <Paper
        elevation={3}
        sx={{
          p: 2,
          mb: 2
        }}
      >
        <TextField
          fullWidth
          multiline
          rows={2}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a new note..."
          variant="outlined"
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddNote();
            }
          }}
        />
      </Paper>

      <Paper
        elevation={3}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2
        }}
      >
        {notes.map((note) => (
          <Paper
            key={note.id}
            elevation={1}
            sx={{
              p: 2,
              mb: 2,
              backgroundColor: theme.palette.background.paper
            }}
          >
            {editingNote?.id === note.id ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  value={editingNote.content}
                  onChange={(e) => setEditingNote({
                    ...editingNote,
                    content: e.target.value
                  })}
                  variant="outlined"
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <IconButton
                    onClick={() => handleUpdateNote(editingNote)}
                    color="primary"
                  >
                    <SaveIcon />
                  </IconButton>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography>{note.content}</Typography>
                <Box>
                  <IconButton
                    onClick={() => setEditingNote(note)}
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDeleteNote(note.id)}
                    size="small"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Box>
            )}
          </Paper>
        ))}
      </Paper>
    </Box>
  );
};

export default Notes; 