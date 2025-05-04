import React, { useMemo } from 'react'
import { 
  Box, 
  Typography, 
  List,
  ListSubheader,
  Paper,
  Tooltip,
  Collapse,
  IconButton
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { COMPONENT_TYPES } from '../constants/componentTypes'
import { ComponentType } from '../types/types'

// Interface for component props
interface ComponentPaletteProps {
  showTooltips: boolean
  showHelpText?: boolean
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, type: string) => void
}

// Group component types by category
const groupByCategory = (componentTypes: ComponentType[]) => {
  return componentTypes.reduce<Record<string, ComponentType[]>>((acc, component) => {
    const category = component.category || 'Other'
    
    if (!acc[category]) {
      acc[category] = []
    }
    
    acc[category].push(component)
    return acc
  }, {})
}

// Define the component palette groups and expand state
const PALETTE_GROUPS = ['UI Components', 'Layout Containers', 'Chart Components']

// Component palette component
const ComponentPalette = ({ showTooltips, showHelpText = true, handleDragStart }: ComponentPaletteProps) => {
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
  
  return (
    <Box
      sx={{
        width: 250,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography 
        variant="h6" 
        sx={{ 
          px: 2, 
          py: 1, 
          color: 'foreground.contrastPrimary', 
          fontWeight: 'bold', 
          borderBottom: 1, 
          borderColor: 'divider' 
        }}
      >
        Components
      </Typography>
      
      <List
        sx={{
          width: '100%',
          overflowY: 'auto',
          flexGrow: 1,
          pt: 0,
        }}
      >
        {PALETTE_GROUPS.map((category) => {
          const components = groupedComponents[category] || []
          
          if (components.length === 0) {
            return null
          }
          
          return (
            <Box key={category} sx={{ mb: 2 }}>
              <ListSubheader
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  bgcolor: 'background.default',
                  color: 'foreground.contrastSecondary',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  py: 1
                }}
                onClick={() => toggleCategory(category)}
              >
                {category}
                <IconButton size="small" sx={{ color: 'foreground.contrastSecondary' }}>
                  {expandedCategories[category] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </ListSubheader>
              
              <Collapse in={expandedCategories[category]} timeout="auto">
                <Box sx={{ px: 1 }}>
                  {components.map((component) => {
                    // Create the icon element dynamically from the component's icon property
                    const IconComponent = component.icon
                    
                    return (
                      <Box key={component.type} sx={{ mb: 1 }}>
                        <Tooltip
                          title={showTooltips ? component.tooltip || '' : ''}
                          placement="right"
                          arrow
                        >
                          <Paper
                            elevation={1}
                            draggable
                            onDragStart={(e) => handleDragStart(e, component.type)}
                            sx={{
                              p: 1.5,
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'grab',
                              transition: 'all 0.2s',
                              '&:hover': {
                                bgcolor: 'background.paper',
                                transform: 'translateY(-2px)',
                                boxShadow: 2,
                              },
                              bgcolor: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: 1,
                            }}
                          >
                            <Box
                              sx={{
                                mr: 1.5,
                                color: 'primary.main',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {IconComponent && <IconComponent />}
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 'medium', color: 'foreground.contrastPrimary' }}
                            >
                              {component.label}
                            </Typography>
                          </Paper>
                        </Tooltip>
                      </Box>
                    )
                  })}
                </Box>
              </Collapse>
            </Box>
          )
        })}
      </List>
      
      {/* Help text at bottom */}
      {showHelpText && (
        <Box sx={{ p: '4px 16px', borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
          <Typography variant="caption" color="foreground.contrastSecondary" sx={{ display: 'block', mb: 1, fontSize: '11px' }}>
            Drag components to the editor canvas
          </Typography>
          <Typography variant="caption" color="foreground.contrastSecondary" sx={{ fontSize: '9px' }}>
            {showTooltips 
              ? 'Hover over components for descriptions' 
              : 'Enable tooltips in settings for descriptions'}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default React.memo(ComponentPalette) 