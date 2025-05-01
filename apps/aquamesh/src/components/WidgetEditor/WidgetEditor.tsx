import React, { useState, useRef, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Divider,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  IconButton,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import EditIcon from '@mui/icons-material/Edit'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import WidgetStorage, { CustomWidget } from './WidgetStorage'

// Component types for the widget editor
interface ComponentData {
  id: string
  type: string
  props: Record<string, unknown>
  children?: ComponentData[]
  parentId?: string
}

interface WidgetData {
  name: string
  components: ComponentData[]
}

interface EditComponentDialogProps {
  open: boolean
  component: ComponentData | null
  onClose: () => void
  onSave: (component: ComponentData) => void
}

// Types of components that can be added to the widget
const COMPONENT_TYPES = [
  {
    type: 'Label',
    label: 'Text Label',
    defaultProps: { text: 'Label Text' },
  },
  {
    type: 'TextField',
    label: 'Text Field',
    defaultProps: { label: 'Text Field', placeholder: 'Enter text...', defaultValue: '' },
  },
  {
    type: 'Button',
    label: 'Button',
    defaultProps: { text: 'Button', variant: 'contained', showToast: true, toastMessage: 'Button clicked!', toastSeverity: 'info' },
  },
  {
    type: 'SwitchEnable',
    label: 'Switch',
    defaultProps: { label: 'Switch', defaultChecked: false },
  },
  {
    type: 'FieldSet',
    label: 'Field Set',
    defaultProps: { legend: 'Field Set', collapsed: false },
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
  },
  {
    type: 'GridBox',
    label: 'Grid Container',
    defaultProps: { 
      columns: 2, 
      rows: 1,
      spacing: 2
    },
  },
]

// Type for notification severity
type NotificationSeverity = 'success' | 'error' | 'info' | 'warning'

// Component edit dialog
const EditComponentDialog: React.FC<EditComponentDialogProps> = ({
  open,
  component,
  onClose,
  onSave,
}) => {
  const [editedProps, setEditedProps] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (component) {
      setEditedProps({ ...component.props })
    }
  }, [component])

  if (!component) return null

  const handleSave = () => {
    const updatedComponent = {
      ...component,
      props: editedProps,
    }
    onSave(updatedComponent)
    onClose()
  }

  const renderPropsEdit = () => {
    switch (component.type) {
      case 'SwitchEnable':
        return (
          <>
            <TextField
              label="Label"
              fullWidth
              margin="normal"
              value={(editedProps.label as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, label: e.target.value })
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedProps.defaultChecked)}
                  onChange={(e) =>
                    setEditedProps({
                      ...editedProps,
                      defaultChecked: e.target.checked,
                    })
                  }
                />
              }
              label="Default State"
            />
          </>
        )
      case 'FieldSet':
        return (
          <>
            <TextField
              label="Legend"
              fullWidth
              margin="normal"
              value={(editedProps.legend as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, legend: e.target.value })
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedProps.collapsed)}
                  onChange={(e) =>
                    setEditedProps({
                      ...editedProps,
                      collapsed: e.target.checked,
                    })
                  }
                />
              }
              label="Default Collapsed"
            />
          </>
        )
      case 'Label':
        return (
          <TextField
            label="Text"
            fullWidth
            margin="normal"
            value={(editedProps.text as string) || ''}
            onChange={(e) =>
              setEditedProps({ ...editedProps, text: e.target.value })
            }
          />
        )
      case 'Button':
        return (
          <>
            <TextField
              label="Button Text"
              fullWidth
              margin="normal"
              value={(editedProps.text as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, text: e.target.value })
              }
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Variant</InputLabel>
              <Select
                value={(editedProps.variant as string) || 'contained'}
                label="Variant"
                onChange={(e) =>
                  setEditedProps({ ...editedProps, variant: e.target.value })
                }
              >
                <MenuItem value="contained">Contained</MenuItem>
                <MenuItem value="outlined">Outlined</MenuItem>
                <MenuItem value="text">Text</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedProps.showToast)}
                  onChange={(e) =>
                    setEditedProps({
                      ...editedProps,
                      showToast: e.target.checked,
                    })
                  }
                />
              }
              label="Show Toast on Click"
            />
            {editedProps.showToast && (
              <>
                <TextField
                  label="Toast Message"
                  fullWidth
                  margin="normal"
                  value={(editedProps.toastMessage as string) || ''}
                  onChange={(e) =>
                    setEditedProps({ ...editedProps, toastMessage: e.target.value })
                  }
                />
                <FormControl fullWidth margin="normal">
                  <InputLabel>Toast Severity</InputLabel>
                  <Select
                    value={(editedProps.toastSeverity as string) || 'info'}
                    label="Toast Severity"
                    onChange={(e) =>
                      setEditedProps({ ...editedProps, toastSeverity: e.target.value })
                    }
                  >
                    <MenuItem value="info">Info</MenuItem>
                    <MenuItem value="success">Success</MenuItem>
                    <MenuItem value="warning">Warning</MenuItem>
                    <MenuItem value="error">Error</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}
          </>
        )
      case 'TextField':
        return (
          <>
            <TextField
              label="Field Label"
              fullWidth
              margin="normal"
              value={(editedProps.label as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, label: e.target.value })
              }
            />
            <TextField
              label="Placeholder"
              fullWidth
              margin="normal"
              value={(editedProps.placeholder as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, placeholder: e.target.value })
              }
            />
            <TextField
              label="Default Value"
              fullWidth
              margin="normal"
              value={(editedProps.defaultValue as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, defaultValue: e.target.value })
              }
            />
          </>
        )
      case 'FlexBox':
        return (
          <>
            <FormControl fullWidth margin="normal">
              <InputLabel>Direction</InputLabel>
              <Select
                value={(editedProps.direction as string) || 'row'}
                label="Direction"
                onChange={(e) =>
                  setEditedProps({ ...editedProps, direction: e.target.value })
                }
              >
                <MenuItem value="row">Row</MenuItem>
                <MenuItem value="column">Column</MenuItem>
                <MenuItem value="row-reverse">Row Reverse</MenuItem>
                <MenuItem value="column-reverse">Column Reverse</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Justify Content</InputLabel>
              <Select
                value={(editedProps.justifyContent as string) || 'flex-start'}
                label="Justify Content"
                onChange={(e) =>
                  setEditedProps({ ...editedProps, justifyContent: e.target.value })
                }
              >
                <MenuItem value="flex-start">Start</MenuItem>
                <MenuItem value="center">Center</MenuItem>
                <MenuItem value="flex-end">End</MenuItem>
                <MenuItem value="space-between">Space Between</MenuItem>
                <MenuItem value="space-around">Space Around</MenuItem>
                <MenuItem value="space-evenly">Space Evenly</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Align Items</InputLabel>
              <Select
                value={(editedProps.alignItems as string) || 'center'}
                label="Align Items"
                onChange={(e) =>
                  setEditedProps({ ...editedProps, alignItems: e.target.value })
                }
              >
                <MenuItem value="flex-start">Start</MenuItem>
                <MenuItem value="center">Center</MenuItem>
                <MenuItem value="flex-end">End</MenuItem>
                <MenuItem value="stretch">Stretch</MenuItem>
                <MenuItem value="baseline">Baseline</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Wrap</InputLabel>
              <Select
                value={(editedProps.wrap as string) || 'wrap'}
                label="Wrap"
                onChange={(e) =>
                  setEditedProps({ ...editedProps, wrap: e.target.value })
                }
              >
                <MenuItem value="wrap">Wrap</MenuItem>
                <MenuItem value="nowrap">No Wrap</MenuItem>
                <MenuItem value="wrap-reverse">Wrap Reverse</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Spacing"
              type="number"
              fullWidth
              margin="normal"
              inputProps={{ min: 0, max: 10, step: 1 }}
              value={(editedProps.spacing as number) || 0}
              onChange={(e) =>
                setEditedProps({ ...editedProps, spacing: Number(e.target.value) })
              }
            />
          </>
        )
      case 'GridBox':
        return (
          <>
            <TextField
              label="Columns"
              type="number"
              fullWidth
              margin="normal"
              inputProps={{ min: 1, max: 12, step: 1 }}
              value={(editedProps.columns as number) || 2}
              onChange={(e) =>
                setEditedProps({ ...editedProps, columns: Number(e.target.value) })
              }
            />
            <TextField
              label="Rows"
              type="number"
              fullWidth
              margin="normal"
              inputProps={{ min: 1, max: 12, step: 1 }}
              value={(editedProps.rows as number) || 1}
              onChange={(e) =>
                setEditedProps({ ...editedProps, rows: Number(e.target.value) })
              }
            />
            <TextField
              label="Spacing"
              type="number"
              fullWidth
              margin="normal"
              inputProps={{ min: 0, max: 10, step: 1 }}
              value={(editedProps.spacing as number) || 2}
              onChange={(e) =>
                setEditedProps({ ...editedProps, spacing: Number(e.target.value) })
              }
            />
          </>
        )
      default:
        return <Typography>No editable properties</Typography>
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit {component.type}</DialogTitle>
      <DialogContent>{renderPropsEdit()}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Component that renders a preview of a component based on its type
const ComponentPreview: React.FC<{
  component: ComponentData
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onAddInside: (parentId: string) => void
  isFirst: boolean
  isLast: boolean
  level?: number
  editMode: boolean
}> = ({
  component,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddInside,
  isFirst,
  isLast,
  level = 0,
  editMode,
}) => {
  const renderComponent = () => {
    switch (component.type) {
      case 'SwitchEnable':
        return (
          <FormControlLabel
            control={
              <Switch
                defaultChecked={component.props.defaultChecked as boolean}
              />
            }
            label={component.props.label as string}
          />
        )
      case 'FieldSet':
        const [collapsed, setCollapsed] = useState<boolean>(
          Boolean(component.props.collapsed)
        )
        return (
          <Box
            sx={{
              border: '1px solid #ccc',
              p: 2,
              borderRadius: 1,
              ...(editMode ? {} : { borderStyle: 'solid' }),
            }}
          >
            <Box
              onClick={() => setCollapsed(!collapsed)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                mb: 1
              }}
            >
              {collapsed ? (
                <KeyboardArrowDownIcon fontSize="small" />
              ) : (
                <KeyboardArrowUpIcon fontSize="small" />
              )}
              <Typography variant="subtitle2" sx={{ ml: 0.5 }}>
                {component.props.legend as string}
              </Typography>
            </Box>
            {!collapsed && (
              <Box sx={{ ml: editMode ? 2 : 0 }}>
                {component.children && component.children.length > 0 ? (
                  <Box sx={{ ml: editMode ? 2 : 0 }}>
                    {component.children.map((childComponent, index) => (
                      <ComponentPreview
                        key={childComponent.id}
                        component={childComponent}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onMoveUp={onMoveUp}
                        onMoveDown={onMoveDown}
                        onAddInside={onAddInside}
                        isFirst={index === 0}
                        isLast={index === (component.children?.length || 0) - 1}
                        level={editMode ? level + 1 : 0}
                        editMode={editMode}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Field Set Content
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )
      case 'Label':
        return (
          <Typography variant="body1">
            {component.props.text as string}
          </Typography>
        )
      case 'Button':
        const [showToastMsg, setShowToastMsg] = useState<boolean>(false)
        const toastMessage = component.props.toastMessage as string || 'Button clicked!'
        const toastSeverity = component.props.toastSeverity as 'info' | 'success' | 'warning' | 'error' || 'info'
        
        return (
          <>
            <Button
              variant={
                (component.props.variant as 'contained' | 'outlined' | 'text') ||
                'contained'
              }
              size="small"
              onClick={() => {
                if (component.props.showToast) {
                  setShowToastMsg(true)
                  setTimeout(() => setShowToastMsg(false), 3000)
                }
              }}
            >
              {component.props.text as string}
            </Button>
            {showToastMsg && component.props.showToast && (
              <Alert 
                severity={toastSeverity}
                sx={{ 
                  position: 'fixed', 
                  bottom: 16, 
                  right: 16, 
                  zIndex: 9999,
                  boxShadow: 3,
                  maxWidth: 400
                }}
                onClose={() => setShowToastMsg(false)}
              >
                {toastMessage}
              </Alert>
            )}
          </>
        )
      case 'TextField':
        return (
          <TextField
            label={component.props.label as string}
            placeholder={component.props.placeholder as string}
            defaultValue={component.props.defaultValue as string || ''}
            size="small"
            fullWidth
          />
        )
      case 'FlexBox':
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: component.props.direction as 'row' | 'column' | 'row-reverse' | 'column-reverse' || 'row',
              justifyContent: component.props.justifyContent as string || 'flex-start',
              alignItems: component.props.alignItems as string || 'center',
              flexWrap: component.props.wrap as 'nowrap' | 'wrap' | 'wrap-reverse' || 'nowrap',
              gap: (component.props.spacing as number || 2),
              width: '100%',
              border: editMode ? '1px dashed #ccc' : 'none',
              p: 1,
              boxSizing: 'border-box'
            }}
          >
            {component.children && component.children.length > 0 ? (
              component.children.map((childComponent, index) => (
                <ComponentPreview
                  key={childComponent.id}
                  component={childComponent}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onAddInside={onAddInside}
                  isFirst={index === 0}
                  isLast={index === (component.children?.length || 0) - 1}
                  level={editMode ? level + 1 : 0}
                  editMode={editMode}
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                Flex Container (Add components inside)
              </Typography>
            )}
          </Box>
        )
      case 'GridBox':
        return (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${component.props.columns as number || 2}, 1fr)`,
              gridTemplateRows: `repeat(${component.props.rows as number || 1}, auto)`,
              gap: (component.props.spacing as number || 2),
              width: '100%',
              border: editMode ? '1px dashed #ccc' : 'none',
              p: 1,
              boxSizing: 'border-box'
            }}
          >
            {component.children && component.children.length > 0 ? (
              component.children.map((childComponent, index) => (
                <ComponentPreview
                  key={childComponent.id}
                  component={childComponent}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onAddInside={onAddInside}
                  isFirst={index === 0}
                  isLast={index === (component.children?.length || 0) - 1}
                  level={editMode ? level + 1 : 0}
                  editMode={editMode}
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                Grid Container (Add components inside)
              </Typography>
            )}
          </Box>
        )
      default:
        return <Typography>Unknown component type</Typography>
    }
  }

  // In preview mode, only show the component without controls or dashed borders
  if (!editMode) {
    return <Box sx={{ mb: 1 }}>{renderComponent()}</Box>
  }

  return (
    <Box
      sx={{
        position: 'relative',
        mb: 1,
        p: 1,
        border: '1px dashed #ccc',
        borderRadius: 1,
        marginLeft: level > 0 ? level * 2 : 0,
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
        },
      }}
    >
      <Box display="flex" alignItems="center" sx={{ mb: 1 }}>
        <DragIndicatorIcon sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {component.type}
        </Typography>
        {['FieldSet', 'FlexBox', 'GridBox'].includes(component.type) && (
          <IconButton
            size="small"
            color="primary"
            onClick={() => onAddInside(component.id)}
            title="Add component inside"
          >
            <AddCircleOutlineIcon fontSize="small" />
          </IconButton>
        )}
        <IconButton
          size="small"
          disabled={isFirst}
          onClick={() => onMoveUp(component.id)}
          title="Move up"
        >
          <KeyboardArrowUpIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={isLast}
          onClick={() => onMoveDown(component.id)}
          title="Move down"
        >
          <KeyboardArrowDownIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onEdit(component.id)}
          title="Edit"
        >
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          color="error"
          onClick={() => onDelete(component.id)}
          title="Delete"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ pl: 2 }}>{renderComponent()}</Box>
    </Box>
  )
}

// Component palette item that can be dragged
const ComponentPaletteItem: React.FC<{
  type: string
  label: string
  onDragStart: (e: React.DragEvent, type: string) => void
}> = ({ type, label, onDragStart }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1,
        mb: 1,
        cursor: 'grab',
        border: '1px solid #e0e0e0',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          borderColor: 'primary.light',
        },
      }}
      draggable
      onDragStart={(e) => onDragStart(e, type)}
    >
      <Typography variant="body2">{label}</Typography>
    </Paper>
  )
}

// Main Widget Editor component
const WidgetEditor: React.FC = () => {
  const [widgetData, setWidgetData] = useState<WidgetData>({
    name: 'New Widget',
    components: [],
  })
  const [editMode, setEditMode] = useState(true)
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as NotificationSeverity,
  })
  const [savedWidgets, setSavedWidgets] = useState<CustomWidget[]>([])
  const [showWidgetList, setShowWidgetList] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [currentEditComponent, setCurrentEditComponent] =
    useState<ComponentData | null>(null)
  const [stayOpen, setStayOpen] = useState<boolean>(true)
  const [addToParentId, setAddToParentId] = useState<string | null>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)

  // Load saved widgets on component mount
  useEffect(() => {
    setSavedWidgets(WidgetStorage.getAllWidgets())
  }, [])

  // Handle drag start from component palette
  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('componentType', type)
  }

  // Find component by id including nested children
  const findComponentById = (
    id: string,
    components: ComponentData[],
  ): ComponentData | null => {
    for (const component of components) {
      if (component.id === id) {
        return component
      }

      if (component.children && component.children.length > 0) {
        const found = findComponentById(id, component.children)
        if (found) {
          return found
        }
      }
    }

    return null
  }

  // Get parent component containing a specific child
  const findParentComponent = (
    childId: string,
    components: ComponentData[],
  ): ComponentData | null => {
    for (const component of components) {
      if (component.children?.some((child) => child.id === childId)) {
        return component
      }

      if (component.children && component.children.length > 0) {
        const found = findParentComponent(childId, component.children)
        if (found) {
          return found
        }
      }
    }

    return null
  }

  // Update a component in the nested structure
  const updateComponentById = (
    id: string,
    updatedComponent: ComponentData,
    components: ComponentData[],
  ): ComponentData[] => {
    return components.map((component) => {
      if (component.id === id) {
        return updatedComponent
      }

      if (component.children && component.children.length > 0) {
        return {
          ...component,
          children: updateComponentById(
            id,
            updatedComponent,
            component.children,
          ),
        }
      }

      return component
    })
  }

  // Remove a component from the nested structure
  const removeComponentById = (
    id: string,
    components: ComponentData[],
  ): ComponentData[] => {
    const filteredComponents = components.filter(
      (component) => component.id !== id,
    )

    return filteredComponents.map((component) => {
      if (component.children && component.children.length > 0) {
        return {
          ...component,
          children: removeComponentById(id, component.children),
        }
      }

      return component
    })
  }

  // Move a component up or down in its parent container
  const moveComponent = (
    id: string,
    direction: 'up' | 'down',
    components: ComponentData[],
  ): ComponentData[] => {
    // If component is at the root level
    const rootIndex = components.findIndex((c) => c.id === id)
    if (rootIndex !== -1) {
      const newComponents = [...components]

      if (direction === 'up' && rootIndex > 0) {
        ;[newComponents[rootIndex - 1], newComponents[rootIndex]] = [
          newComponents[rootIndex],
          newComponents[rootIndex - 1],
        ]
      } else if (direction === 'down' && rootIndex < components.length - 1) {
        ;[newComponents[rootIndex], newComponents[rootIndex + 1]] = [
          newComponents[rootIndex + 1],
          newComponents[rootIndex],
        ]
      }

      return newComponents
    }

    // If component is nested
    const parent = findParentComponent(id, components)
    if (parent && parent.children) {
      const childIndex = parent.children.findIndex((c) => c.id === id)

      if (childIndex !== -1) {
        const newChildren = [...parent.children]

        if (direction === 'up' && childIndex > 0) {
          ;[newChildren[childIndex - 1], newChildren[childIndex]] = [
            newChildren[childIndex],
            newChildren[childIndex - 1],
          ]
        } else if (
          direction === 'down' &&
          childIndex < newChildren.length - 1
        ) {
          ;[newChildren[childIndex], newChildren[childIndex + 1]] = [
            newChildren[childIndex + 1],
            newChildren[childIndex],
          ]
        }

        const updatedParent = {
          ...parent,
          children: newChildren,
        }

        return updateComponentById(parent.id, updatedParent, components)
      }
    }

    return components
  }

  // Handler for adding components inside a fieldset
  const handleAddInsideFieldset = (parentId: string) => {
    setAddToParentId(parentId)

    // Scroll to component palette to make it obvious what to do next
    const paletteEl = document.querySelector('[data-component-palette]')
    if (paletteEl) {
      paletteEl.scrollIntoView({ behavior: 'smooth' })
    }

    // Get parent component type
    const parent = findComponentById(parentId, widgetData.components)
    const parentType = parent ? parent.type : ''

    setNotification({
      open: true,
      message: `Select a component from the palette to add inside ${parentType}${stayOpen ? ' (Stay Open Mode)' : ''}`,
      severity: 'info',
    })
  }

  // Handle drop onto the widget container or a container component
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()

    const componentType = e.dataTransfer.getData('componentType')
    const componentConfig = COMPONENT_TYPES.find(
      (c) => c.type === componentType,
    )

    if (componentConfig) {
      const newComponent: ComponentData = {
        id: `${componentType}-${Date.now()}`,
        type: componentType,
        props: { ...componentConfig.defaultProps },
      }

      // If we're adding to a container component
      if (addToParentId) {
        const parent = findComponentById(addToParentId, widgetData.components)

        if (parent && ['FieldSet', 'FlexBox', 'GridBox'].includes(parent.type)) {
          const updatedParent = {
            ...parent,
            children: [...(parent.children || []), newComponent],
          }

          setWidgetData((prev) => ({
            ...prev,
            components: updateComponentById(
              addToParentId,
              updatedParent,
              prev.components,
            ),
          }))

          // If stay open is disabled, clear the parent ID
          if (!stayOpen) {
            setAddToParentId(null)
          } else {
            // If stay open is enabled, keep the parent ID and scroll back to the palette
            const paletteEl = document.querySelector('[data-component-palette]')
            if (paletteEl) {
              paletteEl.scrollIntoView({ behavior: 'smooth' })
            }
          }
          return
        }
      }

      // Otherwise add to the root level
      setWidgetData((prev) => ({
        ...prev,
        components: [...prev.components, newComponent],
      }))
    }
  }

  // Prevent default behavior for dragover to allow drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Handler for deleting a component
  const handleDeleteComponent = (id: string) => {
    setWidgetData((prev) => ({
      ...prev,
      components: removeComponentById(id, prev.components),
    }))
  }

  // Handler for editing a component
  const handleEditComponent = (id: string) => {
    const component = findComponentById(id, widgetData.components)
    if (component) {
      setCurrentEditComponent(component)
      setEditDialogOpen(true)
    }
  }

  // Handler for saving edited component
  const handleSaveComponent = (updatedComponent: ComponentData) => {
    setWidgetData((prev) => ({
      ...prev,
      components: updateComponentById(
        updatedComponent.id,
        updatedComponent,
        prev.components,
      ),
    }))
  }

  // Handler for moving components up and down
  const handleMoveComponent = (id: string, direction: 'up' | 'down') => {
    setWidgetData((prev) => ({
      ...prev,
      components: moveComponent(id, direction, prev.components),
    }))
  }

  // Handler for saving the widget
  const handleSaveWidget = () => {
    if (!widgetData.name.trim()) {
      setNotification({
        open: true,
        message: 'Please provide a widget name',
        severity: 'error',
      })
      return
    }

    if (widgetData.components.length === 0) {
      setNotification({
        open: true,
        message: 'Add at least one component to the widget',
        severity: 'error',
      })
      return
    }

    // Save the widget using WidgetStorage service
    const savedWidget = WidgetStorage.saveWidget({
      name: widgetData.name,
      components: widgetData.components,
    })

    // Update the saved widgets list
    setSavedWidgets(WidgetStorage.getAllWidgets())

    setNotification({
      open: true,
      message: `Widget "${savedWidget.name}" saved successfully!`,
      severity: 'success',
    })
  }

  // Load a saved widget for editing
  const handleLoadWidget = (widget: CustomWidget) => {
    setWidgetData({
      name: widget.name,
      components: widget.components,
    })
    setShowWidgetList(false)
    setEditMode(true)
  }

  // Delete a saved widget
  const handleDeleteSavedWidget = (id: string) => {
    WidgetStorage.deleteWidget(id)
    setSavedWidgets(WidgetStorage.getAllWidgets())

    setNotification({
      open: true,
      message: 'Widget deleted successfully',
      severity: 'success',
    })
  }

  // Close notification handler
  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }))
  }

  // Render nested components recursively
  const renderComponents = (components: ComponentData[]) => {
    return components.map((component, index) => (
      <ComponentPreview
        key={component.id}
        component={component}
        onEdit={handleEditComponent}
        onDelete={handleDeleteComponent}
        onMoveUp={(id) => handleMoveComponent(id, 'up')}
        onMoveDown={(id) => handleMoveComponent(id, 'down')}
        onAddInside={handleAddInsideFieldset}
        isFirst={index === 0}
        isLast={index === components.length - 1}
        editMode={editMode}
      />
    ))
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6" sx={{ flex: 1 }}>
          Widget Editor
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSaveWidget}
          sx={{ mr: 1 }}
        >
          Save Widget
        </Button>
        <Button
          variant="outlined"
          onClick={() => setEditMode(!editMode)}
          sx={{ mr: 1 }}
        >
          {editMode ? 'Preview' : 'Edit'}
        </Button>
        <Button
          variant="outlined"
          color={savedWidgets.length === 0 ? 'secondary' : 'primary'}
          onClick={() => setShowWidgetList(true)}
        >
          My Widgets
        </Button>
      </Box>

      {/* Main content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Component palette - only visible in edit mode */}
        {editMode && (
          <Box
            data-component-palette
            sx={{
              width: 200,
              p: 2,
              borderRight: '1px solid #e0e0e0',
              overflowY: 'auto',
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {addToParentId ? 'Add component inside' : 'Components'}
            </Typography>
            {addToParentId && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  onClick={() => setAddToParentId(null)}
                  sx={{ mb: 1 }}
                >
                  Cancel
                </Button>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={stayOpen}
                      onChange={(e) => setStayOpen(e.target.checked)}
                    />
                  }
                  label="Open Mode"
                  sx={{ mb: 1, display: 'flex' }}
                />
              </>
            )}
            <Divider sx={{ mb: 2 }} />

            {COMPONENT_TYPES.map((component) => (
              <ComponentPaletteItem
                key={component.type}
                type={component.type}
                label={component.label}
                onDragStart={handleDragStart}
              />
            ))}
          </Box>
        )}

        {/* Widget editing area */}
        <Box
          sx={{
            flex: 1,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* Widget name field */}
          {editMode ? (
            <TextField
              label="Widget Name"
              value={widgetData.name}
              onChange={(e) =>
                setWidgetData((prev) => ({ ...prev, name: e.target.value }))
              }
              margin="normal"
              variant="outlined"
              size="small"
              sx={{ mb: 2 }}
            />
          ) : (
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Widget Name:</strong> {widgetData.name}
            </Typography>
          )}

          {/* Drop area */}
          <Paper
            ref={dropAreaRef}
            sx={{
              flex: 1,
              p: 2,
              backgroundColor: editMode
                ? 'rgba(255, 255, 255, 0.04)'
                : 'rgba(0, 0, 0, 0.04)',
              border: editMode ? '2px dashed #ccc' : '1px solid #e0e0e0',
              borderRadius: 1,
              minHeight: 200,
              overflowY: 'auto',
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {widgetData.components.length === 0 ? (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                }}
              >
                <Typography color="text.secondary" align="center">
                  {editMode
                    ? 'Drag and drop components here to create your widget'
                    : 'This widget is empty. Switch to Edit mode to add components.'}
                </Typography>
              </Box>
            ) : (
              <Box>{renderComponents(widgetData.components)}</Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* Component Edit Dialog */}
      <EditComponentDialog
        open={editDialogOpen}
        component={currentEditComponent}
        onClose={() => {
          setEditDialogOpen(false)
          setCurrentEditComponent(null)
        }}
        onSave={handleSaveComponent}
      />

      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Saved Widgets Dialog */}
      <Dialog
        open={showWidgetList}
        onClose={() => setShowWidgetList(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>My Custom Widgets</DialogTitle>
        <DialogContent>
          {savedWidgets.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ my: 4 }}>
              You haven&apos;t saved any custom widgets yet
            </Typography>
          ) : (
            <List>
              {savedWidgets.map((widget) => (
                <ListItem
                  key={widget.id}
                  button
                  onClick={() => handleLoadWidget(widget)}
                  sx={{
                    border: '1px solid #eee',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      borderColor: 'primary.light',
                      backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    },
                  }}
                >
                  <ListItemText
                    primary={widget.name}
                    secondary={`Last modified: ${new Date(
                      widget.updatedAt,
                    ).toLocaleString()}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSavedWidget(widget.id)
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWidgetList(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default WidgetEditor
