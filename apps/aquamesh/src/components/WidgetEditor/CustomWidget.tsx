import React, { useEffect, useState } from 'react'
import { 
  Box, 
  Typography, 
  Paper, 
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Alert,
  Collapse
} from '@mui/material'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import WidgetStorage from './WidgetStorage'
import DataUpload from './components/builtin/DataUpload'

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
  const [toastState, setToastState] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  })
  // Track collapsed state for fieldsets
  const [collapsedFieldsets, setCollapsedFieldsets] = useState<Record<string, boolean>>({})
  
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

  // Show toast message
  const showToast = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToastState({
      open: true,
      message,
      severity,
    })
    
    // Auto hide after 3 seconds
    setTimeout(() => {
      setToastState(prev => ({ ...prev, open: false }))
    }, 3000)
  }

  // Toggle fieldset collapsed state
  const toggleFieldsetCollapse = (componentId: string) => {
    setCollapsedFieldsets(prev => ({
      ...prev,
      [componentId]: !prev[componentId]
    }))
  }

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
    case 'FieldSet': {
      const isCollapsed = collapsedFieldsets[component.id] ?? Boolean(component.props.collapsed)
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
          <Box
            onClick={() => toggleFieldsetCollapse(component.id)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              mb: 1
            }}
          >
            {isCollapsed ? (
              <KeyboardArrowDownIcon fontSize="small" />
            ) : (
              <KeyboardArrowUpIcon fontSize="small" />
            )}
            <Typography variant="subtitle2" sx={{ ml: 0.5 }}>
              {component.props.legend as string}
            </Typography>
          </Box>
          <Collapse in={!isCollapsed}>
            {component.children && component.children.length > 0 ? (
              <Box sx={{ mt: 1 }}>
                {component.children.map(renderComponent)}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No content</Typography>
            )}
          </Collapse>
        </Box>
      )
    }
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
            size={component.props.size as 'small' | 'medium' | 'large' || 'small'}
            color={component.props.color as 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' || 'primary'}
            onClick={() => {
              const clickAction = component.props.clickAction as string || 'toast'
              
              if (clickAction === 'toast' && component.props.showToast) {
                const message = component.props.toastMessage as string || 'Button clicked!'
                const severity = component.props.toastSeverity as 'success' | 'error' | 'info' | 'warning' || 'info'
                showToast(message, severity)
              } else if (clickAction === 'openUrl') {
                const url = component.props.url as string
                if (url) {
                  window.open(url, '_blank', 'noopener,noreferrer')
                } else {
                  showToast('No URL configured for this button', 'warning')
                }
              }
            }}
          >
            {component.props.text as string}
          </Button>
        </Box>
      )
    case 'DataUpload':
      return (
        <Box key={component.id} sx={{ mb: 1 }}>
          <DataUpload 
            label={component.props.label as string || 'Upload File'}
            acceptedFileTypes={component.props.acceptedFileTypes as string || 'image/*,application/pdf'}
            maxFileSize={component.props.maxFileSize as number || 5}
            allowMultiple={component.props.allowMultiple as boolean || false}
            helperText={component.props.helperText as string}
          />
        </Box>
      )
    case 'TextField':
      return (
        <Box key={component.id} sx={{ mb: 1 }}>
          <TextField 
            label={component.props.label as string} 
            placeholder={component.props.placeholder as string}
            defaultValue={component.props.defaultValue as string || ''}
            size="small"
            fullWidth
          />
        </Box>
      )
    case 'FlexBox': {
      return (
        <Box 
          key={component.id} 
          sx={{ 
            display: 'flex',
            flexDirection: component.props.direction as 'row' | 'column' | 'row-reverse' | 'column-reverse' || 'row',
            justifyContent: component.props.justifyContent as string || 'flex-start',
            alignItems: component.props.alignItems as string || 'center',
            flexWrap: component.props.wrap as 'nowrap' | 'wrap' | 'wrap-reverse' || 'wrap',
            gap: (component.props.spacing as number || 2),
            width: '100%',
            mb: 1
          }}
        >
          {component.children && component.children.length > 0 ? (
            component.children.map(renderComponent)
          ) : (
            <Typography variant="body2" color="text.secondary">Empty Flex Container</Typography>
          )}
        </Box>
      )
    }
    case 'GridBox': {
      return (
        <Box 
          key={component.id} 
          sx={{ 
            display: 'grid',
            gridTemplateColumns: `repeat(${component.props.columns as number || 2}, 1fr)`,
            gridTemplateRows: `repeat(${component.props.rows as number || 1}, auto)`,
            gap: (component.props.spacing as number || 2),
            width: '100%',
            mb: 1
          }}
        >
          {component.children && component.children.length > 0 ? (
            component.children.map(renderComponent)
          ) : (
            <Typography variant="body2" color="text.secondary">Empty Grid Container</Typography>
          )}
        </Box>
      )
    }
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
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto', position: 'relative' }}>
      {widgetName && (
        <Typography variant="subtitle1" sx={{ mb: 2 }}>{widgetName}</Typography>
      )}
      {widgetComponents.map(renderComponent)}
      
      {/* Toast notification */}
      {toastState.open && (
        <Alert 
          severity={toastState.severity} 
          sx={{ 
            position: 'absolute', 
            bottom: 16, 
            right: 16, 
            zIndex: 9999,
            boxShadow: 3,
            maxWidth: 400
          }}
          onClose={() => setToastState(prev => ({ ...prev, open: false }))}
        >
          {toastState.message}
        </Alert>
      )}
    </Paper>
  )
}

export default CustomWidget 