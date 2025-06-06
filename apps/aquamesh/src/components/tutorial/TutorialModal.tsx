import React, { useState, useEffect, useRef } from 'react'
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
import ImportContactsIcon from '@mui/icons-material/ImportContacts'

interface TutorialModalProps {
  open: boolean
  onClose: () => void
  onShowOnStartupToggle?: () => void
}

// Base64 placeholder images until real ones are created
const placeholderImages = {
  dashboardWidgetExplanation: '/images/understanding_dashboards.png',
  predefinedDashboards: `/images/dashboards_topnavbar.png`,
  predefinedWidgets: `/images/widgets_topnavbar.png`,
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
  
  // State for tracking the active tutorial slide
  const [currentSlide, setCurrentSlide] = useState(0)
  
  // Ref to focus the dialog for keyboard navigation
  const dialogRef = useRef<HTMLDivElement>(null)
  
  // Check if user is admin
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Track key pressed state for faster repeated scrolling
  // The state itself doesn't need to be referenced directly as it's used in the setKeyHoldState updater function
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [keyHoldState, setKeyHoldState] = useState({
    ArrowUp: { held: false, repeats: 0 },
    ArrowDown: { held: false, repeats: 0 }
  })
  
  // Reset current slide when modal opens
  useEffect(() => {
    if (open) {
      setCurrentSlide(0)
      
      // Set a small delay to ensure DOM is ready
      setTimeout(() => {
        const scrollContainer = document.querySelector('.MuiDialogContent-root')
        if (scrollContainer) {
          // Reset scroll position when opening the modal
          scrollContainer.scrollTop = 0
        }
        
        // Ensure the dialog receives focus for keyboard navigation
        if (dialogRef.current) {
          dialogRef.current.focus()
        }
      }, 50)
    }
  }, [open])
  
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
      title: isMobile ? 'Create Custom Widgets & Dashboards' : 'OPTION 2: Create Custom Widgets & Dashboards',
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

  // Determine which slides to display based on device and user role
  let displayOptions = options
  if (isMobile) {
    if (isAdmin) {
      // On mobile for admin: show only the first and last slides
      displayOptions = [options[0], options[options.length - 1]]
    } else {
      // On mobile for non-admin: show only the first slide
      displayOptions = [options[0]]
    }
  }

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Only handle keyboard navigation when no explanation modals are open
    if (explanationModalOpen || widgetEditorModalOpen) {
      return
    }
    
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      goToNextSlide()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goToPrevSlide()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      
      setKeyHoldState(prev => {
        const isArrowDown = e.key === 'ArrowDown'
        const key = e.key as 'ArrowUp' | 'ArrowDown'
        
        const scrollAmount = 50
        
        // Perform the scroll
        const scrollContainer = document.querySelector('.MuiDialogContent-root')
        if (scrollContainer) {
          scrollContainer.scrollBy({
            top: isArrowDown ? scrollAmount : -scrollAmount,
            behavior: 'auto'
          })
        }
        
        // Return updated state
        return {
          ...prev,
          [key]: { held: true }
        }
      })
    }
  }
  
  // Handle key up to reset hold state
  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Reset key hold state when key is released
      setKeyHoldState(prev => ({
        ...prev,
        [e.key]: { held: false, repeats: 0 }
      }))
    }
  }
  
  // Function to navigate to next slide
  const goToNextSlide = () => {
    if (currentSlide < displayOptions.length - 1) {
      setCurrentSlide(currentSlide + 1)
      
      // Add smooth scrolling when using arrows with proper offset
      const nextOptionElement = document.getElementById(`tutorial-option-${currentSlide + 1}`)
      if (nextOptionElement) {
        const scrollContainer = document.querySelector('.MuiDialogContent-root')
        if (scrollContainer) {
          // Get element position relative to the scroll container
          const elementPosition = nextOptionElement.getBoundingClientRect().top -
                                 scrollContainer.getBoundingClientRect().top
          
          // Calculate target position with padding to account for the sticky header (66px)
          const targetPosition = elementPosition + scrollContainer.scrollTop - 66
          
          // Perform smooth scroll to that position
          scrollContainer.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          })
        } else {
          // Fallback to standard method if scroll container not found
          nextOptionElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }
  }
  
  // Function to navigate to previous slide
  const goToPrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
      
      // Add smooth scrolling when using arrows with proper offset
      const prevOptionElement = document.getElementById(`tutorial-option-${currentSlide - 1}`)
      if (prevOptionElement) {
        const scrollContainer = document.querySelector('.MuiDialogContent-root')
        if (scrollContainer) {
          // Get element position relative to the scroll container
          const elementPosition = prevOptionElement.getBoundingClientRect().top -
                                 scrollContainer.getBoundingClientRect().top
          
          // Calculate target position with padding to account for the sticky header (66px)
          const targetPosition = elementPosition + scrollContainer.scrollTop - 66
          
          // Perform smooth scroll to that position
          scrollContainer.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          })
        } else {
          // Fallback to standard method if scroll container not found
          prevOptionElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }
  }
  
  // Function to scroll to a specific slide
  const scrollToSlide = (index: number) => {
    setCurrentSlide(index)
    const optionElement = document.getElementById(`tutorial-option-${index}`)
    if (optionElement) {
      const scrollContainer = document.querySelector('.MuiDialogContent-root')
      if (scrollContainer) {
        // Get element position relative to the scroll container
        const elementPosition = optionElement.getBoundingClientRect().top -
                               scrollContainer.getBoundingClientRect().top
        
        // Calculate target position with padding to account for the sticky header (66px)
        const targetPosition = elementPosition + scrollContainer.scrollTop - 66
        
        // Perform smooth scroll to that position
        scrollContainer.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        })
      } else {
        // Fallback to standard method if scroll container not found
        optionElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }
  
  // Set up keyboard event listeners
  useEffect(() => {
    // Listen for visibility change events to check if elements are in viewport
    const handleScroll = () => {
      // Check which option is most visible in the viewport and update currentSlide
      const optionElements = document.querySelectorAll('[id^="tutorial-option-"]')
      if (optionElements.length === 0) {
        return
      }
      
      let mostVisibleOption = 0
      let maxVisibleArea = 0
      
      optionElements.forEach((option) => {
        const index = parseInt(option.id.split('-').pop() || '0', 10)
        const rect = option.getBoundingClientRect()
        
        // Get the scroll container's position
        const scrollContainer = document.querySelector('.MuiDialogContent-root')
        if (!scrollContainer) {
          return
        }
        
        const containerRect = scrollContainer.getBoundingClientRect()
        
        // Calculate how much of the element is visible in the viewport
        const visibleTop = Math.max(rect.top, containerRect.top)
        const visibleBottom = Math.min(rect.bottom, containerRect.bottom)
        const visibleHeight = Math.max(0, visibleBottom - visibleTop)
        
        // Calculate visible percentage (how much of the element is visible)
        const visiblePercent = visibleHeight / rect.height
        
        // Give priority to elements that are more visible and closer to the top
        // This weighted calculation considers both visibility and position
        const visibleScore = visiblePercent * (1 - (visibleTop - containerRect.top) / containerRect.height)
        
        if (visibleScore > maxVisibleArea) {
          maxVisibleArea = visibleScore
          mostVisibleOption = index
        }
      })
      
      // Update the current slide regardless of previous state
      setCurrentSlide(mostVisibleOption)
    }
    
    // Add scroll event listener when modal is open
    if (open) {
      const scrollContainer = document.querySelector('.MuiDialogContent-root')
      if (scrollContainer) {
        // Add a passive listener for better performance on smooth scrolling
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
        
        // Initial check to set the correct option based on scroll position
        setTimeout(handleScroll, 100)
      }
      
      // Set up a periodic check to ensure dots are updated even if scroll events are missed
      const intervalCheck = setInterval(handleScroll, 200)
      
      return () => {
        const scrollContainer = document.querySelector('.MuiDialogContent-root')
        if (scrollContainer) {
          scrollContainer.removeEventListener('scroll', handleScroll)
        }
        clearInterval(intervalCheck)
      }
    }
    
    return () => {
      const scrollContainer = document.querySelector('.MuiDialogContent-root')
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll)
      }
    }
  }, [open])

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
            overflow: 'hidden',
            backgroundImage: 'linear-gradient(135deg, rgba(0, 196, 154, 0.05) 0%, rgba(0, 188, 162, 0.1) 100%)',
            height: 'auto',
            margin: isMobile ? 0 : undefined
          }
        }}
        TransitionComponent={Fade}
        transitionDuration={400}
      >
        <DialogTitle id="tutorial-dialog-title" sx={{ 
          bgcolor: 'primary.main', 
          color: 'white', 
          pb: 1,
          backgroundImage: 'linear-gradient(90deg, #00BC9A 0%, #00A389 100%)',
          position: 'sticky',
          top: 0,
          zIndex: 1200
        }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            
            <Box display="flex" alignItems="center">
              <ImportContactsIcon sx={{ color: '#eee', mr: 1 }} />
              <Typography 
                variant="h5" 
                component="div" 
                fontWeight="bold" 
                sx={{
                  color: '#eee',
                  textShadow: '0px 1px 2px rgba(255, 255, 255, 0.3)',
                  fontSize: isMobile ? '1.2rem' : undefined
                }}
              >
                Welcome to AquaMesh
              </Typography>
            </Box>
            <Box display="flex" alignItems="center">
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
          </Box>
        </DialogTitle>
        
        <div 
          ref={dialogRef} 
          tabIndex={-1} 
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          style={{ outline: 'none' }}
          autoFocus
        >
          <DialogContent 
            sx={{ 
              backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(0, 188, 162, 0.1) 0%, transparent 60%)',
              position: 'relative',
              overflowY: 'auto', // Ensure scrolling works
              maxHeight: 'calc(100dvh - 220px)', // Set max height to allow scrolling
              paddingTop: 0,
              paddingBottom: 0,
              px: isMobile ? 2 : 3, // Reduce padding on mobile
            }}
          >
            <Box my={isMobile ? 2 : 3}>            
              {/* Admin access note for non-admin users */}
              {!isAdmin && (
                <Zoom in={open} style={{ transitionDelay: `${displayOptions.length * 100}ms` }}>
                  <Paper
                    elevation={3}
                    sx={{
                      p: isMobile ? 2 : 3,
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      mt: isMobile ? 1 : 2,
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
                      <InfoIcon fontSize={isMobile ? "medium" : "large"} sx={{ color: '#FFC107' }} />
                      <Typography 
                        variant={isMobile ? "subtitle1" : "h6"} 
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
                      <Typography 
                        variant={isMobile ? "body2" : "body1"} 
                        paragraph 
                        color="#f9f9f9"
                        sx={{ fontSize: isMobile ? '0.875rem' : undefined }}
                      >
                        Some advanced features like the Widget Editor are only available to users with Administrator privileges. 
                        To access these features, please log in with an Admin account.
                      </Typography>
                    </Box>
                  </Paper>
                </Zoom>
              )}

              {/* Tutorial information */}
              <Grid container spacing={isMobile ? 2 : 4} sx={{ mt: isMobile ? 1 : 2 }}>
                {displayOptions.map((option, index) => (
                  <Zoom 
                    in={open} 
                    style={{ transitionDelay: `${index * 100}ms` }}
                    key={index}
                  >
                    <Grid item xs={12} className="tutorial-option">
                      <Paper
                        elevation={3}
                        sx={{
                          p: isMobile ? 2 : 3,
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          transition: 'transform 0.3s, box-shadow 0.3s, border 0.3s',
                          '&:hover': {
                            transform: isMobile ? 'none' : 'translateY(-8px)',
                            boxShadow: isMobile ? undefined : '0 12px 24px rgba(0, 0, 0, 0.2)',
                          },
                          mb: isMobile ? 2 : 3,
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
                          },
                          // Highlight the current slide
                          border: currentSlide === index ? '2px solid #00BC9A' : '2px solid transparent',
                          boxShadow: currentSlide === index ? '0 0 20px rgba(0, 188, 162, 0.4)' : undefined,
                        }}
                        id={`tutorial-option-${index}`}
                      >
                        <Box sx={{ width: '100%' }}>
                          <Box mb={isMobile ? 1 : 2} display="flex" justifyContent="center">
                            <div style={{ 
                              background: 'rgba(0, 188, 162, 0.1)',
                              borderRadius: '50%',
                              width: isMobile ? '50px' : '60px',
                              height: isMobile ? '50px' : '60px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
                            }}>
                              {React.cloneElement(option.icon, {
                                style: { fontSize: isMobile ? '28px' : '32px', color: '#00BC9A' }
                              })}
                            </div>
                          </Box>
                          <Typography 
                            variant={isMobile ? "subtitle1" : "h6"} 
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
                          <Typography 
                            variant={isMobile ? "body2" : "body1"} 
                            paragraph 
                            color="#f9f9f9" 
                            sx={{ 
                              minHeight: isMobile ? '36px' : '48px',
                              fontSize: isMobile ? '0.875rem' : undefined
                            }}
                          >
                            {option.description}
                          </Typography>
                          
                          {/* Image with arrows */}
                          <Box 
                            sx={{ 
                              mt: isMobile ? 1 : 2, 
                              mb: isMobile ? 2 : 3, 
                              maxWidth: '100%', 
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {option.hasMultipleImages && option.images ? (
                              <Box sx={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                px: isMobile ? 1 : 2, 
                                gap: isMobile ? 1 : 2,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}>
                                {option.images.map((image, imgIndex) => (
                                  <img 
                                    key={imgIndex}
                                    src={image.src} 
                                    alt={image.alt}
                                    style={{ 
                                      maxWidth: isMobile ? '50%' : '30%', 
                                      maxHeight: '100%',
                                      objectFit: 'contain',
                                      border: '1px solid rgb(238, 238, 238)',
                                      borderRadius: '8px',
                                      backgroundColor: 'background.paper',
                                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                      transition: 'transform 0.2s ease',
                                      marginBottom: isMobile ? '10px' : 0
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
                                  maxWidth: isMobile ? '90%' : '65%', 
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
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'center', 
                              flexWrap: 'wrap', 
                              gap: isMobile ? 1 : 2, 
                              mt: isMobile ? 1 : 2,
                              flexDirection: isMobile ? 'column' : 'row'
                            }}>
                              {option.buttons.map((button, btnIndex) => (
                                <Button 
                                  key={btnIndex}
                                  variant={btnIndex === 0 ? "outlined" : "contained"} 
                                  onClick={button.action}
                                  size={isMobile ? "small" : "medium"}
                                  sx={{
                                    color: btnIndex === 0 ? "#00BC9A" : "#191919",
                                    borderColor: btnIndex === 0 ? "#00BC9A" : "transparent",
                                    boxShadow: btnIndex === 0 ? 'none' : '0 2px 8px rgba(0, 188, 162, 0.4)',
                                    fontWeight: 'bold',
                                    '&:hover': {
                                      transform: isMobile ? 'none' : 'translateY(-2px)',
                                      boxShadow: btnIndex === 0 ? '0 2px 5px rgba(0, 188, 162, 0.3)' : '0 4px 12px rgba(0, 188, 162, 0.5)',
                                      backgroundColor: btnIndex === 0 ? 'transparent' : '#00D1AB'
                                    },
                                    transition: 'all 0.2s ease',
                                    fontSize: isMobile ? '0.8rem' : undefined
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
                              size={isMobile ? "small" : "medium"}
                              onClick={option.action}
                              sx={{ 
                                mt: isMobile ? 1 : 2, 
                                color: '#191919',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 8px rgba(0, 188, 162, 0.4)',
                                '&:hover': {
                                  transform: isMobile ? 'none' : 'translateY(-2px)',
                                  boxShadow: '0 4px 12px rgba(0, 188, 162, 0.5)',
                                  backgroundColor: '#00D1AB'
                                },
                                transition: 'all 0.2s ease',
                                fontSize: isMobile ? '0.8rem' : undefined
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
            </Box>
          </DialogContent>
          <DialogActions sx={{ 
            px: isMobile ? 2 : 3, 
            pb: isMobile ? 2 : 3, 
            pt: isMobile ? 1 : 2,
            justifyContent: 'space-between',
            position: 'sticky',
            bottom: 0,
            bgcolor: 'background.paper',
            borderTop: '1px solid rgba(0, 188, 162, 0.2)',
            zIndex: 1100,
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            <Box display="flex" alignItems="center" mb={isMobile ? 1 : 0}>
              {/* Pagination dots */}
              { displayOptions.length > 1 && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {displayOptions.map((_, index) => (
                    <Box 
                      key={index}
                      onClick={() => {
                        scrollToSlide(index)
                      }}
                      sx={{
                        width: isMobile ? 10 : 12,
                        height: isMobile ? 10 : 12,
                        borderRadius: '50%',
                        backgroundColor: currentSlide === index ? '#00BC9A' : 'rgba(0, 188, 162, 0.3)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          backgroundColor: currentSlide === index ? '#00BC9A' : 'rgba(0, 188, 162, 0.5)',
                        }
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
            
            {/* Show on startup toggle and close button */}
            <Box display="flex" width={isMobile ? '100%' : 'auto'} justifyContent={isMobile ? 'space-between' : 'flex-end'}>
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
                  size={isMobile ? "small" : "medium"}
                  sx={{
                    color: '#191919', 
                    ":hover": {background: '#00C49A99'},
                    fontSize: isMobile ? '0.8rem' : undefined
                  }}
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
                  size={isMobile ? "small" : "medium"}
                  sx={{
                    color: '#191919', 
                    ":hover": {background: '#00C49A99'},
                    fontSize: isMobile ? '0.8rem' : undefined
                  }}
                >
                  Don&apos;t show again
                </Button>
              )}
              <Button 
                onClick={onClose} 
                color="primary" 
                variant="contained"
                size={isMobile ? "small" : "medium"}
                sx={{ 
                  ml: 1,
                  fontSize: isMobile ? '0.8rem' : undefined
                }}
              >
                Got it!
              </Button>
            </Box>
          </DialogActions>
        </div>
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
        onCloseTutorial={onClose}
      />

      {/* Add CSS for image hover effect */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .hover-scale-image {
            transition: transform 0.3s ease;
          }
          .hover-scale-image:hover {
            transform: scale(${isMobile ? '1.01' : '1.02'});
          }
        `
      }} />
    </>
  )
}

export default TutorialModal