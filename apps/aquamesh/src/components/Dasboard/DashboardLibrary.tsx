import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  IconButton,
  Box,
  Paper,
  Tooltip,
  Chip,
  TextField,
  InputAdornment,
  MenuItem,
  FormControl,
  Select,
  SelectChangeEvent,
  InputLabel,
  Grid,
  Fade,
  Switch,
  FormControlLabel,
  Menu,
  useTheme,
  useMediaQuery
} from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DeleteIcon from '@mui/icons-material/Delete'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import PublicIcon from '@mui/icons-material/Public'
import LockIcon from '@mui/icons-material/Lock'
import { Layout } from '../../types/types'
import { useDashboards } from './DashboardProvider'
import { DefaultDashboard } from './fixture'
import DeleteConfirmationDialog from '../WidgetEditor/components/dialogs/DeleteConfirmationDialog'

interface SavedDashboard {
  id: string;
  name: string;
  layout: Layout;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
  componentsCount: number;
}

interface SavedDashboardsDialogProps {
  open: boolean;
  onClose: () => void;
}

// Add a new interface for the edit dashboard dialog
interface EditDashboardDialogProps {
  open: boolean;
  onClose: () => void;
  dashboard: SavedDashboard | null;
  onSave: (dashboard: SavedDashboard) => void;
}

// Sort types
type SortOption = 'nameAsc' | 'nameDesc' | 'dateNewest' | 'dateOldest' | 'mostComponents' | 'fewestComponents'

const SavedDashboardsDialog: React.FC<SavedDashboardsDialogProps> = ({
  open,
  onClose,
}) => {
  // Increased card spacing and padding for mobile via responsive styles
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  
  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('dateNewest')
  
  // Filter state
  const [showPublicOnly, setShowPublicOnly] = useState(false)
  
  // Dashboard state
  const [dashboards, setDashboards] = useState<SavedDashboard[]>([])
  
  // User state - check if user is admin
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [dashboardToDelete, setDashboardToDelete] = useState<string | null>(null)
  
  // Access dashboards context
  const { addDashboard } = useDashboards()
  
  // Add state for edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [dashboardToEdit, setDashboardToEdit] = useState<SavedDashboard | null>(null)
  
  // Theme and responsive breakpoints for xs checks
  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  
  // State for action menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuDashboard, setMenuDashboard] = useState<SavedDashboard | null>(null)
  
  // Get the delete confirmation preference from localStorage
  const shouldConfirmDelete = () => {
    try {
      const stored = localStorage.getItem('widget-editor-delete-dashboard-confirmation')
      if (stored !== null) {
        return JSON.parse(stored)
      }
      return true // Default to true if not set
    } catch (error) {
      console.error('Error reading widget-editor-delete-dashboard-confirmation from localStorage', error)
      return true // Default to true if there's an error
    }
  }
  
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
  
  // Function to load dashboards from localStorage
  const loadDashboards = () => {
    try {
      const savedDashboards = localStorage.getItem('customDashboards')
      if (savedDashboards) {
        const parsedDashboards = JSON.parse(savedDashboards)
        
        // Transform to ensure all required fields
        const formattedDashboards = parsedDashboards.map((dashboard: { 
          id: string; 
          name: string; 
          layout: Layout; 
          description?: string;
          tags?: string[];
          isPublic?: boolean;
          createdAt?: string;
          updatedAt?: string;
        }) => ({
          id: dashboard.id,
          name: dashboard.name,
          layout: dashboard.layout,
          description: dashboard.description || 'No description',
          tags: dashboard.tags || ['dashboard'],
          isPublic: dashboard.isPublic || false,
          createdAt: dashboard.createdAt || new Date().toISOString(),
          updatedAt: dashboard.updatedAt || new Date().toISOString(),
          componentsCount: calculateComponentsCount(dashboard.layout),
        }))
        
        setDashboards(formattedDashboards)
      }
    } catch (error) {
      console.error('Failed to load dashboards from localStorage', error)
      setDashboards([])
    }
  }
  
  // Calculate the number of components in a layout
  const calculateComponentsCount = (layout: Layout): number => {
    let count = 0
    
    // Define NodeType interface for better type safety
    interface NodeType {
      type?: string;
      component?: string | unknown;
      children?: NodeType[];
      weight?: number;
      name?: string;
    }
    
    // Count tabs with components
    const countTabs = (node: NodeType): number => {
      if (!node) {
        return 0
      }
      
      if (node.type === 'tab' && node.component) {
        return 1
      }
      
      if (node.children && Array.isArray(node.children)) {
        return node.children.reduce((sum: number, child: NodeType) => sum + countTabs(child), 0)
      }
      
      return 0
    }
    
    count = countTabs(layout as unknown as NodeType)
    return count
  }
  
  // Load dashboards when dialog opens
  useEffect(() => {
    if (open) {
      loadDashboards()
      setSearchTerm('')
      setSortBy('dateNewest')
    }
  }, [open])
  
  // Handle opening a dashboard
  const handleOpenDashboard = (dashboard: SavedDashboard) => {
    // Convert saved dashboard to the format needed by DashboardProvider
    const dashboardToOpen: DefaultDashboard = {
      name: dashboard.name,
      layout: dashboard.layout
    }
    
    // Add the dashboard
    addDashboard(dashboardToOpen)
    
    // Close the dialog
    onClose()
  }
  
  // Function to delete a dashboard
  const handleDeleteDashboard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Check if we should confirm deletion
    if (shouldConfirmDelete()) {
      setDashboardToDelete(id)
      setDeleteConfirmOpen(true)
    } else {
      // Delete without confirmation
      deleteDashboard(id)
    }
  }
  
  // Function to actually delete the dashboard
  const deleteDashboard = (id: string) => {
    try {
      const updatedDashboards = dashboards.filter(dashboard => dashboard.id !== id)
      setDashboards(updatedDashboards)
      localStorage.setItem('customDashboards', JSON.stringify(updatedDashboards))
    } catch (error) {
      console.error('Failed to delete dashboard', error)
    }
  }
  
  // Confirm dashboard deletion
  const confirmDeleteDashboard = () => {
    if (dashboardToDelete) {
      deleteDashboard(dashboardToDelete)
      setDeleteConfirmOpen(false)
      setDashboardToDelete(null)
    }
  }
  
  // Cancel dashboard deletion
  const cancelDeleteDashboard = () => {
    setDeleteConfirmOpen(false)
    setDashboardToDelete(null)
  }
  
  // Function to toggle a dashboard's public status
  const handleTogglePublic = (id: string, e: React.MouseEvent) => {
    if (!isAdmin) {
      return
    }
    
    e.stopPropagation()
    try {
      const updatedDashboards = dashboards.map(dashboard => {
        if (dashboard.id === id) {
          return { ...dashboard, isPublic: !dashboard.isPublic }
        }
        return dashboard
      })
      setDashboards(updatedDashboards)
      localStorage.setItem('customDashboards', JSON.stringify(updatedDashboards))
    } catch (error) {
      console.error('Failed to update dashboard visibility', error)
    }
  }
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }
  
  // Handle sort change
  const handleSortChange = (e: SelectChangeEvent) => {
    setSortBy(e.target.value as SortOption)
  }
  
  // Handle public filter toggle
  const handlePublicFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowPublicOnly(e.target.checked)
  }
  
  // Filter dashboards based on search term, public filter, and user role
  const filteredDashboards = useMemo(() => {
    let filtered = dashboards
    
    // If not admin, only show public dashboards
    if (!isAdmin) {
      filtered = filtered.filter(dashboard => dashboard.isPublic)
    } else if (showPublicOnly) {
      // Admin user with public filter enabled
      filtered = filtered.filter(dashboard => dashboard.isPublic)
    }
    
    // Apply search filter if there's a search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(dashboard => 
        dashboard.name.toLowerCase().includes(term) ||
        dashboard.description?.toLowerCase().includes(term) ||
        dashboard.tags?.some(tag => tag.toLowerCase().includes(term))
      )
    }
    
    return filtered
  }, [dashboards, searchTerm, showPublicOnly, isAdmin])
  
  // Sort filtered dashboards
  const sortedDashboards = useMemo(() => {
    return [...filteredDashboards].sort((a, b) => {
      switch (sortBy) {
      case 'nameAsc':
        return a.name.localeCompare(b.name)
      case 'nameDesc':
        return b.name.localeCompare(a.name)
      case 'dateNewest':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'dateOldest':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      case 'mostComponents':
        return b.componentsCount - a.componentsCount
      case 'fewestComponents':
        return a.componentsCount - b.componentsCount
      default:
        return 0
      }
    })
  }, [filteredDashboards, sortBy])
  
  // Function to handle editing a dashboard
  const handleEditDashboard = (dashboard: SavedDashboard, e: React.MouseEvent) => {
    e.stopPropagation()
    setDashboardToEdit(dashboard)
    setEditDialogOpen(true)
  }

  // Function to save edited dashboard
  const handleSaveEditedDashboard = (editedDashboard: SavedDashboard) => {
    try {
      const updatedDashboards = dashboards.map(dashboard => 
        dashboard.id === editedDashboard.id ? editedDashboard : dashboard
      )
      setDashboards(updatedDashboards)
      localStorage.setItem('customDashboards', JSON.stringify(updatedDashboards))
      setEditDialogOpen(false)
      setDashboardToEdit(null)
    } catch (error) {
      console.error('Failed to update dashboard', error)
    }
  }
  
  const handleMenuOpen = (dashboard: SavedDashboard, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setMenuDashboard(dashboard)
    setMenuAnchorEl(e.currentTarget)
  }
  const handleMenuClose = () => {
    setMenuAnchorEl(null)
    setMenuDashboard(null)
  }
  
  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            overflow: 'hidden',
            bgcolor: '#00A389', // Teal background for the entire dialog
          }
        }}
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
              <DashboardIcon sx={{ mr: 1.5, color: '#eee' }} />
              <Typography 
                variant="h5" 
                component="div" 
                fontWeight="bold" 
                sx={{
                  color: '#eee',
                  textShadow: '0px 1px 2px rgba(255, 255, 255, 0.3)'
                }}
              >
                Dashboard Library
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
        
        <DialogContent sx={{ p: { xs: 2, sm: 3 }, bgcolor: '#00A389'}}>
          {/* Search, Sort, and Filter Controls */}
          <Grid container spacing={2} sx={{ mb: 3, mt: 1 }}>
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                placeholder="Search dashboards..."
                value={searchTerm}
                onChange={handleSearchChange}
                variant="outlined"
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm ? (
                    <InputAdornment position="end">
                      <IconButton 
                        size="small" 
                        onClick={() => setSearchTerm('')}
                        sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                  sx: {
                    bgcolor: 'rgba(0, 0, 0, 0.1)',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
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
                sx={{
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)'
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel id="sort-by-label" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Sort By</InputLabel>
                <Select
                  labelId="sort-by-label"
                  value={sortBy}
                  onChange={handleSortChange}
                  label="Sort By"
                  startAdornment={
                    <InputAdornment position="start">
                      <SortIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
                  }
                  sx={{
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
                  }}
                >
                  <MenuItem value="nameAsc">Name (A-Z)</MenuItem>
                  <MenuItem value="nameDesc">Name (Z-A)</MenuItem>
                  <MenuItem value="dateNewest">Date (Newest First)</MenuItem>
                  <MenuItem value="dateOldest">Date (Oldest First)</MenuItem>
                  <MenuItem value="mostComponents">Most Components</MenuItem>
                  <MenuItem value="fewestComponents">Fewest Components</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              {isAdmin && (
                <FormControlLabel
                  control={
                    <Switch 
                      checked={showPublicOnly} 
                      onChange={handlePublicFilterChange}
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
                  label="Public only"
                  sx={{ 
                    color: 'white',
                    '& .MuiFormControlLabel-label': {
                      fontSize: '0.875rem'
                    }
                  }}
                />
              )}
            </Grid>
          </Grid>
          
          {/* Results count and non-admin message */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
              {sortedDashboards.length === 0 
                ? "No dashboards found" 
                : `Showing ${sortedDashboards.length} dashboard${sortedDashboards.length !== 1 ? 's' : ''}`
              }
              {searchTerm && ` matching "${searchTerm}"`}
              {!isAdmin && " (only showing public dashboards)"}
            </Typography>
          </Box>

          {/* Dashboards list */}
          {sortedDashboards.length === 0 ? (
            <Paper 
              elevation={0} 
              sx={{ 
                p: 4, 
                textAlign: 'center',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 2,
                border: '1px dashed rgba(255, 255, 255, 0.3)',
              }}
            >
              <DashboardIcon 
                sx={{ 
                  fontSize: 48, 
                  mb: 2, 
                  color: 'rgba(255, 255, 255, 0.6)'
                }} 
              />
              <Typography color="white" variant="h6" gutterBottom>
                {searchTerm ? 'No Matching Dashboards' : 'No Dashboards Available'}
              </Typography>
              <Typography color="rgba(255, 255, 255, 0.7)" variant="body2">
                {searchTerm 
                  ? 'Try a different search term or clear the search' 
                  : !isAdmin 
                    ? 'No public dashboards are currently available' 
                    : 'No dashboards have been saved yet'
                }
              </Typography>
            </Paper>
          ) : (
            <List>
              {sortedDashboards.map((dashboard, index) => (
                <Fade key={dashboard.id} in={true} timeout={300} style={{ transitionDelay: `${index * 50}ms` }}>
                  <Paper
                    elevation={0}
                    sx={{
                      mb: { xs: 1, sm: 2 },
                      width: '100%',
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 2,
                      transition: 'all 0.2s ease-in-out',
                      bgcolor: '#00886F',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      cursor: 'pointer'
                    }}
                    onClick={() => handleOpenDashboard(dashboard)}
                  >
                    <Box
                      sx={{
                        p: { xs: 1, sm: 2 },
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: { xs: 'center', sm: 'flex-start' },
                      }}
                    >
                      <Box sx={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: { xs: 'center', sm: 'space-between' },
                        alignItems: { xs: 'center', sm: 'flex-start' },
                        position: { xs: 'relative', sm: 'static' }
                      }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flexGrow: { xs: 0, sm: 1 },
                            flexDirection: { xs: 'column', sm: 'row' }
                          }}>
                          <Box
                            sx={{
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              width: { xs: 32, sm: 40 },
                              height: { xs: 32, sm: 40 },
                              mr: 2
                            }}
                          >
                            <DashboardIcon fontSize={isXs ? 'small' : 'medium'} />
                          </Box>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="bold" color="white" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                              {dashboard.name}
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, mt: 0.5 }}>
                              <Typography variant="caption" color="rgba(255, 255, 255, 0.7)" sx={{ display: { xs: 'none', sm: 'block' }, fontSize: '0.8rem' }}>
                                Last modified: {new Date(dashboard.updatedAt).toLocaleDateString()} at {new Date(dashboard.updatedAt).toLocaleTimeString()}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: { xs: 0.5, sm: 0 }, ml: { xs: 0, sm: 2 } }}>
                                <Chip size="small" label={`${dashboard.componentsCount} components`} sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(255, 255, 255, 0.15)', color: 'white' }} />
                                {dashboard.isPublic && (
                                  <Chip size="small" label="Public" icon={<PublicIcon style={{ width: 12, height: 12, color: 'white' }} />} sx={{ ml: 1, height: 20, fontSize: '0.7rem', bgcolor: 'rgba(0, 209, 171, 0.3)', color: 'white' }} />
                                )}
                              </Box>
                            </Box>
                            {dashboard.tags && dashboard.tags.length > 0 && (
                              <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                {dashboard.tags.map((tag, tagIndex) => (
                                  <Chip
                                    key={tagIndex}
                                    label={tag}
                                    size="small"
                                    sx={{
                                      height: 18,
                                      fontSize: '0.65rem',
                                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                                      color: 'rgba(255, 255, 255, 0.8)'
                                    }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Box>
                        <Box
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            position: { xs: 'absolute', sm: 'static' },
                            top: { xs: '8px', sm: 'auto' },
                            right: { xs: '8px', sm: 'auto' }
                          }}
                        >
                          {isAdmin && (
                            <>
                              {/* xs: overflow menu, sm+: inline icons */}
                              <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                                <IconButton size="small" sx={{ color: 'white' }} onClick={(e) => handleMenuOpen(dashboard, e)}>
                                  <MoreVertIcon fontSize="small" />
                                </IconButton>
                              </Box>
                              <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
                                <Tooltip title="Edit Dashboard">
                                  <IconButton size="small" onClick={(e) => handleEditDashboard(dashboard, e)} sx={{ mr: 1, bgcolor: 'rgba(0,150,136,0.1)', color: 'white', '&:hover': { bgcolor: 'rgba(0,150,136,0.2)' } }}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={dashboard.isPublic ? 'Make Private' : 'Make Public'}>
                                  <IconButton size="small" onClick={(e) => handleTogglePublic(dashboard.id, e)} sx={{ mr: 1, bgcolor: dashboard.isPublic ? 'rgba(0,209,171,0.2)' : 'rgba(255,255,255,0.1)', color: 'white', '&:hover': { bgcolor: dashboard.isPublic ? 'rgba(0,209,171,0.3)' : 'rgba(255,255,255,0.2)' } }}>
                                    {dashboard.isPublic ? <LockIcon fontSize="small" /> : <PublicIcon fontSize="small" />}
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Dashboard">
                                  <IconButton size="small" color="error" onClick={(e) => handleDeleteDashboard(dashboard.id, e)} sx={{ bgcolor: 'rgba(211,47,47,0.1)', '&:hover': { bgcolor: 'rgba(211,47,47,0.2)' } }}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                              {/* Mobile action menu */}
                              <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl) && menuDashboard?.id === dashboard.id} onClose={handleMenuClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                                <MenuItem onClick={(e: React.MouseEvent<HTMLElement>) => { handleEditDashboard(dashboard, e); handleMenuClose() }}>Edit</MenuItem>
                                <MenuItem onClick={(e: React.MouseEvent<HTMLElement>) => { handleTogglePublic(dashboard.id, e); handleMenuClose() }}>{dashboard.isPublic ? 'Make Private' : 'Make Public'}</MenuItem>
                                <MenuItem onClick={(e: React.MouseEvent<HTMLElement>) => { handleDeleteDashboard(dashboard.id, e); handleMenuClose() }}>Delete</MenuItem>
                              </Menu>
                            </>
                          )}
                        </Box>
                      </Box>
                      {dashboard.description && (
                        <Typography 
                          variant="body2" 
                          color="rgba(255, 255, 255, 0.7)"
                          sx={{ mt: { xs: 0.5, sm: 1 }, pl: { xs: 0, sm: 7 }, textAlign: { xs: 'center', sm: 'left' }, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
                        >
                          {dashboard.description}
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                </Fade>
              ))}
            </List>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3, bgcolor: '#00A389' }}>
          <Button 
            onClick={onClose} 
            variant="contained"
            sx={{ 
              bgcolor: '#00D1AB',
              color: '#191919',
              '&:hover': {
                bgcolor: '#00E4BC',
              }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog - Replace with the imported DeleteConfirmationDialog */}
      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        title="Delete Dashboard"
        content="Are you sure you want to delete this dashboard? This action cannot be undone."
        onConfirm={confirmDeleteDashboard}
        onCancel={cancelDeleteDashboard}
      />
      
      {/* Edit Dashboard Dialog */}
      <EditDashboardDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        dashboard={dashboardToEdit}
        onSave={handleSaveEditedDashboard}
      />
    </>
  )
}

// Create the EditDashboardDialog component
const EditDashboardDialog: React.FC<EditDashboardDialogProps> = ({
  open,
  onClose,
  dashboard,
  onSave,
}) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [tagInput, setTagInput] = useState('')
  
  // Initialize form values when dashboard changes
  useEffect(() => {
    if (dashboard) {
      setName(dashboard.name)
      setDescription(dashboard.description || '')
      setTags(dashboard.tags || [])
      setIsPublic(dashboard.isPublic || false)
    }
  }, [dashboard])
  
  // Handle form submission
  const handleSubmit = () => {
    if (dashboard && name.trim()) {
      const updatedDashboard: SavedDashboard = {
        ...dashboard,
        name: name.trim(),
        description: description.trim() || 'No description',
        tags: tags.length > 0 ? tags : ['dashboard'],
        isPublic,
        updatedAt: new Date().toISOString()
      }
      onSave(updatedDashboard)
    }
  }
  
  // Handle adding a tag
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }
  
  // Handle removing a tag
  const handleRemoveTag = (tagToDelete: string) => {
    setTags(tags.filter(tag => tag !== tagToDelete))
  }
  
  // Handle tag input key down
  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: '#00A389'
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: '#00BC9A', 
        color: '#191919',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2
      }}>
        <Box display="flex" alignItems="center">
          <EditIcon sx={{ mr: 1.5, color: '#191919' }} />
          <Typography variant="h6" component="div" fontWeight="bold">
            Edit Dashboard
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          aria-label="close"
          sx={{ color: '#191919' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3, bgcolor: '#00A389' }}>
        <Box component="form" sx={{ mt: 1 }}>
          <TextField
            fullWidth
            label="Dashboard Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => { e.target.select() }}
            margin="normal"
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
              }
            }}
          />
          
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={(e) => { e.target.select() }}
            margin="normal"
            multiline
            rows={3}
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
              {tags.map((tag, index) => (
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
              {tags.length === 0 && (
                <Typography variant="body2" color="rgba(255, 255, 255, 0.5)">
                  No tags added yet
                </Typography>
              )}
            </Box>
          </Box>
          
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
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, bgcolor: '#00A389' }}>
        <Button 
          onClick={onClose} 
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
          onClick={handleSubmit} 
          variant="contained"
          disabled={!name.trim()}
          sx={{ 
            bgcolor: '#00D1AB',
            color: '#191919',
            '&:hover': {
              bgcolor: '#00E4BC',
            }
          }}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SavedDashboardsDialog 