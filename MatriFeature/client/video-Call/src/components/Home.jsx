import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Stack
} from '@mui/material';
import { VideoCall as VideoCallIcon } from '@mui/icons-material';
import { socket } from '../utils/socket';

function Home() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');

  const createRoom = async () => {
    try {
      const response = await new Promise((resolve) => {
        socket.emit('createRoom', resolve);
      });

      if (response.error) {
        setError(response.error);
        return;
      }

      navigate(`/room/${response.roomId}`);
    } catch (err) {
      setError('Failed to create room');
    }
  };

  const joinRoom = () => {
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }
    navigate(`/room/${roomId}`);
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, textAlign: 'center' }}>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <VideoCallIcon sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" gutterBottom>
            Video Call App
          </Typography>
          <Stack spacing={2} sx={{ width: '100%', mt: 2 }}>
            <Button
              variant="contained"
              size="large"
              onClick={createRoom}
              startIcon={<VideoCallIcon />}
            >
              Create New Room
            </Button>
            <Typography variant="h6" sx={{ mt: 2 }}>
              OR
            </Typography>
            <TextField
              fullWidth
              label="Room ID"
              variant="outlined"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              error={!!error}
              helperText={error}
            />
            <Button
              variant="outlined"
              size="large"
              onClick={joinRoom}
            >
              Join Room
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
}

export default Home;
