import React, { useState, useEffect } from 'react'
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Tooltip } from '@mui/material'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'

import { ReactComponent as AddIcon } from '../../icons/add.svg'
import { ReactComponent as CloseIcon } from '../../icons/close.svg'
import SaveIcon from '@mui/icons-material/Save'

import LayoutView from '../Layout/Layout'
import { ViewLayout } from '../../state/store'
import { useViews } from './ViewsProvider'
import './tabs.scss'

// Define custom dashboard type for localStorage
interface SavedDashboard {
  id: string;
  name: string;
  layout: ViewLayout;
  timestamp: number;
}

// Dashboard Storage utilities
const DashboardStorage = {
  getAll: (): SavedDashboard[] => {
    try {
      const dashboards = localStorage.getItem('customDashboards')
      return dashboards ? JSON.parse(dashboards) : []
    } catch (error) {
      console.error('Failed to parse saved dashboards', error)
      return []
    }
  },
  
  getByName: (name: string): SavedDashboard | null => {
    try {
      const dashboards = DashboardStorage.getAll()
      return dashboards.find(dashboard => dashboard.name === name) || null
    } catch (error) {
      console.error('Failed to find dashboard by name', error)
      return null
    }
  },
  
  save: (name: string, layout: ViewLayout): SavedDashboard => {
    try {
      const dashboards = DashboardStorage.getAll()
      // Check if a dashboard with this name already exists and update it
      const existingIndex = dashboards.findIndex(d => d.name === name)
      
      const newDashboard: SavedDashboard = {
        id: existingIndex >= 0 ? dashboards[existingIndex].id : `dashboard-${Date.now()}`,
        name,
        layout,
        timestamp: Date.now()
      }
      
      if (existingIndex >= 0) {
        dashboards[existingIndex] = newDashboard
      } else {
        dashboards.push(newDashboard)
      }
      
      localStorage.setItem('customDashboards', JSON.stringify(dashboards))
      return newDashboard
    } catch (error) {
      console.error('Failed to save dashboard', error)
      throw error
    }
  },
  
  delete: (id: string): void => {
    try {
      const dashboards = DashboardStorage.getAll()
      const filteredDashboards = dashboards.filter(dashboard => dashboard.id !== id)
      localStorage.setItem('customDashboards', JSON.stringify(filteredDashboards))
    } catch (error) {
      console.error('Failed to delete dashboard', error)
    }
  },
  
  // Check if the current layout is different from the saved one
  hasChanges: (name: string, currentLayout?: ViewLayout): boolean => {
    const savedDashboard = DashboardStorage.getByName(name)
    if (!savedDashboard) { return true } // If no saved dashboard exists, then there are changes
    if (!currentLayout) { return false } // If no current layout, no changes
    
    // Deep comparison between the current layout and saved layout
    return JSON.stringify(currentLayout) !== JSON.stringify(savedDashboard.layout)
  }
}

const Views = () => {
  const {
    openViews,
    selectedView,
    setSelectedView,
    removeView,
    addView,
    updateLayout,
    renameView
  } = useViews()
  
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [dashboardName, setDashboardName] = useState('')
  const [currentTabIndex, setCurrentTabIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({})

  // Check if current views have changes compared to saved dashboards
  useEffect(() => {
    const changes: Record<string, boolean> = {}
    
    openViews.forEach((view, index) => {
      changes[index] = DashboardStorage.hasChanges(view.name, view.layout)
    })
    
    setHasChanges(changes)
  }, [openViews])

  const handleSaveDialogOpen = (index: number) => {
    const currentView = openViews[index]
    
    // Check if it's an update of an existing dashboard
    const existingDashboard = DashboardStorage.getByName(currentView.name)
    
    if (existingDashboard) {
      // Direct update without showing the dialog
      try {
        if (currentView.layout) {
          DashboardStorage.save(currentView.name, currentView.layout)
          
          // Mark this view as no longer having changes
          setHasChanges(prev => ({
            ...prev,
            [index]: false
          }))
        }
      } catch (error) {
        console.error('Error updating dashboard:', error)
      }
    } else {
      // Show save dialog for new dashboards
      setCurrentTabIndex(index)
      setDashboardName(currentView.name || '')
      setSaveDialogOpen(true)
    }
  }

  const handleSaveDialogClose = () => {
    setSaveDialogOpen(false)
    setDashboardName('')
    setCurrentTabIndex(null)
  }

  const handleSaveDashboard = () => {
    if (currentTabIndex !== null && dashboardName.trim() !== '') {
      const currentView = openViews[currentTabIndex]
      try {
        if (currentView.layout) {
          DashboardStorage.save(dashboardName, currentView.layout)
          
          // Update the view name in the TabList
          renameView(currentView.id, dashboardName)
          
          // Mark this view as no longer having changes
          setHasChanges(prev => ({
            ...prev,
            [currentTabIndex]: false
          }))
        }
        
        handleSaveDialogClose()
      } catch (error) {
        console.error('Error saving dashboard:', error)
      }
    }
  }

  return (
    <Box>
      <Tabs
        selectedIndex={selectedView}
        onSelect={(index) => setSelectedView(index)}
        style={{ position: 'relative' }}
      >
        <TabList>
          {openViews.map((view, index) => (
            <Tab key={view.id}>
              <Typography
                variant="subtitle2"
                sx={{
                  flex: '1 0 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginLeft: '0.5rem'
                }}
              >
                {view.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {hasChanges[index] && (
                  <Tooltip title="Save Dashboard">
                    <IconButton
                      size="small"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        handleSaveDialogOpen(index)
                      }}
                      sx={{
                        p: 0.5,
                        mr: 0.5,
                        color: 'primary.light',
                        '&:hover': { color: 'primary.main' }
                      }}
                    >
                      <SaveIcon sx={{ fontSize: 16 }}/>
                    </IconButton>
                  </Tooltip>
                )}
                <Box
                  className="close"
                  sx={{
                    display: 'flex',
                    p: 0.5,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: '999px',
                    transition: 'all .25s ease',
                    '&:hover': {
                      backgroundColor: 'action.contrastHover',
                    },
                  }}
                >
                  <CloseIcon
                    width={16}
                    height={16}
                    onClick={(ev) => {
                      // NOTE prevent the tab being closed from being selected too!
                      ev.stopPropagation()
                      removeView(view.id)
                    }}
                  />
                </Box>
              </Box>
            </Tab>
          ))}
          <Button
            size="small"
            variant="text"
            disableRipple
            sx={{
              position: 'relative',
              top: '3px',
              marginBottom: '8px',
              minWidth: 'fit-content',
              display: 'flex',
              alignItems: 'middle',
              gap: '8px',
              fontSize: '13px',
              p: '4px 12px',
              color: 'primary.light',
              transition: 'all .25s ease',
              '.MuiButton-startIcon': {
                transition: 'all .25s ease',
                m: 0,
                color: 'primary.light',
              },
              ':hover': {
                backgroundColor: 'transparent',
                color: 'primary.main',
                '.MuiButton-startIcon': {
                  color: 'primary.main',
                },
              },
            }}
            startIcon={<AddIcon width={16} height={16} />}
            onClick={() => addView()}
          />
        </TabList>
        {openViews.map((view) => (
          <TabPanel key={view.id}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: 'background.default',
              }}
            >
              <Box sx={{ position: 'relative', flex: '1' }}>
                <LayoutView
                  layout={view.layout}
                  updateLayout={(model) => {
                    updateLayout(model)
                    // Mark this view as having changes after layout update
                    setHasChanges(prev => ({
                      ...prev,
                      [selectedView]: true
                    }))
                  }}
                />
              </Box>
            </Box>
          </TabPanel>
        ))}
      </Tabs>

      {/* Save Dashboard Dialog */}
      <Dialog 
        open={saveDialogOpen} 
        onClose={handleSaveDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
          <Typography variant="h6">Save Dashboard</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Enter a name for your dashboard configuration
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Dashboard Name"
            type="text"
            fullWidth
            variant="outlined"
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
            error={dashboardName.trim() === ''}
            helperText={dashboardName.trim() === '' ? 'Dashboard name is required' : ''}
            InputProps={{
              endAdornment: dashboardName.trim() !== '' && (
                <IconButton 
                  size="small" 
                  onClick={() => setDashboardName('')}
                  edge="end"
                >
                  <CloseIcon width={16} height={16} />
                </IconButton>
              )
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleSaveDialogClose}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveDashboard} 
            variant="contained" 
            color="primary"
            disabled={dashboardName.trim() === ''}
            startIcon={<SaveIcon />}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Views