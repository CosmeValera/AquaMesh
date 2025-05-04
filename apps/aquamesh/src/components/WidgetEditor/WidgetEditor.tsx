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
    showDeleteConfirmation,
    setShowDeleteConfirmation,
    showComponentPaletteHelp,
    setShowComponentPaletteHelp,
    deleteConfirmOpen,
    showDeleteWidgetConfirmation,
    setShowDeleteWidgetConfirmation,
    
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
    
    // Utility
    setEditDialogOpen,
    setCurrentEditComponent,
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

  // Handle closing component toasts
  const handleCloseComponentToast = () => {
    setComponentToast({
      ...componentToast,
      open: false,
    })
  }

  // Check if we're updating an existing widget
  const isUpdating = savedWidgets.some(widget => widget.name === widgetData.name)

  // Set up delete confirmation content based on what's being deleted
  const getDeleteConfirmationProps = () => {
    if (componentToDelete) {
      return {
        title: "Delete Component?",
        content: "Are you sure you want to delete this component? This action cannot be undone.",
        onConfirm: confirmDeleteComponent,
        onCancel: cancelDeleteComponent
      }
    } else if (widgetToDelete) {
      const widgetName = savedWidgets.find(w => w.id === widgetToDelete)?.name || "widget"
      return {
        title: "Delete Widget?",
        content: `Are you sure you want to delete "${widgetName}"? This action cannot be undone.`,
        onConfirm: confirmDeleteSavedWidget,
        onCancel: cancelDeleteComponent
      }
    }
    return {
      title: "Delete Item?",
      content: "Are you sure you want to delete this item? This action cannot be undone.",
      onConfirm: cancelDeleteComponent,
      onCancel: cancelDeleteComponent
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
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        title={deleteConfirmProps.title}
        content={deleteConfirmProps.content}
        onConfirm={deleteConfirmProps.onConfirm}
        onCancel={deleteConfirmProps.onCancel}
      />
    </Box>
  )
}

export default WidgetEditor 