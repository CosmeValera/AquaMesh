import React, { useEffect, useState } from 'react'
import { 
  Box, 
  Typography, 
  Paper, 
  Switch,
  FormControlLabel,
  TextField,
  Button
} from '@mui/material'
import WidgetStorage from './WidgetStorage'

interface ComponentData {
  id: string
  type: string
  props: Record<string, unknown>
  children?: ComponentData[]
  parentId?: string
}

interface CustomWidgetProps {
  name?: string
  widgetId?: string
  components?: ComponentData[]
  customProps?: {
    widgetId?: string
    components?: ComponentData[]
  }
}

// Component that renders a saved widget
const CustomWidget: React.FC<CustomWidgetProps> = ({ widgetId, components: propComponents, customProps, name }) => {
  const [widgetComponents, setWidgetComponents] = useState<ComponentData[]>([])
  const [widgetName, setWidgetName] = useState<string>('')
  
  // Determine which components to use
  useEffect(() => {    
    // First try to get from direct props
    if (propComponents && propComponents.length > 0) {
      setWidgetComponents(propComponents)
      return
    }
    
    // Then try to get from custom props (from topNavBar)
    if (customProps?.components && customProps.components.length > 0) {
      setWidgetComponents(customProps.components)
      return
    }
    
    // Then try getting from widgetId directly
    const directWidgetId = widgetId || customProps?.widgetId
    if (directWidgetId) {
      const widget = WidgetStorage.getWidgetById(directWidgetId)
      
      if (widget) {
        setWidgetName(widget.name)
        
        if (Array.isArray(widget.components) && widget.components.length > 0) {
          setWidgetComponents(widget.components)
          return
        }
      }
    }
    
    // Last attempt - try to get all widgets and find one matching the name parameter
    if (name) {
      const allWidgets = WidgetStorage.getAllWidgets()
      const matchingWidget = allWidgets.find(w => w.name === name)
      
      if (matchingWidget && Array.isArray(matchingWidget.components)) {
        console.log('CustomWidget: Found widget by name:', JSON.stringify(matchingWidget, null, 2))
        setWidgetName(matchingWidget.name)
        setWidgetComponents(matchingWidget.components)
        return
      }
    }
    
    // Default to empty array if nothing is found
    console.log('CustomWidget: No components found, using empty array')
    setWidgetComponents([])
  }, [widgetId, propComponents, customProps, name])

  // Function to render any component type
  const renderComponent = (component: ComponentData) => {
    switch (component.type) {
    case 'SwitchEnable':
      return (
        <Box key={component.id} sx={{ mb: 1 }}>
          <FormControlLabel
            control={<Switch defaultChecked={component.props.defaultChecked as boolean} />}
            label={component.props.label as string}
          />
        </Box>
      )
    case 'FieldSet':
      return (
        <Box 
          key={component.id} 
          sx={{ 
            border: '1px solid #ccc', 
            p: 2, 
            borderRadius: 1,
            mb: 1
          }}
        >
          <Typography variant="subtitle2">{component.props.legend as string}</Typography>
          {component.children && component.children.length > 0 ? (
            <Box sx={{ mt: 1 }}>
              {component.children.map(renderComponent)}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No content</Typography>
          )}
        </Box>
      )
    case 'Label':
      return (
        <Box key={component.id} sx={{ mb: 1 }}>
          <Typography variant="body1">{component.props.text as string}</Typography>
        </Box>
      )
    case 'Button':
      return (
        <Box key={component.id} sx={{ mb: 1 }}>
          <Button 
            variant={component.props.variant as 'contained' | 'outlined' | 'text' || 'contained'} 
            size="small"
          >
            {component.props.text as string}
          </Button>
        </Box>
      )
    case 'TextField':
      return (
        <Box key={component.id} sx={{ mb: 1 }}>
          <TextField 
            label={component.props.label as string} 
            placeholder={component.props.placeholder as string}
            size="small"
            fullWidth
          />
        </Box>
      )
    default:
      return (
        <Box key={component.id}>
          <Typography>Unknown component type: {component.type}</Typography>
        </Box>
      )
    }
  }

  // For debugging purposes
  console.log('CustomWidget rendering with components:', 
    widgetComponents ? `Array(${widgetComponents.length})` : 'none')

  if (!widgetComponents || widgetComponents.length === 0) {
    return (
      <Paper 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          height: '100%'
        }}
      >
        <Typography color="text.secondary">This widget has no components</Typography>
        {widgetId && (
          <Typography variant="caption" sx={{ mt: 1 }}>Widget ID: {widgetId}</Typography>
        )}
        {customProps?.widgetId && (
          <Typography variant="caption">Custom Props Widget ID: {customProps.widgetId}</Typography>
        )}
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      {widgetName && (
        <Typography variant="subtitle1" sx={{ mb: 2 }}>{widgetName}</Typography>
      )}
      {widgetComponents.map(renderComponent)}
    </Paper>
  )
}

export default CustomWidget 