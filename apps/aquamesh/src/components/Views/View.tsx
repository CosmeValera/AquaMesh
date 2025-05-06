import React, { useState, useEffect } from 'react'
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Tooltip, FormControlLabel, Switch, Chip } from '@mui/material'
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
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
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
  
  save: (dashboard: SavedDashboard): SavedDashboard => {
    try {
      const dashboards = DashboardStorage.getAll()
      // Check if a dashboard with this id already exists and update it
      const existingIndex = dashboards.findIndex(d => d.id === dashboard.id)
      
      if (existingIndex >= 0) {
        dashboards[existingIndex] = dashboard
      } else {
        dashboards.push(dashboard)
      }
      
      localStorage.setItem('customDashboards', JSON.stringify(dashboards))
      return dashboard
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
  const [dashboardDescription, setDashboardDescription] = useState('')
  const [dashboardTags, setDashboardTags] = useState<string[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [currentTabIndex, setCurrentTabIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({})
  const [isAdmin, setIsAdmin] = useState(false)

  // Check if user is admin on component mount
  useEffect(() => {
    try {
      const userData = localStorage.getItem('userData')
      if (userData) {
        const parsedData = JSON.parse(userData)
        setIsAdmin(parsedData.id === 'admin' && parsedData.role === 'ADMIN_ROLE')
      }
    } catch (error) {
      console.error('Failed to parse user data', error)
      setIsAdmin(false)
    }
  }, [])

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
      // Direct update without showing the dialog for existing dashboards
      try {
        if (currentView.layout) {
          const updatedDashboard: SavedDashboard = {
            ...existingDashboard,
            layout: currentView.layout,
            updatedAt: new Date().toISOString()
          }
          
          DashboardStorage.save(updatedDashboard)
          
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
      // Show enhanced save dialog for new dashboards
      setCurrentTabIndex(index)
      setDashboardName(currentView.name || '')
      setDashboardDescription('')
      setDashboardTags(['dashboard'])
      setIsPublic(false)
      setTagInput('')
      setSaveDialogOpen(true)
    }
  }

  const handleSaveDialogClose = () => {
    setSaveDialogOpen(false)
    setDashboardName('')
    setDashboardDescription('')
    setDashboardTags([])
    setIsPublic(false)
    setTagInput('')
    setCurrentTabIndex(null)
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !dashboardTags.includes(tagInput.trim())) {
      setDashboardTags([...dashboardTags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setDashboardTags(dashboardTags.filter(tag => tag !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSaveDashboard = () => {
    if (currentTabIndex !== null && dashboardName.trim() !== '') {
      const currentView = openViews[currentTabIndex]
      try {
        if (currentView.layout) {
          const newDashboard: SavedDashboard = {
            id: `dashboard-${Date.now()}`,
            name: dashboardName.trim(),
            layout: currentView.layout,
            description: dashboardDescription.trim() || undefined,
            tags: dashboardTags.length > 0 ? dashboardTags : ['dashboard'],
            isPublic: isAdmin ? isPublic : false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          
          DashboardStorage.save(newDashboard)
          
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
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: '#00A389', // Teal background
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#00BC9A', 
          color: '#191919',
          borderBottom: 1, 
          borderColor: 'rgba(255, 255, 255, 0.2)', 
          pb: 2 
        }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight="medium">Save Dashboard</Typography>
              <Typography variant="body2" color="rgba(0, 0, 0, 0.7)" sx={{ mt: 0.5 }}>
                Configure your dashboard settings
              </Typography>
            </Box>
            <IconButton
              onClick={handleSaveDialogClose}
              aria-label="close"
              sx={{ color: '#191919' }}
            >
              <CloseIcon width={20} height={20} />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ bgcolor: '#00A389', pt: 3, pb: 2 }}>
          <TextField
            autoFocus
            margin="normal"
            id="name"
            label="Dashboard Name"
            type="text"
            fullWidth
            variant="outlined"
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
            onFocus={(e) => { e.target.select() }}
            error={dashboardName.trim() === ''}
            helperText={dashboardName.trim() === '' ? 'Dashboard name is required' : ''}
            required
            InputLabelProps={{ shrink: true, sx: { color: 'rgba(255, 255, 255, 0.7)' } }}
            InputProps={{
              sx: {
                bgcolor: 'rgba(0, 0, 0, 0.1)',
                color: 'white',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.3)'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.5)'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'white'
                }
              },
              endAdornment: dashboardName.trim() !== '' && (
                <IconButton 
                  size="small" 
                  onClick={() => setDashboardName('')}
                  edge="end"
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  <CloseIcon width={16} height={16} />
                </IconButton>
              )
            }}
          />
          
          <TextField
            margin="normal"
            id="description"
            label="Description (optional)"
            type="text"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={dashboardDescription}
            onChange={(e) => setDashboardDescription(e.target.value)}
            onFocus={(e) => { e.target.select() }}
            InputLabelProps={{ shrink: true, sx: { color: 'rgba(255, 255, 255, 0.7)' } }}
            InputProps={{
              sx: {
                bgcolor: 'rgba(0, 0, 0, 0.1)',
                color: 'white',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.3)'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.5)'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'white'
                }
              }
            }}
          />
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" color="white" gutterBottom>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TextField
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                size="small"
                onKeyDown={handleTagInputKeyDown}
                InputProps={{
                  sx: {
                    bgcolor: 'rgba(0, 0, 0, 0.1)',
                    color: 'white',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.3)'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.5)'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'white'
                    }
                  }
                }}
                sx={{ flexGrow: 1, mr: 1 }}
              />
              <Button 
                onClick={handleAddTag}
                variant="contained"
                disabled={!tagInput.trim()}
                sx={{ 
                  bgcolor: '#00D1AB',
                  color: '#191919',
                  '&:hover': {
                    bgcolor: '#00E4BC',
                  }
                }}
              >
                Add
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {dashboardTags.map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.15)',
                    color: 'white',
                    '& .MuiChip-deleteIcon': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&:hover': {
                        color: 'white'
                      }
                    }
                  }}
                />
              ))}
              {dashboardTags.length === 0 && (
                <Typography variant="body2" color="rgba(255, 255, 255, 0.5)">
                  No tags added yet
                </Typography>
              )}
            </Box>
          </Box>
          
          {isAdmin && (
            <FormControlLabel
              control={
                <Switch 
                  checked={isPublic} 
                  onChange={(e) => setIsPublic(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#00D1AB',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#00886F',
                    },
                  }}
                />
              }
              label="Make dashboard public"
              sx={{ 
                color: 'white',
                mt: 2
              }}
            />
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3, bgcolor: '#00A389', display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            onClick={handleSaveDialogClose}
            variant="outlined"
            sx={{ 
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              mr: 1,
              '&:hover': {
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.05)'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveDashboard} 
            variant="contained" 
            color="primary"
            disabled={dashboardName.trim() === ''}
            startIcon={<SaveIcon />}
            sx={{ 
              bgcolor: '#00D1AB',
              color: '#191919',
              '&:hover': {
                bgcolor: '#00E4BC',
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Views