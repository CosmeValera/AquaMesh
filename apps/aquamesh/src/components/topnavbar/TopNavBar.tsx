import React, { useState, useEffect } from 'react'
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Menu,
  MenuItem,
  Divider,
  Avatar,
  ListItemIcon,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import LogoutIcon from '@mui/icons-material/Logout'
import WidgetsIcon from '@mui/icons-material/Widgets'
import CreateIcon from '@mui/icons-material/Create'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import HelpIcon from '@mui/icons-material/Help'
import FolderIcon from '@mui/icons-material/Folder'
import ImportContactsIcon from '@mui/icons-material/ImportContacts'

import useTopNavBarWidgets from '../../customHooks/useTopNavBarWidgets'
import { useLayout } from '../Layout/LayoutProvider'
import { ReactComponent as Logo } from '../../../public/logo.svg'
import { useDashboards } from '../Dasboard/DashboardProvider'
import TutorialModal from '../tutorial/TutorialModal'
import DashboardOptionsMenu from '../Dasboard/DashboardOptionsMenu'
import WidgetManagementModal from '../WidgetEditor/components/dialogs/WidgetLibrary'
import useWidgetManager from '../WidgetEditor/hooks/useWidgetManager'
import FAQDialog from '../tutorial/FAQDialog'
import { Actions } from 'flexlayout-react'

// Define user data type
interface UserData {
  id: string
  name: string
  role: string
}

// Define component props interface 
interface TopNavBarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

// Custom button with icon and label for phone view
interface ButtonWithLabelProps {
  icon: React.ReactNode
  label: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  sx?: React.CSSProperties | Record<string, unknown>
  'data-tutorial-id'?: string
}

const ButtonWithLabel: React.FC<ButtonWithLabelProps> = ({ icon, label, onClick, sx, ...props }) => {
  return (
    <Button
      onClick={onClick}
      sx={{
        color: 'foreground.contrastPrimary',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: '48px',
        mx: 0.5,
        px: 1,
        ...sx
      }}
      {...props}
    >
      {icon}
      <Typography variant="caption" sx={{ fontSize: '0.6rem', mt: 0.3, lineHeight: 1 }}>
        {label}
      </Typography>
    </Button>
  )
}

const TopNavBar: React.FC<TopNavBarProps> = () => {
  // State for different dropdown menus
  const [widgetsAnchorEl, setWidgetsAnchorEl] = useState<null | HTMLElement>(null)
  const [userAnchorEl, setUserAnchorEl] = useState<null | HTMLElement>(null)
  const [userData, setUserData] = useState<UserData>({ id: 'admin', name: 'Admin User', role: 'ADMIN_ROLE' })
  
  // Tutorial modal state
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [showTutorialOnStartup, setShowTutorialOnStartup] = useState(() => {
    return !localStorage.getItem('aquamesh-tutorial-shown')
  })

  // Add a state for the FAQ dialog
  const [faqDialogOpen, setFaqDialogOpen] = useState(false)

  // State for phone More menu grouping Tutorial and FAQ
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null)

  const { topNavBarWidgets } = useTopNavBarWidgets()
  const { ref: layoutRef, addComponent } = useLayout()
  const { addDashboard, openDashboards } = useDashboards()
  const navigate = useNavigate()
  
  // Use theme and media query for responsive design
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'))
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'))
  
  // Use the widget manager hook
  const {
    widgets,
    isWidgetManagementOpen,
    openWidgetManagement,
    closeWidgetManagement,
    previewWidget,
    editWidget,
    deleteWidget
  } = useWidgetManager()
  
  // Load user data from localStorage on component mount
  useEffect(() => {
    const storedUserData = localStorage.getItem('userData')
    if (storedUserData) {
      try {
        const parsedUserData = JSON.parse(storedUserData)
        setUserData(parsedUserData)
      } catch (error) {
        console.error('Failed to parse user data from localStorage', error)
      }
    }
    
    // Check if tutorial should be shown
    if (showTutorialOnStartup) {
      setTutorialOpen(true)
    }
  }, [showTutorialOnStartup])

  // Handle opening and closing dropdowns
  const handleWidgetsMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setWidgetsAnchorEl(event.currentTarget)
  }
  
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setUserAnchorEl(event.currentTarget)
  }
  
  const handleClose = () => {
    setWidgetsAnchorEl(null)
    setUserAnchorEl(null)
  }

  const handleLogout = () => {
    handleClose()
    navigate('/login')
  }

  // Open tutorial modal
  const handleOpenTutorial = () => {
    setTutorialOpen(true)
  }
  
  // Toggle tutorial display on startup
  const handleToggleTutorialStartup = () => {
    setShowTutorialOnStartup(!showTutorialOnStartup)
  }

  // Add a function to handle opening the FAQ dialog
  const handleOpenFaq = () => {
    setFaqDialogOpen(true)
  }

  // Handlers for More menu
  const handleMoreMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMoreAnchorEl(event.currentTarget)
  }
  const handleMoreMenuClose = () => {
    setMoreAnchorEl(null)
  }

  // Helper function to ensure there's a dashboard before adding a component
  const ensureDashboardAndAddComponent = (componentConfig: {
    id: string,
    name: string,
    component: string
  }) => {
    // Check if there are any open dashboards
    if (openDashboards.length === 0) {
      // If no dashboards exist, create a default dashboard first
      addDashboard()
      // Short delay to ensure the dashboard is created before adding the component
      setTimeout(() => {
        addComponent(componentConfig)
      }, 100)
    } else {
      // If dashboards already exist, ensure an active tabset exists, and then add the component
      if (layoutRef.current) {
        const model = layoutRef.current.props.model
        if (!model.getActiveTabset()) {
          const firstTabset = model.getFirstTabSet()
          if (firstTabset) {
            // @ts-expect-error: doAction exists at runtime on Layout instance
            layoutRef.current.doAction(Actions.setActiveTabset(firstTabset.getId()))
          }
        }
      }
      addComponent(componentConfig)
    }
  }

  // Handle opening widgets library
  const handleOpenWidgetsLibrary = () => {
    openWidgetManagement()
    handleClose()
  }

  return (
    <>
      <AppBar 
        position="static" 
        sx={{ 
          backgroundColor: 'background.header',
          boxShadow: 2,
          height: isPhone ? '72px' : '64px'
        }}
      >
        <Toolbar sx={{ height: isPhone ? '72px' : '64px' }}>
          {/* Logo and Brand */}
          <Typography
            variant="h6"
            component="div"
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              fontWeight: isDesktop ? 'bold' : 'normal',
              mr: isDesktop ? 4 : 1,
              color: 'foreground.contrastPrimary',
              cursor: 'default'
            }}
          >
            <Logo height="32px" width="32px" style={{ marginRight: isDesktop ? '12px' : '0' }} />
            {isDesktop && 'AquaMesh'}
          </Typography>

          {/* Main Navigation Items */}
          <Box sx={{ flexGrow: 1, display: 'flex' }}>
            {/* Dashboard Options Menu */}
            {isPhone || isTablet ? (
              <DashboardOptionsMenu />
            ) : (
              <DashboardOptionsMenu />
            )}

            {/* Widgets Menu */}
            {isPhone || isTablet ? (
              <ButtonWithLabel
                icon={<WidgetsIcon />}
                label={isPhone ? "Widgets" : "Widgets"}
                onClick={handleWidgetsMenuOpen}
                data-tutorial-id="widgets-button"
              />
            ) : (
              <Button
                onClick={handleWidgetsMenuOpen}
                sx={{ 
                  color: 'foreground.contrastPrimary', 
                  display: 'flex', 
                  alignItems: 'center',
                  minWidth: 'auto',
                  mx: 1,
                  px: 2,
                }}
                startIcon={<WidgetsIcon />}
                endIcon={<KeyboardArrowDownIcon />}
                data-tutorial-id="widgets-button"
              >
                Widgets
              </Button>
            )}
            <Menu
              anchorEl={widgetsAnchorEl}
              open={Boolean(widgetsAnchorEl)}
              onClose={handleClose}
              PaperProps={{
                sx: {
                  bgcolor: 'background.menu',
                  color: 'foreground.contrastPrimary',
                  width: '250px',
                  boxShadow: 3
                }
              }}
            >
              {/* Widget Management Section */}
              {userData.id === 'admin' && userData.role === 'ADMIN_ROLE' && (
                <>
                  <MenuItem 
                    onClick={handleOpenWidgetsLibrary}
                    sx={{ p: 1.5 }}
                  >
                    <ListItemIcon>
                      <FolderIcon fontSize="small" sx={{ color: 'foreground.contrastPrimary' }}/>
                    </ListItemIcon>
                    Manage Widgets
                  </MenuItem>
                  <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                </>
              )}

              {/* Predefined Widgets Section */}
              <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', mt: 1, color: '#000000DE' }}>
                Predefined Widgets
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
              {topNavBarWidgets.filter((widget: { name: string }) => !widget.name.includes('Custom')).map((topNavBarWidget: { name: string; items: Array<{ name: string; component: string }> }) => (
                <Box key={topNavBarWidget.name}>
                  {topNavBarWidget.items.map((item: { name: string; component: string }) => (
                    <MenuItem 
                      key={item.name} 
                      onClick={() => {
                        ensureDashboardAndAddComponent({
                          id: `panel-${Date.now()}`,
                          ...item,
                        })
                        handleClose()
                      }}
                      sx={{ p: 1.5 }}
                    >
                      {item.name}
                    </MenuItem>
                  ))}
                </Box>
              ))}
              
              {/* Custom Widgets Section */}
              {topNavBarWidgets.filter((widget: { name: string }) => widget.name.includes('Custom')).length > 0 && (
                <>
                  <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', mt: 1, color: '#000000DE' }}>
                    Custom Widgets
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                  {topNavBarWidgets.filter((widget: { name: string }) => widget.name.includes('Custom')).map((topNavBarWidget: { name: string; items: Array<{ name: string; component: string; customProps?: { widgetId?: string } }> }) => (
                    <Box key={topNavBarWidget.name}>
                      {topNavBarWidget.items.map((item: { name: string; component: string; customProps?: { widgetId?: string } }) => (
                        <MenuItem 
                          key={item.name} 
                          onClick={() => {
                            ensureDashboardAndAddComponent({
                              id: `panel-${Date.now()}`,
                              ...item,
                            })
                            handleClose()
                          }}
                          sx={{ 
                            p: 1.5,
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          {item.name}
                        </MenuItem>
                      ))}
                    </Box>
                  ))}
                </>
              )}
            </Menu>

            {/* Create Custom Widget Button */}
            {userData.id === 'admin' && userData.role === 'ADMIN_ROLE' && (
              isPhone || isTablet ? (
                <ButtonWithLabel
                  icon={<CreateIcon />}
                  label={isPhone ? "Editor" : "Widget Editor"}
                  onClick={() => {
                    ensureDashboardAndAddComponent({
                      id: `widget-editor-${Date.now()}`,
                      name: "Widget Editor",
                      component: "WidgetEditor",
                    })
                    handleClose()
                  }}
                  data-tutorial-id="create-widget-button"
                />
              ) : (
                <Button
                  onClick={() => {
                    ensureDashboardAndAddComponent({
                      id: `widget-editor-${Date.now()}`,
                      name: "Widget Editor",
                      component: "WidgetEditor",
                    })
                    handleClose()
                  }}
                  sx={{ 
                    color: 'foreground.contrastPrimary', 
                    display: 'flex', 
                    alignItems: 'center',
                    minWidth: 'auto',
                    mx: 1,
                    px: 2,
                  }}
                  startIcon={<CreateIcon />}
                  data-tutorial-id="create-widget-button"
                >
                  Widget Editor
                </Button>
              )
            )}
          </Box>

          {/* Right Side Elements */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isPhone ? (
              <>
                {/* More menu grouping Tutorial & FAQ on phone */}
                <ButtonWithLabel
                  icon={<HelpIcon />}
                  label="Help"
                  onClick={handleMoreMenuOpen}
                  data-tutorial-id="help-button"
                />
                <Menu
                  anchorEl={moreAnchorEl}
                  open={Boolean(moreAnchorEl)}
                  onClose={handleMoreMenuClose}
                  PaperProps={{
                    sx: {
                      bgcolor: 'background.menu',
                      color: 'foreground.contrastPrimary',
                      boxShadow: 3
                    }
                  }}
                >
                  <MenuItem
                    onClick={() => (handleOpenTutorial(), handleMoreMenuClose())}
                    sx={{ p: 1.5 }}
                  >
                    <ListItemIcon>
                      <ImportContactsIcon fontSize="small" sx={{ color: 'foreground.contrastPrimary' }} />
                    </ListItemIcon>
                    Tutorial
                  </MenuItem>
                  <MenuItem
                    onClick={() => (handleOpenFaq(), handleMoreMenuClose())}
                    sx={{ p: 1.5 }}
                  >
                    <ListItemIcon>
                      <HelpOutlineIcon fontSize="small" sx={{ color: 'foreground.contrastPrimary' }} />
                    </ListItemIcon>
                    FAQ
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                {/* Tutorial Button */}
                <ButtonWithLabel
                  icon={<ImportContactsIcon />}
                  label="Tutorial"
                  onClick={handleOpenTutorial}
                  data-tutorial-id="help-button"
                />

                {/* FAQ Button */}
                <ButtonWithLabel
                  icon={<HelpOutlineIcon />}
                  label="FAQ"
                  onClick={handleOpenFaq}
                  data-tutorial-id="faq-button"
                />
              </>
            )}
            
            <Divider orientation="vertical" flexItem sx={{ mx: isPhone ? 0.5 : isTablet ? 1 : 2, bgcolor: 'background.light' }} />

            {/* User Menu */}
            {isPhone || isTablet ? (
              <ButtonWithLabel
                icon={
                  <Avatar 
                    sx={{ 
                      width: 32, 
                      height: 32, 
                      bgcolor: 'primary.main',
                      fontSize: '0.9rem'
                    }}
                  >
                    {userData.id.substring(0, 2).toUpperCase()}
                  </Avatar>
                }
                label="User"
                onClick={handleUserMenuOpen}
                sx={{ minWidth: '45px' }}
              />
            ) : (
              <Button
                onClick={handleUserMenuOpen}
                sx={{ 
                  color: 'foreground.contrastPrimary', 
                  textTransform: 'none',
                  minWidth: 'auto',
                  px: 2,
                  display: 'flex'
                }}
                endIcon={<KeyboardArrowDownIcon />}
              >
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32, 
                    bgcolor: 'primary.main',
                    mr: 1,
                    fontSize: '0.9rem'
                  }}
                >
                  {userData.id.substring(0, 2).toUpperCase()}
                </Avatar>
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
                    {userData.name}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1 }}>
                    {userData.role}
                  </Typography>
                </Box>
              </Button>
            )}
            <Menu
              anchorEl={userAnchorEl}
              open={Boolean(userAnchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleLogout} sx={{ color: 'white' }}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" sx={{ color: 'white' }}/>
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Tutorial Modal */}
      <TutorialModal 
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onShowOnStartupToggle={handleToggleTutorialStartup}
      />
      
      {/* FAQ Dialog */}
      <FAQDialog
        open={faqDialogOpen}
        onClose={() => setFaqDialogOpen(false)}
      />
      
      {/* Widget Management Modal */}
      <WidgetManagementModal
        open={isWidgetManagementOpen}
        onClose={closeWidgetManagement}
        widgets={widgets}
        onPreview={previewWidget}
        onEdit={editWidget}
        onDelete={deleteWidget}
      />
    </>
  )
}

export default TopNavBar 