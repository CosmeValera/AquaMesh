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
  IconButton,
  useTheme,
  useMediaQuery,
  Fade,
  Zoom,
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

// Define interfaces for the tutorial options
interface ButtonOption {
  text: string
  action: () => void
}

interface TutorialOption {
  title: string
  description: string
  icon: React.ReactElement
  buttonText?: string
  action?: () => void
  hasMultipleButtons?: boolean
  buttons?: ButtonOption[]
}

const USER_ROLE_CHANGED_EVENT = 'studymesh-user-role-changed'
const TUTORIAL_SHOWN_KEY = 'studymesh-tutorial-shown'
const LEGACY_TUTORIAL_SHOWN_KEY = 'aquamesh-tutorial-shown'

const TutorialModal: React.FC<TutorialModalProps> = ({
  open,
  onClose,
  onShowOnStartupToggle,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [explanationModalOpen, setExplanationModalOpen] = useState(false)
  const [widgetEditorModalOpen, setWidgetEditorModalOpen] = useState(false)
  const tutorialShown =
    localStorage.getItem(TUTORIAL_SHOWN_KEY) ||
    localStorage.getItem(LEGACY_TUTORIAL_SHOWN_KEY)

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
    ArrowDown: { held: false, repeats: 0 },
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
    const readUserRole = () => {
      try {
        const storedUserData = localStorage.getItem('userData')
        if (storedUserData) {
          const userData = JSON.parse(storedUserData)
          setIsAdmin(userData.role === 'ADMIN_ROLE')
          return
        }
        setIsAdmin(false)
      } catch (error) {
        console.error('Failed to parse user data', error)
        setIsAdmin(false)
      }
    }

    readUserRole()
    window.addEventListener(USER_ROLE_CHANGED_EVENT, readUserRole)

    return () => {
      window.removeEventListener(USER_ROLE_CHANGED_EVENT, readUserRole)
    }
  }, [])

  const options: TutorialOption[] = []

  options.push({
    title: 'Open Dashboard',
    description:
      'Open a saved dashboard or starter example from the Dashboards menu.',
    icon: <ImportContactsIcon fontSize="large" color="primary" />,
    hasMultipleButtons: true,
    buttons: [
      {
        text: 'Dashboard Basics',
        action: () => {
          setExplanationModalOpen(true)
        },
      },
      {
        text: 'Open Starters',
        action: () => {
          onClose()
          const dashboardsButton = document.querySelector(
            '[data-tutorial-id="dashboards-button"]',
          )
          if (dashboardsButton) {
            ;(dashboardsButton as HTMLElement).click()
          }
        },
      },
    ],
  })

  // Create Widget is the primary path for builder users.
  if (isAdmin) {
    options.push({
      title: 'Create Widget',
      description:
        'Build one reusable widget: add a layout block, place content inside it, preview, and save.',
      icon: <CreateIcon fontSize="large" color="primary" />,
      buttonText: 'Start building',
      action: () => {
        onClose()
        const createWidgetButton = document.querySelector(
          '[data-tutorial-id="create-widget-button"]',
        )
        if (createWidgetButton) {
          ;(createWidgetButton as HTMLElement).click()
        }
      },
    })
  } else {
    options.push({
      title: 'Create Widget',
      description:
        'The recommended path is to start from a dashboard example, then create one reusable block for your own notes. Builder mode is required to save widgets.',
      icon: <CreateIcon fontSize="large" color="primary" />,
      buttonText: 'View Quick Start',
      action: () => {
        setWidgetEditorModalOpen(true)
      },
    })
  }

  options.push(
    {
      title: 'Create Dashboard',
      description:
        'Start a dashboard, add your saved widget from Widgets, arrange it, save it, then reopen it from Dashboards.',
      icon: <DashboardIcon fontSize="large" color="primary" />,
      hasMultipleButtons: true,
      buttons: [
        {
          text: 'Widget Basics',
          action: () => {
            setExplanationModalOpen(true)
          },
        },
        {
          text: 'Create Dashboard',
          action: () => {
            onClose()
            const createDashboardButton = document.querySelector(
              '[data-tutorial-id="create-dashboard-button"]',
            )
            if (createDashboardButton) {
              ;(createDashboardButton as HTMLElement).click()
            }
          },
        },
      ],
    },
    {
      title: 'View more starter dashboards',
      description:
        'Use the dashboard menu for finished layouts. Mathematics, content load, and grouping tutorials show different dashboard patterns.',
      icon: <InfoIcon fontSize="large" color="primary" />,
      hasMultipleButtons: true,
      buttons: [
        {
          text: 'Dashboard Basics',
          action: () => {
            setExplanationModalOpen(true)
          },
        },
        {
          text: 'Open Dashboards',
          action: () => {
            onClose()
            const dashboardsButton = document.querySelector(
              '[data-tutorial-id="dashboards-button"]',
            )
            if (dashboardsButton) {
              ;(dashboardsButton as HTMLElement).click()
            }
          },
        },
      ],
    },
  )

  // Determine which slides to display based on device and user role
  const displayOptions = isMobile ? options.slice(0, 2) : options.slice(0, 3)

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

      setKeyHoldState((prev) => {
        const isArrowDown = e.key === 'ArrowDown'
        const key = e.key as 'ArrowUp' | 'ArrowDown'

        const scrollAmount = 50

        // Perform the scroll
        const scrollContainer = document.querySelector('.MuiDialogContent-root')
        if (scrollContainer) {
          scrollContainer.scrollBy({
            top: isArrowDown ? scrollAmount : -scrollAmount,
            behavior: 'auto',
          })
        }

        // Return updated state
        return {
          ...prev,
          [key]: { held: true },
        }
      })
    }
  }

  // Handle key up to reset hold state
  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Reset key hold state when key is released
      setKeyHoldState((prev) => ({
        ...prev,
        [e.key]: { held: false, repeats: 0 },
      }))
    }
  }

  // Function to navigate to next slide
  const goToNextSlide = () => {
    if (currentSlide < displayOptions.length - 1) {
      setCurrentSlide(currentSlide + 1)

      // Add smooth scrolling when using arrows with proper offset
      const nextOptionElement = document.getElementById(
        `tutorial-option-${currentSlide + 1}`,
      )
      if (nextOptionElement) {
        const scrollContainer = document.querySelector('.MuiDialogContent-root')
        if (scrollContainer) {
          // Get element position relative to the scroll container
          const elementPosition =
            nextOptionElement.getBoundingClientRect().top -
            scrollContainer.getBoundingClientRect().top

          // Calculate target position with padding to account for the sticky header (66px)
          const targetPosition =
            elementPosition + scrollContainer.scrollTop - 66

          // Perform smooth scroll to that position
          scrollContainer.scrollTo({
            top: targetPosition,
            behavior: 'smooth',
          })
        } else {
          // Fallback to standard method if scroll container not found
          nextOptionElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
        }
      }
    }
  }

  // Function to navigate to previous slide
  const goToPrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)

      // Add smooth scrolling when using arrows with proper offset
      const prevOptionElement = document.getElementById(
        `tutorial-option-${currentSlide - 1}`,
      )
      if (prevOptionElement) {
        const scrollContainer = document.querySelector('.MuiDialogContent-root')
        if (scrollContainer) {
          // Get element position relative to the scroll container
          const elementPosition =
            prevOptionElement.getBoundingClientRect().top -
            scrollContainer.getBoundingClientRect().top

          // Calculate target position with padding to account for the sticky header (66px)
          const targetPosition =
            elementPosition + scrollContainer.scrollTop - 66

          // Perform smooth scroll to that position
          scrollContainer.scrollTo({
            top: targetPosition,
            behavior: 'smooth',
          })
        } else {
          // Fallback to standard method if scroll container not found
          prevOptionElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
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
        const elementPosition =
          optionElement.getBoundingClientRect().top -
          scrollContainer.getBoundingClientRect().top

        // Calculate target position with padding to account for the sticky header (66px)
        const targetPosition = elementPosition + scrollContainer.scrollTop - 66

        // Perform smooth scroll to that position
        scrollContainer.scrollTo({
          top: targetPosition,
          behavior: 'smooth',
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
      const optionElements = document.querySelectorAll(
        '[id^="tutorial-option-"]',
      )
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
        const visibleScore =
          visiblePercent *
          (1 - (visibleTop - containerRect.top) / containerRect.height)

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
        scrollContainer.addEventListener('scroll', handleScroll, {
          passive: true,
        })

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
            boxShadow: '0 12px 32px rgba(16, 42, 45, 0.16)',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            height: 'auto',
            margin: isMobile ? 0 : undefined,
          },
        }}
        TransitionComponent={Fade}
        transitionDuration={400}
      >
        <DialogTitle
          id="tutorial-dialog-title"
          sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            pb: 1,
            borderBottom: 1,
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            zIndex: 1200,
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box display="flex" alignItems="center">
              <ImportContactsIcon sx={{ color: 'primary.main', mr: 1 }} />
              <Typography
                variant="h5"
                component="div"
                fontWeight="bold"
                sx={{
                  color: 'text.primary',
                  fontSize: isMobile ? '1.2rem' : undefined,
                }}
              >
                Welcome to StudyMesh
              </Typography>
            </Box>
            <Box display="flex" alignItems="center">
              <IconButton
                aria-label="close"
                onClick={onClose}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
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
              bgcolor: 'background.default',
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
                <Zoom
                  in={open}
                  style={{
                    transitionDelay: `${displayOptions.length * 100}ms`,
                  }}
                >
                  <Box
                    sx={{
                      p: isMobile ? 2 : 3,
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      mt: isMobile ? 1 : 2,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background:
                          'linear-gradient(90deg, #FFC107 0%, #FF9800 100%)',
                      },
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <Box sx={{ width: '100%' }}>
                      <InfoIcon
                        fontSize={isMobile ? 'medium' : 'large'}
                        sx={{ color: '#FFC107' }}
                      />
                      <Typography
                        variant={isMobile ? 'subtitle1' : 'h6'}
                        fontWeight="bold"
                        gutterBottom
                        color="text.primary"
                      >
                        Builder Mode Required
                      </Typography>
                      <Typography
                        variant={isMobile ? 'body2' : 'body1'}
                        paragraph
                        color="text.secondary"
                        sx={{ fontSize: isMobile ? '0.875rem' : undefined }}
                      >
                        Creating reusable widgets is available in Builder mode.
                        Switch to a builder account to design and save widgets.
                      </Typography>
                    </Box>
                  </Box>
                </Zoom>
              )}

              {/* Tutorial information */}
              <Grid
                container
                spacing={isMobile ? 2 : 4}
                sx={{ mt: isMobile ? 1 : 2 }}
              >
                {displayOptions.map((option, index) => (
                  <Zoom
                    in={open}
                    style={{ transitionDelay: `${index * 100}ms` }}
                    key={index}
                  >
                    <Grid item xs={12} className="tutorial-option">
                      <Box
                        sx={{
                          py: isMobile ? 2 : 3,
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          textAlign: 'left',
                          borderBottom:
                            index === displayOptions.length - 1
                              ? 'none'
                              : '1px solid',
                          borderColor: 'divider',
                        }}
                        id={`tutorial-option-${index}`}
                      >
                        <Box sx={{ width: '100%' }}>
                          <Box
                            mb={1}
                            display="flex"
                            justifyContent="flex-start"
                            alignItems="center"
                            gap={1.5}
                          >
                            {React.cloneElement(option.icon, {
                              style: {
                                fontSize: isMobile ? '28px' : '32px',
                                color: theme.palette.primary.main,
                              },
                            })}
                            <Typography
                              variant={isMobile ? 'subtitle1' : 'h6'}
                              fontWeight="bold"
                              color="text.primary"
                            >
                              {option.title}
                            </Typography>
                          </Box>
                          <Typography
                            variant={isMobile ? 'body2' : 'body1'}
                            paragraph
                            color="text.secondary"
                            sx={{
                              maxWidth: 760,
                              fontSize: isMobile ? '0.875rem' : undefined,
                            }}
                          >
                            {option.description}
                          </Typography>

                          {/* Render either multiple buttons or a single button */}
                          {option.hasMultipleButtons && option.buttons ? (
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'flex-start',
                                flexWrap: 'wrap',
                                gap: isMobile ? 1 : 2,
                                mt: isMobile ? 1 : 1.5,
                                flexDirection: isMobile ? 'column' : 'row',
                              }}
                            >
                              {option.buttons.map((button, btnIndex) => (
                                <Button
                                  key={btnIndex}
                                  variant={
                                    btnIndex === 0 ? 'outlined' : 'contained'
                                  }
                                  onClick={button.action}
                                  size={isMobile ? 'small' : 'medium'}
                                  sx={{
                                    color:
                                      btnIndex === 0
                                        ? 'primary.dark'
                                        : '#191919',
                                    borderColor:
                                      btnIndex === 0
                                        ? 'primary.dark'
                                        : 'transparent',
                                    boxShadow:
                                      btnIndex === 0
                                        ? 'none'
                                        : '0 2px 8px rgba(0, 188, 162, 0.4)',
                                    fontWeight: 'bold',
                                    '&:hover': {
                                      transform: isMobile
                                        ? 'none'
                                        : 'translateY(-2px)',
                                      boxShadow:
                                        btnIndex === 0
                                          ? '0 2px 5px rgba(0, 188, 162, 0.3)'
                                          : '0 4px 12px rgba(0, 188, 162, 0.5)',
                                      backgroundColor:
                                        btnIndex === 0
                                          ? 'action.hover'
                                          : 'primary.light',
                                    },
                                    transition: 'all 0.2s ease',
                                    fontSize: isMobile ? '0.8rem' : undefined,
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
                              size={isMobile ? 'small' : 'medium'}
                              onClick={option.action}
                              sx={{
                                mt: isMobile ? 1 : 1.5,
                                color: '#191919',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 8px rgba(0, 188, 162, 0.4)',
                                '&:hover': {
                                  transform: isMobile
                                    ? 'none'
                                    : 'translateY(-2px)',
                                  boxShadow:
                                    '0 4px 12px rgba(0, 188, 162, 0.5)',
                                  backgroundColor: 'primary.light',
                                },
                                transition: 'all 0.2s ease',
                                fontSize: isMobile ? '0.8rem' : undefined,
                              }}
                            >
                              {option.buttonText}
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                  </Zoom>
                ))}
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions
            sx={{
              px: isMobile ? 2 : 3,
              pb: isMobile ? 2 : 3,
              pt: isMobile ? 1 : 2,
              justifyContent: 'space-between',
              position: 'sticky',
              bottom: 0,
              bgcolor: 'background.paper',
              borderTop: '1px solid',
              borderColor: 'divider',
              zIndex: 1100,
              flexDirection: isMobile ? 'column' : 'row',
            }}
          >
            <Box display="flex" alignItems="center" mb={isMobile ? 1 : 0}>
              {/* Pagination dots */}
              {displayOptions.length > 1 && (
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
                        backgroundColor:
                          currentSlide === index
                            ? 'primary.main'
                            : 'action.selected',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          backgroundColor:
                            currentSlide === index
                              ? 'primary.main'
                              : 'action.hover',
                        },
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {/* Show on startup toggle and close button */}
            <Box
              display="flex"
              width={isMobile ? '100%' : 'auto'}
              justifyContent={isMobile ? 'space-between' : 'flex-end'}
            >
              {tutorialShown ? (
                <Button
                  onClick={() => {
                    localStorage.removeItem(TUTORIAL_SHOWN_KEY)
                    localStorage.removeItem(LEGACY_TUTORIAL_SHOWN_KEY)
                    if (onShowOnStartupToggle) {
                      onShowOnStartupToggle()
                    }
                    onClose()
                  }}
                  variant="text"
                  size={isMobile ? 'small' : 'medium'}
                  sx={{
                    color: 'text.primary',
                    ':hover': { background: 'action.hover' },
                    fontSize: isMobile ? '0.8rem' : undefined,
                  }}
                >
                  Show on startup
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    localStorage.setItem(TUTORIAL_SHOWN_KEY, 'true')
                    if (onShowOnStartupToggle) {
                      onShowOnStartupToggle()
                    }
                    onClose()
                  }}
                  variant="text"
                  size={isMobile ? 'small' : 'medium'}
                  sx={{
                    color: 'text.primary',
                    ':hover': { background: 'action.hover' },
                    fontSize: isMobile ? '0.8rem' : undefined,
                  }}
                >
                  Don&apos;t show again
                </Button>
              )}
              <Button
                onClick={onClose}
                color="primary"
                variant="contained"
                size={isMobile ? 'small' : 'medium'}
                sx={{
                  ml: 1,
                  fontSize: isMobile ? '0.8rem' : undefined,
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
    </>
  )
}

export default TutorialModal
