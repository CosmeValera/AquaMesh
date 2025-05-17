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
// Import shared styles
import { dialogStyles, applyDialogStyles, buttonStyles, cardStyles, chipStyles, TAG_COLOR_MAP } from '../../../shared/DialogStyles'
import useMediaQuery from '@mui/material/useMediaQuery'
import theme from '../../../../theme'

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

const TemplateSelectionDialog: React.FC<TemplateSelectionDialogProps> = ({
  open,
  onClose,
  onTemplateSelected,
  currentWidget,
  showDeleteTemplateConfirmation = true,
}) => {
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
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
    case 'name_asc':
      sortFn = (a, b) => a.name.localeCompare(b.name)
      break
    case 'name_desc':
      sortFn = (a, b) => b.name.localeCompare(a.name)
      break
    case 'components_desc':
      sortFn = (a, b) => b.components.length - a.components.length
      break
    case 'components_asc':
      sortFn = (a, b) => a.components.length - b.components.length
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

  const handleDeleteBuiltInTemplate = (templateId: string) => {
    setDeletedBuiltInTemplates([...deletedBuiltInTemplates, templateId])
    setShowDeleteConfirm(null)
  }

  const handleRestoreBuiltInTemplates = () => {
    setDeletedBuiltInTemplates([])
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={isPhone ? 'xs' : 'md'}
      fullWidth
      {...applyDialogStyles()}
    >
      {saveAsTemplateMode ? (
        <>
          <DialogTitle sx={dialogStyles.title}>
            <SaveIcon sx={{ mr: 1.5, color: 'white' }} />
            <Typography variant={isPhone ? 'subtitle1' : 'h6'} sx={{ fontWeight: 500, color: 'white' }}>
              Save as Template
            </Typography>
          </DialogTitle>
          <DialogContent sx={dialogStyles.content}>
            <Box sx={{ my: 1, py: 1 }}>
              <Typography variant="body1" paragraph>
                Create a reusable template from your current widget design.
                Templates help you quickly start new widgets with pre-designed
                structures and layouts.
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
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'white',
                  },
                },
              }}
              InputLabelProps={{
                sx: {
                  color: 'rgba(255, 255, 255, 0.7)',
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
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'white',
                  },
                },
              }}
              InputLabelProps={{
                sx: {
                  color: 'rgba(255, 255, 255, 0.7)',
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
                  const color = TAG_COLOR_MAP[option.toLowerCase()] || 'default'
                  return (
                    <Chip
                      {...getTagProps({ index })}
                      key={option}
                      label={option}
                      size="small"
                      color={color}
                      sx={chipStyles.base}
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
                  InputProps={{
                    ...params.InputProps,
                    sx: {
                      color: 'white',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'white',
                      },
                    },
                  }}
                  InputLabelProps={{
                    sx: {
                      color: 'rgba(255, 255, 255, 0.7)',
                    },
                  }}
                  FormHelperTextProps={{
                    sx: {
                      color: 'rgba(255, 255, 255, 0.7)',
                    },
                  }}
                />
              )}
              sx={{
                '& .MuiAutocomplete-tag': {
                  bgcolor: 'rgba(255, 255, 255, 0.16)',
                  color: 'white',
                }
              }}
            />
          </DialogContent>
          <DialogActions sx={dialogStyles.actions}>
            <Button
              onClick={() => {
                setSaveAsTemplateMode(false)
                setTemplateName('')
                setTemplateDescription('')
              }}
              variant="outlined"
              sx={buttonStyles.secondary}
            >
              Cancel
            </Button>
            <Button
              onClick={saveCurrentWidgetAsTemplate}
              variant="contained"
              disabled={!templateName.trim()}
              startIcon={<SaveIcon />}
              sx={buttonStyles.primary}
            >
              Save Template
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle sx={{
            ...dialogStyles.title,
            px: isPhone ? 2 : dialogStyles.title.px,
            py: isPhone ? 1 : dialogStyles.title.py
          }}>
            <DashboardIcon sx={{ mr: 1.5, color: 'white' }} />
            <Typography
              variant={isPhone ? 'subtitle2' : 'h6'}
              sx={{
                flexGrow: 1,
                fontWeight: 500,
                color: 'white',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: isPhone ? '1rem' : undefined,
              }}
            >
              Templates
            </Typography>

            <Box sx={{
              position: 'absolute',
              right: isPhone ? 4 : 10,
              top: isPhone ? 8 : '50%',
              transform: isPhone ? 'none' : 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: isPhone ? 0.5 : 1,
            }}>
              {isPhone ? (
                <>
                  <IconButton
                    onClick={handleOpenSortMenu}
                    size="small"
                    sx={{ color: 'white', p: 0.5 }}
                  >
                    <SortIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    size="small"
                    sx={{
                      color: showFavoritesOnly ? '#FFD700' : 'white',
                      p: 0.5,
                    }}
                  >
                    {showFavoritesOnly ? (
                      <StarIcon fontSize="small" />
                    ) : (
                      <StarBorderIcon fontSize="small" />
                    )}
                  </IconButton>
                  <IconButton
                    onClick={toggleBuiltInTemplatesVisibility}
                    size="small"
                    sx={{
                      color: showBuiltInTemplates ? 'white' : 'rgba(255,255,255,0.5)',
                      p: 0.5,
                    }}
                  >
                    <DashboardIcon fontSize="small" />
                  </IconButton>
                </>
              ) : (
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
                        color: 'white',
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.15)',
                        },
                      }}
                    >
                      {!isPhone && (
                        sortOption === 'newest' ? 'Date (New-Old)' :
                        sortOption === 'oldest' ? 'Date (Old-New)' :
                        sortOption === 'name_asc' ? 'Name (A-Z)' :
                        sortOption === 'name_desc' ? 'Name (Z-A)' :
                        sortOption === 'components_asc' ? 'Components (Low-High)' :
                        sortOption === 'components_desc' ? 'Components (High-Low)' : ''
                      )}
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
                          ? '#FFD700'
                          : 'white',
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
                          ? 'white'
                          : 'rgba(255, 255, 255, 0.5)',
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
              )}
            </Box>
          </DialogTitle>

          {/* Sort menu */}
          <Menu
            anchorEl={sortMenuAnchor}
            open={Boolean(sortMenuAnchor)}
            onClose={handleCloseSortMenu}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            sx={{
              '& .MuiPaper-root': {
                backgroundImage: 'linear-gradient(135deg, #00BC9A 0%, #008C8C 100%)',
                borderRadius: 2,
                mt: 1,
                '& .MuiList-root': {
                  py: 0.5,
                },
                '& .MuiMenuItem-root': {
                  py: 1,
                },
              },
            }}
          >
            <MenuItem
              onClick={() => handleSortOptionChange('newest')}
              sx={{
                fontWeight: sortOption === 'newest' ? 'bold' : 'normal',
                bgcolor: sortOption === 'newest' ? 'rgba(0, 0, 0, 0.08)' : 'inherit',
              }}
            >
              <ListItemText>Date (Newest first)</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => handleSortOptionChange('oldest')}
              sx={{
                fontWeight: sortOption === 'oldest' ? 'bold' : 'normal',
                bgcolor: sortOption === 'oldest' ? 'rgba(0, 0, 0, 0.08)' : 'inherit',
              }}
            >
              <ListItemText>Date (Oldest first)</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => handleSortOptionChange('name_asc')}
              sx={{
                fontWeight: sortOption === 'name_asc' ? 'bold' : 'normal',
                bgcolor: sortOption === 'name_asc' ? 'rgba(0, 0, 0, 0.08)' : 'inherit',
              }}
            >
              <ListItemText>Name (A-Z)</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => handleSortOptionChange('name_desc')}
              sx={{
                fontWeight: sortOption === 'name_desc' ? 'bold' : 'normal',
                bgcolor: sortOption === 'name_desc' ? 'rgba(0, 0, 0, 0.08)' : 'inherit',
              }}
            >
              <ListItemText>Name (Z-A)</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => handleSortOptionChange('components_desc')}
              sx={{
                fontWeight: sortOption === 'components_desc' ? 'bold' : 'normal',
                bgcolor: sortOption === 'components_desc' ? 'rgba(0, 0, 0, 0.08)' : 'inherit',
              }}
            >
              <ListItemText>Components (High-Low)</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => handleSortOptionChange('components_asc')}
              sx={{
                fontWeight: sortOption === 'components_asc' ? 'bold' : 'normal',
                bgcolor: sortOption === 'components_asc' ? 'rgba(0, 0, 0, 0.08)' : 'inherit',
              }}
            >
              <ListItemText>Components (Low-High)</ListItemText>
            </MenuItem>
          </Menu>

          <DialogContent sx={{...dialogStyles.content, p: isPhone ? 1 : 3}}>
            {/* Dialog content */}
            <Grid container spacing={isPhone ? 1 : 3} sx={{ flexDirection: isPhone ? 'column' : 'row' }}>

              {/* Save as Template Card - Only show if there's a current widget */}
              {currentWidget && (
                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    onClick={() => setSaveAsTemplateMode(true)}
                    sx={{
                      ...cardStyles.base,
                      cursor: 'pointer',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      transition: 'all 0.3s ease',
                      borderStyle: 'dashed',
                      borderWidth: 2,
                      '&:hover': {
                        ...cardStyles.base['&:hover'],
                        borderColor: '#00BC9A',
                        bgcolor: 'rgba(0, 188, 154, 0.25)',
                      }
                    }}
                  >
                    <CardContent sx={{ ...cardStyles.content, flexGrow: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          textAlign: 'center',
                          pt: 2,
                          pb: 3,
                        }}
                      >
                        <SaveIcon sx={{ fontSize: 45, color: '#00BC9A', mb: 2 }} />
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'white' }}>
                          Save as Template
                        </Typography>
                        <Typography variant="body2" color="white" sx={{ opacity: 0.7 }}>
                          Create a reusable template from current widget
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Empty Template Card */}
              <Grid item xs={12} sm={6} md={4}>
                <Card
                  onClick={handleUseEmptyTemplate}
                  sx={{
                    ...cardStyles.base,
                    cursor: 'pointer',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    borderStyle: 'dashed',
                    borderWidth: 2,
                    '&:hover': {
                      ...cardStyles.base['&:hover'],
                      borderColor: '#00BC9A',
                      bgcolor: 'rgba(0, 188, 154, 0.25)',
                    }
                  }}
                >
                  <CardContent sx={{ ...cardStyles.content, flexGrow: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        textAlign: 'center',
                        pt: 2,
                        pb: 3,
                      }}
                    >
                      <AddIcon sx={{ fontSize: 45, color: 'white', mb: 2 }} />
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'white' }}>
                        Start Empty
                      </Typography>
                      <Typography variant="body2" color="white" sx={{ opacity: 0.7 }}>
                        Create a new widget from scratch
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Template Cards */}
              {getSortedAndFilteredTemplates().map((template) => (
                <Grid item xs={12} sm={6} md={4} key={template.id}>
                  <Card
                    onClick={() => handleSelectTemplate(template.id)}
                    sx={{
                      ...cardStyles.base,
                      cursor: 'pointer',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        ...cardStyles.base['&:hover'],
                      }
                    }}
                  >
                    <Box
                      sx={{
                        height: 8,
                        bgcolor: WIDGET_TEMPLATES.some((t) => t.id === template.id)
                          ? '#9c27b0'
                          : '#00BC9A',
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
                          ...chipStyles.base,
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
                        ...cardStyles.content,
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
                              ? '#FFD700'
                              : 'rgba(255,255,255,0.5)',
                            '&:hover': {
                              transform: 'scale(1.1)',
                              color: isFavorite(template.id) 
                                ? '#FFD700' 
                                : 'rgba(255,255,255,0.8)'
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
                          color: 'white',
                        }}
                      >
                        {template.name}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="rgba(255,255,255,0.7)"
                        sx={{
                          display: '-webkit-box',
                          overflow: 'hidden',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          mb: 2,
                          height: 40,
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
                          const color = TAG_COLOR_MAP[tag.toLowerCase()] || 'default'
                          return (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              color={color}
                              sx={{
                                ...chipStyles.base,
                                fontSize: '0.7rem', 
                                height: 22, 
                                fontWeight: 'bold',
                                '& .MuiChip-label': { px: 1 }
                              }}
                            />
                          )
                        })}
                        <Chip
                          label={`${template.components?.length || 0} components`}
                          size="small"
                          color="primary"
                          sx={{ 
                            ...chipStyles.base,
                            fontSize: '0.7rem', 
                            background: 'linear-gradient(to right,rgb(31, 177, 174),rgb(33, 218, 116))',
                            height: 22, 
                            fontWeight: 'medium', 
                            '& .MuiChip-label': { px: 1 }
                          }}
                        />
                      </Box>
                    </CardContent>

                    <CardActions sx={{...cardStyles.actions, justifyContent: 'space-between'}}>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectTemplate(template.id)
                        }}
                        variant="contained"
                        sx={{
                          ...buttonStyles.primary,
                          flexGrow: 1,
                          borderRadius: 1.5,
                          textTransform: 'none',
                          fontWeight: 'bold',
                          py: 0.7,
                        }}
                      >
                        Use Template
                      </Button>

                      <Tooltip title="Delete template">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation()
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
          <DialogActions sx={{
            px: isPhone ? 1 : 3,
            py: isPhone ? 1 : 2,
            bgcolor: '#00A389',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <Button 
              onClick={onClose} 
              variant="contained"
              sx={{
                bgcolor: '#00D1AB',
                color: '#191919',
                px: isPhone ? 2 : undefined,
                py: isPhone ? 1 : undefined,
                '&:hover': {
                  bgcolor: '#00E4BC',
                }
              }}            >
              Close
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
            ...dialogStyles.paper,
            bgcolor: '#006B58' // Special background for danger dialog
          }
        }}
      >
        <DialogTitle
          sx={{
            ...dialogStyles.errorTitle,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <DeleteIcon sx={{ mr: 1.5, fontSize: 24, color: 'white' }} />
          <Typography variant="h6" sx={{ fontWeight: 500, color: 'white' }}>
            Confirm Deletion
          </Typography>
          <IconButton
            size="small"
            aria-label="close"
            sx={dialogStyles.closeButton}
            onClick={() => setShowDeleteConfirm(null)}
          >
            <CloseIcon fontSize="medium" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ ...dialogStyles.content, bgcolor: '#006B58', color: 'white' }}>
          <Typography
            variant="body1"
            sx={{ mb: 2, pt: 1.5, fontWeight: 400 }}
          >
            Are you sure you want to delete this template?
          </Typography>
          <Typography
            variant="body2"
            color="rgba(255, 255, 255, 0.7)"
            sx={{ mt: 1 }}
          >
            This action cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            ...dialogStyles.centeredActions,
            bgcolor: '#006B58'
          }}
        >
          <Button
            onClick={() => setShowDeleteConfirm(null)}
            variant="outlined"
            sx={buttonStyles.secondary}
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
            sx={buttonStyles.danger}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}

export default TemplateSelectionDialog
