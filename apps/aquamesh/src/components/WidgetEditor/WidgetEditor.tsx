import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Divider, 
  Button,
  TextField,
  Grid,
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
  FormControl
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import WidgetStorage, { CustomWidget } from './WidgetStorage';

// Component types for the widget editor
interface ComponentData {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: ComponentData[];
  parentId?: string;
}

interface WidgetData {
  name: string;
  components: ComponentData[];
}

interface EditComponentDialogProps {
  open: boolean;
  component: ComponentData | null;
  onClose: () => void;
  onSave: (component: ComponentData) => void;
}

// Types of components that can be added to the widget
const COMPONENT_TYPES = [
  { 
    type: 'SwitchEnable', 
    label: 'Switch',
    defaultProps: { label: 'Switch', defaultChecked: false } 
  },
  { 
    type: 'FieldSet', 
    label: 'Field Set',
    defaultProps: { legend: 'Field Set' } 
  },
  { 
    type: 'Label', 
    label: 'Text Label',
    defaultProps: { text: 'Label Text' } 
  },
  { 
    type: 'Button', 
    label: 'Button',
    defaultProps: { text: 'Button', variant: 'contained' } 
  },
  { 
    type: 'TextField', 
    label: 'Text Field',
    defaultProps: { label: 'Text Field', placeholder: 'Enter text...' } 
  }
];

// Component edit dialog
const EditComponentDialog: React.FC<EditComponentDialogProps> = ({
  open,
  component,
  onClose,
  onSave
}) => {
  const [editedProps, setEditedProps] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (component) {
      setEditedProps({...component.props});
    }
  }, [component]);

  if (!component) return null;

  const handleSave = () => {
    const updatedComponent = {
      ...component,
      props: editedProps
    };
    onSave(updatedComponent);
    onClose();
  };

  const renderPropsEdit = () => {
    switch (component.type) {
      case 'SwitchEnable':
        return (
          <>
            <TextField
              label="Label"
              fullWidth
              margin="normal"
              value={editedProps.label as string || ''}
              onChange={(e) => setEditedProps({...editedProps, label: e.target.value})}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedProps.defaultChecked)}
                  onChange={(e) => setEditedProps({...editedProps, defaultChecked: e.target.checked})}
                />
              }
              label="Default State"
            />
          </>
        );
      case 'FieldSet':
        return (
          <TextField
            label="Legend"
            fullWidth
            margin="normal"
            value={editedProps.legend as string || ''}
            onChange={(e) => setEditedProps({...editedProps, legend: e.target.value})}
          />
        );
      case 'Label':
        return (
          <TextField
            label="Text"
            fullWidth
            margin="normal"
            value={editedProps.text as string || ''}
            onChange={(e) => setEditedProps({...editedProps, text: e.target.value})}
          />
        );
      case 'Button':
        return (
          <>
            <TextField
              label="Button Text"
              fullWidth
              margin="normal"
              value={editedProps.text as string || ''}
              onChange={(e) => setEditedProps({...editedProps, text: e.target.value})}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Variant</InputLabel>
              <Select
                value={editedProps.variant as string || 'contained'}
                label="Variant"
                onChange={(e) => setEditedProps({...editedProps, variant: e.target.value})}
              >
                <MenuItem value="contained">Contained</MenuItem>
                <MenuItem value="outlined">Outlined</MenuItem>
                <MenuItem value="text">Text</MenuItem>
              </Select>
            </FormControl>
          </>
        );
      case 'TextField':
        return (
          <>
            <TextField
              label="Field Label"
              fullWidth
              margin="normal"
              value={editedProps.label as string || ''}
              onChange={(e) => setEditedProps({...editedProps, label: e.target.value})}
            />
            <TextField
              label="Placeholder"
              fullWidth
              margin="normal"
              value={editedProps.placeholder as string || ''}
              onChange={(e) => setEditedProps({...editedProps, placeholder: e.target.value})}
            />
          </>
        );
      default:
        return <Typography>No editable properties</Typography>;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit {component.type}</DialogTitle>
      <DialogContent>
        {renderPropsEdit()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">Save</Button>
      </DialogActions>
    </Dialog>
  );
};

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
}> = ({ 
  component, 
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddInside,
  isFirst,
  isLast,
  level = 0
}) => {
  const renderComponent = () => {
    switch (component.type) {
      case 'SwitchEnable':
        return (
          <FormControlLabel
            control={<Switch defaultChecked={component.props.defaultChecked as boolean} />}
            label={component.props.label as string}
          />
        );
      case 'FieldSet':
        return (
          <Box sx={{ border: '1px solid #ccc', p: 2, borderRadius: 1 }}>
            <Typography variant="subtitle2">{component.props.legend as string}</Typography>
            {component.children && component.children.length > 0 ? (
              <Box sx={{ ml: 2 }}>
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
                    level={level + 1}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">Field Set Content</Typography>
            )}
          </Box>
        );
      case 'Label':
        return (
          <Typography variant="body1">{component.props.text as string}</Typography>
        );
      case 'Button':
        return (
          <Button 
            variant={component.props.variant as 'contained' | 'outlined' | 'text' || 'contained'} 
            size="small"
          >
            {component.props.text as string}
          </Button>
        );
      case 'TextField':
        return (
          <TextField 
            label={component.props.label as string} 
            placeholder={component.props.placeholder as string}
            size="small"
            fullWidth
          />
        );
      default:
        return <Typography>Unknown component type</Typography>;
    }
  };

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
          backgroundColor: 'rgba(0, 0, 0, 0.02)'
        }
      }}
    >
      <Box display="flex" alignItems="center" sx={{ mb: 1 }}>
        <DragIndicatorIcon sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {component.type}
        </Typography>
        {component.type === 'FieldSet' && (
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
        <IconButton size="small" onClick={() => onEdit(component.id)} title="Edit">
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="error" onClick={() => onDelete(component.id)} title="Delete">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ pl: 2 }}>
        {renderComponent()}
      </Box>
    </Box>
  );
};

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
          borderColor: 'primary.light'
        }
      }}
      draggable
      onDragStart={(e) => onDragStart(e, type)}
    >
      <Typography variant="body2">{label}</Typography>
    </Paper>
  );
};

// Main Widget Editor component
const WidgetEditor: React.FC = () => {
  const [widgetData, setWidgetData] = useState<WidgetData>({
    name: 'New Widget',
    components: []
  });
  const [editMode, setEditMode] = useState(true);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [savedWidgets, setSavedWidgets] = useState<CustomWidget[]>([]);
  const [showWidgetList, setShowWidgetList] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentEditComponent, setCurrentEditComponent] = useState<ComponentData | null>(null);
  const [addToParentId, setAddToParentId] = useState<string | null>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);

  // Load saved widgets on component mount
  useEffect(() => {
    setSavedWidgets(WidgetStorage.getAllWidgets());
  }, []);

  // Handle drag start from component palette
  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('componentType', type);
  };

  // Find component by id including nested children
  const findComponentById = (id: string, components: ComponentData[]): ComponentData | null => {
    for (const component of components) {
      if (component.id === id) {
        return component;
      }
      
      if (component.children && component.children.length > 0) {
        const found = findComponentById(id, component.children);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  };

  // Get parent component containing a specific child
  const findParentComponent = (childId: string, components: ComponentData[]): ComponentData | null => {
    for (const component of components) {
      if (component.children?.some(child => child.id === childId)) {
        return component;
      }
      
      if (component.children && component.children.length > 0) {
        const found = findParentComponent(childId, component.children);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  };

  // Update a component in the nested structure
  const updateComponentById = (id: string, updatedComponent: ComponentData, components: ComponentData[]): ComponentData[] => {
    return components.map(component => {
      if (component.id === id) {
        return updatedComponent;
      }
      
      if (component.children && component.children.length > 0) {
        return {
          ...component,
          children: updateComponentById(id, updatedComponent, component.children)
        };
      }
      
      return component;
    });
  };

  // Remove a component from the nested structure
  const removeComponentById = (id: string, components: ComponentData[]): ComponentData[] => {
    const filteredComponents = components.filter(component => component.id !== id);
    
    return filteredComponents.map(component => {
      if (component.children && component.children.length > 0) {
        return {
          ...component,
          children: removeComponentById(id, component.children)
        };
      }
      
      return component;
    });
  };

  // Move a component up or down in its parent container
  const moveComponent = (id: string, direction: 'up' | 'down', components: ComponentData[]): ComponentData[] => {
    // If component is at the root level
    const rootIndex = components.findIndex(c => c.id === id);
    if (rootIndex !== -1) {
      const newComponents = [...components];
      
      if (direction === 'up' && rootIndex > 0) {
        [newComponents[rootIndex - 1], newComponents[rootIndex]] = 
          [newComponents[rootIndex], newComponents[rootIndex - 1]];
      } else if (direction === 'down' && rootIndex < components.length - 1) {
        [newComponents[rootIndex], newComponents[rootIndex + 1]] = 
          [newComponents[rootIndex + 1], newComponents[rootIndex]];
      }
      
      return newComponents;
    }
    
    // If component is nested
    const parent = findParentComponent(id, components);
    if (parent && parent.children) {
      const childIndex = parent.children.findIndex(c => c.id === id);
      
      if (childIndex !== -1) {
        const newChildren = [...parent.children];
        
        if (direction === 'up' && childIndex > 0) {
          [newChildren[childIndex - 1], newChildren[childIndex]] = 
            [newChildren[childIndex], newChildren[childIndex - 1]];
        } else if (direction === 'down' && childIndex < newChildren.length - 1) {
          [newChildren[childIndex], newChildren[childIndex + 1]] = 
            [newChildren[childIndex + 1], newChildren[childIndex]];
        }
        
        const updatedParent = {
          ...parent,
          children: newChildren
        };
        
        return updateComponentById(parent.id, updatedParent, components);
      }
    }
    
    return components;
  };

  // Handle drop onto the widget container or a fieldset
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    const componentType = e.dataTransfer.getData('componentType');
    const componentConfig = COMPONENT_TYPES.find(c => c.type === componentType);
    
    if (componentConfig) {
      const newComponent: ComponentData = {
        id: `${componentType}-${Date.now()}`,
        type: componentType,
        props: { ...componentConfig.defaultProps }
      };
      
      // If we're adding to a fieldset
      if (addToParentId) {
        const parent = findComponentById(addToParentId, widgetData.components);
        
        if (parent && parent.type === 'FieldSet') {
          const updatedParent = {
            ...parent,
            children: [...(parent.children || []), newComponent]
          };
          
          setWidgetData(prev => ({
            ...prev,
            components: updateComponentById(addToParentId, updatedParent, prev.components)
          }));
          
          setAddToParentId(null);
          return;
        }
      }
      
      // Otherwise add to the root level
      setWidgetData(prev => ({
        ...prev,
        components: [...prev.components, newComponent]
      }));
    }
  };

  // Prevent default behavior for dragover to allow drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handler for deleting a component
  const handleDeleteComponent = (id: string) => {
    setWidgetData(prev => ({
      ...prev,
      components: removeComponentById(id, prev.components)
    }));
  };

  // Handler for editing a component
  const handleEditComponent = (id: string) => {
    const component = findComponentById(id, widgetData.components);
    if (component) {
      setCurrentEditComponent(component);
      setEditDialogOpen(true);
    }
  };

  // Handler for saving edited component
  const handleSaveComponent = (updatedComponent: ComponentData) => {
    setWidgetData(prev => ({
      ...prev,
      components: updateComponentById(updatedComponent.id, updatedComponent, prev.components)
    }));
  };

  // Handler for moving components up and down
  const handleMoveComponent = (id: string, direction: 'up' | 'down') => {
    setWidgetData(prev => ({
      ...prev,
      components: moveComponent(id, direction, prev.components)
    }));
  };

  // Handler for adding components inside a fieldset
  const handleAddInsideFieldset = (parentId: string) => {
    setAddToParentId(parentId);
    
    // Scroll to component palette to make it obvious what to do next
    const paletteEl = document.querySelector('[data-component-palette]');
    if (paletteEl) {
      paletteEl.scrollIntoView({ behavior: 'smooth' });
    }
    
    setNotification({
      open: true,
      message: 'Select a component from the palette to add inside',
      severity: 'info'
    });
  };

  // Handler for saving the widget
  const handleSaveWidget = () => {
    if (!widgetData.name.trim()) {
      setNotification({
        open: true,
        message: 'Please provide a widget name',
        severity: 'error'
      });
      return;
    }

    if (widgetData.components.length === 0) {
      setNotification({
        open: true,
        message: 'Add at least one component to the widget',
        severity: 'error'
      });
      return;
    }

    // Save the widget using WidgetStorage service
    const savedWidget = WidgetStorage.saveWidget({
      name: widgetData.name,
      components: widgetData.components
    });
    
    // Update the saved widgets list
    setSavedWidgets(WidgetStorage.getAllWidgets());
    
    setNotification({
      open: true,
      message: `Widget "${savedWidget.name}" saved successfully!`,
      severity: 'success'
    });
  };

  // Load a saved widget for editing
  const handleLoadWidget = (widget: CustomWidget) => {
    setWidgetData({
      name: widget.name,
      components: widget.components
    });
    setShowWidgetList(false);
    setEditMode(true);
  };

  // Delete a saved widget
  const handleDeleteSavedWidget = (id: string) => {
    WidgetStorage.deleteWidget(id);
    setSavedWidgets(WidgetStorage.getAllWidgets());
    
    setNotification({
      open: true,
      message: 'Widget deleted successfully',
      severity: 'success'
    });
  };

  // Close notification handler
  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

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
      />
    ));
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ flex: 1 }}>Widget Editor</Typography>
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
          color={savedWidgets.length === 0 ? "secondary" : "primary"}
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
              overflowY: 'auto'
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {addToParentId ? 'Add component inside FieldSet' : 'Components'}
            </Typography>
            {addToParentId && (
              <Button 
                variant="outlined" 
                size="small" 
                fullWidth 
                onClick={() => setAddToParentId(null)}
                sx={{ mb: 2 }}
              >
                Cancel
              </Button>
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
        <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Widget name field */}
          {editMode ? (
            <TextField
              label="Widget Name"
              value={widgetData.name}
              onChange={(e) => setWidgetData(prev => ({ ...prev, name: e.target.value }))}
              margin="normal"
              variant="outlined"
              size="small"
              sx={{ mb: 2 }}
            />
          ) : (
            <Typography
              variant="body1"
              sx={{ mb: 2 }}
            >
              <strong>Widget Name:</strong> {widgetData.name}
            </Typography>
          )}

          {/* Drop area */}
          <Paper
            ref={dropAreaRef}
            sx={{
              flex: 1,
              p: 2,
              backgroundColor: editMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              border: editMode ? '2px dashed #ccc' : '1px solid #e0e0e0',
              borderRadius: 1,
              minHeight: 200,
              overflowY: 'auto'
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
                  flexDirection: 'column'
                }}
              >
                <Typography color="text.secondary" align="center">
                  {editMode 
                    ? 'Drag and drop components here to create your widget' 
                    : 'This widget is empty. Switch to Edit mode to add components.'}
                </Typography>
              </Box>
            ) : (
              <Box>
                {renderComponents(widgetData.components)}
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* Component Edit Dialog */}
      <EditComponentDialog
        open={editDialogOpen}
        component={currentEditComponent}
        onClose={() => {
          setEditDialogOpen(false);
          setCurrentEditComponent(null);
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
                      backgroundColor: 'rgba(0, 0, 0, 0.02)'
                    }
                  }}
                >
                  <ListItemText 
                    primary={widget.name} 
                    secondary={`Last modified: ${new Date(widget.updatedAt).toLocaleString()}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSavedWidget(widget.id);
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
  );
};

export default WidgetEditor; 