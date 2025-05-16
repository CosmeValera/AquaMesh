import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Box,
  Divider,
  Alert,
  useTheme
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { ComponentData } from '../../types/types'
import { getComponentIcon } from '../../constants/componentTypes'

// Function to recursively search for components that match the search criteria
const searchComponents = (
  components: ComponentData[],
  searchTerm: string,
  parentPath: string = ''
): { component: ComponentData; path: string }[] => {
  let results: { component: ComponentData; path: string }[] = []
  
  components.forEach((component) => {
    const currentPath = parentPath 
      ? `${parentPath} > ${component.type}`
      : component.type
    
    // Check if this component matches search
    const matchesType = component.type.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Check if any prop value matches search
    const matchesProp = Object.entries(component.props).some(([key, value]) => {
      if (typeof value === 'string') {
        return value.toLowerCase().includes(searchTerm.toLowerCase())
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      }
      return false
    })
    
    if (matchesType || matchesProp) {
      results.push({ component, path: currentPath })
    }
    
    // Recursively search children
    if (component.children && component.children.length > 0) {
      const childResults = searchComponents(component.children, searchTerm, currentPath)
      results = [...results, ...childResults]
    }
  })
  
  return results
}

// Get a visual representation of a component's key props
const getComponentDescription = (component: ComponentData): string => {
  switch (component.type) {
  case 'Label':
    return `"${component.props.text || 'No text'}"` 
  case 'Button':
    return `"${component.props.text || 'No text'}"` 
  case 'TextField':
    return `Label: "${component.props.label || 'No label'}"` 
  case 'SwitchEnable':
    return `Label: "${component.props.label || 'No label'}"` 
  case 'FieldSet':
    return `Legend: "${component.props.legend || 'No legend'}"` 
  case 'Chart':
    return `Title: "${component.props.title || 'No title'}"` 
  case 'FlexBox':
    return `Direction: ${component.props.direction || 'row'}, Items: ${component.children?.length || 0}` 
  case 'GridBox':
    return `Grid ${component.props.columns || 1}x${component.props.rows || 1}, Items: ${component.children?.length || 0}` 
  default:
    return `${component.props.label || component.props.text || ''}`
  }
}

interface ComponentSearchDialogProps {
  open: boolean
  onClose: () => void
  components: ComponentData[]
  onSelectComponent: (componentId: string) => void
}

const ComponentSearchDialog: React.FC<ComponentSearchDialogProps> = ({
  open,
  onClose,
  components,
  onSelectComponent
}) => {
  const theme = useTheme()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<{ component: ComponentData; path: string }[]>([])
  
  // Reset search term when dialog opens
  useEffect(() => {
    if (open) {
      setSearchTerm('')
      setSearchResults([])
    }
  }, [open])
  
  // Update search results when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }
    
    const results = searchComponents(components, searchTerm)
    setSearchResults(results)
  }, [searchTerm, components])
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }
  
  // Handle component selection
  const handleSelectComponent = (componentId: string) => {
    onSelectComponent(componentId)
    onClose()
  }
  
  // Get component icon component
  const getIconComponent = (type: string) => {
    const IconComponent = getComponentIcon(type)
    return IconComponent ? <IconComponent sx={{ color: '#eee' }} /> : null
  }
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary
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
        <Box display="flex" alignItems="center">
          <SearchIcon sx={{ mr: 1.5, color: '#eee' }} />
          <Typography 
            variant="h5" 
            component="div" 
            fontWeight="bold" 
            sx={{
              color: '#eee',
              textShadow: '0px 1px 2px rgba(255, 255, 255, 0.3)'
            }}
          >
            Search Components
          </Typography>
        </Box>
      </DialogTitle>
        
      
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          placeholder="Search components by type or properties..."
          value={searchTerm}
          onChange={handleSearchChange}
          margin="normal"
          variant="outlined"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#eee' }} />
              </InputAdornment>
            )
          }}
          sx={{ 
            color: '#eee',
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: '#eee'
              },
              '& .MuiOutlinedInput-input': {
                color: '#eee'
              }
            }
          }}
        />
        
        <Box sx={{ my: 2 }}>
          {searchTerm && (
            <Typography variant="body2" color="#eee">
              Found {searchResults.length} component{searchResults.length !== 1 ? 's' : ''} matching "{searchTerm}"
            </Typography>
          )}
        </Box>
        
        <Divider sx={{ my: 1 }} />
        
        {searchTerm && searchResults.length === 0 ? (
          <Alert severity="info" sx={{ my: 2 }}>
            No components found matching your search.
          </Alert>
        ) : (
          <List sx={{ maxHeight: '50dvh', overflow: 'auto' }}>
            {searchResults.map(({ component, path }) => (
              <ListItem
                key={component.id}
                button
                onClick={() => handleSelectComponent(component.id)}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover
                  }
                }}
              >
                <ListItemIcon>
                  {getIconComponent(component.type)}
                </ListItemIcon>
                <ListItemText
                  primary={component.type}
                  primaryTypographyProps={{ color: 'white' }}
                  secondary={
                    <Box component="span">
                      <Typography variant="body2" component="span" color="#eee">
                        {getComponentDescription(component)}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        component="div" 
                        color="#eee" 
                        sx={{ mt: 0.5, opacity: 0.7 }}
                      >
                        Path: {path}
                      </Typography>
                    </Box>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#00A389', display: 'flex', justifyContent: 'flex-end' }}>
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

export default ComponentSearchDialog 