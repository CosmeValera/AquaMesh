import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Autocomplete,
  useTheme
} from '@mui/material'
import WidgetStorage, { CustomWidget, WIDGET_CATEGORIES } from '../../WidgetStorage'

interface WidgetMetadataDialogProps {
  open: boolean
  onClose: () => void
  widget: CustomWidget | null
  onSave: (updatedWidget: CustomWidget) => void
}

const WidgetMetadataDialog: React.FC<WidgetMetadataDialogProps> = ({
  open,
  onClose,
  widget,
  onSave
}) => {
  const theme = useTheme()
  const [formData, setFormData] = useState<Partial<CustomWidget>>({
    name: '',
    category: 'Other',
    tags: [],
    description: '',
    version: '1.0',
    author: ''
  })
  const [availableTags, setAvailableTags] = useState<string[]>([])
  
  // Load all existing tags when dialog opens
  useEffect(() => {
    if (open) {
      setAvailableTags(WidgetStorage.getAllTags())
    }
  }, [open])
  
  // Update form data when widget changes
  useEffect(() => {
    if (widget) {
      setFormData({
        name: widget.name || '',
        category: widget.category || 'Other',
        tags: widget.tags || [],
        description: widget.description || '',
        version: widget.version || '1.0',
        author: widget.author || ''
      })
    }
  }, [widget])
  
  // Handle form field changes
  const handleChange = (field: keyof CustomWidget, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }
  
  // Handle save button click
  const handleSave = () => {
    if (!widget || !formData.name) return
    
    const updatedWidget: CustomWidget = {
      ...widget,
      name: formData.name || widget.name,
      category: formData.category || 'Other',
      tags: formData.tags || [],
      description: formData.description || '',
      version: formData.version || '1.0',
      author: formData.author || ''
    }
    
    onSave(updatedWidget)
    onClose()
  }
  
  // Add a new tag that doesn't exist yet
  const handleAddNewTag = (newTag: string) => {
    if (!newTag || (formData.tags && formData.tags.includes(newTag))) {
      return
    }
    
    handleChange('tags', [...(formData.tags || []), newTag])
    
    // Add to available tags if it's not there yet
    if (!availableTags.includes(newTag)) {
      setAvailableTags([...availableTags, newTag])
    }
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
      <DialogTitle>
        <Typography variant="h6">Widget Properties</Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {/* Widget Name */}
          <TextField
            label="Widget Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            fullWidth
            required
            variant="outlined"
            error={!formData.name}
            helperText={!formData.name ? 'Name is required' : ''}
          />
          
          {/* Widget Category */}
          <FormControl fullWidth variant="outlined">
            <InputLabel id="widget-category-label">Category</InputLabel>
            <Select
              labelId="widget-category-label"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              label="Category"
            >
              {WIDGET_CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Widget Tags */}
          <Autocomplete
            multiple
            id="widget-tags"
            options={availableTags}
            value={formData.tags || []}
            onChange={(_, newValue) => handleChange('tags', newValue)}
            freeSolo
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  key={option}
                  variant="outlined"
                  label={option}
                  {...getTagProps({ index })}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label="Tags"
                placeholder="Add tags..."
                helperText="Press Enter to add a new tag"
              />
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Get current input value
                const input = e.target as HTMLInputElement
                const value = input.value.trim()
                
                if (value) {
                  handleAddNewTag(value)
                  // Clear the input (Autocomplete doesn't do this automatically for freeSolo)
                  setTimeout(() => {
                    input.value = ''
                  }, 0)
                }
              }
            }}
          />
          
          {/* Widget Description */}
          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            placeholder="Enter a description for this widget..."
          />
          
          {/* Other metadata */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Version"
              value={formData.version}
              onChange={(e) => handleChange('version', e.target.value)}
              variant="outlined"
              sx={{ width: '30%' }}
            />
            
            <TextField
              label="Author"
              value={formData.author}
              onChange={(e) => handleChange('author', e.target.value)}
              variant="outlined"
              sx={{ width: '70%' }}
            />
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave}
          variant="contained" 
          color="primary"
          disabled={!formData.name}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default WidgetMetadataDialog 