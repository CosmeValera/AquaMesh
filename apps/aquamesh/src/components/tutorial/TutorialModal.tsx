import React, { useState, useEffect } from 'react'
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
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DashboardIcon from '@mui/icons-material/Dashboard'
import CreateIcon from '@mui/icons-material/Create'
import InfoIcon from '@mui/icons-material/Info'
import DashboardWidgetExplanationModal from './DashboardWidgetExplanationModal'

interface TutorialModalProps {
  open: boolean
  onClose: () => void
  onShowOnStartupToggle?: () => void
}

// Base64 placeholder images until real ones are created
const placeholderImages = {
  dashboardWidgetExplanation: '/images/understanding_dashboards.png',
  predefinedDashboards: `/images/predefined_dashboards.png`,
  predefinedWidgets: `/images/predefined_widgets.png`,
  customWidgetCreation: `/images/widget_editor.png`
}

const TutorialModal: React.FC<TutorialModalProps> = ({ open, onClose, onShowOnStartupToggle }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [explanationModalOpen, setExplanationModalOpen] = useState(false)
  const tutorialShown = localStorage.getItem('aquamesh-tutorial-shown')
  
  // Check if user is admin
  const [isAdmin, setIsAdmin] = useState(false)
  
  useEffect(() => {
    // Check user role from localStorage
    try {
      const storedUserData = localStorage.getItem('userData')
      if (storedUserData) {
        const userData = JSON.parse(storedUserData)
        setIsAdmin(userData.id === 'admin' && userData.role === 'ADMIN_ROLE')
      }
    } catch (error) {
      console.error('Failed to parse user data', error)
    }
  }, [])

  const options = [
    {
      title: 'Understand Dashboards & Widgets',
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
      title: isAdmin ? 'OPTION 1: Use Predefined Dashboards & Widgets' : 'Use Predefined Dashboards & Widgets',
      description: 'Choose from existing dashboards and add predefined widgets to visualize your data effectively.',
      icon: <DashboardIcon fontSize="large" color="primary" />,
      // Instead of a single image, we'll display two images
      hasMultipleImages: true,
      images: [
        {
          src: placeholderImages.predefinedDashboards,
          alt: 'Predefined Dashboards illustration'
        },
        {
          src: placeholderImages.predefinedWidgets,
          alt: 'Predefined Widgets illustration'
        }
      ],
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
  ]
  
  // Add Option 2 only for admin users
  if (isAdmin) {
    options.push({
      title: 'OPTION 2: Create Custom Widgets & Dashboards',
      description: 'Design your own widgets with the Widget Editor and save custom dashboards that fit your specific needs.',
      icon: <CreateIcon fontSize="large" color="primary" />,
      buttonText: 'Open Widget Editor',
      image: placeholderImages.customWidgetCreation,
      action: () => {
        // Close modal and programmatically click the widget editor button directly
        onClose()
        const createWidgetButton = document.querySelector('[data-tutorial-id="create-widget-button"]')
        if (createWidgetButton) {
          (createWidgetButton as HTMLElement).click()
        }
      }
    })
  }

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
            <Typography variant="h5" component="div" fontWeight="bold" sx={{color: '#191919'}}>
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
            <Grid container spacing={4} sx={{ mt: 2 }}>
              {options.map((option, index) => (
                <Grid item xs={12} key={index} className="tutorial-option">
                  <Paper
                    elevation={3}
                    sx={{
                      p: 3,
                      width: '100%',
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
                      <Typography variant="h6" fontWeight="bold" gutterBottom color="#f9f9f9">
                        {option.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph color="#f9f9f9">
                        {option.description}
                      </Typography>
                      
                      {/* Image with arrows */}
                      <Box 
                        sx={{ 
                          mt: 2, 
                          mb: 3, 
                          maxWidth: '100%', 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {option.hasMultipleImages ? (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2 }}>
                            {option.images.map((image, imgIndex) => (
                              <img 
                                key={imgIndex}
                                src={image.src} 
                                alt={image.alt}
                                style={{ 
                                  maxWidth: '48%', 
                                  maxHeight: '100%',
                                  objectFit: 'contain',
                                  border: '1px solid rgb(238, 238, 238)',
                                  borderRadius: '4px',
                                  backgroundColor: 'background.paper'
                                }}
                              />
                            ))}
                          </Box>
                        ) : option.image ? (
                          <img 
                            src={option.image} 
                            alt={`${option.title} illustration`}
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '100%',
                              objectFit: 'contain',
                              border: '1px solid rgb(238, 238, 238)',
                              borderRadius: '4px',
                              backgroundColor: 'background.paper'
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
                              onClick={button.action}
                              sx={{color:"#191919"}}
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
                          sx={{ mt: 2, color: '#191919' }}
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
                  if (onShowOnStartupToggle) { 
                    onShowOnStartupToggle()
                  }
                  onClose()
                }} 
                variant="text"
                sx={{color: '#191919', ":hover": {background: '#00C49A99'}}}
              >
                Show on startup
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  localStorage.setItem('aquamesh-tutorial-shown', 'true')
                  if (onShowOnStartupToggle) { 
                    onShowOnStartupToggle()
                  }
                  onClose()
                }} 
                variant="text"
                sx={{color: '#191919', ":hover": {background: '#00C49A99'}}}
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
}

export default TutorialModal