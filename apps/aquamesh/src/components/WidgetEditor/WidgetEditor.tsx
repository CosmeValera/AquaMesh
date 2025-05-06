import React from 'react'
import {
  Box
} from '@mui/material'
import { useWidgetEditor } from './hooks/useWidgetEditor'
import EditComponentDialog from './components/dialogs/EditComponentDialog'
import SavedWidgetsDialog from './components/dialogs/SavedWidgetsDialog'
import SettingsDialog from './components/dialogs/SettingsDialog'
import EditorToolbar from './components/core/EditorToolbar'
import ComponentPalette from './components/core/ComponentPalette'
import EditorCanvas from './components/core/EditorCanvas'
import NotificationSystem from './components/ui/NotificationSystem'
import DeleteConfirmationDialog from './components/dialogs/DeleteConfirmationDialog'
import { CustomWidget } from './WidgetStorage'

// Main Widget Editor component
const WidgetEditor: React.FC<{
  customProps?: {
    loadWidget?: CustomWidget; // The widget to load
    initialEditMode?: boolean; // Whether to start in edit mode
  }
}> = ({ customProps }) => {
  const {
    // State
    widgetData,
    setWidgetData,
    editMode,
    setEditMode,
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
    showDeleteConfirmation,
    setShowDeleteConfirmation,
    showComponentPaletteHelp,
    setShowComponentPaletteHelp,
    deleteConfirmOpen,
    showDeleteWidgetConfirmation,
    setShowDeleteWidgetConfirmation,
    showDeleteDashboardConfirmation,
    setShowDeleteDashboardConfirmation,
    
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
    handleToggleVisibility,
    confirmDeleteComponent,
    cancelDeleteComponent,
    confirmDeleteSavedWidget,
    componentToDelete,
    widgetToDelete,
    
    // History/Undo/Redo functionality
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    
    // Utility
    setEditDialogOpen,
    setCurrentEditComponent,
    handleWidgetNameChange,
  } = useWidgetEditor()

  // State to control sidebar visibility
  const [showSidebar, setShowSidebar] = React.useState(true)

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar)
  }

  // Toast state for component interactions
  const [componentToast, setComponentToast] = React.useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info' | 'warning'
  }>({
    open: false,
    message: '',
    severity: 'info',
  })

  // Listen for custom toast events from components
  React.useEffect(() => {
    const handleComponentToast = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail) {
        setComponentToast({
          open: true,
          message: customEvent.detail.message || 'Action performed',
          severity: customEvent.detail.severity || 'info',
        })
      }
    }

    document.addEventListener('showWidgetToast', handleComponentToast)
    
    // Cleanup
    return () => {
      document.removeEventListener('showWidgetToast', handleComponentToast)
    }
  }, [])

  // Listen for loadWidgetInEditor events from widget management
  React.useEffect(() => {
    const handleExternalWidgetLoad = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail && customEvent.detail.widget) {
        handleLoadWidget(customEvent.detail.widget, customEvent.detail.editMode)
      }
    }

    document.addEventListener('loadWidgetInEditor', handleExternalWidgetLoad)
    
    // Cleanup
    return () => {
      document.removeEventListener('loadWidgetInEditor', handleExternalWidgetLoad)
    }
  }, [handleLoadWidget])
  
  // Handle initial widget load from customProps
  React.useEffect(() => {
    if (customProps?.loadWidget) {
      console.log('WidgetEditor: Loading initial widget from customProps', {
        widgetName: customProps.loadWidget.name,
        editMode: customProps.initialEditMode || false,
        componentCount: customProps.loadWidget.components.length
      })
      
      // Set the appropriate edit mode first
      if (customProps.initialEditMode !== undefined) {
        setEditMode(customProps.initialEditMode)
      }
      
      // Then load the widget - use a setTimeout to ensure the edit mode is set first
      setTimeout(() => {
        // Load the widget with the proper mode
        handleLoadWidget(customProps.loadWidget!, customProps.initialEditMode || false)
      }, 0)
    }
  }, [customProps, handleLoadWidget, setEditMode])
  
  // Handle closing component toasts
  const handleCloseComponentToast = () => {
    setComponentToast({
      ...componentToast,
      open: false,
    })
  }

  // Check if we're updating an existing widget
  const isUpdating = savedWidgets.some(widget => widget.name === widgetData.name)
  
  // Check if there are changes to save/update
  const hasChanges = React.useMemo(() => {
    if (!isUpdating) {
      return true // Always enable save for new widgets
    }
    
    // Find the saved widget with the same name
    const savedWidget = savedWidgets.find(widget => widget.name === widgetData.name)
    if (!savedWidget) {
      return true
    }
    
    // Compare the current widget data with the saved one
    const savedWidgetJson = JSON.stringify(savedWidget.components)
    const currentWidgetJson = JSON.stringify(widgetData.components)
    const result = savedWidgetJson !== currentWidgetJson
    
    // Debug log
    console.log('Widget change detection:', { 
      hasChanges: result, 
      widgetName: widgetData.name,
      savedComponentsLength: savedWidget.components.length,
      currentComponentsLength: widgetData.components.length
    })
    
    return result
  }, [widgetData, savedWidgets, isUpdating])

  // Set up delete confirmation content based on what's being deleted
  const getDeleteConfirmationProps = () => {
    if (componentToDelete) {
      return {
        title: "Delete Component?",
        content: "Are you sure you want to delete this component?",
        onConfirm: confirmDeleteComponent,
        onCancel: cancelDeleteComponent
      }
    } else if (widgetToDelete) {
      const widgetName = savedWidgets.find(w => w.id === widgetToDelete)?.name || "widget"
      return {
        title: "Delete Widget?",
        content: `Are you sure you want to delete "${widgetName}"?`,
        onConfirm: confirmDeleteSavedWidget,
        onCancel: cancelDeleteComponent
      }
    }
    return {
      title: "Delete Item?",
      content: "Are you sure you want to delete this item?",
      onConfirm: () => cancelDeleteComponent(),
      onCancel: () => cancelDeleteComponent()
    }
  }

  const deleteConfirmProps = getDeleteConfirmationProps()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        bgcolor: 'background.paper',
      }}
      className="widget-editor-container"
      data-component="WidgetEditor"
    >
      {/* Toolbar */}
      <EditorToolbar 
        editMode={editMode}
        showSidebar={showSidebar}
        toggleSidebar={toggleSidebar}
        toggleEditMode={toggleEditMode}
        handleSaveWidget={handleSaveWidget}
        setShowWidgetList={setShowWidgetList}
        setShowSettingsModal={setShowSettingsModal}
        isUpdating={isUpdating}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        hasChanges={hasChanges}
        isEmpty={widgetData.components.length === 0}
      />

      {/* Main content area */}
      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Component palette */}
        {editMode && showSidebar && (
          <ComponentPalette 
            showTooltips={showTooltips}
            showHelpText={showComponentPaletteHelp}
            handleDragStart={handleDragStart}
          />
        )}

        {/* Widget editing area */}
        <EditorCanvas 
          editMode={editMode}
          widgetData={widgetData}
          setWidgetData={setWidgetData}
          dropAreaRef={dropAreaRef}
          handleDrop={handleDrop}
          handleDragOver={handleDragOver}
          handleDragEnd={handleDragEnd}
          isDragging={isDragging}
          dropTarget={dropTarget}
          handleEditComponent={handleEditComponent}
          handleDeleteComponent={handleDeleteComponent}
          handleMoveComponent={handleMoveComponent}
          handleAddInsideFieldset={handleAddInsideFieldset}
          handleToggleVisibility={handleToggleVisibility}
          handleContainerDragEnter={handleContainerDragEnter}
          handleContainerDragOver={handleContainerDragOver}
          handleContainerDragLeave={handleContainerDragLeave}
          handleContainerDrop={handleContainerDrop}
          showSidebar={showSidebar}
          handleWidgetNameChange={handleWidgetNameChange}
        />
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

      {/* Notifications */}
      <NotificationSystem 
        notification={notification}
        componentToast={componentToast}
        handleCloseNotification={handleCloseNotification}
        handleCloseComponentToast={handleCloseComponentToast}
      />

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
        showComponentPaletteHelp={showComponentPaletteHelp}
        onShowComponentPaletteHelpChange={setShowComponentPaletteHelp}
        showDeleteConfirmation={showDeleteConfirmation}
        onShowDeleteConfirmationChange={setShowDeleteConfirmation}
        showDeleteWidgetConfirmation={showDeleteWidgetConfirmation}
        onShowDeleteWidgetConfirmationChange={setShowDeleteWidgetConfirmation}
        showDeleteDashboardConfirmation={showDeleteDashboardConfirmation}
        onShowDeleteDashboardConfirmationChange={setShowDeleteDashboardConfirmation}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && deleteConfirmProps && (
        <DeleteConfirmationDialog
          open={deleteConfirmOpen}
          title={deleteConfirmProps.title}
          content={deleteConfirmProps.content}
          onConfirm={deleteConfirmProps.onConfirm}
          onCancel={deleteConfirmProps.onCancel}
        />
      )}
    </Box>
  )
}

export default WidgetEditor 