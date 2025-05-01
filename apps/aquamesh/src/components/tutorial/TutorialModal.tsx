import React, { useState } from 'react';
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
import CreateIcon from '@mui/icons-material/Create';
import InfoIcon from '@mui/icons-material/Info';
import DashboardWidgetExplanationModal from './DashboardWidgetExplanationModal';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
  onShowOnStartupToggle?: () => void;
}

// Base64 placeholder images until real ones are created
const placeholderImages = {
  dashboardWidgetExplanation: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y1ZjVmNSIvPgo8cmVjdCB4PSI1MCIgeT0iNTAiIHdpZHRoPSIxNTAiIGhlaWdodD0iOTAiIGZpbGw9IiM2N2JjZDIiIHN0cm9rZT0iIzIxOTZmMyIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxyZWN0IHg9IjI1MCIgeT0iNTAiIHdpZHRoPSIxNTAiIGhlaWdodD0iOTAiIGZpbGw9IiM4MmQzYTQiIHN0cm9rZT0iIzRjYWY1MCIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxyZWN0IHg9IjUwIiB5PSIxNzAiIHdpZHRoPSIzNTAiIGhlaWdodD0iNTAiIGZpbGw9IiNmZmQxODAiIHN0cm9rZT0iI2ZmOTgwMCIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjx0ZXh0IHg9IjEyNSIgeT0iOTUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzMzMyI+V2lkZ2V0IDE8L3RleHQ+Cjx0ZXh0IHg9IjMyNSIgeT0iOTUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzMzMyI+V2lkZ2V0IDI8L3RleHQ+Cjx0ZXh0IHg9IjIyNSIgeT0iMTk1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiMzMzMiPkRhc2hib2FyZDwvdGV4dD4KPHBvbHlsaW5lIHBvaW50cz0iMjI1LDE1MCAxMDAsMTUwIDEwMCwxNDUiIHN0cm9rZT0iI2ZmMDAwMCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtZGFzaGFycmF5PSI1LDUiIGZpbGw9Im5vbmUiLz4KPHBvbHlsaW5lIHBvaW50cz0iMjI1LDE1MCAzNTAsMTUwIDM1MCwxNDUiIHN0cm9rZT0iI2ZmMDAwMCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtZGFzaGFycmF5PSI1LDUiIGZpbGw9Im5vbmUiLz4KPHRleHQgeD0iMTAwIiB5PSIxNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iI2ZmMDAwMCI+V2lkZ2V0czwvdGV4dD4KPHRleHQgeD0iMjI1IiB5PSIxNjUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iI2ZmMDAwMCI+RGFzaGJvYXJkIENvbnRhaW5lcjwvdGV4dD4KPC9zdmc+`,
  predefinedDashboards: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y1ZjVmNSIvPgo8cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyMDAiIGhlaWdodD0iMTgwIiBmaWxsPSIjZWVlIiBzdHJva2U9IiNkZGQiIHN0cm9rZS13aWR0aD0iMiIvPgo8cmVjdCB4PSIzMCIgeT0iMzAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI1MCIgZmlsbD0iIzk1YjhmMiIgc3Ryb2tlPSIjM2Y1MWI1IiBzdHJva2Utd2lkdGg9IjIiLz4KPHJlY3QgeD0iMTIwIiB5PSIzMCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZTU4YWE5IiBzdHJva2U9IiNlOTFlNjMiIHN0cm9rZS13aWR0aD0iMiIvPgo8cmVjdCB4PSIzMCIgeT0iOTAiIHdpZHRoPSIxNzAiIGhlaWdodD0iNTAiIGZpbGw9IiNhNWQ2YTciIHN0cm9rZT0iIzRjYWY1MCIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxyZWN0IHg9IjMwIiB5PSIxNTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI0MCIgZmlsbD0iI2ZmZjU5ZCIgc3Ryb2tlPSIjZmZlYjNiIiBzdHJva2Utd2lkdGg9IjIiLz4KPHJlY3QgeD0iMTIwIiB5PSIxNTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI0MCIgZmlsbD0iI2ZmY2M4MCIgc3Ryb2tlPSIjZmY5ODAwIiBzdHJva2Utd2lkdGg9IjIiLz4KPHJlY3QgeD0iMjQwIiB5PSIyMCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmZmYiIHN0cm9rZT0iI2RkZCIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxyZWN0IHg9IjI3MCIgeT0iNzAiIHdpZHRoPSIxNDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjZTFlMWUxIiBzdHJva2U9IiNiZGJkYmQiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIzNDAiIGN5PSI0MCIgcj0iMTUiIGZpbGw9IiM0Y2FmNTAiLz4KPHBvbHlsaW5lIHBvaW50cz0iMjM1LDcwIDMyMCw3MCIgc3Ryb2tlPSIjZmYwMDAwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1kYXNoYXJyYXk9IjUsMCIgZmlsbD0ibm9uZSIgbWFya2VyLWVuZD0idXJsKCNhcnJvd2hlYWQpIi8+Cjx0ZXh0IHg9IjExNSIgeT0iMTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzMzMyI+UHJlZGVmaW5lZCBEYXNoYm9hcmRzPC90ZXh0Pgo8dGV4dCB4PSIzNDAiIHk9IjEwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiMzMzMiPldpZGdldCBMaWJyYXJ5PC90ZXh0Pgo8dGV4dCB4PSIyNTAiIHk9IjYwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiNmZjAwMDAiPkFkZCB3aWRnZXRzIHRvIGRhc2hib2FyZDwvdGV4dD4KPGRlZnM+CiAgPG1hcmtlciBpZD0iYXJyb3doZWFkIiBtYXJrZXJXaWR0aD0iMTAiIG1hcmtlckhlaWdodD0iNyIgcmVmWD0iMCIgcmVmWT0iMy41IiBvcmllbnQ9ImF1dG8iPgogICAgPHBvbHlnb24gcG9pbnRzPSIwIDAsIDEwIDMuNSwgMCA3IiBmaWxsPSIjZmYwMDAwIi8+CiAgPC9tYXJrZXI+CjwvZGVmcz4KPC9zdmc+`,
  customWidgetCreation: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y1ZjVmNSIvPgo8cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjhmOGY4IiBzdHJva2U9IiNkZGQiIHN0cm9rZS13aWR0aD0iMiIvPgo8cmVjdCB4PSIyNDAiIHk9IjIwIiB3aWR0aD0iMjIwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjZGRkIiBzdHJva2Utd2lkdGg9IjIiLz4KPHJlY3QgeD0iMzAiIHk9IjQwIiB3aWR0aD0iMTYwIiBoZWlnaHQ9IjExMCIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMjE5NmYzIiBzdHJva2Utd2lkdGg9IjIiLz4KPHRleHQgeD0iMTEwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzMzIj5XaWRnZXQgRWRpdG9yPC90ZXh0Pgo8dGV4dCB4PSIzNTAiIHk9IjUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiMzMzMiPkN1c3RvbSBEYXNoYm9hcmQ8L3RleHQ+CjxyZWN0IHg9IjQwIiB5PSI3MCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjYmJkZWZiIiBzdHJva2U9IiMyMTk2ZjMiIHN0cm9rZS13aWR0aD0iMiIvPgo8cmVjdCB4PSIxMjAiIHk9IjcwIiB3aWR0aD0iNjAiIGhlaWdodD0iMzAiIGZpbGw9IiNjOGU2YzkiIHN0cm9rZT0iIzRjYWY1MCIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxyZWN0IHg9IjQwIiB5PSIxMTAiIHdpZHRoPSIxNDAiIGhlaWdodD0iMzAiIGZpbGw9IiNmZmVjYjMiIHN0cm9rZT0iI2ZmOTgwMCIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxyZWN0IHg9IjcwIiB5PSIxNzAiIHdpZHRoPSI4MCIgaGVpZ2h0PSIzMCIgZmlsbD0iI2U4ZWFmNiIgc3Ryb2tlPSIjM2Y1MWI1IiBzdHJva2Utd2lkdGg9IjIiLz4KPHRleHQgeD0iMTEwIiB5PSIxODgiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzMzMyI+U2F2ZTwvdGV4dD4KPHJlY3QgeD0iMjcwIiB5PSI3MCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjYmJkZWZiIiBzdHJva2U9IiMyMTk2ZjMiIHN0cm9rZS13aWR0aD0iMiIvPgo8cmVjdCB4PSIzNjAiIHk9IjcwIiB3aWR0aD0iODAiIGhlaWdodD0iNjAiIGZpbGw9IiNjOGU2YzkiIHN0cm9rZT0iIzRjYWY1MCIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxyZWN0IHg9IjI3MCIgeT0iMTQwIiB3aWR0aD0iMTcwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZmZlY2IzIiBzdHJva2U9IiNmZjk4MDAiIHN0cm9rZS13aWR0aD0iMiIvPgo8cG9seWxpbmUgcG9pbnRzPSIyMDAsMTAwIDI0MCwxMDAiIHN0cm9rZT0iI2ZmMDAwMCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSI1LDUiIGZpbGw9Im5vbmUiIG1hcmtlci1lbmQ9InVybCgjYXJyb3doZWFkKSIvPgo8dGV4dCB4PSIyMjAiIHk9IjkwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiNmZjAwMDAiPkFkZCB0byBkYXNoYm9hcmQ8L3RleHQ+CjxkZWZzPgogIDxtYXJrZXIgaWQ9ImFycm93aGVhZCIgbWFya2VyV2lkdGg9IjEwIiBtYXJrZXJIZWlnaHQ9IjciIHJlZlg9IjAiIHJlZlk9IjMuNSIgb3JpZW50PSJhdXRvIj4KICAgIDxwb2x5Z29uIHBvaW50cz0iMCAwLCAxMCAzLjUsIDAgNyIgZmlsbD0iI2ZmMDAwMCIvPgogIDwvbWFya2VyPgo8L2RlZnM+Cjwvc3ZnPg==`
}

const TutorialModal: React.FC<TutorialModalProps> = ({ open, onClose, onShowOnStartupToggle }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [explanationModalOpen, setExplanationModalOpen] = useState(false);
  const tutorialShown = localStorage.getItem('aquamesh-tutorial-shown');

  const options = [
    {
      title: 'Understanding Dashboards & Widgets',
      description: 'Learn the core concepts of AquaMesh: Dashboards are containers that organize multiple widgets into a layout. Widgets are individual components that display specific data or functionality.',
      icon: <InfoIcon fontSize="large" color="primary" />,
      buttonText: 'Learn more',
      image: placeholderImages.dashboardWidgetExplanation,
      action: () => {
        // Open the explanation modal
        setExplanationModalOpen(true)
      }
    },
    {
      title: 'Use Predefined Dashboards & Widgets',
      description: 'Choose from existing dashboards and add predefined widgets to visualize your data effectively.',
      icon: <DashboardIcon fontSize="large" color="primary" />,
      image: placeholderImages.predefinedDashboards,
      // Instead of a single button, we'll render two buttons in the template
      hasMultipleButtons: true,
      buttons: [
        {
          text: 'Open Dashboard Menu',
          action: () => {
            // Close modal and programmatically click the dashboards button
            onClose()
            const dashboardsButton = document.querySelector('[data-tutorial-id="dashboards-button"]')
            if (dashboardsButton) {
              (dashboardsButton as HTMLElement).click()
            }
          }
        },
        {
          text: 'Open Widgets Menu',
          action: () => {
            // Close modal and programmatically click the widgets button
            onClose()
            const widgetsButton = document.querySelector('[data-tutorial-id="widgets-button"]')
            if (widgetsButton) {
              (widgetsButton as HTMLElement).click()
            }
          }
        }
      ]
    },
    {
      title: 'Create Custom Widgets & Dashboards',
      description: 'Design your own widgets with the Widget Editor and save custom dashboards that fit your specific needs.',
      icon: <CreateIcon fontSize="large" color="primary" />,
      buttonText: 'Open Widget Editor',
      image: placeholderImages.customWidgetCreation,
      action: () => {
        // Close modal and programmatically click create widget option
        onClose()
        const widgetsButton = document.querySelector('[data-tutorial-id="widgets-button"]')
        if (widgetsButton) {
          (widgetsButton as HTMLElement).click()
          // We need to wait for the menu to open before clicking the create widget option
          setTimeout(() => {
            const createWidgetOption = document.querySelector('[data-tutorial-id="create-widget-option"]')
            if (createWidgetOption) {
              (createWidgetOption as HTMLElement).click()
            }
          }, 100)
        }
      }
    }
  ]

  return (
    <>
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
                <Grid item xs={12} key={index} className="tutorial-option">
                  <Paper
                    elevation={3}
                    sx={{
                      p: 3,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: 6,
                      },
                      mb: 3
                    }}
                  >
                    <Box sx={{ width: '100%' }}>
                      <Box mb={2} display="flex" justifyContent="center">
                        {option.icon}
                      </Box>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {option.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {option.description}
                      </Typography>
                      
                      {/* Image with arrows */}
                      <Box 
                        sx={{ 
                          mt: 2, 
                          mb: 3, 
                          width: '100%', 
                          height: '180px',
                          backgroundColor: 'rgba(0,0,0,0.03)',
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {option.image ? (
                          <img 
                            src={option.image} 
                            alt={`${option.title} illustration`}
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '100%',
                              objectFit: 'contain'
                            }}
                          />
                        ) : (
                          <Typography color="text.secondary">
                            Illustration placeholder
                          </Typography>
                        )}
                      </Box>
                      
                      {/* Render either multiple buttons or a single button */}
                      {option.hasMultipleButtons ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                          {option.buttons.map((button, btnIndex) => (
                            <Button 
                              key={btnIndex}
                              variant="contained" 
                              color="primary" 
                              onClick={button.action}
                            >
                              {button.text}
                            </Button>
                          ))}
                        </Box>
                      ) : (
                        <Button 
                          variant="contained" 
                          color="primary" 
                          onClick={option.action}
                          sx={{ mt: 2 }}
                        >
                          {option.buttonText}
                        </Button>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'flex-end' }}>
          <Box>
            {tutorialShown ? (
              <Button 
                onClick={() => {
                  localStorage.removeItem('aquamesh-tutorial-shown')
                  if (onShowOnStartupToggle) onShowOnStartupToggle()
                  onClose()
                }} 
                variant="outlined"
                color="primary"
              >
                Show on startup
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  localStorage.setItem('aquamesh-tutorial-shown', 'true')
                  if (onShowOnStartupToggle) onShowOnStartupToggle()
                  onClose()
                }} 
                variant="outlined"
                color="primary"
              >
                Don&apos;t show again
              </Button>
            )}
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

      {/* The detailed explanation modal */}
      <DashboardWidgetExplanationModal
        open={explanationModalOpen}
        onClose={() => setExplanationModalOpen(false)}
      />
    </>
  )
};

export default TutorialModal; 