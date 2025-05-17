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
  CircularProgress,
  useTheme,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import WidgetsIcon from '@mui/icons-material/Widgets'
import EditIcon from '@mui/icons-material/Edit'
import PreviewIcon from '@mui/icons-material/Visibility'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import CloseIcon from '@mui/icons-material/Close'
import { CustomWidget } from '../../WidgetStorage'
import DeleteConfirmationDialog from './DeleteConfirmationDialog'
import useMediaQuery from '@mui/material/useMediaQuery'

// Sorting options
type SortOption = 'dateNewest' | 'dateOldest' | 'nameAsc' | 'nameDesc' | 'mostComponents' | 'fewestComponents';

interface WidgetManagementModalProps {
  open: boolean
  onClose: () => void
  widgets: CustomWidget[]
  onPreview: (widget: CustomWidget) => void
  onEdit: (widget: CustomWidget) => void
  onDelete: (id: string) => void
}

const WidgetManagementModal: React.FC<WidgetManagementModalProps> = ({
  open,
  onClose,
  widgets,
  onPreview,
  onEdit,
  onDelete
}) => {
  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  
  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('dateNewest')
  
  // Loading state for operations
  const [isLoading, setIsLoading] = useState(false)
  
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [widgetToDelete, setWidgetToDelete] = useState<string | null>(null)
  // Delete all confirmation state
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false)
  
  // Phone breakpoint detection for responsive sizing
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  
  // Clear search when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearchTerm('')
      setIsLoading(false)
    }
  }, [open])
  
  // Function to check if delete confirmation is enabled
  const shouldConfirmDelete = (): boolean => {
    try {
      const storedValue = localStorage.getItem('widget-editor-delete-widget-confirmation')
      return storedValue !== 'false' // Default to true if not set
    } catch (error) {
      console.error('Error reading widget-editor-delete-widget-confirmation from localStorage', error)
      return true // Default to true if there's an error
    }
  }
  
  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent, widgetId: string) => {
    e.stopPropagation()
    
    if (shouldConfirmDelete()) {
      // Show confirmation dialog if enabled
      setWidgetToDelete(widgetId)
      setDeleteConfirmOpen(true)
    } else {
      // Delete directly if confirmation is disabled
      onDelete(widgetId)
    }
  }
  
  // Confirm deletion
  const confirmDelete = () => {
    if (widgetToDelete) {
      onDelete(widgetToDelete)
      setDeleteConfirmOpen(false)
      setWidgetToDelete(null)
    }
  }
  
  // Cancel deletion
  const cancelDelete = () => {
    setDeleteConfirmOpen(false)
    setWidgetToDelete(null)
  }
  
  // Handle delete all button click
  const handleDeleteAllClick = () => {
    setDeleteAllConfirmOpen(true)
  }

  // Confirm deletion of all widgets
  const confirmDeleteAll = () => {
    sortedWidgets.forEach(widget => onDelete(widget.id))
    setDeleteAllConfirmOpen(false)
  }

  // Cancel deletion of all widgets
  const cancelDeleteAll = () => {
    setDeleteAllConfirmOpen(false)
  }
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }
  
  // Handle sort change
  const handleSortChange = (e: SelectChangeEvent) => {
    setSortBy(e.target.value as SortOption)
  }
  
  // Filter widgets based on search term
  const filteredWidgets = useMemo(() => {
    if (!searchTerm.trim()) {
      return widgets
    }
    
    const term = searchTerm.toLowerCase()
    return widgets.filter(widget => 
      widget.name.toLowerCase().includes(term)
    )
  }, [widgets, searchTerm])
  
  // Sort filtered widgets
  const sortedWidgets = useMemo(() => {
    return [...filteredWidgets].sort((a, b) => {
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
        return b.components.length - a.components.length
      case 'fewestComponents':
        return a.components.length - b.components.length
      default:
        return 0
      }
    })
  }, [filteredWidgets, sortBy])
  
  // Format date to human-readable format
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      console.error('Invalid date format:', dateString)
      return 'Unknown date'
    }
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
            minHeight: 'fit-content',
            bgcolor: 'background.paper',
            backgroundImage: 'linear-gradient(to bottom, #00A389, #00886F)',
            borderRadius: 2,
            maxHeight: '80dvh',
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'primary.main', 
          color: 'white', 
          pb: 1,
          backgroundImage: 'linear-gradient(90deg, #00BC9A 0%, #00A389 100%)',
          position: 'sticky',
          top: 0,
          zIndex: 1200
        }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <WidgetsIcon sx={{ mr: 1 }} />
              <Typography 
                variant="h5" 
                component="div" 
                fontWeight="bold" 
                sx={{
                  color: '#eee',
                  textShadow: '0px 1px 2px rgba(255, 255, 255, 0.3)'
                }}
              >
                Widget Library
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
        
        <DialogContent sx={{ px: 3, py: 2, bgcolor: '#00A389' }}>
          {/* Search and Sort Controls */}
          <Grid container spacing={2} sx={{ mb: 3, mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search widgets by name..."
                value={searchTerm}
                onChange={handleSearchChange}
                variant="outlined"
                size="small"
                disabled={isLoading}
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
                        disabled={isLoading}
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
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" variant="outlined" disabled={isLoading}>
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
          </Grid>
          
          {/* Widget editor status info */}
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
              {sortedWidgets.length === 0 
                ? "No widgets found" 
                : `Showing ${sortedWidgets.length} widget${sortedWidgets.length !== 1 ? 's' : ''}`
              }
              {searchTerm && ` matching "${searchTerm}"`}
            </Typography>
            {sortedWidgets.length > 0 && (
              <Tooltip title="Delete All Widgets">
                <IconButton
                  size="small"
                  color="error"
                  onClick={handleDeleteAllClick}
                  disabled={isLoading}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          
          {/* Loading overlay */}
          {isLoading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: 2,
              }}
            >
              <CircularProgress size={60} sx={{ color: '#00D1AB', mb: 2 }} />
              <Typography variant="h6" color="white">
                Loading...
              </Typography>
            </Box>
          )}
          
          {/* Widget cards */}
          {sortedWidgets.length === 0 ? (
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                py: 6,
                color: 'white',
                opacity: 0.7,
                textAlign: 'center'
              }}
            >
              <WidgetsIcon sx={{ fontSize: 64, mb: 2, opacity: 0.6 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>No Widgets Found</Typography>
              <Typography variant="body2" sx={{ maxWidth: 400 }}>
                {searchTerm 
                  ? `No widgets match your search for "${searchTerm}"`
                  : "You haven't created any widgets yet. Use the Widget Editor to create your first custom widget."
                }
              </Typography>
            </Box>
          ) : (
            <List sx={{ 
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(240px, 1fr))', md: 'repeat(auto-fill, minmax(320px, 1fr))' },
              gap: 2,
              maxHeight: 'calc(80dvh - 250px)',
              overflowY: 'auto',
              pb: 2,
              px: 0,
              
              // Scrollbar styling
              '&::-webkit-scrollbar': {
                width: '10px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderRadius: '10px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                }
              }
            }}>
              {sortedWidgets.map((widget, index) => (
                <Fade key={widget.id} in={true} timeout={300} style={{ transitionDelay: `${index * 50}ms` }}>
                  <Paper
                    elevation={3}
                    sx={{
                      width: '100%',
                      bgcolor: 'rgba(0, 0, 0, 0.2)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)',
                      }
                    }}
                    onClick={() => onEdit(widget)}
                  >
                    {/* Widget Header */}
                    <Box 
                      sx={{ 
                        bgcolor: '#00D1AB',
                        color: '#191919',
                        p: { xs: 1, sm: 2 },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <WidgetsIcon sx={{ mr: 1 }} />
                        <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '1rem' } }}>
                          {widget.name}
                        </Typography>
                      </Box>
                      <Chip 
                        label={`${widget.components.length} ${widget.components.length === 1 ? 'component' : 'components'}`}
                        size="small" 
                        sx={{ 
                          bgcolor: 'rgba(0, 0, 0, 0.2)',
                          color: '#191919',
                          fontWeight: 'bold',
                          '& .MuiChip-label': {
                            fontSize: { xs: '0.6rem', sm: '0.875rem' }
                          }
                        }} 
                      />
                    </Box>
                  
                    {/* Widget Info */}
                    <Box sx={{ p: { xs: 1, sm: 2 }, color: 'white' }}>
                      <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" sx={{ mb: { xs: 0.5, sm: 1 }, fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>
                        Last updated: {formatDate(widget.updatedAt)}
                      </Typography>
                      
                      <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" sx={{ mb: { xs: 0.5, sm: 1 }, fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>
                        Created: {formatDate(widget.createdAt)}
                      </Typography>
                      
                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <Box sx={{ display: 'flex', mr: 1 }}>
                          <Tooltip title="Preview">
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<PreviewIcon />}
                              onClick={(e) => {
                                e.stopPropagation() // Prevent row click handler
                                onPreview(widget)
                              }}
                              sx={{ 
                                mr: isPhone ? 0.5 : 1,
                                color: 'white',
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                fontSize: isPhone ? '0.6rem' : '0.875rem',
                                padding: isPhone ? '2px 6px' : undefined,
                                '&:hover': {
                                  borderColor: 'white',
                                  bgcolor: 'rgba(255, 255, 255, 0.1)'
                                }
                              }}
                            >
                              Preview
                            </Button>
                          </Tooltip>
                          
                          <Tooltip title="Edit">
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<EditIcon />}
                              onClick={(e) => {
                                e.stopPropagation() // Prevent row click handler
                                onEdit(widget)
                              }}
                              sx={{ 
                                mr: isPhone ? 0.5 : 1,
                                bgcolor: '#00D1AB',
                                color: '#191919',
                                fontSize: isPhone ? '0.7rem' : '0.875rem',
                                padding: isPhone ? '2px 6px' : undefined,
                                '&:hover': {
                                  bgcolor: '#00E4BC'
                                }
                              }}
                            >
                              Edit
                            </Button>
                          </Tooltip>
                        </Box>
                        <Tooltip title="Delete Widget">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => handleDeleteClick(e, widget.id)}
                            sx={{
                              bgcolor: 'rgba(211, 47, 47, 0.1)',
                              '&:hover': {
                                bgcolor: 'rgba(211, 47, 47, 0.2)'
                              }
                            }}
                            disabled={isLoading}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Paper>
                </Fade>
              ))}
            </List>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3, bgcolor: '#00A389', display: 'flex', justifyContent: 'flex-end' }}>
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
            disabled={isLoading}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        title="Delete Widget"
        content="Are you sure you want to delete this widget?"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
      {/* Delete All Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteAllConfirmOpen}
        title="Delete All Widgets"
        content={sortedWidgets.length === 1 
          ? "Are you sure you want to delete this widget?" 
          : `Are you sure you want to delete all ${sortedWidgets.length} widgets? \n Always export your widgets before deleting them.`
        }
        onConfirm={confirmDeleteAll}
        onCancel={cancelDeleteAll}
      />
    </>
  )
}

export default WidgetManagementModal 