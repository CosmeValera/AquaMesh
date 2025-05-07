import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Box,
  TextField,
  Tooltip,
  IconButton,
  Checkbox,
  FormControlLabel,
  Menu,
  MenuItem,
  ButtonGroup,
  Chip,
  useTheme
} from '@mui/material'
import { WIDGET_TEMPLATES, cloneTemplate } from '../../constants/templateWidgets'
import AddIcon from '@mui/icons-material/Add'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import DeleteIcon from '@mui/icons-material/Delete'
import SortIcon from '@mui/icons-material/Sort'
import FilterListIcon from '@mui/icons-material/FilterList'
import WidgetStorage, { CustomWidget } from '../../WidgetStorage'

// Sort function type
type SortFunction = (a: CustomWidget, b: CustomWidget) => number

interface TemplateSelectionDialogProps {
  open: boolean
  onClose: () => void
  onTemplateSelected: (widget: CustomWidget) => void
  currentWidget?: CustomWidget | null  // Optional current widget to allow saving as template
}

const TEMPLATES_STORAGE_KEY = 'aquamesh_custom_templates'

interface ComponentType {
  id?: string
  type: string
  props: Record<string, any>
  children?: ComponentType[]
  [key: string]: any
}

const TemplateSelectionDialog: React.FC<TemplateSelectionDialogProps> = ({
  open,
  onClose,
  onTemplateSelected,
  currentWidget
}) => {
  const theme = useTheme()
  const [saveAsTemplateMode, setSaveAsTemplateMode] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [keepStructureOnly, setKeepStructureOnly] = useState(true)
  
  // State for sorting and filtering
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null)
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null)
  const [sortOption, setSortOption] = useState<string>('newest')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  
  // Load user-saved templates
  const [userTemplates, setUserTemplates] = useState<CustomWidget[]>([])
  
  // Load templates when dialog opens
  useEffect(() => {
    if (open) {
      loadTemplates()
    }
  }, [open])
  
  // Load templates from localStorage
  const loadTemplates = () => {
    try {
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY)
      const templates = stored ? JSON.parse(stored) : []
      setUserTemplates(templates)
    } catch (error) {
      console.error('Failed to load custom templates', error)
      setUserTemplates([])
    }
  }
  
  // Save the current widget as a template
  const saveCurrentWidgetAsTemplate = () => {
    if (!currentWidget || !templateName.trim()) {
      return
    }
    
    // Create a copy with a different ID and marked as a template
    const templateWidget: CustomWidget = {
      id: `template-${Date.now()}`,
      name: templateName,
      // If keepStructureOnly is true, reset dynamic values but keep structure
      components: keepStructureOnly 
        ? cleanComponentValues(currentWidget.components) 
        : [...currentWidget.components],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: currentWidget.category,
      tags: [...(currentWidget.tags || []), 'template'],
      description: templateDescription || 'Custom template',
      version: '1.0',
      author: currentWidget.author || 'Template Creator'
    }
    
    // Save to localStorage
    const updatedTemplates = [...userTemplates, templateWidget]
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates))
    
    // Update state
    setUserTemplates(updatedTemplates)
    setSaveAsTemplateMode(false)
    setTemplateName('')
    setTemplateDescription('')
  }
  
  // Helper to clean component values for structure-only templates
  const cleanComponentValues = (components: ComponentType[]): ComponentType[] => {
    return components.map(component => {
      const cleanedComponent = {...component}
      
      // Clean text values and other dynamic content while preserving structure
      if (component.type === 'Label' || component.type === 'Button') {
        cleanedComponent.props = {
          ...component.props,
          text: component.type === 'Label' ? 'Text Label' : 'Button'
        }
      } else if (component.type === 'TextField') {
        cleanedComponent.props = {
          ...component.props,
          defaultValue: '',
          placeholder: component.props.placeholder || 'Enter text'
        }
      } else if (component.type === 'Chart') {
        cleanedComponent.props = {
          ...component.props,
          title: 'Chart Title'
        }
      }
      
      // Process children recursively
      if (component.children && component.children.length > 0) {
        cleanedComponent.children = cleanComponentValues(component.children)
      }
      
      return cleanedComponent
    })
  }
  
  // Toggle favorite status for templates
  const toggleFavorite = (templateId: string) => {
    const favorites = new Set(getFavoriteTemplates())
    
    if (favorites.has(templateId)) {
      favorites.delete(templateId)
    } else {
      favorites.add(templateId)
    }
    
    localStorage.setItem('aquamesh_favorite_templates', JSON.stringify([...favorites]))
    
    // Force a re-render to update UI
    setUserTemplates([...userTemplates])
  }
  
  // Get favorite templates from localStorage
  const getFavoriteTemplates = (): string[] => {
    try {
      const stored = localStorage.getItem('aquamesh_favorite_templates')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }
  
  // Check if a template is favorited
  const isFavorite = (templateId: string): boolean => {
    return getFavoriteTemplates().includes(templateId)
  }

  // Delete a custom template
  const deleteTemplate = (templateId: string) => {
    const updatedTemplates = userTemplates.filter(t => t.id !== templateId)
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates))
    setUserTemplates(updatedTemplates)
    setShowDeleteConfirm(null)
  }

  const handleSelectTemplate = (templateId: string) => {
    // First check user templates
    let template = userTemplates.find(t => t.id === templateId)
    
    // If not found, check built-in templates
    if (!template) {
      template = cloneTemplate(templateId)
    } else {
      // Clone the user template to avoid reference issues
      template = {
        ...template,
        id: `widget-${Date.now()}`,
        components: JSON.parse(JSON.stringify(template.components)),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }
    
    if (template) {
      onTemplateSelected(template)
      onClose()
    }
  }

  const handleUseEmptyTemplate = () => {
    // Create a completely empty widget with just a timestamp-based ID
    const emptyWidget: CustomWidget = {
      id: `widget-${Date.now()}`,
      name: 'New Widget',
      components: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    onTemplateSelected(emptyWidget)
    onClose()
  }
  
  // Get sorted and filtered templates
  const getSortedAndFilteredTemplates = () => {
    // First filter if necessary
    let filtered = [...userTemplates]
    
    if (showFavoritesOnly) {
      const favorites = getFavoriteTemplates()
      filtered = filtered.filter(t => favorites.includes(t.id))
    }
    
    // Then sort
    let sortFn: SortFunction
    
    switch (sortOption) {
      case 'newest':
        sortFn = (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        break
      case 'oldest':
        sortFn = (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        break
      case 'most-components':
        sortFn = (a, b) => b.components.length - a.components.length
        break
      case 'name-asc':
        sortFn = (a, b) => a.name.localeCompare(b.name)
        break
      case 'name-desc':
        sortFn = (a, b) => b.name.localeCompare(a.name)
        break
      default:
        sortFn = (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    
    return filtered.sort(sortFn)
  }
  
  // Handle sort menu
  const handleOpenSortMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setSortMenuAnchor(event.currentTarget)
  }
  
  const handleCloseSortMenu = () => {
    setSortMenuAnchor(null)
  }
  
  const handleSortOptionChange = (option: string) => {
    setSortOption(option)
    handleCloseSortMenu()
  }
  
  // Handle filter menu
  const handleOpenFilterMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterMenuAnchor(event.currentTarget)
  }
  
  const handleCloseFilterMenu = () => {
    setFilterMenuAnchor(null)
  }
  
  const handleFilterOptionChange = (showFavorites: boolean) => {
    setShowFavoritesOnly(showFavorites)
    handleCloseFilterMenu()
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Select a Widget Template</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {currentWidget && !saveAsTemplateMode && (
              <Button 
                variant="outlined" 
                startIcon={<AddIcon />} 
                onClick={() => {
                  setSaveAsTemplateMode(true)
                  setTemplateName(currentWidget.name + ' Template')
                }}
              >
                Save Current as Template
              </Button>
            )}
          </Box>
        </Box>
      </DialogTitle>
      
      {saveAsTemplateMode ? (
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Save your current widget as a reusable template for future use.
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <TextField
              label="Template Name"
              fullWidth
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              sx={{ mb: 2 }}
              autoFocus
            />
            
            <TextField
              label="Template Description"
              fullWidth
              multiline
              rows={2}
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              sx={{ mb: 2 }}
            />
            
            <FormControlLabel
              control={
                <Checkbox 
                  checked={keepStructureOnly} 
                  onChange={(e) => setKeepStructureOnly(e.target.checked)} 
                />
              }
              label="Keep structure only (reset text values and dynamic content)"
            />
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setSaveAsTemplateMode(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="primary"
              onClick={saveCurrentWidgetAsTemplate}
              disabled={!templateName.trim()}
            >
              Save as Template
            </Button>
          </Box>
        </DialogContent>
      ) : (
        <DialogContent dividers>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2">
              Choose a template to quickly start with a pre-configured widget, or create a blank widget.
            </Typography>
            
            {/* Control buttons */}
            {userTemplates.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<SortIcon />}
                  onClick={handleOpenSortMenu}
                  variant="outlined"
                >
                  Sort
                </Button>
                <Menu
                  anchorEl={sortMenuAnchor}
                  open={Boolean(sortMenuAnchor)}
                  onClose={handleCloseSortMenu}
                >
                  <MenuItem 
                    selected={sortOption === 'newest'} 
                    onClick={() => handleSortOptionChange('newest')}
                  >
                    Newest First
                  </MenuItem>
                  <MenuItem 
                    selected={sortOption === 'oldest'} 
                    onClick={() => handleSortOptionChange('oldest')}
                  >
                    Oldest First
                  </MenuItem>
                  <MenuItem 
                    selected={sortOption === 'most-components'} 
                    onClick={() => handleSortOptionChange('most-components')}
                  >
                    Most Components
                  </MenuItem>
                  <MenuItem 
                    selected={sortOption === 'name-asc'} 
                    onClick={() => handleSortOptionChange('name-asc')}
                  >
                    Name (A-Z)
                  </MenuItem>
                  <MenuItem 
                    selected={sortOption === 'name-desc'} 
                    onClick={() => handleSortOptionChange('name-desc')}
                  >
                    Name (Z-A)
                  </MenuItem>
                </Menu>

                <Button
                  size="small"
                  startIcon={<FilterListIcon />}
                  onClick={handleOpenFilterMenu}
                  variant="outlined"
                  color={showFavoritesOnly ? "primary" : "inherit"}
                >
                  Filter
                </Button>
                <Menu
                  anchorEl={filterMenuAnchor}
                  open={Boolean(filterMenuAnchor)}
                  onClose={handleCloseFilterMenu}
                >
                  <MenuItem 
                    selected={!showFavoritesOnly} 
                    onClick={() => handleFilterOptionChange(false)}
                  >
                    Show All
                  </MenuItem>
                  <MenuItem 
                    selected={showFavoritesOnly} 
                    onClick={() => handleFilterOptionChange(true)}
                  >
                    Favorites Only
                  </MenuItem>
                </Menu>
                
                {showFavoritesOnly && (
                  <Chip 
                    label="Favorites Only" 
                    onDelete={() => setShowFavoritesOnly(false)}
                    color="primary"
                    size="small"
                  />
                )}
              </Box>
            )}
          </Box>
          
          <Grid container spacing={2}>
            {/* Empty Template Option */}
            <Grid item xs={12} sm={6} md={4}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: `1px dashed ${theme.palette.divider}`,
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    boxShadow: '0 0 0 1px ' + theme.palette.primary.main
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <AddIcon sx={{ fontSize: 40, color: theme.palette.text.secondary, mb: 1 }} />
                  <Typography variant="h6" component="div" align="center">
                    Blank Widget
                  </Typography>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                    Start with an empty canvas
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    fullWidth 
                    variant="outlined"
                    onClick={handleUseEmptyTemplate}
                  >
                    Create Blank
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            {/* User Template Cards */}
            {getSortedAndFilteredTemplates().map((template) => (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      boxShadow: '0 0 0 1px ' + theme.palette.primary.main
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, position: 'relative' }}>
                    <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
                      <Tooltip title={isFavorite(template.id) ? "Remove from favorites" : "Add to favorites"}>
                        <IconButton 
                          size="small"
                          onClick={() => toggleFavorite(template.id)}
                        >
                          {isFavorite(template.id) ? 
                            <StarIcon color="primary" /> : 
                            <StarBorderIcon />
                          }
                        </IconButton>
                      </Tooltip>
                      
                      {showDeleteConfirm === template.id ? (
                        <ButtonGroup size="small">
                          <Button 
                            size="small" 
                            color="error"
                            onClick={() => deleteTemplate(template.id)}
                          >
                            Confirm
                          </Button>
                          <Button 
                            size="small" 
                            onClick={() => setShowDeleteConfirm(null)}
                          >
                            Cancel
                          </Button>
                        </ButtonGroup>
                      ) : (
                        <Tooltip title="Delete template">
                          <IconButton 
                            size="small"
                            onClick={() => setShowDeleteConfirm(template.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    
                    <Typography variant="h6" component="div" gutterBottom>
                      {template.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.components.length} components
                    </Typography>
                    
                    {template.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {template.description}
                      </Typography>
                    )}
                    
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Custom Template
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      fullWidth 
                      color="primary"
                      variant="contained"
                      onClick={() => handleSelectTemplate(template.id)}
                    >
                      Use Template
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}

            {/* Default Template Cards */}
            {WIDGET_TEMPLATES.map((template) => (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      boxShadow: '0 0 0 1px ' + theme.palette.primary.main
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, position: 'relative' }}>
                    <Tooltip title={isFavorite(template.id) ? "Remove from favorites" : "Add to favorites"}>
                      <IconButton 
                        size="small" 
                        sx={{ position: 'absolute', top: 8, right: 8 }}
                        onClick={() => toggleFavorite(template.id)}
                      >
                        {isFavorite(template.id) ? 
                          <StarIcon color="primary" /> : 
                          <StarBorderIcon />
                        }
                      </IconButton>
                    </Tooltip>
                    
                    <Typography variant="h6" component="div" gutterBottom>
                      {template.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.components.length} components
                    </Typography>
                    
                    {/* Preview thumbnail placeholder */}
                    <Box 
                      sx={{ 
                        mt: 1, 
                        height: 100, 
                        backgroundColor: 'background.default',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${theme.palette.divider}`
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Template Preview
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      fullWidth 
                      color="primary"
                      variant="contained"
                      onClick={() => handleSelectTemplate(template.id)}
                    >
                      Use Template
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      )}
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  )
}

export default TemplateSelectionDialog 