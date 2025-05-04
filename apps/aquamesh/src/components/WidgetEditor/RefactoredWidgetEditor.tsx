import React from 'react'
import {
  Box
} from '@mui/material'
import { useWidgetEditor } from './hooks/useWidgetEditor'
import EditComponentDialog from './components/EditComponentDialog'
import SavedWidgetsDialog from './components/SavedWidgetsDialog'
import SettingsDialog from './components/SettingsDialog'
import EditorToolbar from './components/EditorToolbar'
import ComponentPalette from './components/ComponentPalette'
import EditorCanvas from './components/EditorCanvas'
import NotificationSystem from './components/NotificationSystem'

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
    handleToggleVisibility,
    
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
      />
    </Box>
  )
}

export default WidgetEditor 