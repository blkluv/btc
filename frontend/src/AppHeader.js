import React, { useEffect, useState } from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from '@mui/material';

import BuildTime from './BuildTime';

const AppHeader = ({ isAuthenticated, setIsAuthenticated, navigate }) => {

    const [anchorEl, setAnchorEl] = useState(null);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const handleHelpMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleHelpMenuClose = () => {
        setAnchorEl(null);
    };

    const handleAboutClick = () => {
        setAnchorEl(null);
        setAboutOpen(true);
    };

    const handleAboutClose = () => {
        setAboutOpen(false);
    };

    const checkAuthStatus = async () => {
        try {
            const response = await fetch('/check-auth');
            const data = await response.json();
            if (data.message === 'Authenticated') {
                setIsAuthenticated(true);
                setIsAdmin(data.isAdmin);
            } else {
                setIsAuthenticated(false);
                setIsAdmin(false);
            }
        } catch (error) {
            console.error('Error fetching authentication status:', error);
            setIsAuthenticated(false);
            setIsAdmin(false);
        }
    };

    useEffect(() => {
        checkAuthStatus();
    });

    const handleLogin = () => {
        window.open('/login');
    };

    const handleLogout = async () => {
        await fetch('/logout', { method: 'GET', credentials: 'include' });
        navigate('/');
    };

    const handleGettingStartedClick = async () => {
        window.open('https://github.com/macterra/artx-market/wiki/Getting-Started', '_blank');
    };

    return (
        <>
            <AppBar position="static">
                <Toolbar>
                    <Button color="inherit" onClick={() => navigate('/')}>
                        Home
                    </Button>
                    {isAuthenticated && (
                        <Button color="inherit" onClick={() => navigate('/profile')}>
                            Profile
                        </Button>
                    )}
                    {isAdmin &&
                        <Button color="inherit" onClick={() => navigate('/admin')}>
                            Admin
                        </Button>
                    }
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        ArtX Market
                    </Typography>
                    {isAuthenticated ? (
                        <Button color="inherit" onClick={handleLogout}>
                            Logout
                        </Button>
                    ) : (
                        <Button color="inherit" onClick={handleLogin}>
                            Login
                        </Button>
                    )}
                    <Button
                        color="inherit"
                        aria-controls="help-menu"
                        aria-haspopup="true"
                        onClick={handleHelpMenuClick}
                    >
                        Help
                    </Button>
                    <Menu
                        id="help-menu"
                        anchorEl={anchorEl}
                        keepMounted
                        open={Boolean(anchorEl)}
                        onClose={handleHelpMenuClose}
                    >
                        <MenuItem onClick={handleGettingStartedClick}>Getting Started</MenuItem>
                        <MenuItem onClick={handleAboutClick}>About</MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>
            <Dialog onClose={handleAboutClose} open={aboutOpen}>
                <DialogTitle>About ArtX Market</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <BuildTime />
                    </DialogContentText>
                    <DialogContentText>
                        <p>github:
                            <a href="https://github.com/macterra/artx-market" target="_blank" rel="noopener noreferrer">
                                macterra/artx-market
                            </a>
                        </p>
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleAboutClose}>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default AppHeader;
