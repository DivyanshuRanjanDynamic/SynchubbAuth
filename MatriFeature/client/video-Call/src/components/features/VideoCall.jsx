import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Grid,
  Button,
  useTheme,
  CircularProgress,
  Tooltip,
  Menu,
  MenuItem,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  ScreenShare,
  StopScreenShare,
  CallEnd,
  VolumeUp,
  VolumeOff,
  Settings,
  Security
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { socketService } from '../../services/socket';
import { deviceService } from '../../services/device';
import { roomService } from '../../services/room';
import { mediasoupService } from '../../services/mediasoup';
import { logger } from '../../services/logger';
import { useAuth } from '../../hooks/useAuth';
import { permissionsService } from '../../services/permissions';

const VideoCall = ({ roomId, onLeave }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentRoom } = useSelector(state => state.room);
  const { user, token } = useAuth();
  
  // Refs
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef(new Map());
  const peerConnectionsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const settingsAnchorRef = useRef(null);
  const metricsIntervalRef = useRef(null);
  
  // State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const [quality, setQuality] = useState('high');
  const [securityAlert, setSecurityAlert] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    cpu: 0,
    memory: 0,
    network: 0
  });

  // Initialize WebRTC
  useEffect(() => {
    const initializeCall = async () => {
      try {
        setIsConnecting(true);
        
        // Initialize permissions service
        await permissionsService.initialize(user.id, roomId);
        
        // Set up authentication
        socketService.setAuthToken(token);

        // Initialize Mediasoup with security context
        await mediasoupService.initialize(roomId, {
          userId: user.id,
          token
        });

        // Create transports with security checks
        await mediasoupService.createProducerTransport();
        await mediasoupService.createConsumerTransport();

        // Get local stream with permissions check
        const stream = await mediasoupService.initializeLocalStream({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        });

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Start producing media with quality settings
        await mediasoupService.produceMedia(stream, {
          quality: 'high',
          simulcast: true
        });

        // Set up socket listeners with error handling
        setupSocketListeners();

        // Start performance monitoring
        startPerformanceMonitoring();

        logger.info('Video call initialized successfully');
        setIsConnecting(false);
      } catch (error) {
        logger.error('Failed to initialize video call:', error);
        handleError(error);
        setIsConnecting(false);
      }
    };

    initializeCall();

    return () => {
      cleanup();
      permissionsService.cleanup();
    };
  }, [roomId, token, user.id]);

  const setupSocketListeners = useCallback(() => {
    // Handle security events
    socketService.on('security:alert', (alert) => {
      setSecurityAlert(alert);
      logger.warn('Security alert:', alert);
    });

    // Handle performance metrics
    socketService.on('performance:metrics', (metrics) => {
      setPerformanceMetrics(metrics);
    });

    // Handle new participants with permission check
    socketService.on('newParticipant', async ({ participantId, permissions }) => {
      const hasPermission = await permissionsService.checkParticipantPermissions(participantId, roomId);
      if (hasPermission) {
        setParticipants(prev => [...prev, participantId]);
      } else {
        logger.warn(`Participant ${participantId} denied access due to insufficient permissions`);
      }
    });

    // Handle participant leaving with cleanup
    socketService.on('participantLeft', ({ participantId }) => {
      setParticipants(prev => prev.filter(id => id !== participantId));
      handleParticipantLeft(participantId);
    });

    // Handle new producers with permission check
    socketService.on('newProducer', async ({ producerId, kind, permissions }) => {
      const hasPermission = await permissionsService.checkProducerPermissions(producerId, roomId, kind);
      if (hasPermission) {
        try {
          const { stream } = await mediasoupService.consumeMedia(producerId, kind);
          remoteVideosRef.current.set(producerId, stream);
          updateParticipants();
        } catch (error) {
          logger.error('Failed to consume new producer:', error);
        }
    } else {
        logger.warn(`Producer ${producerId} denied access due to insufficient permissions`);
      }
    });

    // Handle producer closed with cleanup
    socketService.on('producerClosed', ({ producerId }) => {
      handleParticipantLeft(producerId);
    });
  }, [roomId]);

  const startPerformanceMonitoring = useCallback(() => {
    metricsIntervalRef.current = setInterval(async () => {
      try {
        const metrics = await mediasoupService.getPerformanceMetrics();
        setPerformanceMetrics(metrics);
        
        // Adjust quality based on performance
        if (metrics.cpu > 80 || metrics.memory > 80) {
          await handleQualityChange('medium');
        }
      } catch (error) {
        logger.error('Failed to get performance metrics:', error);
      }
    }, 5000);
  }, []);

  const handleError = useCallback((error) => {
    let errorMessage = 'An error occurred';
    
    if (error.code === 'NotAllowedError') {
      errorMessage = 'Camera/microphone access denied';
    } else if (error.code === 'NotFoundError') {
      errorMessage = 'No camera/microphone found';
    } else if (error.code === 'SecurityError') {
      errorMessage = 'Security violation detected';
      setSecurityAlert({
        type: 'security',
        message: 'Security violation detected'
      });
    }

    setError(errorMessage);
    logger.error('Video call error:', error);
  }, []);

  const handleParticipantLeft = useCallback((participantId) => {
    const peerConnection = peerConnectionsRef.current.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      peerConnectionsRef.current.delete(participantId);
    }

    const remoteVideo = remoteVideosRef.current.get(participantId);
    if (remoteVideo) {
      remoteVideo.srcObject = null;
      remoteVideosRef.current.delete(participantId);
    }

    setParticipants(prev => prev.filter(p => p.id !== participantId));
  }, []);

  const handleIceCandidate = async ({ candidate, source }) => {
    try {
      const peerConnection = peerConnectionsRef.current.get(source);
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  };

  const handleOffer = async ({ offer, source }) => {
    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Add local stream
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.emit('ice:candidate', {
            roomId: currentRoom.id,
            candidate: event.candidate,
            target: source
          });
        }
      };

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        const remoteVideo = document.createElement('video');
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        remoteVideo.srcObject = event.streams[0];
        remoteVideosRef.current.set(source, remoteVideo);
        updateParticipants();
      };

      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socketService.emit('answer', {
        roomId: currentRoom.id,
        answer,
        target: source
      });

      peerConnectionsRef.current.set(source, peerConnection);
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async ({ answer, source }) => {
    try {
      const peerConnection = peerConnectionsRef.current.get(source);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await mediasoupService.startScreenShare();
        setIsScreenSharing(true);
      } else {
        await mediasoupService.stopScreenShare();
        setIsScreenSharing(false);
      }
    } catch (error) {
      logger.error('Failed to toggle screen share:', error);
      setError('Failed to toggle screen share. Please try again.');
    }
  };

  const handleQualityChange = async (newQuality) => {
    try {
      await mediasoupService.setStreamQuality(newQuality);
      setQuality(newQuality);
      setIsSettingsOpen(false);
    } catch (error) {
      handleError(error);
    }
  };

  const leaveCall = async () => {
    try {
      await roomService.leaveRoom(currentRoom.id);
      cleanup();
      onLeave();
    } catch (err) {
      console.error('Error leaving call:', err);
    }
  };

  const cleanup = useCallback(async () => {
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
    }
    // Close all peer connections
    peerConnectionsRef.current.forEach(peerConnection => {
      peerConnection.close();
    });
    peerConnectionsRef.current.clear();

    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Clear remote videos
    remoteVideosRef.current.forEach(video => {
      video.srcObject = null;
    });
    remoteVideosRef.current.clear();

    // Remove socket listeners
    socketService.off('participant:joined');
    socketService.off('participant:left');
    socketService.off('ice:candidate');
    socketService.off('offer');
    socketService.off('answer');

    await mediasoupService.cleanup();
    localStreamRef.current = null;
    remoteVideosRef.current = new Map();
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
  }, []);

  const updateParticipants = () => {
    const updatedParticipants = Array.from(remoteVideosRef.current.entries()).map(([id, video]) => ({
      id,
      video
    }));
    setParticipants(updatedParticipants);
  };

  // Helper functions for security checks
  const checkParticipantPermissions = async (permissions) => {
    // Implement your permission checking logic
    return true;
  };

  const checkProducerPermissions = async (permissions) => {
    // Implement your permission checking logic
    return true;
  };

  if (isConnecting) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Typography color="error">{error}</Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Error display */}
      {error && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.main', color: 'white' }}>
          <Typography>{error}</Typography>
        </Paper>
      )}

      {/* Security alert */}
      {securityAlert && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {securityAlert.message}
        </Alert>
      )}

      {/* Performance metrics */}
      <Paper sx={{ p: 1, mb: 2, display: 'flex', justifyContent: 'space-around' }}>
        <Typography>CPU: {performanceMetrics.cpu}%</Typography>
        <Typography>Memory: {performanceMetrics.memory}%</Typography>
        <Typography>Network: {performanceMetrics.network}bps</Typography>
      </Paper>

      {/* Video grid */}
      <Grid container spacing={2} sx={{ flex: 1, p: 2 }}>
        {/* Local video */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper
            elevation={2}
            sx={{
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: theme.palette.background.default
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                p: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white'
              }}
            >
              <Typography variant="body2">
                {user.username} (You)
            </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Remote videos */}
        {participants.map((participant) => (
          <Grid key={participant.id} item xs={12} md={6} lg={4}>
                <Paper
              elevation={2}
                  sx={{
                height: '100%',
                    position: 'relative',
                overflow: 'hidden',
                backgroundColor: theme.palette.background.default
                  }}
                >
                  <video
                ref={(el) => {
                  if (el) {
                    el.srcObject = participant.video.srcObject;
                  }
                }}
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
              <Box
                    sx={{
                      position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  p: 1,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white'
                    }}
                  >
                <Typography variant="body2">
                    {participant.username}
                  </Typography>
              </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>

      {/* Controls */}
      <Paper sx={{ p: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Tooltip title={isMuted ? "Unmute" : "Mute"}>
          <IconButton
            color={isMuted ? "error" : "primary"}
            onClick={toggleMute}
          >
            {isMuted ? <MicOff /> : <Mic />}
          </IconButton>
        </Tooltip>

        <Tooltip title={isVideoOff ? "Turn on camera" : "Turn off camera"}>
          <IconButton
            color={isVideoOff ? "error" : "primary"}
            onClick={toggleVideo}
          >
            {isVideoOff ? <VideocamOff /> : <Videocam />}
          </IconButton>
        </Tooltip>

        <Tooltip title={isScreenSharing ? "Stop sharing" : "Share screen"}>
          <IconButton
            color={isScreenSharing ? "error" : "primary"}
            onClick={toggleScreenShare}
          >
            {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
          </IconButton>
        </Tooltip>

        <IconButton
          ref={settingsAnchorRef}
          color="primary"
          onClick={() => setIsSettingsOpen(true)}
          title="Settings"
        >
          <Settings />
        </IconButton>

        <IconButton
          color="error"
          onClick={leaveCall}
          title="Leave call"
        >
          <CallEnd />
        </IconButton>
      </Paper>

      {/* Settings menu */}
      <Menu
        anchorEl={settingsAnchorRef.current}
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      >
        <MenuItem onClick={() => handleQualityChange('low')} selected={quality === 'low'}>
          Low Quality
        </MenuItem>
        <MenuItem onClick={() => handleQualityChange('medium')} selected={quality === 'medium'}>
          Medium Quality
        </MenuItem>
        <MenuItem onClick={() => handleQualityChange('high')} selected={quality === 'high'}>
          High Quality
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default VideoCall; 