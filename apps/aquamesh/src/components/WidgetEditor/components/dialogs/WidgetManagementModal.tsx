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
  Snackbar,
  Alert
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import WidgetsIcon from '@mui/icons-material/Widgets'
import EditIcon from '@mui/icons-material/Edit'
import PreviewIcon from '@mui/icons-material/Visibility'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import CloseIcon from '@mui/icons-material/Close'
import CreateIcon from '@mui/icons-material/Create'
import { CustomWidget } from '../../WidgetStorage'
import useWidgetManager from '../../hooks/useWidgetManager'

// Sorting options
type SortOption = 'dateNewest' | 'dateOldest' | 'nameAsc' | 'nameDesc';

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
  onDelete,
}) => {
  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  
  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('dateNewest')
  
  // Alert message state
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  
  // Get functions from widget manager hook
  const { isWidgetEditorOpen, openWidgetEditor } = useWidgetManager()
  
  // Clear search when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearchTerm('')
    }
  }, [open])
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }
  
  // Handle sort change
  const handleSortChange = (e: SelectChangeEvent) => {
    setSortBy(e.target.value as SortOption)
  }
  
  // Handle preview button click
  const handlePreviewClick = (e: React.MouseEvent, widget: CustomWidget) => {
    e.stopPropagation()
    
    if (isWidgetEditorOpen()) {
      onPreview(widget)
    } else {
      setAlertMessage("Please open a Widget Editor first to preview widgets")
      setAlertOpen(true)
    }
  }
  
  // Handle edit button click
  const handleEditClick = (e: React.MouseEvent, widget: CustomWidget) => {
    e.stopPropagation()
    
    if (isWidgetEditorOpen()) {
      onEdit(widget)
    } else {
      setAlertMessage("Please open a Widget Editor first to edit widgets")
      setAlertOpen(true)
    }
  }
  
  // Handle opening widget editor
  const handleOpenWidgetEditor = () => {
    // Close the current modal
    onClose()
    
    // Use the openWidgetEditor function from the hook
    openWidgetEditor()
  }
  
  // Close alert
  const handleAlertClose = () => {
    setAlertOpen(false)
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
            maxHeight: '80vh',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'white',
          px: 3,
          pt: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WidgetsIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Widget Library
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            edge="end"
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
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
            <Grid item xs={12} md={6}>
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
            
            <Typography variant="body2" color={isWidgetEditorOpen() ? "rgba(50, 255, 100, 0.9)" : "rgba(255, 200, 50, 0.9)"}>
              Widget Editor: {isWidgetEditorOpen() ? "Open" : "Not Open"}
            </Typography>
          </Box>
          
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 2,
              maxHeight: 'calc(80vh - 250px)',
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
                      bgcolor: 'rgba(0, 0, 0, 0.2)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)',
                      }
                    }}
                  >
                    <Box 
                      onClick={(e) => handleEditClick(e, widget)}
                      sx={{ cursor: 'pointer' }}
                    >
                      {/* Widget Header */}
                      <Box 
                        sx={{ 
                          bgcolor: '#00D1AB',
                          color: '#191919',
                          p: 2, 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <WidgetsIcon sx={{ mr: 1 }} />
                          <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                            {widget.name}
                          </Typography>
                        </Box>
                        <Chip 
                          label={`${widget.components.length} ${widget.components.length === 1 ? 'component' : 'components'}`}
                          size="small" 
                          sx={{ 
                            bgcolor: 'rgba(0, 0, 0, 0.2)',
                            color: '#191919',
                            fontWeight: 'bold'
                          }} 
                        />
                      </Box>
                    
                      {/* Widget Info */}
                      <Box sx={{ p: 2, color: 'white' }}>
                        <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" sx={{ mb: 1 }}>
                          Last updated: {formatDate(widget.updatedAt)}
                        </Typography>
                        
                        <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" sx={{ mb: 2 }}>
                          Created: {formatDate(widget.createdAt)}
                        </Typography>
                        
                        {/* Action Buttons */}
                        <Box>
                          <Tooltip title="Preview Widget">
                            <Button
                              size="small"
                              startIcon={<PreviewIcon />}
                              onClick={(e) => handlePreviewClick(e, widget)}
                              sx={{ 
                                mr: 1,
                                color: 'white',
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                '&:hover': {
                                  borderColor: 'white',
                                  bgcolor: 'rgba(255, 255, 255, 0.1)'
                                }
                              }}
                              variant="outlined"
                            >
                              Preview
                            </Button>
                          </Tooltip>
                          <Tooltip title="Edit Widget">
                            <Button
                              size="small"
                              startIcon={<EditIcon />}
                              onClick={(e) => handleEditClick(e, widget)}
                              sx={{ 
                                mr: 1,
                                bgcolor: '#00D1AB',
                                color: '#191919',
                                '&:hover': {
                                  bgcolor: '#00E4BC'
                                }
                              }}
                              variant="contained"
                            >
                              Edit
                            </Button>
                          </Tooltip>
                          <Tooltip title="Delete Widget">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDelete(widget.id)
                              }}
                              sx={{
                                bgcolor: 'rgba(211, 47, 47, 0.1)',
                                '&:hover': {
                                  bgcolor: 'rgba(211, 47, 47, 0.2)'
                                }
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </Fade>
              ))}
            </List>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3, bgcolor: '#00A389', display: 'flex', justifyContent: 'space-between' }}>
          {/* Open Widget Editor Button */}
          <Button 
            onClick={handleOpenWidgetEditor}
            variant="contained"
            startIcon={<CreateIcon />}
            sx={{ 
              bgcolor: '#005542',
              color: 'white',
              '&:hover': {
                bgcolor: '#006653',
              }
            }}
          >
            Open Widget Editor
          </Button>
          
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
      
      {/* Alert for when Widget Editor is not open */}
      <Snackbar
        open={alertOpen}
        autoHideDuration={5000}
        onClose={handleAlertClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleAlertClose} 
          severity="info" 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </>
  )
}

export default WidgetManagementModal 