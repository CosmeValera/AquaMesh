import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
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
  Fade
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import WidgetsIcon from '@mui/icons-material/Widgets'
import EditIcon from '@mui/icons-material/Edit'
import PreviewIcon from '@mui/icons-material/Visibility'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import CloseIcon from '@mui/icons-material/Close'
import { CustomWidget } from '../WidgetStorage'

interface SavedWidgetsDialogProps {
  open: boolean
  widgets: CustomWidget[]
  onClose: () => void
  onLoad: (widget: CustomWidget, editMode?: boolean) => void
  onDelete: (id: string) => void
}

// Sort types
type SortOption = 'nameAsc' | 'nameDesc' | 'dateNewest' | 'dateOldest' | 'mostComponents' | 'fewestComponents'

const SavedWidgetsDialog: React.FC<SavedWidgetsDialogProps> = ({
  open,
  widgets,
  onClose,
  onLoad,
  onDelete,
}) => {
  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  
  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('dateNewest')
  
  // Function to preview a widget (load in view mode)
  const handlePreviewWidget = (widget: CustomWidget) => {
    // Pass false to explicitly set it to view mode
    onLoad(widget, false)
  }
  
  // Function to edit a widget (load in edit mode)
  const handleEditWidget = (e: React.MouseEvent, widget: CustomWidget) => {
    e.stopPropagation()
    // Pass true to explicitly set it to edit mode
    onLoad(widget, true)
  }
  
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
        return a.name.localeCompare(b.name);
      case 'nameDesc':
        return b.name.localeCompare(a.name);
      case 'dateNewest':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'dateOldest':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'mostComponents':
        return b.components.length - a.components.length;
      case 'fewestComponents':
        return a.components.length - b.components.length;
      default:
        return 0;
      }
    });
  }, [filteredWidgets, sortBy]);
  
  return (
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
      <DialogTitle sx={{ 
        bgcolor: '#00BC9A', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2,
      }}>
        <Box display="flex" alignItems="center">
          <WidgetsIcon sx={{ mr: 1.5, color: '#191919' }} />
          <Typography variant="h6" component="div" fontWeight="bold" color="#191919">
            Custom Widgets Library
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
      
      <DialogContent sx={{ p: 3, bgcolor: '#00A389'}}>
        {/* Search and Sort Controls */}
        <Grid container spacing={2} sx={{ mb: 3, mt: 1 }}>
          <Grid item xs={12} md={8}>
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
        </Grid>
        
        {/* Results count */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
            {sortedWidgets.length === 0 
              ? "No widgets found" 
              : `Showing ${sortedWidgets.length} widget${sortedWidgets.length !== 1 ? 's' : ''}`
            }
            {searchTerm && ` matching "${searchTerm}"`}
          </Typography>
        </Box>

        {/* Widgets list */}
        {sortedWidgets.length === 0 ? (
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
            <WidgetsIcon 
              sx={{ 
                fontSize: 48, 
                mb: 2, 
                color: 'rgba(255, 255, 255, 0.6)'
              }} 
            />
            <Typography color="white" variant="h6" gutterBottom>
              {searchTerm ? 'No Matching Widgets' : 'No Custom Widgets Yet'}
            </Typography>
            <Typography color="rgba(255, 255, 255, 0.7)" variant="body2">
              {searchTerm 
                ? 'Try a different search term or clear the search' 
                : 'Start by creating and saving a widget using the editor'
              }
            </Typography>
          </Paper>
        ) : (
          <List>
            {sortedWidgets.map((widget, index) => (
              <Fade key={widget.id} in={true} timeout={300} style={{ transitionDelay: `${index * 50}ms` }}>
                <Paper
                  elevation={0}
                  sx={{
                    mb: 2,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: 2,
                    transition: 'all 0.2s ease-in-out',
                    bgcolor: '#00886F', // Darker teal for widget cards
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                  }}
                >
                  <ListItem
                    button
                    onClick={(e) => handleEditWidget(e, widget)}
                    sx={{
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box 
                          sx={{ 
                            bgcolor: 'rgba(255, 255, 255, 0.15)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            width: 40,
                            height: 40,
                            mr: 2
                          }}
                        >
                          <WidgetsIcon />
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold" color="white">
                            {widget.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <Typography variant="caption" color="rgba(255, 255, 255, 0.7)">
                              Last modified: {new Date(widget.updatedAt).toLocaleDateString()} at {new Date(widget.updatedAt).toLocaleTimeString()}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={`${widget.components.length} components`} 
                              sx={{ 
                                ml: 2, 
                                height: 20, 
                                fontSize: '0.7rem',
                                bgcolor: 'rgba(255, 255, 255, 0.15)',
                                color: 'white'
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>
                      <Box>
                        <Tooltip title="Preview Widget">
                          <Button
                            size="small"
                            startIcon={<PreviewIcon />}
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePreviewWidget(widget)
                            }}
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
                            onClick={(e) => handleEditWidget(e, widget)}
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
                  </ListItem>
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
  )
}

export default SavedWidgetsDialog