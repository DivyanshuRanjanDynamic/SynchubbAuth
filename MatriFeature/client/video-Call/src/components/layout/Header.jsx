import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Box,
  Avatar,
  Menu,
  MenuItem,
  useTheme
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications,
  Settings,
  ExitToApp,
  Person,
  Group
} from '@mui/icons-material';

const Header = ({ roomName, userName, onLeaveRoom }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLeaveRoom = () => {
    handleMenuClose();
    onLeaveRoom();
  };

  return (
    <AppBar position="static" elevation={0}>
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <Group sx={{ mr: 1 }} />
          <Typography variant="h6" component="div">
            {roomName}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton color="inherit" sx={{ mr: 2 }}>
            <Notifications />
          </IconButton>

          <IconButton color="inherit" sx={{ mr: 2 }}>
            <Settings />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: theme.palette.primary.main,
                width: 32,
                height: 32,
                mr: 1
              }}
            >
              {userName.charAt(0)}
            </Avatar>
            <Typography variant="body1" sx={{ mr: 2 }}>
              {userName}
            </Typography>
          </Box>

          <IconButton
            color="inherit"
            onClick={handleMenuClick}
          >
            <Person />
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              <Person sx={{ mr: 1 }} /> Profile
            </MenuItem>
            <MenuItem onClick={handleMenuClose}>
              <Settings sx={{ mr: 1 }} /> Settings
            </MenuItem>
            <MenuItem onClick={handleLeaveRoom}>
              <ExitToApp sx={{ mr: 1 }} /> Leave Room
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header; 