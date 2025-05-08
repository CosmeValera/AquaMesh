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
  Menu,
  MenuItem,
  ButtonGroup,
  Chip,
  useTheme,
  ListItemText,
} from '@mui/material'
import {
  WIDGET_TEMPLATES,
  cloneTemplate,
} from '../../constants/templateWidgets'
import AddIcon from '@mui/icons-material/Add'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import DeleteIcon from '@mui/icons-material/Delete'
import SortIcon from '@mui/icons-material/Sort'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SaveIcon from '@mui/icons-material/Save'
import RestoreIcon from '@mui/icons-material/Restore'
import { CustomWidget } from '../../WidgetStorage'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import Autocomplete from '@mui/material/Autocomplete'

// Sort function type
type SortFunction = (a: CustomWidget, b: CustomWidget) => number

interface TemplateSelectionDialogProps {
  open: boolean
  onClose: () => void
  onTemplateSelected: (widget: CustomWidget) => void
  currentWidget?: CustomWidget | null // Optional current widget to allow saving as template
  showDeleteTemplateConfirmation?: boolean
}

const TEMPLATES_STORAGE_KEY = 'aquamesh_custom_templates'

// Define static tag options
const TAG_OPTIONS = [
  'form', 'input', 'user data',
  'dashboard', 'stats', 'chart', 'metrics',
  'report', 'status', 'system', 'monitoring',
  'custom', 'template'
]

// Define colors for tags
const TAG_COLOR_MAP: Record<string, 'default'|'primary'|'secondary'|'error'|'info'|'success'|'warning'> = {
  form: 'secondary',
  dashboard: 'success',
  stats: 'success',
  chart: 'info',
  report: 'warning',
  status: 'error',
  metrics: 'primary',
  input: 'warning',
  'user data': 'info',
  monitoring: 'success',
  custom: 'default',
  template: 'default'
}

const TemplateSelectionDialog: React.FC<TemplateSelectionDialogProps> = ({
  open,
  onClose,
  onTemplateSelected,
  currentWidget,
  showDeleteTemplateConfirmation = true,
}) => {
  const theme = useTheme()
  const [saveAsTemplateMode, setSaveAsTemplateMode] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateTags, setTemplateTags] = useState<string[]>([])

  // State for sorting and filtering
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null)
  const [sortOption, setSortOption] = useState<string>('newest')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  )

  // Load user-saved templates
  const [userTemplates, setUserTemplates] = useState<CustomWidget[]>([])

  // Add new state variables
  const [showBuiltInTemplates, setShowBuiltInTemplates] = useState(true)
  const [deletedBuiltInTemplates, setDeletedBuiltInTemplates] = useState<
    string[]
  >([])

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
      components: cleanComponentValues(currentWidget.components),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: currentWidget.category,
      tags: [...templateTags],
      description: templateDescription || 'Custom template',
      version: '1.0',
      author: currentWidget.author || 'Template Creator',
    }

    // Save to localStorage
    const updatedTemplates = [...userTemplates, templateWidget]
    localStorage.setItem(
      TEMPLATES_STORAGE_KEY,
      JSON.stringify(updatedTemplates),
    )

    // Update state
    setUserTemplates(updatedTemplates)
    setSaveAsTemplateMode(false)
    setTemplateName('')
    setTemplateDescription('')
    setTemplateTags([])
  }

  // Helper to clean component values for structure-only templates
  const cleanComponentValues = (
    components: CustomWidget['components'],
  ): CustomWidget['components'] => {
    return components.map((component) => {
      const cleanedComponent = { ...component }

      // Clean text values and other dynamic content while preserving structure
      if (component.type === 'Label' || component.type === 'Button') {
        cleanedComponent.props = {
          ...component.props,
          text: component.type === 'Label' ? 'Text Label' : 'Button',
        }
      } else if (component.type === 'TextField') {
        cleanedComponent.props = {
          ...component.props,
          defaultValue: '',
          placeholder: component.props.placeholder || 'Enter text',
        }
      } else if (component.type === 'Chart') {
        cleanedComponent.props = {
          ...component.props,
          title: 'Chart Title',
        }
      }

      if (component.children && component.children.length > 0) {
        cleanedComponent.children = cleanComponentValues(
          component.children as CustomWidget['components'],
        )
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

    localStorage.setItem(
      'aquamesh_favorite_templates',
      JSON.stringify([...favorites]),
    )

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
    const updatedTemplates = userTemplates.filter((t) => t.id !== templateId)
    localStorage.setItem(
      TEMPLATES_STORAGE_KEY,
      JSON.stringify(updatedTemplates),
    )
    setUserTemplates(updatedTemplates)
    setShowDeleteConfirm(null)
  }

  const handleSelectTemplate = (templateId: string) => {
    // First check user templates
    let template = userTemplates.find((t) => t.id === templateId)

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
      updatedAt: new Date().toISOString(),
    }
    onTemplateSelected(emptyWidget)
    onClose()
  }

  // Get sorted and filtered templates
  const getSortedAndFilteredTemplates = () => {
    // Combine built-in and user templates
    const builtInList = showBuiltInTemplates
      ? WIDGET_TEMPLATES.filter((t) => !deletedBuiltInTemplates.includes(t.id))
      : []
    const userList = [...userTemplates]
    // Apply favorites filter
    const favorites = getFavoriteTemplates()
    let combined = [...builtInList, ...userList]
    if (showFavoritesOnly) {
      combined = combined.filter((t) => favorites.includes(t.id))
    }
    // Determine sort function
    let sortFn: SortFunction
    switch (sortOption) {
      case 'newest':
        sortFn = (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        break
      case 'oldest':
        sortFn = (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        break
      case 'compCount':
        sortFn = (a, b) => b.components.length - a.components.length
        break
      case 'name':
        sortFn = (a, b) => a.name.localeCompare(b.name)
        break
      default:
        sortFn = (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    return combined.sort(sortFn)
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

  const toggleBuiltInTemplatesVisibility = () => {
    setShowBuiltInTemplates(!showBuiltInTemplates)
  }

  const isBuiltInTemplateDeleted = (templateId: string): boolean => {
    return deletedBuiltInTemplates.includes(templateId)
  }

  const handleDeleteBuiltInTemplate = (templateId: string) => {
    setDeletedBuiltInTemplates([...deletedBuiltInTemplates, templateId])
    setShowDeleteConfirm(null)
  }

  const handleRestoreBuiltInTemplates = () => {
    setDeletedBuiltInTemplates([])
  }

  // Helper to check if built-in template should be displayed based on current filter
  const shouldShowBuiltInTemplate = (templateId: string): boolean => {
    if (isBuiltInTemplateDeleted(templateId)) {
      return false
    }

    if (showFavoritesOnly) {
      return isFavorite(templateId)
    }

    return true
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
          overflow: 'hidden',
        },
      }}
    >
      {saveAsTemplateMode ? (
        <>
          <DialogTitle
            sx={{
              bgcolor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              p: 3,
            }}
          >
            <Typography variant="h5" fontWeight="bold">
              Save as Template
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 1 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                Create a reusable template from your current widget
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Templates allow you to quickly create new widgets with
                predefined structures.
              </Typography>
            </Box>

            <TextField
              label="Template Name"
              variant="outlined"
              fullWidth
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              sx={{ mb: 3 }}
              autoFocus
              placeholder="Enter a descriptive name (e.g., 'Dashboard Layout')"
              InputProps={{
                sx: {
                  borderRadius: 1.5,
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.primary.main,
                  },
                },
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
              placeholder="Describe what this template is for or how it should be used (e.g., 'A dashboard layout with three metric panels and a chart')"
              InputProps={{
                sx: {
                  borderRadius: 1.5,
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.primary.main,
                  },
                },
              }}
            />

            {/* Replace free-text tags with Autocomplete multiple select */}
            <Autocomplete
              multiple
              options={TAG_OPTIONS}
              value={templateTags}
              onChange={(_e, values) => setTemplateTags(values)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const color = TAG_COLOR_MAP[option] || 'default'
                  return (
                    <Chip
                      {...getTagProps({ index })}
                      label={option}
                      size="small"
                      color={color}
                    />
                  )
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  placeholder="Select tags"
                  helperText="Pick one or more categories"
                  fullWidth
                  sx={{ mb: 3 }}
                />
              )}
            />
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2,
              bgcolor:
                theme.palette.mode === 'dark'
                  ? 'rgba(0,0,0,0.1)'
                  : 'rgba(0,0,0,0.02)',
            }}
          >
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
                boxShadow: 2,
              }}
            >
              Save Template
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle
            sx={{
              bgcolor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              p: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box display="flex" alignItems="center">
              <DashboardIcon sx={{ mr: 1.5 }} />
              <Typography variant="h5" fontWeight="bold">
                Templates
              </Typography>
            </Box>

            <Box>
              <ButtonGroup
                size="small"
                variant="contained"
                sx={{
                  boxShadow: 'none',
                  bgcolor: 'rgba(255,255,255,0.2)',
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'rgba(255,255,255,0.3)',
                  overflow: 'hidden',
                }}
              >
                <Tooltip title="Sort templates">
                  <Button
                    onClick={handleOpenSortMenu}
                    startIcon={<SortIcon />}
                    sx={{
                      borderRadius: '8px 0 0 8px',
                      textTransform: 'none',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      backgroundColor: 'transparent',
                      px: 2,
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.15)',
                      },
                    }}
                  >
                    {sortOption === 'newest' && 'Newest'}
                    {sortOption === 'oldest' && 'Oldest'}
                    {sortOption === 'compCount' && 'Components'}
                    {sortOption === 'name' && 'Name'}
                  </Button>
                </Tooltip>

                <Tooltip
                  title={
                    showFavoritesOnly
                      ? 'Show all templates'
                      : 'Show favorites only'
                  }
                >
                  <IconButton
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    sx={{
                      color: showFavoritesOnly
                        ? theme.palette.warning.light
                        : theme.palette.common.white,
                      borderRadius: '0',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.15)',
                      },
                    }}
                  >
                    {showFavoritesOnly ? <StarIcon /> : <StarBorderIcon />}
                  </IconButton>
                </Tooltip>

                <Tooltip
                  title={
                    showBuiltInTemplates
                      ? 'Hide built-in templates'
                      : 'Show built-in templates'
                  }
                >
                  <IconButton
                    onClick={toggleBuiltInTemplatesVisibility}
                    sx={{
                      color: showBuiltInTemplates
                        ? theme.palette.common.white
                        : 'rgba(255,255,255,0.5)',
                      borderRadius: '0 8px 8px 0',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.15)',
                      },
                    }}
                  >
                    <DashboardIcon />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>

              <Menu
                anchorEl={sortMenuAnchor}
                open={Boolean(sortMenuAnchor)}
                onClose={handleCloseSortMenu}
                PaperProps={{
                  elevation: 4,
                  sx: { borderRadius: 2, mt: 1, minWidth: 180 },
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
            </Box>
          </DialogTitle>

          <DialogContent dividers sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {currentWidget && (
                <Box sx={{ mb: 3, width: '50%' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => setSaveAsTemplateMode(true)}
                    fullWidth
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: `linear-gradient(45deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.light, 0.9)} 100%)`,
                      color: '#ffffff',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
                      textTransform: 'none',
                      fontSize: '0.95rem',
                      '&:hover': {
                        background: `linear-gradient(45deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.2)',
                      },
                    }}
                  >
                    SAVE CURRENT WIDGET A TEMPLATE
                  </Button>
                </Box>
              )}

              {/* Empty template option with improved contrast */}
              <Box sx={{ mb: 3, width: currentWidget ? '50%' : '100%' }}>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleUseEmptyTemplate}
                  fullWidth
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    background: `linear-gradient(45deg, ${theme.palette.secondary.dark} 0%, ${theme.palette.secondary.main} 100%)`,
                    color: '#ffffff',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
                    textTransform: 'none',
                    fontSize: '0.95rem',
                    '&:hover': {
                      background: `linear-gradient(45deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.light} 100%)`,
                      boxShadow: '0 6px 12px rgba(0, 0, 0, 0.2)',
                    },
                  }}
                >
                  START WITH AN EMPTY TEMPLATE
                </Button>
              </Box>
            </Box>

            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium' }}>
              {userTemplates.length > 0
                ? 'Available Templates'
                : 'Custom Templates'}
            </Typography>

            {/* Render combined built-in and custom templates in sorted order */}
            <Grid container spacing={2}>
              {getSortedAndFilteredTemplates().map((template) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
                  <Card
                    elevation={3}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 2.5,
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'transparent',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: 8,
                        borderColor: theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.primary.main, 0.2)
                          : alpha(theme.palette.primary.main, 0.1),
                        '& .template-actions': {
                          opacity: 1,
                          transform: 'translateY(0)',
                        }
                      },
                      bgcolor: theme.palette.mode === 'dark'
                        ? alpha(theme.palette.background.paper, 0.8)
                        : theme.palette.background.paper,
                    }}
                  >
                    <Box
                      sx={{
                        height: 8,
                        bgcolor: WIDGET_TEMPLATES.some((t) => t.id === template.id)
                          ? theme.palette.secondary.main
                          : theme.palette.primary.main,
                        borderRadius: '8px 8px 0 0',
                      }}
                    />

                    {/* Add 'Built-in' chip for built-in templates */}
                    {WIDGET_TEMPLATES.some((t) => t.id === template.id) && (
                      <Chip
                        label="Built-in"
                        size="small"
                        color="secondary"
                        sx={{
                          position: 'relative',
                          top: 8,
                          left: 8,
                          fontSize: '0.7rem',
                          height: 20,
                          fontWeight: 'bold',
                          boxShadow: 1,
                          width: '4rem',
                        }}
                      />
                    )}
                    <CardContent
                      sx={{
                        flexGrow: 1,
                        pb: 1,
                        position: 'relative',
                        '&:last-child': { pb: 1 },
                        pt: WIDGET_TEMPLATES.some((t) => t.id === template.id) ? 2 : 3,
                      }}
                    >
                      <Tooltip title={isFavorite(template.id) ? "Remove from favorites" : "Add to favorites"}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(template.id)
                          }}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            transition: 'all 0.2s ease',
                            color: isFavorite(template.id) 
                              ? theme.palette.warning.main
                              : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)',
                            '&:hover': {
                              transform: 'scale(1.1)',
                              color: isFavorite(template.id) 
                                ? theme.palette.warning.dark 
                                : theme.palette.warning.main
                            }
                          }}
                        >
                          {isFavorite(template.id) ? (
                            <StarIcon
                              fontSize="small"
                              sx={{ 
                                filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.2))',
                              }}
                            />
                          ) : (
                            <StarBorderIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>

                      <Typography
                        variant="h6"
                        gutterBottom
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          mb: 0.5,
                          mt: 1,
                          paddingRight: '24px', // Space for the favorite button
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          lineHeight: 1.3,
                        }}
                      >
                        {template.name}
                      </Typography>

                      <Typography
                        variant="body2"
                        color={theme.palette.text.secondary}
                        sx={{
                          display: '-webkit-box',
                          overflow: 'hidden',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          mb: 2,
                          height: 40,
                          opacity: 0.85,
                          lineHeight: 1.4,
                        }}
                      >
                        {template.description || 'No description provided'}
                      </Typography>

                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          flexWrap: 'wrap',
                          mb: 1,
                        }}
                      >
                        {template.tags?.map((tag) => {
                          const color = TAG_COLOR_MAP[tag] || 'default'
                          return (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              variant="filled"
                              color={color}
                              sx={{
                                fontSize: '0.7rem', height: 22, fontWeight: 'bold', boxShadow: 1,
                                '& .MuiChip-label': { px: 1 }
                              }}
                            />
                          )
                        })}
                        <Chip
                          label={`${template.components?.length || 0} components`}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: '0.7rem',
                            height: 22,
                            borderColor: alpha(theme.palette.primary.main, 0.4),
                            color: theme.palette.primary.main,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            fontWeight: 'medium',
                          }}
                        />
                      </Box>
                    </CardContent>

                    <CardActions
                      sx={{
                        px: 2,
                        pt: 0,
                        pb: 2,
                        justifyContent: 'space-between',
                        gap: 1,
                        opacity: 0.95,
                        transition: 'all 0.3s ease',
                        className: 'template-actions',
                      }}
                    >
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => handleSelectTemplate(template.id)}
                        variant="contained"
                        sx={{
                          flexGrow: 1,
                          borderRadius: 1.5,
                          textTransform: 'none',
                          fontWeight: 'bold',
                          boxShadow: 3,
                          py: 0.7,
                          background: theme.palette.mode === 'dark'
                            ? `linear-gradient(45deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`
                            : `linear-gradient(45deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.light, 0.9)} 100%)`,
                          '&:hover': {
                            boxShadow: 4,
                            background: theme.palette.mode === 'dark'
                              ? `linear-gradient(45deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
                              : `linear-gradient(45deg, ${alpha(theme.palette.primary.light, 0.9)} 0%, ${theme.palette.primary.main} 100%)`,
                          }
                        }}
                      >
                        Use Template
                      </Button>

                      <Tooltip title="Delete template">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            const isBuiltIn = WIDGET_TEMPLATES.some(
                              (t) => t.id === template.id,
                            )
                            if (!showDeleteTemplateConfirmation) {
                              if (isBuiltIn) {
                                handleDeleteBuiltInTemplate(template.id)
                              } else {
                                deleteTemplate(template.id)
                              }
                            } else {
                              setShowDeleteConfirm(template.id)
                            }
                          }}
                          sx={{ 
                            ml: 1,
                            bgcolor: alpha(theme.palette.error.main, 0.1),
                            '&:hover': {
                              bgcolor: alpha(theme.palette.error.main, 0.2),
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}

              {/* Empty state for user templates */}
              {userTemplates.length === 0 && (
                <Grid item xs={12}>
                  <Box
                    sx={{
                      p: 4,
                      textAlign: 'center',
                      borderRadius: 2,
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? 'rgba(0,0,0,0.2)'
                          : 'rgba(0,0,0,0.03)',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      gutterBottom
                    >
                      No custom templates found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Save your current widget as a template to reuse it later
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Show restore button if all built-in templates are deleted AND built-in templates are shown */}
              {deletedBuiltInTemplates.length === WIDGET_TEMPLATES.length &&
                showBuiltInTemplates && (
                  <Grid item xs={12}>
                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={handleRestoreBuiltInTemplates}
                        startIcon={<RestoreIcon />}
                        sx={{
                          borderRadius: 1.5,
                          textTransform: 'none',
                          fontWeight: 'medium',
                          borderColor: alpha(theme.palette.primary.main, 0.8),
                          color: theme.palette.primary.main,
                          '&:hover': {
                            borderColor: theme.palette.primary.main,
                            backgroundColor: alpha(
                              theme.palette.primary.main,
                              0.05,
                            ),
                          },
                        }}
                      >
                        Restore Built-in Templates
                      </Button>
                    </Box>
                  </Grid>
                )}
            </Grid>
          </DialogContent>

          <DialogActions
            sx={{
              px: 3,
              py: 2,
              bgcolor:
                theme.palette.mode === 'dark'
                  ? 'rgba(0,0,0,0.1)'
                  : 'rgba(0,0,0,0.02)',
            }}
          >
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

      {/* Confirmation dialog for deleting templates - Styled like DeleteConfirmationDialog */}
      <Dialog
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
          },
        }}
      >
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.error.dark} 0%, ${theme.palette.error.main} 100%)`,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            px: 3,
            py: 2,
            position: 'relative',
          }}
        >
          <DeleteIcon sx={{ mr: 1.5, fontSize: 24, color: 'white' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
            Confirm Deletion
          </Typography>
          <IconButton
            size="small"
            aria-label="close"
            sx={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.2)',
              },
            }}
            onClick={() => setShowDeleteConfirm(null)}
          >
            <CloseIcon fontSize="medium" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pb: 1, pt: 3, bgcolor: theme.palette.background.paper }}>
          <Typography
            variant="body1"
            sx={{ mb: 2, fontWeight: 500, color: theme.palette.text.primary }}
          >
            Are you sure you want to delete this template?
          </Typography>
          <Typography
            variant="body2"
            color={theme.palette.text.secondary}
            sx={{ mt: 1 }}
          >
            This action cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 3,
            justifyContent: 'flex-end',
            gap: 2,
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Button
            onClick={() => setShowDeleteConfirm(null)}
            variant="outlined"
            sx={{
              px: 3,
              py: 1,
              minWidth: 120,
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 'medium',
              borderColor: alpha(theme.palette.text.primary, 0.3),
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                bgcolor: alpha(theme.palette.text.primary, 0.05),
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (showDeleteConfirm) {
                // Check if it's a built-in template or user template
                const isBuiltIn = WIDGET_TEMPLATES.some(
                  (t) => t.id === showDeleteConfirm,
                )

                if (isBuiltIn) {
                  handleDeleteBuiltInTemplate(showDeleteConfirm)
                } else {
                  deleteTemplate(showDeleteConfirm)
                }
              }
            }}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            sx={{
              px: 3,
              py: 1,
              minWidth: 120,
              fontWeight: 600,
              borderRadius: 1.5,
              textTransform: 'none',
              boxShadow: 3,
              background: `linear-gradient(45deg, ${theme.palette.error.dark} 0%, ${theme.palette.error.main} 100%)`,
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}

export default TemplateSelectionDialog
