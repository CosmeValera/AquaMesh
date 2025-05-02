import TextFieldsIcon from '@mui/icons-material/TextFields'
import InputIcon from '@mui/icons-material/Input'
import SmartButtonIcon from '@mui/icons-material/SmartButton'
import ToggleOnIcon from '@mui/icons-material/ToggleOn'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'
import FlexibleIcon from '@mui/icons-material/Dashboard'
import GridViewIcon from '@mui/icons-material/GridView'
import { ComponentType } from '../types/types'

// Types of components that can be added to the widget
export const COMPONENT_TYPES: ComponentType[] = [
  // UI Components
  {
    type: 'Label',
    label: 'Text Label',
    defaultProps: { text: 'Label Text' },
    category: 'UI Components',
    icon: TextFieldsIcon,
    tooltip: 'Adds a static text label to display information'
  },
  {
    type: 'TextField',
    label: 'Text Field',
    defaultProps: { label: 'Text Field', placeholder: 'Enter text...', defaultValue: '' },
    category: 'UI Components',
    icon: InputIcon,
    tooltip: 'Adds an input field for user text entry'
  },
  {
    type: 'Button',
    label: 'Button',
    defaultProps: { text: 'Button', variant: 'contained', showToast: true, toastMessage: 'Button clicked!', toastSeverity: 'info' },
    category: 'UI Components',
    icon: SmartButtonIcon,
    tooltip: 'Adds a clickable button that can trigger actions like showing notifications'
  },
  {
    type: 'SwitchEnable',
    label: 'Switch',
    defaultProps: { label: 'Switch', defaultChecked: false },
    category: 'UI Components',
    icon: ToggleOnIcon,
    tooltip: 'Adds an on/off toggle switch for boolean settings'
  },
  
  // Layout Containers
  {
    type: 'FieldSet',
    label: 'Field Set',
    defaultProps: { legend: 'Field Set', collapsed: false },
    category: 'Layout Containers',
    icon: ViewQuiltIcon,
    tooltip: 'Creates a collapsible container that can be toggled open/closed to organize related components'
  },
  {
    type: 'FlexBox',
    label: 'Flex Container',
    defaultProps: { 
      direction: 'row', 
      justifyContent: 'flex-start', 
      alignItems: 'center', 
      spacing: 0,
      wrap: 'wrap'
    },
    category: 'Layout Containers',
    icon: FlexibleIcon,
    tooltip: 'Creates a flexible layout container using CSS Flexbox for responsive positioning of components'
  },
  {
    type: 'GridBox',
    label: 'Grid Container',
    defaultProps: { 
      columns: 2, 
      rows: 1,
      spacing: 2
    },
    category: 'Layout Containers',
    icon: GridViewIcon,
    tooltip: 'Creates a grid layout container for organizing components in rows and columns'
  },
]

/**
 * Get a component icon by type
 */
export const getComponentIcon = (type: string) => {
  const componentType = COMPONENT_TYPES.find(c => c.type === type)
  return componentType?.icon || null
}

/**
 * Get components organized by category
 */
export const getComponentsByCategory = () => {
  const categories: Record<string, ComponentType[]> = {}
  
  COMPONENT_TYPES.forEach(component => {
    if (!categories[component.category]) {
      categories[component.category] = []
    }
    categories[component.category].push(component)
  })
  
  return categories
} 