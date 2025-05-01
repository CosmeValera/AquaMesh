import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  IconButton,
  useTheme,
  useMediaQuery
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import WidgetsIcon from '@mui/icons-material/Widgets';
import CreateIcon from '@mui/icons-material/Create';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const options = [
    {
      title: 'Use predefined dashboards',
      description: 'Open one of the existing dashboards to quickly visualize your data.',
      icon: <DashboardIcon fontSize="large" color="primary" />,
      buttonText: 'Open Dashboards Menu',
      action: () => {
        // Close modal and programmatically click the dashboards button
        onClose();
        const dashboardsButton = document.querySelector('[data-tutorial-id="dashboards-button"]');
        if (dashboardsButton) {
          (dashboardsButton as HTMLElement).click();
        }
      }
    },
    {
      title: 'Add widgets to your dashboard',
      description: 'Create a new view and add predefined widgets to customize your experience.',
      icon: <WidgetsIcon fontSize="large" color="primary" />,
      buttonText: 'Open Widgets Menu',
      action: () => {
        // Close modal and programmatically click the widgets button
        onClose();
        const widgetsButton = document.querySelector('[data-tutorial-id="widgets-button"]');
        if (widgetsButton) {
          (widgetsButton as HTMLElement).click();
        }
      }
    },
    {
      title: 'Create custom widgets',
      description: 'Use the Widget Editor to create your own custom widgets and save them for later use.',
      icon: <CreateIcon fontSize="large" color="primary" />,
      buttonText: 'Open Widget Editor',
      action: () => {
        // Close modal and programmatically click create widget option
        onClose();
        const widgetsButton = document.querySelector('[data-tutorial-id="widgets-button"]');
        if (widgetsButton) {
          (widgetsButton as HTMLElement).click();
          // We need to wait for the menu to open before clicking the create widget option
          setTimeout(() => {
            const createWidgetOption = document.querySelector('[data-tutorial-id="create-widget-option"]');
            if (createWidgetOption) {
              (createWidgetOption as HTMLElement).click();
            }
          }, 100);
        }
      }
    }
  ];

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      aria-labelledby="tutorial-dialog-title"
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          boxShadow: 24,
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
      fullScreen={isMobile}
    >
      <DialogTitle id="tutorial-dialog-title" sx={{ bgcolor: 'primary.main', color: 'white', pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" component="div" fontWeight="bold">
            Welcome to AquaMesh
          </Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box my={3}>
          <Typography variant="h6" gutterBottom>
            Get started with these options:
          </Typography>
          
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {options.map((option, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Paper
                  elevation={3}
                  sx={{
                    p: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'center',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: 6,
                    }
                  }}
                >
                  <Box>
                    <Box mb={2}>{option.icon}</Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      {option.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {option.description}
                    </Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={option.action}
                    sx={{ mt: 2 }}
                  >
                    {option.buttonText}
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button 
          onClick={onClose} 
          color="primary"
          variant="outlined"
        >
          Close
        </Button>
        <Box>
          <Button 
            onClick={() => {
              localStorage.setItem('aquamesh-tutorial-shown', 'true');
              onClose();
            }} 
            color="primary"
          >
            Don't show again
          </Button>
          <Button 
            onClick={onClose} 
            color="primary" 
            variant="contained"
            sx={{ ml: 1 }}
          >
            Got it!
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default TutorialModal; 