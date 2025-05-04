import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Divider,
  Button,
  TextField,
  IconButton,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import EditIcon from '@mui/icons-material/Edit'
import DescriptionIcon from '@mui/icons-material/Description'
import SettingsIcon from '@mui/icons-material/Settings'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { getComponentsByCategory } from './constants/componentTypes'
import { ComponentData } from './types/types'
import { useWidgetEditor } from './hooks/useWidgetEditor'
import EditComponentDialog from './components/EditComponentDialog'
import ComponentPreview from './components/ComponentPreview'
import ComponentPaletteItem from './components/ComponentPaletteItem'
import SavedWidgetsDialog from './components/SavedWidgetsDialog'
import SettingsDialog from './components/SettingsDialog'

// Main Widget Editor component
const WidgetEditor: React.FC = () => {
  const {
    // State
    widgetData,
    setWidgetData,
    editMode,
    notification,
    savedWidgets,
    showWidgetList,
    setShowWidgetList,
    editDialogOpen,
    currentEditComponent,
    dropTarget,
    dropAreaRef,
    isDragging,
    showSettingsModal,
    setShowSettingsModal,
    showTooltips,
    setShowTooltips,
    
    // Event handlers
    handleDragStart,
    handleDragEnd,
    handleContainerDragEnter,
    handleContainerDragLeave,
    handleContainerDragOver,
    handleContainerDrop,
    handleAddInsideFieldset,
    handleDrop,
    handleDragOver,
    handleDeleteComponent,
    handleEditComponent,
    handleSaveComponent,
    handleMoveComponent,
    handleSaveWidget,
    handleLoadWidget,
    handleDeleteSavedWidget,
    handleCloseNotification,
    toggleEditMode,
    
    // Utility
    setEditDialogOpen,
    setCurrentEditComponent,
  } = useWidgetEditor()

  // Toast state for component interactions
  const [componentToast, setComponentToast] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Listen for custom toast events from components
  React.useEffect(() => {
    const handleComponentToast = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        setComponentToast({
          open: true,
          message: customEvent.detail.message || 'Action performed',
          severity: customEvent.detail.severity || 'info',
        });
      }
    };

    document.addEventListener('showWidgetToast', handleComponentToast);
    
    // Cleanup
    return () => {
      document.removeEventListener('showWidgetToast', handleComponentToast);
    };
  }, []);

  // Handle closing component toasts
  const handleCloseComponentToast = () => {
    setComponentToast({
      ...componentToast,
      open: false,
    });
  };

  // Check if we're updating an existing widget
  const isUpdating = savedWidgets.some(widget => widget.name === widgetData.name)

  // Render the component hierarchy
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
        isDragging={isDragging}
        dropTarget={dropTarget}
        handleContainerDragEnter={handleContainerDragEnter}
        handleContainerDragOver={handleContainerDragOver}
        handleContainerDragLeave={handleContainerDragLeave}
        handleContainerDrop={handleContainerDrop}
      />
    ))
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        bgcolor: 'background.paper',
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" sx={{ flexGrow: 1, color: 'foreground.contrastPrimary' }}>
          Widget Editor
        </Typography>
        <Tooltip title="Settings">
          <IconButton
            size="small"
            onClick={() => setShowSettingsModal(true)}
            sx={{ color: 'text.secondary', marginInline: '0.75rem' }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit/Preview mode">
          <Button
            size="small"
            variant={'contained'}
            startIcon={editMode ? <DescriptionIcon /> :  <EditIcon /> }
            onClick={toggleEditMode}
            sx={{ mr: 1 }}
          >
            {editMode ? 'Preview Mode' :  'Edit Mode' }
          </Button>
        </Tooltip>
        <Tooltip title={isUpdating ? "Update widget" : "Save widget"}>
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSaveWidget}
            sx={{ mr: 1 }}
          >
            {isUpdating ? 'UPDATE' : 'SAVE'}
          </Button>
        </Tooltip>
        <Button
          size="small"
          variant="contained"
          onClick={() => setShowWidgetList(true)}
          sx={{ mr: 1 }}
        >
          Browse Widgets
        </Button>
      </Box>

      {/* Main content area */}
      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          overflow: 'hidden',
        }}
      >
        {/* Component palette */}
        {editMode && (
          <Box
            sx={{
              width: 250,
              p: 2,
              borderRight: '1px solid',
              borderColor: 'divider',
              overflowY: 'auto',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'foreground.contrastPrimary' }}>
              Widget Components
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {Object.entries(getComponentsByCategory()).map(([category, components]) => (
              <Box key={category} sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {category}
                </Typography>
                {components.map(component => (
                  <ComponentPaletteItem
                    key={component.type}
                    type={component.type}
                    label={component.label}
                    tooltip={showTooltips ? component.tooltip || '' : ''}
                    icon={component.icon || InfoOutlinedIcon}
                    onDragStart={handleDragStart}
                  />
                ))}
              </Box>
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
            bgcolor: 'background.default',
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
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'foreground.contrastSecondary',
                },
                '& .MuiOutlinedInput-input': {
                  color: 'foreground.contrastPrimary',
                },
              }}
            />
          ) : (
            <Typography variant="body1" sx={{ mb: 2, color: 'foreground.contrastPrimary' }}>
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
                ? dropTarget.id === null && isDragging 
                  ? 'rgba(0, 188, 162, 0.1)' 
                  : 'rgba(0, 188, 162, 0.05)'
                : 'rgba(0, 188, 162, 0.02)',
              border: editMode ? '2px dashed rgba(0, 188, 162, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 1,
              minHeight: 200,
              overflowY: 'auto',
              color: 'foreground.contrastPrimary',
              boxShadow: 'none',
              transition: 'background-color 0.2s'
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {widgetData.components.length === 0 ? (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'rgba(255, 255, 255, 0.4)',
                  pt: 4,
                  pb: 4,
                }}
              >
                <Typography variant="body1" sx={{ mb: 1, textAlign: 'center' }}>
                  {editMode
                    ? isDragging 
                      ? 'Drop component here'
                      : 'Drag and drop components here'
                    : 'No components added yet'}
                </Typography>
                {editMode && !isDragging && (
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                    Use the components panel on the left to build your widget
                  </Typography>
                )}
              </Box>
            ) : (
              renderComponents(widgetData.components)
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

      {/* Widget editor notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={3000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Component interaction toast */}
      <Snackbar
        open={componentToast.open}
        autoHideDuration={3000}
        onClose={handleCloseComponentToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseComponentToast} severity={componentToast.severity}>
          {componentToast.message}
        </Alert>
      </Snackbar>

      {/* Saved Widgets Dialog */}
      <SavedWidgetsDialog 
        open={showWidgetList}
        widgets={savedWidgets}
        onClose={() => setShowWidgetList(false)}
        onLoad={handleLoadWidget}
        onDelete={handleDeleteSavedWidget}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        showTooltips={showTooltips}
        onShowTooltipsChange={setShowTooltips}
      />
    </Box>
  )
}

export default WidgetEditor 