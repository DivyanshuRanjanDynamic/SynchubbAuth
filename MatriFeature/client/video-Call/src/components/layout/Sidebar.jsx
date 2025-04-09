import React, { useState } from 'react';
import { 
  Box, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Collapse,
  IconButton,
  useTheme
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Videocam,
  ScreenShare,
  Chat,
  Poll,
  Code,
  Brush,
  Folder,
  Note,
  Terminal,
  BugReport,
  Psychology,
  GitHub,
  FiberManualRecord,
  Mic,
  Settings,
  People
} from '@mui/icons-material';

const featureCategories = [
  {
    name: 'Communication',
    icon: <Videocam />,
    features: [
      { name: 'Video/Audio Call', icon: <Videocam />, path: '/call' },
      { name: 'Screen Share', icon: <ScreenShare />, path: '/screen-share' },
      { name: 'Chat', icon: <Chat />, path: '/chat' },
      { name: 'Polls', icon: <Poll />, path: '/polls' }
    ]
  },
  {
    name: 'Collaboration',
    icon: <Code />,
    features: [
      { name: 'Code Editor', icon: <Code />, path: '/code-editor' },
      { name: 'Whiteboard', icon: <Brush />, path: '/whiteboard' },
      { name: 'File Share', icon: <Folder />, path: '/file-share' },
      { name: 'Notes', icon: <Note />, path: '/notes' }
    ]
  },
  {
    name: 'Development',
    icon: <Terminal />,
    features: [
      { name: 'Terminal', icon: <Terminal />, path: '/terminal' },
      { name: 'Debugger', icon: <BugReport />, path: '/debugger' },
      { name: 'Code Intelligence', icon: <Psychology />, path: '/code-intelligence' },
      { name: 'Git Integration', icon: <GitHub />, path: '/git' }
    ]
  },
  {
    name: 'Meeting Tools',
    icon: <FiberManualRecord />,
    features: [
      { name: 'Recording', icon: <FiberManualRecord />, path: '/recording' },
      { name: 'Transcription', icon: <Mic />, path: '/transcription' },
      { name: 'Room Settings', icon: <Settings />, path: '/settings' },
      { name: 'Participants', icon: <People />, path: '/participants' }
    ]
  }
];

const Sidebar = () => {
  const theme = useTheme();
  const [openCategories, setOpenCategories] = useState({});

  const handleCategoryClick = (categoryName) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  return (
    <Box sx={{
      width: 240,
      borderRight: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
      height: '100%',
      overflow: 'auto'
    }}>
      <List component="nav">
        {featureCategories.map((category) => (
          <React.Fragment key={category.name}>
            <ListItem 
              button 
              onClick={() => handleCategoryClick(category.name)}
              sx={{
                '&:hover': {
                  backgroundColor: theme.palette.action.hover
                }
              }}
            >
              <ListItemIcon>
                {category.icon}
              </ListItemIcon>
              <ListItemText primary={category.name} />
              {openCategories[category.name] ? <ExpandLess /> : <ExpandMore />}
            </ListItem>
            <Collapse in={openCategories[category.name]} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {category.features.map((feature) => (
                  <ListItem 
                    button 
                    key={feature.name}
                    sx={{ pl: 4 }}
                  >
                    <ListItemIcon>
                      {feature.icon}
                    </ListItemIcon>
                    <ListItemText primary={feature.name} />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default Sidebar; 