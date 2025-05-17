import React, { useMemo } from 'react'
import { 
  Box, 
  Typography, 
  List,
  ListSubheader,
  Collapse,
  IconButton,
  useTheme,
  useMediaQuery,
  Chip,
  Divider
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import TargetIcon from '@mui/icons-material/GpsFixed'
import CloseIcon from '@mui/icons-material/Close'
import { COMPONENT_TYPES } from '../../constants/componentTypes'
import { ComponentType } from '../../types/types'
import ComponentPaletteItem from './ComponentPaletteItem'

// Interface for component props
interface ComponentPaletteProps {
  showTooltips?: boolean
  showHelpText?: boolean
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, type: string) => void
  showComponentPaletteHelp: boolean
  handleDirectAdd?: (componentType: string) => void
  activeContainerId?: string | null
  setActiveContainerId?: (id: string | null) => void
  widgetData?: any // To lookup container name
}

// Helper function to group components by category
const groupByCategory = (components: ComponentType[]) => {
  return components.reduce((acc, component) => {
    const category = component.category || 'UI Components'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(component)
    return acc
  }, {} as Record<string, ComponentType[]>)
}

// Define the component palette groups and expand state
const PALETTE_GROUPS = ['UI Components', 'Layout Containers', 'Chart Components']

// Component palette component
const ComponentPalette = ({ 
  showTooltips = false, 
  showHelpText = true, 
  handleDragStart, 
  showComponentPaletteHelp,
  handleDirectAdd,
  activeContainerId,
  setActiveContainerId,
  widgetData
}: ComponentPaletteProps) => {
  // Responsive width based on screen size
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'))
  const drawerWidth = isPhone ? 130 : isTablet ? 220 : 250
  
  // Group component types by category - memoized to prevent recalculation on each render
  const groupedComponents = useMemo(() => groupByCategory(COMPONENT_TYPES), [])
  
  // State for controlling which category is expanded
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>(() => {
    // Start with all categories expanded
    return PALETTE_GROUPS.reduce((acc, category) => {
      acc[category] = true
      return acc
    }, {} as Record<string, boolean>)
  })
  
  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }
  
  // Create a direct add handler if one wasn't provided
  const onDirectAdd = handleDirectAdd || ((componentType: string) => {
    // If no handler was provided, dispatch a custom event to add the component
    const customEvent = new CustomEvent('addComponentDirectly', {
      detail: { componentType }
    })
    document.dispatchEvent(customEvent)
  })
  
  // Find active container name if we have an ID and widget data
  const activeContainerInfo = React.useMemo(() => {
    if (!activeContainerId || !widgetData || !widgetData.components) return null
    
    // Recursive function to find a component by ID
    const findComponentById = (id: string, components: any[]): any => {
      for (const component of components) {
        if (component.id === id) {
          return component
        }
        if (component.children && component.children.length > 0) {
          const found = findComponentById(id, component.children)
          if (found) return found
        }
      }
      return null
    }
    
    const container = findComponentById(activeContainerId, widgetData.components)
    if (container) {
      return {
        name: container.type,
        props: container.props,
      }
    }
    
    return null
  }, [activeContainerId, widgetData])
  
  // Handle clearing the active container
  const handleClearActiveContainer = () => {
    if (setActiveContainerId) {
      setActiveContainerId(null)
    }
  }
  
  return (
    <Box
      sx={{
        width: drawerWidth,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
      className="component-palette"
    >
      <Typography 
        variant={isPhone ? "subtitle2" : "h6"}
        sx={{ 
          px: isPhone ? 1 : 2, 
          py: isPhone ? 0.75 : 1, 
          color: 'foreground.contrastPrimary', 
          fontWeight: 'bold', 
          borderBottom: 1, 
          borderColor: 'divider',
          fontSize: isPhone ? '0.875rem' : undefined
        }}
      >
        Components
      </Typography>
      
      {/* Active container indicator for mobile */}
      {activeContainerId && activeContainerInfo && (
        <Box sx={{ 
          p: isPhone ? 0.75 : 1, 
          bgcolor: 'rgba(0, 188, 162, 0.1)', 
          borderBottom: 1, 
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, fontSize: isPhone ? '0.65rem' : undefined }}>
            Adding to:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TargetIcon fontSize="small" sx={{ color: '#00C49A', fontSize: isPhone ? '0.875rem' : undefined }} />
            <Chip
              label={activeContainerInfo.name}
              size="small"
              color="primary"
              variant="outlined"
              onDelete={handleClearActiveContainer}
              deleteIcon={<CloseIcon fontSize="small" sx={{ fontSize: isPhone ? '0.75rem' : undefined }} />}
              sx={{ 
                height: isPhone ? 20 : 24,
                '& .MuiChip-label': {
                  px: isPhone ? 0.5 : 1,
                  fontSize: isPhone ? '0.65rem' : undefined
                }
              }}
            />
          </Box>
        </Box>
      )}
      
      <List
        sx={{
          width: '100%',
          overflowY: 'auto',
          flexGrow: 1,
          pt: 0,
          overflowX: 'hidden',
          '& .MuiListSubheader-root': {
            py: isPhone ? 0.5 : 1
          }
        }}
      >
        {PALETTE_GROUPS.map((category) => {
          const components = groupedComponents[category] || []
          
          if (components.length === 0) {
            return null
          }
          
          return (
            <Box key={category} sx={{ mb: isPhone ? 1 : 2 }}>
              <ListSubheader
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'center',
                  bgcolor: 'background.default',
                  color: 'foreground.contrastSecondary',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  py: isPhone ? 0.5 : 1,
                  fontSize: isPhone ? '0.7rem' : undefined,
                  lineHeight: isPhone ? 1.3 : undefined
                }}
                onClick={() => toggleCategory(category)}
              >
                {category}
                <IconButton 
                  size="small" 
                  sx={{ 
                    color: 'foreground.contrastSecondary',
                    padding: isPhone ? 0.25 : '4px'
                  }}
                >
                  {expandedCategories[category] ? 
                    <ExpandLessIcon sx={{ fontSize: isPhone ? '0.9rem' : '1.25rem' }} /> : 
                    <ExpandMoreIcon sx={{ fontSize: isPhone ? '0.9rem' : '1.25rem' }} />
                  }
                </IconButton>
              </ListSubheader>
              
              <Collapse in={expandedCategories[category]} timeout="auto">
                <Box sx={{ px: isPhone ? 0.5 : 1, pt: isPhone ? 0.5 : 1 }}>
                  {components.map((component) => (
                    <ComponentPaletteItem
                      key={component.type}
                      component={component}
                      showTooltips={showTooltips}
                      handleDragStart={handleDragStart}
                      onDirectAdd={onDirectAdd}
                    />
                  ))}
                </Box>
              </Collapse>
            </Box>
          )
        })}
      </List>
      
      {/* Help text at bottom */}
      {showComponentPaletteHelp && showHelpText && (
        <Box sx={{ 
          p: isPhone ? 1 : 2, 
          borderTop: 1, 
          borderColor: 'divider', 
          fontSize: isPhone ? '0.5rem' : '0.65rem'
        }}>
          <Typography 
            variant="caption" 
            color="foreground.contrastSecondary" 
            sx={{ 
              display: 'block', 
              mb: 0.5, 
              fontSize: isPhone ? '0.5rem' : '0.65rem' 
            }}
          >
            {isPhone ? 'Click the + button to add a component' : 'Drag components to the editor canvas'}
          </Typography>
          <Typography 
            variant="caption" 
            color="foreground.contrastSecondary" 
            sx={{ 
              display: 'block', 
              fontSize: isPhone ? '0.5rem' : '0.65rem' }}
          >
            {!showTooltips 
              ? 'Enable tooltips in settings for descriptions'
              : isPhone 
                ? 'Long press over components for descriptions' 
                : 'Hover over components for descriptions'
            }
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default ComponentPalette 