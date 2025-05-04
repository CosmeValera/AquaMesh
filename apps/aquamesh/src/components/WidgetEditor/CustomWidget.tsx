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
  Collapse,
  InputAdornment
} from '@mui/material'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import WidgetStorage from './WidgetStorage'
import ChartPreview from './components/ChartPreview'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DeleteIcon from '@mui/icons-material/Delete'
import LinkIcon from '@mui/icons-material/Link'
import NotificationsIcon from '@mui/icons-material/Notifications'
import CodeIcon from '@mui/icons-material/Code'
import SettingsIcon from '@mui/icons-material/Settings'
import PreviewIcon from '@mui/icons-material/Preview'
import SendIcon from '@mui/icons-material/Send'
import SaveIcon from '@mui/icons-material/Save'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ColorLensIcon from '@mui/icons-material/ColorLens'

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

// Icon mapping - must match ButtonEditor
const AVAILABLE_ICONS: Record<string, React.ElementType> = {
  add: AddIcon,
  delete: DeleteIcon,
  link: LinkIcon,
  notification: NotificationsIcon,
  code: CodeIcon,
  settings: SettingsIcon,
  preview: PreviewIcon,
  openNew: OpenInNewIcon,
  colorLens: ColorLensIcon,
  send: SendIcon,
  save: SaveIcon,
  upload: CloudUploadIcon,
  check: CheckCircleIcon
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
            control={
              <Switch 
                defaultChecked={component.props.defaultChecked as boolean}
                disabled={Boolean(component.props.disabled)}
                size={component.props.size as 'small' | 'medium'}
                className={component.props.className as string}
                sx={component.props.useCustomColor ? {
                  color: component.props.customColor as string,
                  '& .MuiSwitch-track': {
                    backgroundColor: component.props.customTrackColor as string
                  }
                } : undefined}
              />
            }
            label={component.props.label as string}
            labelPlacement={component.props.labelPlacement as 'end' | 'start' | 'top' | 'bottom' || 'end'}
            onChange={(e) => {
              if (component.props.showToast) {
                const isChecked = (e.target as HTMLInputElement).checked
                const message = isChecked 
                  ? (component.props.onMessage as string || 'Switch turned ON')
                  : (component.props.offMessage as string || 'Switch turned OFF')
                const severity = component.props.toastSeverity as 'success' | 'error' | 'info' | 'warning' || 'info'
                showToast(message, severity)
              }
            }}
          />
        </Box>
      )
    case 'FieldSet': {
      const isCollapsed = collapsedFieldsets[component.id] ?? Boolean(component.props.collapsed)
      
      // Generate fieldset styles
      const fieldsetStyles: Record<string, any> = {
        border: component.props.borderStyle 
          ? `1px ${component.props.borderStyle as string} ${component.props.useCustomColor ? component.props.borderColor : '#ccc'}` 
          : '1px solid #ccc',
        p: component.props.padding !== undefined ? component.props.padding : 2,
        borderRadius: component.props.borderRadius !== undefined ? component.props.borderRadius : 1,
        mb: 1
      }
      
      if (component.props.useCustomColor && component.props.backgroundColor) {
        fieldsetStyles.backgroundColor = component.props.backgroundColor
      }
      
      if (component.props.elevation) {
        fieldsetStyles.boxShadow = 1
      }
      
      // Generate legend styles
      const legendStyles: Record<string, any> = {
        ml: 0.5
      }
      
      if (component.props.useCustomColor && component.props.legendColor) {
        legendStyles.color = component.props.legendColor
      }
      
      if (component.props.legendBold) {
        legendStyles.fontWeight = 'bold'
      }
      
      if (component.props.legendAlign) {
        legendStyles.textAlign = component.props.legendAlign
      }
      
      if (component.props.legendSize) {
        switch(component.props.legendSize) {
          case 'small':
            legendStyles.fontSize = '0.875rem'
            break
          case 'large':
            legendStyles.fontSize = '1.25rem'
            break
        }
      }
      
      return (
        <Box 
          key={component.id} 
          sx={fieldsetStyles}
          data-testid={component.props.dataTestId as string}
          aria-label={component.props.ariaLabel as string}
        >
          <Box
            onClick={() => toggleFieldsetCollapse(component.id)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              mb: 1,
              justifyContent: component.props.iconPosition === 'end' ? 'space-between' : 'flex-start'
            }}
          >
            {component.props.iconPosition !== 'end' && (
              isCollapsed ? (
                <KeyboardArrowDownIcon fontSize="small" color={component.props.useCustomColor && component.props.legendColor ? "inherit" : "action"} />
              ) : (
                <KeyboardArrowUpIcon fontSize="small" color={component.props.useCustomColor && component.props.legendColor ? "inherit" : "action"} />
              )
            )}
            
            <Typography variant="subtitle2" sx={legendStyles}>
              {component.props.legend as string}
            </Typography>
            
            {component.props.iconPosition === 'end' && (
              isCollapsed ? (
                <KeyboardArrowDownIcon fontSize="small" color={component.props.useCustomColor && component.props.legendColor ? "inherit" : "action"} />
              ) : (
                <KeyboardArrowUpIcon fontSize="small" color={component.props.useCustomColor && component.props.legendColor ? "inherit" : "action"} />
              )
            )}
          </Box>
          
          <Collapse in={!isCollapsed} timeout={component.props.animated ? 'auto' : 0}>
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
          <Typography 
            variant={component.props.variant as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2' || 'body1'}
            gutterBottom={Boolean(component.props.gutterBottom)}
            noWrap={Boolean(component.props.noWrap)}
            className={component.props.className as string}
            data-testid={component.props.dataTestId as string}
            sx={{
              fontWeight: component.props.fontWeight as number,
              fontStyle: component.props.fontStyle as string,
              textDecoration: component.props.textDecoration as string,
              textAlign: component.props.textAlign as 'left' | 'center' | 'right' | 'justify',
              color: component.props.useCustomColor ? component.props.customColor as string : 'inherit',
              // Apply any additional styles from JSON if provided
              ...(component.props.styleJson ? JSON.parse(component.props.styleJson as string) : {})
            }}
          >
            {component.props.text as string}
          </Typography>
        </Box>
      )
    case 'Button': {
      // Get the icon component based on the iconName prop
      const iconName = component.props.iconName as string || 'add'
      const IconComponent = AVAILABLE_ICONS[iconName] || AddIcon
      
      return (
        <Box key={component.id} sx={{ mb: 1 }}>
          <Button 
            variant={component.props.variant as 'contained' | 'outlined' | 'text' || 'contained'} 
            size={component.props.size as 'small' | 'medium' | 'large' || 'medium'}
            color={component.props.color as 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' || 'primary'}
            fullWidth={Boolean(component.props.fullWidth)}
            disabled={Boolean(component.props.disabled)}
            className={component.props.className as string}
            data-testid={component.props.dataTestId as string}
            sx={{
              margin: `${component.props.margin || 0}px`,
              borderRadius: `${component.props.borderRadius || 4}px`,
              fontWeight: component.props.fontWeight as number,
              fontStyle: component.props.fontStyle as string,
              textDecoration: component.props.textDecoration as string,
              ...(component.props.customColor ? {
                backgroundColor: component.props.variant === 'contained' ? component.props.customColor : 'transparent',
                borderColor: component.props.customColor,
                color: component.props.variant === 'contained' ? '#fff' : component.props.customColor,
                '&:hover': {
                  backgroundColor: component.props.variant === 'contained' 
                    ? component.props.customHoverColor || component.props.customColor 
                    : 'rgba(25, 118, 210, 0.04)',
                  borderColor: component.props.customHoverColor || component.props.customColor
                }
              } : {})
            }}
            startIcon={component.props.showStartIcon ? <IconComponent /> : undefined}
            endIcon={component.props.showEndIcon ? <OpenInNewIcon /> : undefined}
            onClick={() => {
              const clickAction = component.props.clickAction as string || 'toast'
              
              if (clickAction === 'toast' && component.props.showToast !== false) {
                const message = component.props.toastMessage as string || 'Button clicked!'
                const severity = component.props.toastSeverity as 'success' | 'error' | 'info' | 'warning' || 'info'
                showToast(message, severity)
              } else if (clickAction === 'openUrl') {
                // Get URL prop and handle it safely
                try {
                  // Try to get the URL - handle various potential types
                  let url = ''
                  if (component.props.url) {
                    url = String(component.props.url)
                  }
                  
                  if (url) {
                    window.open(url, '_blank', 'noopener,noreferrer')
                  } else {
                    showToast('No URL configured for this button', 'warning')
                  }
                } catch (err) {
                  console.error('Error opening URL:', err)
                  showToast('Error opening URL', 'error')
                }
              }
              // For 'none' action, do nothing
            }}
          >
            {component.props.text as string}
          </Button>
        </Box>
      )
    }
    case 'TextField':
      return (
        <Box key={component.id} sx={{ mb: 1 }}>
          <TextField 
            label={component.props.label as string} 
            placeholder={component.props.placeholder as string}
            defaultValue={component.props.defaultValue as string || ''}
            variant={component.props.variant as 'outlined' | 'filled' | 'standard'}
            size={component.props.size as 'small' | 'medium' || 'small'}
            type={component.props.type as string || 'text'}
            required={Boolean(component.props.required)}
            disabled={Boolean(component.props.disabled)}
            error={Boolean(component.props.error)}
            helperText={component.props.helperText as string}
            multiline={Boolean(component.props.multiline)}
            rows={component.props.multiline ? ((component.props.rows as number) || 3) : undefined}
            fullWidth
            className={component.props.className as string}
            autoFocus={Boolean(component.props.autoFocus)}
            inputProps={{
              'aria-label': component.props.ariaLabel as string,
              'data-testid': component.props.dataTestId as string,
              maxLength: component.props.maxLength as number,
              minLength: component.props.minLength as number,
              min: component.props.min as number,
              max: component.props.max as number,
              step: component.props.step as number
            }}
            InputProps={{
              startAdornment: component.props.startAdornmentText ? (
                <InputAdornment position="start">
                  {component.props.startAdornmentText as string}
                </InputAdornment>
              ) : undefined,
              endAdornment: component.props.endAdornmentText ? (
                <InputAdornment position="end">
                  {component.props.endAdornmentText as string}
                </InputAdornment>
              ) : undefined
            }}
          />
        </Box>
      )
    case 'FlexBox': {
      // Prepare the flexbox style object
      const flexStyles = {
        display: 'flex',
        flexDirection: component.props.direction as 'row' | 'column' | 'row-reverse' | 'column-reverse' || 'row',
        justifyContent: component.props.justifyContent as string || 'flex-start',
        alignItems: component.props.alignItems as string || 'center',
        flexWrap: component.props.wrap as 'nowrap' | 'wrap' | 'wrap-reverse' || 'wrap',
        gap: (component.props.spacing as number || 2),
        width: '100%',
        mb: 1,
        padding: component.props.padding as number,
        minHeight: component.props.minHeight ? `${component.props.minHeight}px` : 'auto'
      }
      
      // Add conditional styles
      if (component.props.backgroundColor) {
        flexStyles.backgroundColor = component.props.backgroundColor as string
      }
      
      if (component.props.border) {
        flexStyles.border = `1px ${component.props.border} ${component.props.borderColor || '#ccc'}`
      }
      
      if (component.props.scrollable) {
        flexStyles.overflow = 'auto'
      }
      
      return (
        <Box 
          key={component.id} 
          sx={flexStyles}
          className={component.props.className as string}
          data-testid={component.props.dataTestId as string}
        >
          {component.children && component.children.length > 0 ? (
            // Limit number of children if maxItems is set
            component.children
              .slice(0, component.props.maxItems ? Number(component.props.maxItems) : undefined)
              .map(child => ({
                ...child,
                props: {
                  ...child.props,
                  ...(component.props.grow ? { flexGrow: 1 } : {})
                }
              }))
              .map(renderComponent)
          ) : (
            <Typography variant="body2" color="text.secondary">Empty Flex Container</Typography>
          )}
        </Box>
      )
    }
    case 'GridBox': {
      // Prepare the grid style object
      const gridStyles = {
        display: 'grid',
        gridTemplateColumns: `repeat(${component.props.columns as number || 2}, 1fr)`,
        gridTemplateRows: component.props.autoRows 
          ? 'auto' 
          : `repeat(${component.props.rows as number || 1}, ${component.props.equalHeight ? '1fr' : 'auto'})`,
        gap: (component.props.spacing as number || 2),
        width: '100%',
        mb: 1,
        minHeight: component.props.minHeight ? `${component.props.minHeight}px` : 'auto'
      }
      
      // Add conditional styles
      if (component.props.useCustomColor && component.props.backgroundColor) {
        gridStyles.backgroundColor = component.props.backgroundColor as string
      }
      
      if (component.props.borderStyle) {
        gridStyles.border = `1px ${component.props.borderStyle} ${component.props.useCustomColor ? component.props.borderColor : '#ccc'}`
      }
      
      if (component.props.alignCenter) {
        gridStyles.justifyItems = 'center'
      }
      
      if (component.props.gridTemplateAreas) {
        gridStyles.gridTemplateAreas = component.props.gridTemplateAreas as string
      }
      
      // Apply responsive behavior if enabled
      if (component.props.responsive) {
        gridStyles['@media (max-width:600px)'] = {
          gridTemplateColumns: '1fr',
          gridTemplateRows: 'auto'
        }
      }
      
      return (
        <Box 
          key={component.id} 
          sx={gridStyles}
          className={component.props.className as string}
          data-testid={component.props.dataTestId as string}
        >
          {component.children && component.children.length > 0 ? (
            component.children.map((child, index) => {
              // Apply cell styles if configured
              const cellProps = { ...child.props }
              
              if (component.props.cellPadding) {
                const padding = {
                  'small': 1,
                  'normal': 2,
                  'large': 3
                }[component.props.cellPadding as string] || 0
                
                cellProps.padding = padding
              }
              
              if (component.props.borderStyle && component.props.borderStyle !== 'none') {
                cellProps.border = `1px ${component.props.borderStyle} ${component.props.useCustomColor ? component.props.borderColor : '#ccc'}`
                
                if (component.props.borderRadius && component.props.borderRadius !== 'none') {
                  const radius = {
                    'small': 1,
                    'medium': 2,
                    'large': 4
                  }[component.props.borderRadius as string] || 0
                  
                  cellProps.borderRadius = radius
                }
              }
              
              return renderComponent({
                ...child,
                props: cellProps
              })
            })
          ) : (
            <Typography variant="body2" color="text.secondary">Empty Grid Container</Typography>
          )}
        </Box>
      )
    }
    case 'Chart': {
      const chartData = component.props.data as string || '{}'
      
      // Parse the data - could be JSON or XML
      let parsedData: {
        labels: string[]
        datasets: Array<{
          label: string
          data: number[]
          backgroundColor?: string | string[]
        }>
      } = {
        labels: [],
        datasets: []
      }
      try {
        if (chartData.trim().startsWith('<')) {
          // Basic XML parsing for demo purposes
          // In a real app, use a proper XML parser
          const parser = new DOMParser()
          const xmlDoc = parser.parseFromString(chartData, "text/xml")
          // Simple conversion for demo
          const series = xmlDoc.getElementsByTagName("series")
          const labels = Array.from(xmlDoc.getElementsByTagName("label"))
            .map(label => label.textContent || '')
          
          // Use only the first series or combine all series data into one
          const allData: number[] = []
          const firstSeries = series[0]
          
          if (firstSeries) {
            // Extract data from the first series
            allData.push(...Array.from(firstSeries.getElementsByTagName("value")).map(val => 
              Number(val.textContent) || 0
            ))
          }
          
          parsedData = {
            labels: labels,
            datasets: [{
              label: firstSeries ? (firstSeries.getAttribute("name") || "Sales") : "Sales",
              data: allData,
              backgroundColor: 'rgba(54, 162, 235, 0.5)'
            }]
          }
        } else {
          // Assume JSON
          parsedData = JSON.parse(chartData) as typeof parsedData
        }
      } catch (error) {
        console.error("Error parsing chart data:", error)
        // Provide fallback sample data
        parsedData = {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Sales',
            data: [30, 20, 15, 25, 10, 5],
            backgroundColor: [
              'rgba(255, 99, 132, 0.8)',
              'rgba(54, 162, 235, 0.8)',
              'rgba(255, 206, 86, 0.8)',
              'rgba(75, 192, 192, 0.8)',
              'rgba(153, 102, 255, 0.8)',
              'rgba(255, 159, 64, 0.8)'
            ] as string | string[]
          }]
        }
      }
      
      // Store the title and description as strings to avoid React type issues
      const chartTitle = component.props.title ? String(component.props.title) : ''
      const chartDescription = component.props.description ? String(component.props.description) : ''
      
      return (
        <Box key={component.id} sx={{ mb: 2, width: '100%' }}>
          <ChartPreview
            chartType={component.props.chartType as string || 'pie'}
            title={chartTitle}
            description={chartDescription}
            data={parsedData}
          />
        </Box>
      )
    }
    default:
      // Handle default case by showing a placeholder for unknown component types
      return (
        <Box 
          key={component.id} 
          sx={{ 
            p: 2, 
            border: '1px dashed #ccc',
            borderRadius: 1,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            minHeight: 80
          }}
        >
          <Typography variant="body2" color="text.secondary">Unknown component type: {component.type}</Typography>
        </Box>
      )
    }
  }

  // For debugging purposes
  console.log('CustomWidget rendering with components:', 
    widgetComponents ? `Array(${widgetComponents.length})` : 'none',
    'Widget component types:', widgetComponents.map(c => c.type).join(', '))

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