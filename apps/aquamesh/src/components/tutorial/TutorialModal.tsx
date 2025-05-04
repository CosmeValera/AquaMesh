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
  useMediaQuery,
  Fade,
  Zoom
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DashboardIcon from '@mui/icons-material/Dashboard'
import CreateIcon from '@mui/icons-material/Create'
import InfoIcon from '@mui/icons-material/Info'
import DashboardWidgetExplanationModal from './DashboardWidgetExplanationModal'
import WidgetEditorExplanationModal from './WidgetEditorExplanationModal'

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

// Define interfaces for the tutorial options
interface TutorialImage {
  src: string;
  alt: string;
}

interface ButtonOption {
  text: string;
  action: () => void;
}

interface TutorialOption {
  title: string;
  description: string;
  icon: React.ReactElement;
  buttonText?: string;
  image?: string;
  action?: () => void;
  hasMultipleImages?: boolean;
  images?: TutorialImage[];
  hasMultipleButtons?: boolean;
  buttons?: ButtonOption[];
}

const TutorialModal: React.FC<TutorialModalProps> = ({ open, onClose, onShowOnStartupToggle }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [explanationModalOpen, setExplanationModalOpen] = useState(false)
  const [widgetEditorModalOpen, setWidgetEditorModalOpen] = useState(false)
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

  const options: TutorialOption[] = [
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
      description: 'Choose from existing dashboards and add predefined widgets to visualize your data effectively. Open the DASHBOARDS or WIDGETS menu and select an option from the list.',
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
      description: 'Design your own widgets with the Widget Editor and save custom dashboards that fit your specific needs. Drag and drop components, then save or browse your widgets.',
      icon: <CreateIcon fontSize="large" color="primary" />,
      buttonText: 'Open Widget Editor',
      image: placeholderImages.customWidgetCreation,
      // Instead of a single button, we'll render two buttons
      hasMultipleButtons: true,
      buttons: [
        {
          text: 'Learn More',
          action: () => {
            // Open the widget editor explanation modal
            setWidgetEditorModalOpen(true)
          }
        },
        {
          text: 'Open Widget Editor',
          action: () => {
            // Close modal and programmatically click the widget editor button directly
            onClose()
            const createWidgetButton = document.querySelector('[data-tutorial-id="create-widget-button"]')
            if (createWidgetButton) {
              (createWidgetButton as HTMLElement).click()
            }
          }
        }
      ]
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
            borderRadius: '16px',
            overflow: 'hidden',
            backgroundImage: 'linear-gradient(135deg, rgba(0, 196, 154, 0.05) 0%, rgba(0, 188, 162, 0.1) 100%)'
          }
        }}
        fullScreen={isMobile}
        TransitionComponent={Fade}
        transitionDuration={400}
      >
        <DialogTitle id="tutorial-dialog-title" sx={{ 
          bgcolor: 'primary.main', 
          color: 'white', 
          pb: 1,
          backgroundImage: 'linear-gradient(90deg, #00BC9A 0%, #00A389 100%)'
        }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography 
              variant="h5" 
              component="div" 
              fontWeight="bold" 
              sx={{
                color: '#191919',
                textShadow: '0px 1px 2px rgba(255, 255, 255, 0.3)'
              }}
            >
              Welcome to AquaMesh
            </Typography>
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{ 
                color: 'white',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent 
          sx={{ 
            backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(0, 188, 162, 0.1) 0%, transparent 60%)'
          }}
        >
          <Box my={3}>            
            <Grid container spacing={4} sx={{ mt: 2 }}>
              {options.map((option, index) => (
                <Zoom 
                  in={open} 
                  style={{ transitionDelay: `${index * 100}ms` }}
                  key={index}
                >
                  <Grid item xs={12} className="tutorial-option">
                    <Paper
                      elevation={3}
                      sx={{
                        p: 3,
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        transition: 'transform 0.3s, box-shadow 0.3s',
                        '&:hover': {
                          transform: 'translateY(-8px)',
                          boxShadow: '0 12px 24px rgba(0, 0, 0, 0.2)',
                        },
                        mb: 3,
                        position: 'relative',
                        overflow: 'hidden',
                        backgroundImage: 'linear-gradient(135deg, rgba(0, 166, 137, 0.1) 0%, rgba(25, 25, 25, 0.2) 100%)',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '4px',
                          background: 'linear-gradient(90deg, #00BC9A 0%, #00D1AB 100%)',
                        }
                      }}
                    >
                      <Box sx={{ width: '100%' }}>
                        <Box mb={2} display="flex" justifyContent="center">
                          <div style={{ 
                            background: 'rgba(0, 188, 162, 0.1)',
                            borderRadius: '50%',
                            width: '60px',
                            height: '60px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
                          }}>
                            {React.cloneElement(option.icon, {
                              style: { fontSize: '32px', color: '#00BC9A' }
                            })}
                          </div>
                        </Box>
                        <Typography 
                          variant="h6" 
                          fontWeight="bold" 
                          gutterBottom 
                          color="#f9f9f9"
                          sx={{ 
                            background: 'linear-gradient(90deg, #00BC9A, #00D1AB)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            textShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          {option.title}
                        </Typography>
                        <Typography variant="body2" paragraph color="#f9f9f9" sx={{ minHeight: '48px' }}>
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
                          {option.hasMultipleImages && option.images ? (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, gap: 2 }}>
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
                                    borderRadius: '8px',
                                    backgroundColor: 'background.paper',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                    transition: 'transform 0.2s ease',
                                  }}
                                  className="hover-scale-image"
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
                                borderRadius: '8px',
                                backgroundColor: 'background.paper',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                transition: 'transform 0.2s ease',
                              }}
                              className="hover-scale-image"
                            />
                          ) : (
                            <Typography color="text.secondary">
                              Illustration placeholder
                            </Typography>
                          )}
                        </Box>
                        
                        {/* Render either multiple buttons or a single button */}
                        {option.hasMultipleButtons && option.buttons ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                            {option.buttons.map((button, btnIndex) => (
                              <Button 
                                key={btnIndex}
                                variant={btnIndex === 0 ? "outlined" : "contained"} 
                                onClick={button.action}
                                sx={{
                                  color: btnIndex === 0 ? "#00BC9A" : "#191919",
                                  borderColor: btnIndex === 0 ? "#00BC9A" : "transparent",
                                  boxShadow: btnIndex === 0 ? 'none' : '0 2px 8px rgba(0, 188, 162, 0.4)',
                                  fontWeight: 'bold',
                                  '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: btnIndex === 0 ? '0 2px 5px rgba(0, 188, 162, 0.3)' : '0 4px 12px rgba(0, 188, 162, 0.5)',
                                    backgroundColor: btnIndex === 0 ? 'transparent' : '#00D1AB'
                                  },
                                  transition: 'all 0.2s ease'
                                }}
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
                            sx={{ 
                              mt: 2, 
                              color: '#191919',
                              fontWeight: 'bold',
                              boxShadow: '0 2px 8px rgba(0, 188, 162, 0.4)',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 12px rgba(0, 188, 162, 0.5)',
                                backgroundColor: '#00D1AB'
                              },
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {option.buttonText}
                          </Button>
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                </Zoom>
              ))}
            </Grid>
            
            {/* Admin access note for non-admin users */}
            {!isAdmin && (
              <Zoom in={open} style={{ transitionDelay: `${options.length * 100}ms` }}>
                <Paper
                  elevation={3}
                  sx={{
                    p: 3,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    mt: 2,
                    background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(25, 25, 25, 0.2) 100%)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: 'linear-gradient(90deg, #FFC107 0%, #FF9800 100%)',
                    },
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ width: '100%' }}>
                    <InfoIcon fontSize="large" sx={{ color: '#FFC107' }} />
                    <Typography 
                      variant="h6" 
                      fontWeight="bold" 
                      gutterBottom 
                      color="#f9f9f9"
                      sx={{ 
                        background: 'linear-gradient(90deg, #FFC107, #FF9800)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      Administrator Access Required
                    </Typography>
                    <Typography variant="body2" paragraph color="#f9f9f9">
                      Some advanced features like the Widget Editor are only available to users with Administrator privileges. 
                      To access these features, please log in with an Admin account.
                    </Typography>
                  </Box>
                </Paper>
              </Zoom>
            )}
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

      {/* The widget editor explanation modal */}
      <WidgetEditorExplanationModal
        open={widgetEditorModalOpen}
        onClose={() => setWidgetEditorModalOpen(false)}
      />

      {/* Add CSS for image hover effect */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .hover-scale-image {
            transition: transform 0.3s ease;
          }
          .hover-scale-image:hover {
            transform: scale(1.02);
          }
        `
      }} />
    </>
  )
}

export default TutorialModal