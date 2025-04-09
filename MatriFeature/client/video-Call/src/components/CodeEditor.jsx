import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { Box, Paper, AppBar, Tabs, Tab, IconButton, Tooltip } from '@mui/material';
import {
  PlayArrow as RunIcon,
  Save as SaveIcon,
  FolderOpen as OpenIcon,
  Create as NewFileIcon,
  Code as FormatIcon,
  BugReport as DebugIcon
} from '@mui/icons-material';

export const CodeEditor = ({ socket, roomId }) => {
  const editorRef = useRef(null);
  const monacoEl = useRef(null);
  const [activeTab, setActiveTab] = useState(0);
  const [tabs, setTabs] = useState([]);
  const [decorations, setDecorations] = useState([]);

  useEffect(() => {
    if (monacoEl.current) {
      const editor = monaco.editor.create(monacoEl.current, {
        value: '',
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        tabSize: 2,
        wordWrap: 'on',
        contextmenu: true,
        rulers: [80],
        bracketPairColorization: { enabled: true },
      });

      editorRef.current = editor;

      editor.onDidChangeModelContent(() => {
        const content = editor.getValue();
        if (tabs[activeTab]) {
          socket.emit('documentChanged', {
            roomId,
            filename: tabs[activeTab].filename,
            content,
            version: Date.now()
          });
        }
      });

      editor.onDidChangeCursorPosition(e => {
        socket.emit('cursorMoved', {
          roomId,
          filename: tabs[activeTab]?.filename,
          position: e.position,
          userId: socket.id
        });
      });

      return () => editor.dispose();
    }
  }, [monacoEl.current]);

  useEffect(() => {
    socket.on('documentChanged', ({ filename, content, userId }) => {
      if (userId !== socket.id && tabs[activeTab]?.filename === filename) {
        const position = editorRef.current?.getPosition();
        editorRef.current?.setValue(content);
        if (position) editorRef.current?.setPosition(position);
      }
    });

    socket.on('cursorMoved', ({ filename, position, userId }) => {
      if (userId !== socket.id && tabs[activeTab]?.filename === filename) {
        const newDecorations = [{
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column + 1
          ),
          options: {
            className: 'remote-cursor',
            hoverMessage: { value: `Cursor: ${userId}` }
          }
        }];
        setDecorations(editorRef.current?.deltaDecorations(decorations, newDecorations) || []);
      }
    });

    socket.on('diagnostics', ({ filename, diagnostics }) => {
      if (tabs[activeTab]?.filename === filename) {
        monaco.editor.setModelMarkers(
          editorRef.current?.getModel() || null,
          'owner',
          diagnostics.map(d => ({
            ...d,
            severity: monaco.MarkerSeverity.Error
          }))
        );
      }
    });

    return () => {
      socket.off('documentChanged');
      socket.off('cursorMoved');
      socket.off('diagnostics');
    };
  }, [socket, activeTab, tabs]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (tabs[newValue]) {
      editorRef.current?.setValue(tabs[newValue].content);
      editorRef.current?.updateOptions({ language: tabs[newValue].language });
    }
  };

  const handleNewFile = () => {
    const newTab = {
      id: Date.now().toString(),
      filename: `untitled-${tabs.length + 1}.js`,
      language: 'javascript',
      content: ''
    };
    setTabs([...tabs, newTab]);
    setActiveTab(tabs.length);
  };

  const handleSave = () => {
    if (tabs[activeTab]) {
      socket.emit('saveFile', {
        roomId,
        filename: tabs[activeTab].filename,
        content: editorRef.current?.getValue() || ''
      });
    }
  };

  const handleFormat = () => {
    if (tabs[activeTab]) {
      socket.emit('formatDocument', {
        roomId,
        filename: tabs[activeTab].filename
      }, response => {
        if (response.success && response.content) {
          editorRef.current?.setValue(response.content);
        }
      });
    }
  };

  const handleRun = () => {
    if (tabs[activeTab]) {
      socket.emit('runCode', {
        roomId,
        filename: tabs[activeTab].filename,
        content: editorRef.current?.getValue() || ''
      });
    }
  };

  const handleDebug = () => {
    if (tabs[activeTab]) {
      socket.emit('debugCode', {
        roomId,
        filename: tabs[activeTab].filename,
        content: editorRef.current?.getValue() || ''
      });
    }
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default">
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ flex: 1 }}
          >
            {tabs.map((tab, index) => (
              <Tab key={tab.id} label={tab.filename} />
            ))}
          </Tabs>
          <Box sx={{ display: 'flex', px: 1 }}>
            <Tooltip title="New File">
              <IconButton onClick={handleNewFile} size="small">
                <NewFileIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Save">
              <IconButton onClick={handleSave} size="small">
                <SaveIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Format">
              <IconButton onClick={handleFormat} size="small">
                <FormatIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Run">
              <IconButton onClick={handleRun} size="small">
                <RunIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Debug">
              <IconButton onClick={handleDebug} size="small">
                <DebugIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </AppBar>
      <Box
        ref={monacoEl}
        sx={{
          flex: 1,
          overflow: 'hidden',
          '& .remote-cursor': {
            backgroundColor: '#007fd4',
            width: '2px !important',
            marginLeft: '-1px'
          }
        }}
      />
    </Paper>
  );
};