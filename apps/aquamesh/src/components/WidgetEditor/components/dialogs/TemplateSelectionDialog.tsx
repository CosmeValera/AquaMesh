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
  useTheme,
  ListItemText,
  ListItemIcon,
  Alert
} from '@mui/material'
import { WIDGET_TEMPLATES, cloneTemplate } from '../../constants/templateWidgets'
import AddIcon from '@mui/icons-material/Add'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import DeleteIcon from '@mui/icons-material/Delete'
import SortIcon from '@mui/icons-material/Sort'
import FilterListIcon from '@mui/icons-material/FilterList'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SaveIcon from '@mui/icons-material/Save'
import { CustomWidget } from '../../WidgetStorage'
import { alpha } from '@mui/material/styles'

// Sort function type
type SortFunction = (a: CustomWidget, b: CustomWidget) => number

interface TemplateSelectionDialogProps {
  open: boolean
  onClose: () => void
  onTemplateSelected: (widget: CustomWidget) => void
  currentWidget?: CustomWidget | null  // Optional current widget to allow saving as template
}

const TEMPLATES_STORAGE_KEY = 'aquamesh_custom_templates'

// This type should match the expected type in CustomWidget
type ComponentData = {
  id: string
  type: string
  props: Record<string, unknown>
  children?: ComponentData[]
  [key: string]: unknown
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
        ? cleanComponentValues(currentWidget.components as ComponentData[]) 
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
  const cleanComponentValues = (components: any[]): any[] => {
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
      const builtInTemplate = cloneTemplate(templateId)
      if (builtInTemplate) {
        template = builtInTemplate
      }
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
    case 'compCount':
      sortFn = (a, b) => b.components.length - a.components.length
      break
    case 'name':
      sortFn = (a, b) => a.name.localeCompare(b.name)
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
      maxWidth="lg"
      fullWidth
      PaperProps={{
        elevation: 8,
        sx: {
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
    >
      {saveAsTemplateMode ? (
        <>
          <DialogTitle sx={{ 
            bgcolor: theme.palette.primary.main, 
            color: theme.palette.primary.contrastText,
            p: 3
          }}>
            <Typography variant="h5" fontWeight="bold">Save as Template</Typography>
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 1 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                Create a reusable template from your current widget
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Templates allow you to quickly create new widgets with predefined structures.
              </Typography>
            </Box>
            
            <TextField
              label="Template Name"
              variant="outlined"
              fullWidth
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              sx={{ mb: 3 }}
              placeholder="Enter a descriptive name for your template"
              InputProps={{
                sx: {
                  borderRadius: 1.5
                }
              }}
            />
            
            <TextField
              label="Description"
              variant="outlined"
              fullWidth
              multiline
              rows={3}
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              sx={{ mb: 3 }}
              placeholder="Describe what this template is for or how it should be used"
              InputProps={{
                sx: {
                  borderRadius: 1.5
                }
              }}
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={keepStructureOnly}
                  onChange={(e) => setKeepStructureOnly(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1">Keep structure only</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Reset dynamic values but keep the structure of components
                  </Typography>
                </Box>
              }
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)' }}>
            <Button 
              onClick={() => {
                setSaveAsTemplateMode(false)
                setTemplateName('')
                setTemplateDescription('')
              }}
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            >
              Cancel
            </Button>
            <Button 
              onClick={saveCurrentWidgetAsTemplate} 
              variant="contained" 
              disabled={!templateName.trim()}
              startIcon={<SaveIcon />}
              sx={{ 
                ml: 1, 
                px: 3,
                borderRadius: 1.5,
                boxShadow: 2
              }}
            >
              Save Template
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle sx={{ 
            bgcolor: theme.palette.primary.main, 
            color: theme.palette.primary.contrastText,
            p: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box display="flex" alignItems="center">
              <DashboardIcon sx={{ mr: 1.5 }} />
              <Typography variant="h5" fontWeight="bold">Templates</Typography>
            </Box>
            
            <Box>
              <ButtonGroup size="small" variant="contained" sx={{ 
                boxShadow: 'none',
                bgcolor: 'rgba(255,255,255,0.1)',
                borderRadius: 1.5,
                mr: 1
              }}>
                <Tooltip title="Sort templates">
                  <Button 
                    onClick={handleOpenSortMenu}
                    startIcon={<SortIcon />}
                    sx={{ 
                      borderRadius: '8px 0 0 8px',
                      textTransform: 'none',
                      fontWeight: 'normal',
                      fontSize: '0.85rem'
                    }}
                  >
                    {sortOption === 'newest' && 'Newest'}
                    {sortOption === 'oldest' && 'Oldest'}
                    {sortOption === 'compCount' && 'Component Count'}
                    {sortOption === 'name' && 'Name'}
                  </Button>
                </Tooltip>
                <Tooltip title="Filter templates">
                  <IconButton 
                    onClick={handleOpenFilterMenu}
                    sx={{ 
                      color: showFavoritesOnly ? 'warning.light' : 'inherit',
                      borderRadius: '0 8px 8px 0'
                    }}
                  >
                    <FilterListIcon />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>
              
              <Menu
                anchorEl={sortMenuAnchor}
                open={Boolean(sortMenuAnchor)}
                onClose={handleCloseSortMenu}
                PaperProps={{
                  elevation: 3,
                  sx: { borderRadius: 2, mt: 1, minWidth: 180 }
                }}
              >
                <MenuItem 
                  onClick={() => handleSortOptionChange('newest')}
                  selected={sortOption === 'newest'}
                  sx={{ py: 1 }}
                >
                  <ListItemText primary="Newest First" />
                </MenuItem>
                <MenuItem 
                  onClick={() => handleSortOptionChange('oldest')}
                  selected={sortOption === 'oldest'}
                  sx={{ py: 1 }}
                >
                  <ListItemText primary="Oldest First" />
                </MenuItem>
                <MenuItem 
                  onClick={() => handleSortOptionChange('compCount')}
                  selected={sortOption === 'compCount'}
                  sx={{ py: 1 }}
                >
                  <ListItemText primary="Component Count" />
                </MenuItem>
                <MenuItem 
                  onClick={() => handleSortOptionChange('name')}
                  selected={sortOption === 'name'}
                  sx={{ py: 1 }}
                >
                  <ListItemText primary="Name (A-Z)" />
                </MenuItem>
              </Menu>
              
              <Menu
                anchorEl={filterMenuAnchor}
                open={Boolean(filterMenuAnchor)}
                onClose={handleCloseFilterMenu}
                PaperProps={{
                  elevation: 3,
                  sx: { borderRadius: 2, mt: 1, minWidth: 180 }
                }}
              >
                <MenuItem 
                  onClick={() => handleFilterOptionChange(true)}
                  selected={showFavoritesOnly}
                  sx={{ py: 1 }}
                >
                  <ListItemIcon>
                    <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                  </ListItemIcon>
                  <ListItemText primary="Favorites Only" />
                </MenuItem>
                <MenuItem 
                  onClick={() => handleFilterOptionChange(false)}
                  selected={!showFavoritesOnly}
                  sx={{ py: 1 }}
                >
                  <ListItemIcon>
                    <Box sx={{ ml: 0.25 }}>•</Box>
                  </ListItemIcon>
                  <ListItemText primary="Show All" />
                </MenuItem>
              </Menu>
            </Box>
          </DialogTitle>
          
          <DialogContent dividers sx={{ p: 3 }}>
            {currentWidget && (
              <Box sx={{ mb: 3 }}>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => setSaveAsTemplateMode(true)}
                  fullWidth
                  sx={{ 
                    p: 1.5, 
                    borderStyle: 'dashed',
                    borderRadius: 2,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,30,60,0.3)' : 'rgba(0,127,255,0.04)',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,30,60,0.5)' : 'rgba(0,127,255,0.08)',
                    }
                  }}
                >
                  Save current widget as template
                </Button>
              </Box>
            )}
            
            {/* Empty template option */}
            <Box sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleUseEmptyTemplate}
                fullWidth
                sx={{ 
                  p: 1.5, 
                  borderStyle: 'dashed',
                  borderRadius: 2,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(50,0,80,0.2)' : 'rgba(100,0,150,0.04)',
                  '&:hover': {
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(50,0,80,0.3)' : 'rgba(100,0,150,0.08)',
                  }
                }}
              >
                Start with empty template
              </Button>
            </Box>
            
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium' }}>
              {userTemplates.length > 0 ? 'Available Templates' : 'Custom Templates'}
            </Typography>
            
            {/* Templates grid/list */}
            <Grid container spacing={2}>
              {/* First show built-in templates */}
              {WIDGET_TEMPLATES.map(template => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
                  <Card 
                    elevation={2}
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 2,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6
                      },
                      bgcolor: alpha(theme.palette.background.paper, 0.7)
                    }}
                  >
                    <Box sx={{ 
                      height: 10, 
                      bgcolor: theme.palette.secondary.main,
                      borderRadius: '8px 8px 0 0'
                    }} />
                    
                    <CardContent sx={{ 
                      flexGrow: 1,
                      pb: 1,
                      position: 'relative',
                      '&:last-child': { pb: 1 }
                    }}>
                      <Chip 
                        label="Built-in" 
                        size="small" 
                        color="secondary"
                        sx={{ 
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          fontSize: '0.7rem'
                        }}
                      />
                      
                      <Typography variant="h6" gutterBottom sx={{ 
                        fontWeight: 'medium', 
                        fontSize: '1rem', 
                        mb: 0.5,
                        mt: 1
                      }}>
                        {template.name}
                      </Typography>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          overflow: 'hidden',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          mb: 2,
                          height: 40
                        }}
                      >
                        {template.description || 'No description'}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                        {template.tags?.map(tag => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 22 }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                    
                    <CardActions sx={{ px: 2, pt: 0, pb: 2 }}>
                      <Button 
                        size="small" 
                        fullWidth
                        variant="contained"
                        onClick={() => handleSelectTemplate(template.id)}
                        sx={{ 
                          borderRadius: 1.5,
                          textTransform: 'none',
                          boxShadow: 2
                        }}
                      >
                        Use Template
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
              
              {/* User-saved templates */}
              {getSortedAndFilteredTemplates().map(template => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
                  <Card 
                    elevation={2}
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 2,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6
                      },
                      bgcolor: alpha(theme.palette.background.paper, 0.7)
                    }}
                  >
                    <Box sx={{ 
                      height: 10, 
                      bgcolor: theme.palette.primary.main,
                      borderRadius: '8px 8px 0 0'
                    }} />
                    
                    <CardContent sx={{ 
                      flexGrow: 1,
                      pb: 1,
                      position: 'relative',
                      '&:last-child': { pb: 1 }
                    }}>
                      <Tooltip title="Favorite">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(template.id)
                          }}
                          sx={{ 
                            position: 'absolute',
                            top: 8,
                            right: 8
                          }}
                        >
                          {isFavorite(template.id) ? (
                            <StarIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />
                          ) : (
                            <StarBorderIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      
                      <Typography variant="h6" gutterBottom sx={{ 
                        fontWeight: 'medium', 
                        fontSize: '1rem', 
                        mb: 0.5,
                        mt: 1,
                        paddingRight: '24px' // Space for the favorite button
                      }}>
                        {template.name}
                      </Typography>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          overflow: 'hidden',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          mb: 2,
                          height: 40
                        }}
                      >
                        {template.description || 'No description'}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                        {template.tags?.map(tag => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 22 }}
                          />
                        ))}
                        <Chip
                          label={`${template.components?.length || 0} components`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 22 }}
                        />
                      </Box>
                    </CardContent>
                    
                    <CardActions sx={{ px: 2, pt: 0, pb: 2, justifyContent: 'space-between' }}>
                      <Button 
                        size="small" 
                        color="primary"
                        onClick={() => handleSelectTemplate(template.id)}
                        variant="contained"
                        sx={{ 
                          flexGrow: 1,
                          borderRadius: 1.5,
                          textTransform: 'none',
                          boxShadow: 2
                        }}
                      >
                        Use Template
                      </Button>
                      
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => setShowDeleteConfirm(template.id)}
                        sx={{ ml: 1 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
              
              {/* Empty state for user templates */}
              {userTemplates.length === 0 && (
                <Grid item xs={12}>
                  <Box sx={{ 
                    p: 4, 
                    textAlign: 'center',
                    borderRadius: 2,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                    border: '1px dashed',
                    borderColor: 'divider'
                  }}>
                    <Typography variant="body1" color="text.secondary" gutterBottom>
                      No custom templates found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Save your current widget as a template to reuse it later
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          
          <DialogActions sx={{ px: 3, py: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)' }}>
            <Button 
              onClick={onClose}
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            >
              Cancel
            </Button>
          </DialogActions>
        </>
      )}
      
      {/* Confirmation dialog for deleting templates */}
      <Dialog
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        maxWidth="xs"
        PaperProps={{
          elevation: 24,
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6">Confirm Deletion</Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone.
          </Alert>
          <Typography variant="body1">
            Are you sure you want to delete this template?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setShowDeleteConfirm(null)}
            variant="outlined"
            sx={{ borderRadius: 1.5 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (showDeleteConfirm) {
                deleteTemplate(showDeleteConfirm)
              }
            }}
            variant="contained"
            color="error"
            sx={{ ml: 1, borderRadius: 1.5 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}

export default TemplateSelectionDialog 