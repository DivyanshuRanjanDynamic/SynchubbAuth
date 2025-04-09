import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { socketService } from '../../services/socket';
import { whiteboardService } from '../../services/api';

const Whiteboard = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentRoom } = useSelector(state => state.room);
  const { drawings } = useSelector(state => state.whiteboard);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(2);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      redrawCanvas();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  useEffect(() => {
    // Subscribe to whiteboard updates
    socketService.on('whiteboard:update', handleWhiteboardUpdate);
    return () => {
      socketService.off('whiteboard:update', handleWhiteboardUpdate);
    };
  }, []);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawings.forEach(drawing => {
      ctx.beginPath();
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = drawing.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      drawing.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      
      ctx.stroke();
    });
  };

  const handleWhiteboardUpdate = (update) => {
    dispatch({ type: 'UPDATE_WHITEBOARD', payload: update });
    redrawCanvas();
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const drawing = {
      id: Date.now(),
      tool,
      color,
      size,
      points: [{ x, y }]
    };

    dispatch({ type: 'ADD_DRAWING', payload: drawing });
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    dispatch({ type: 'UPDATE_DRAWING', payload: { x, y } });
    redrawCanvas();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Send drawing to server
    const currentDrawing = drawings[drawings.length - 1];
    if (currentDrawing) {
      socketService.sendWhiteboardUpdate({
        roomId: currentRoom.id,
        drawing: currentDrawing
      });
    }
  };

  const clearWhiteboard = () => {
    dispatch({ type: 'CLEAR_WHITEBOARD' });
    redrawCanvas();
    socketService.sendWhiteboardUpdate({
      roomId: currentRoom.id,
      action: 'clear'
    });
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
        <Typography variant="h6">Whiteboard</Typography>
        <Box>
          <select value={tool} onChange={(e) => setTool(e.target.value)}>
            <option value="pen">Pen</option>
            <option value="eraser">Eraser</option>
          </select>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <input
            type="range"
            min="1"
            max="10"
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value))}
          />
          <button onClick={clearWhiteboard}>Clear</button>
        </Box>
      </Paper>

      <Paper
        elevation={3}
        sx={{
          flex: 1,
          overflow: 'hidden'
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{
            width: '100%',
            height: '100%',
            cursor: 'crosshair'
          }}
        />
      </Paper>
    </Box>
  );
};

export default Whiteboard; 