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
  DialogActions
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import WidgetStorage, { CustomWidget } from './WidgetStorage';

// Component types for the widget editor
interface ComponentData {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: string;
}

interface WidgetData {
  name: string;
  components: ComponentData[];
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

// Component that renders a preview of a component based on its type
const ComponentPreview: React.FC<{ component: ComponentData, onEdit: (id: string) => void, onDelete: (id: string) => void }> = ({ 
  component, 
  onEdit,
  onDelete
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
            <Typography variant="body2" color="text.secondary">Field Set Content</Typography>
          </Box>
        );
      case 'Label':
        return (
          <Typography variant="body1">{component.props.text as string}</Typography>
        );
      case 'Button':
        return (
          <Button 
            variant={'contained'} 
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
        <IconButton size="small" onClick={() => onEdit(component.id)}>
          <CloseIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="error" onClick={() => onDelete(component.id)}>
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
  type: string; 
  label: string;
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
  const dropAreaRef = useRef<HTMLDivElement>(null);

  // Load saved widgets on component mount
  useEffect(() => {
    setSavedWidgets(WidgetStorage.getAllWidgets());
  }, []);

  // Handle drag start from component palette
  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('componentType', type);
  };

  // Handle drop onto the widget container
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
      components: prev.components.filter(c => c.id !== id)
    }));
  };

  // Handler for editing a component (currently just removes it)
  const handleEditComponent = (id: string) => {
    // For now we'll just remove the component when the close button is clicked
    handleDeleteComponent(id);
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
            sx={{ 
              width: 200, 
              p: 2, 
              borderRight: '1px solid #e0e0e0', 
              overflowY: 'auto'
            }}
          >
            <Typography variant="subtitle2" gutterBottom>Components</Typography>
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
          <TextField
            label="Widget Name"
            value={widgetData.name}
            onChange={(e) => setWidgetData(prev => ({ ...prev, name: e.target.value }))}
            margin="normal"
            variant="outlined"
            size="small"
            sx={{ mb: 2 }}
            disabled={!editMode}
          />

          {/* Drop area */}
          <Paper
            ref={dropAreaRef}
            sx={{
              flex: 1,
              p: 2,
              backgroundColor: editMode ? 'rgba(0, 0, 0, 0.02)' : 'white',
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
                {editMode && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Or click on components in the palette
                  </Typography>
                )}
              </Box>
            ) : (
              <Box>
                {widgetData.components.map((component) => (
                  <ComponentPreview 
                    key={component.id} 
                    component={component} 
                    onEdit={handleEditComponent}
                    onDelete={handleDeleteComponent}
                  />
                ))}
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

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
              You haven't saved any custom widgets yet
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