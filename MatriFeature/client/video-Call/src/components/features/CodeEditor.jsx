import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { socketService } from '../../services/socket';
import { codeService } from '../../services/api';
import Editor from '@monaco-editor/react';

const CodeEditor = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentRoom, currentFile } = useSelector(state => state.code);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const editorRef = useRef(null);

  useEffect(() => {
    if (currentFile) {
      loadFile();
    }
  }, [currentFile]);

  useEffect(() => {
    // Subscribe to code updates
    socketService.on('code:update', handleCodeUpdate);
    return () => {
      socketService.off('code:update', handleCodeUpdate);
    };
  }, []);

  const loadFile = async () => {
    try {
      const response = await codeService.getCode(currentRoom.id, currentFile);
      setCode(response.content);
      setLanguage(response.language || 'javascript');
    } catch (error) {
      console.error('Error loading file:', error);
    }
  };

  const handleCodeUpdate = (update) => {
    if (update.fileId === currentFile) {
      setCode(update.content);
    }
  };

  const handleEditorChange = (value) => {
    setCode(value);
    if (currentFile) {
      socketService.sendCodeUpdate({
        roomId: currentRoom.id,
        fileId: currentFile,
        content: value
      });
    }
  };

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
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
        <Typography variant="h6">
          {currentFile || 'Select a file to edit'}
        </Typography>
      </Paper>

      <Paper
        elevation={3}
        sx={{
          flex: 1,
          overflow: 'hidden'
        }}
      >
        <Editor
          height="100%"
          defaultLanguage={language}
          value={code}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            theme: theme.palette.mode === 'dark' ? 'vs-dark' : 'vs-light'
          }}
        />
      </Paper>
    </Box>
  );
};

export default CodeEditor; 