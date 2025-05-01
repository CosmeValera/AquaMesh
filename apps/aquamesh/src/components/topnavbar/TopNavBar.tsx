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
import DashboardIcon from '@mui/icons-material/Dashboard'
import WidgetsIcon from '@mui/icons-material/Widgets'
import CreateIcon from '@mui/icons-material/Create'

import useTopNavBarWidgets from '../../customHooks/useTopNavBarWidgets'
import { useLayout } from '../Layout/LayoutProvider'
import { ReactComponent as Logo } from '../../../public/logo.svg'
import { useViews } from '../Views/ViewsProvider'
import { DefaultDashboard } from '../Views/fixture'
import DashboardOptions from './DashboardOptions'

// Define user data type
interface UserData {
  id: string
  name: string
  role: string
}

// Import Layout interface from DashboardOptions
interface Layout {
  type: 'row'
  weight: number
  children: any[] // Using any to avoid type conflicts with imported components
}

interface TopNavBarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TopNavBar: React.FC<TopNavBarProps> = () => {
  // State for different dropdown menus
  const [viewsAnchorEl, setViewsAnchorEl] = useState<null | HTMLElement>(null)
  const [panelsAnchorEl, setPanelsAnchorEl] = useState<null | HTMLElement>(null)
  const [userAnchorEl, setUserAnchorEl] = useState<null | HTMLElement>(null)
  const [userData, setUserData] = useState<UserData>({ id: 'admin', name: 'Admin User', role: 'ADMIN_ROLE' })
  
  const { topNavBarWidgets } = useTopNavBarWidgets()
  const { addComponent } = useLayout()
  const { addView } = useViews()
  const navigate = useNavigate()
  
  // Use theme and media query for responsive design
  const theme = useTheme()
  const isTablet = useMediaQuery(theme.breakpoints.down('md'))
  
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
  }, [])
  
  // Handle opening and closing dropdowns
  const handleViewsMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setViewsAnchorEl(event.currentTarget)
  }
  
  const handlePanelsMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setPanelsAnchorEl(event.currentTarget)
  }
  
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setUserAnchorEl(event.currentTarget)
  }
  
  const handleClose = () => {
    setViewsAnchorEl(null)
    setPanelsAnchorEl(null)
    setUserAnchorEl(null)
  }

  const handleLogout = () => {
    handleClose()
    navigate('/login')
  }

  // Create a view with predefined layout
  const createViewWithLayout = (viewName: string, layout: unknown) => {
    const newView: DefaultDashboard = {
      name: viewName,
      layout: layout as any
    }
    
    addView(newView)
    handleClose()
  }

  return (
    <AppBar 
      position="static" 
      sx={{ 
        backgroundColor: 'background.header',
        boxShadow: 2,
        height: '64px'
      }}
    >
      <Toolbar>
        {/* Logo and Brand */}
        <Typography
          variant="h6"
          component="div"
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            fontWeight: isTablet ? 'normal' : 'bold',
            color: 'foreground.contrastPrimary',
            mr: 4
          }}
        >
          <Logo height="32px" width="32px" style={{ marginRight: isTablet ? '4px' : '12px' }} />
          AquaMesh
        </Typography>

        {/* Main Navigation Items */}
        <Box sx={{ flexGrow: 1, display: 'flex' }}>
          {/* Dashboard/Views Menu */}
          <Button
            onClick={handleViewsMenuOpen}
            sx={{ 
              color: 'foreground.contrastPrimary', 
              display: 'flex', 
              alignItems: 'center',
              minWidth: isTablet ? '40px' : 'auto',
              mx: isTablet ? 0.5 : 1,
              px: isTablet ? 1 : 2,
            }}
            startIcon={<DashboardIcon />}
            endIcon={<KeyboardArrowDownIcon />}
          >
            {!isTablet ? 'Dashboards' : 'D.'}
          </Button>
          <Menu
            anchorEl={viewsAnchorEl}
            open={Boolean(viewsAnchorEl)}
            onClose={handleClose}
          >
            <DashboardOptions 
              topNavBarWidgets={topNavBarWidgets}
              createViewWithLayout={createViewWithLayout}
              handleClose={handleClose}
            />
          </Menu>

          {/* Panels/Widgets Menu */}
          <Button
            onClick={handlePanelsMenuOpen}
            sx={{ 
              color: 'foreground.contrastPrimary', 
              display: 'flex', 
              alignItems: 'center',
              minWidth: isTablet ? '40px' : 'auto',
              mx: isTablet ? 0.5 : 1,
              px: isTablet ? 1 : 2,
            }}
            startIcon={<WidgetsIcon />}
            endIcon={<KeyboardArrowDownIcon />}
          >
            {!isTablet ? 'Widgets' : 'W.'}
          </Button>
          <Menu
            anchorEl={panelsAnchorEl}
            open={Boolean(panelsAnchorEl)}
            onClose={handleClose}
          >
            {userData.id === 'admin' && userData.role === 'ADMIN_ROLE' && (
              <MenuItem 
                onClick={() => {
                  addComponent({
                    id: `widget-editor-${Date.now()}`,
                    name: "Widget Editor",
                    component: "WidgetEditor",
                  })
                  handleClose()
                }}
                sx={{ 
                  borderBottom: '1px solid #eee',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'primary.main',
                  fontWeight: 'bold'
                }}
              >
                <ListItemIcon>
                  <CreateIcon fontSize="small" color="primary" />
                </ListItemIcon>
                Create Custom Widget
              </MenuItem>
            )}
            {topNavBarWidgets.map((topNavBarWidget) => (
              <Box key={topNavBarWidget.name}>
                <Typography sx={{ px: 2, py: 1, fontWeight: 'bold' }}>
                  {topNavBarWidget.name}
                </Typography>
                <Divider />
                {topNavBarWidget.items.map((item) => (
                  <MenuItem 
                    key={item.name} 
                    onClick={() => {
                      addComponent({
                        id: `panel-${Date.now()}`,
                        ...item,
                      })
                      handleClose()
                    }}
                  >
                    {item.name}
                  </MenuItem>
                ))}
              </Box>
            ))}
          </Menu>
        </Box>

        {/* Right Side Elements */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Divider orientation="vertical" flexItem sx={{ mx: isTablet ? 1 : 2, bgcolor: 'background.light' }} />

          {/* User Menu */}
          <Button
            onClick={handleUserMenuOpen}
            sx={{ 
              color: 'foreground.contrastPrimary', 
              textTransform: 'none',
              minWidth: isTablet ? '45px' : 'auto',
              px: isTablet ? 0.5 : 2,
              display: 'flex'
            }}
            endIcon={isTablet ? null : <KeyboardArrowDownIcon />}
          >
            <Avatar 
              sx={{ 
                width: 32, 
                height: 32, 
                bgcolor: 'primary.main',
                mr: isTablet ? 0 : 1,
                fontSize: '0.9rem'
              }}
            >
              {userData.id.substring(0, 2).toUpperCase()}
            </Avatar>
            {!isTablet && (
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
                  {userData.name}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1 }}>
                  {userData.role}
                </Typography>
              </Box>
            )}
          </Button>
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
  )
}

export default TopNavBar 