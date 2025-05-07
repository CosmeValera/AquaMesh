import React from 'react'
import {
  Box
} from '@mui/material'
import { useWidgetEditor } from './hooks/useWidgetEditor'
import EditComponentDialog from './components/dialogs/EditComponentDialog'
import SavedWidgetsDialog from './components/dialogs/SavedWidgetsDialog'
import TemplateSelectionDialog from './components/dialogs/TemplateSelectionDialog'
import ExportImportDialog from './components/dialogs/ExportImportDialog'
import WidgetVersioningDialog from './components/dialogs/WidgetVersioningDialog'
import ComponentSearchDialog from './components/dialogs/ComponentSearchDialog'
import SettingsDialog from './components/dialogs/SettingsDialog'
import EditorToolbar from './components/core/EditorToolbar'
import ComponentPalette from './components/core/ComponentPalette'
import EditorCanvas from './components/core/EditorCanvas'
import NotificationSystem from './components/ui/NotificationSystem'
import DeleteConfirmationDialog from './components/dialogs/DeleteConfirmationDialog'
import { CustomWidget } from './WidgetStorage'
import WidgetStorage, { WidgetVersion } from './WidgetStorage'

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
    showAdvancedInToolbar,
    setShowAdvancedInToolbar,
    
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
    handleToggleFieldsetCollapse,
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
    handleWidgetNameChange,
    loadSavedWidgets
  } = useWidgetEditor()

  // State to control sidebar visibility
  const [showSidebar, setShowSidebar] = React.useState(true)
  
  // State to control template selection dialog visibility
  const [showTemplateDialog, setShowTemplateDialog] = React.useState(false)

  // State to control export/import dialog visibility
  const [showExportImportDialog, setShowExportImportDialog] = React.useState(false)
  
  // State to control versioning dialog visibility
  const [showVersioningDialog, setShowVersioningDialog] = React.useState(false)
  
  // State to control component search dialog visibility
  const [showSearchDialog, setShowSearchDialog] = React.useState(false)
  
  // State to track current widget for versioning
  const [currentVersioningWidget, setCurrentVersioningWidget] = React.useState<CustomWidget | null>(null)

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
      // console.log('WidgetEditor: Loading initial widget from customProps', {
      //   widgetName: customProps.loadWidget.name,
      //   editMode: customProps.initialEditMode || false,
      //   componentCount: customProps.loadWidget.components.length
      // })
      
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

    const currentJson = JSON.stringify(widgetData.components)
    const savedJson = JSON.stringify(savedWidget.components)

    // If we're previewing an older version without edits, treat as no changes
    if (widgetData.version && widgetData.version !== savedWidget.version) {
      const versions = WidgetStorage.getWidgetVersions(savedWidget.id)
      const matching = versions.find(v => v.version === widgetData.version)
      if (matching && JSON.stringify(matching.components) === currentJson) {
        return false
      }
    }

    // Otherwise, compare current components to saved
    return savedJson !== currentJson
  }, [widgetData, savedWidgets, isUpdating])
  
  // Check if the current widget (including any loaded preview) is the latest version
  const isLatestVersion = React.useMemo(() => {
    if (!isUpdating) {
      return true // New widgets are always the latest
    }
    // Find the saved widget for history lookup
    const currentWidget = savedWidgets.find(w => w.name === widgetData.name)
    if (!currentWidget) {
      return true
    }
    // Get stored history versions (sorted newest first)
    const versions = WidgetStorage.getWidgetVersions(currentWidget.id)
    if (versions.length === 0) {
      return true
    }
    // Helper to parse 'major.minor'
    const parseVersion = (v: string = '0.0'): [number, number] => {
      const [major = 0, minor = 0] = v.split('.').map(p => parseInt(p, 10))
      return [major, minor]
    }
    // Use loaded widgetData.version for UI (preview or saved), fallback to stored version
    const loadedVersion = widgetData.version ?? currentWidget.version ?? '0.0'
    const [majorCurr, minorCurr] = parseVersion(loadedVersion)
    const [majorHist, minorHist] = parseVersion(versions[0].version)
    // If loaded version is at or ahead of stored latest, consider latest
    return majorCurr > majorHist || (majorCurr === majorHist && minorCurr >= minorHist)
  }, [widgetData.version, savedWidgets, isUpdating])
  
  // Get the current widget version
  const currentWidgetVersion = React.useMemo(() => {
    if (!isUpdating) {
      return '1.0' // Default for new widgets
    }
    
    // Find current widget in saved widgets
    const currentWidget = savedWidgets.find(w => w.name === widgetData.name)
    if (!currentWidget) {
      return '1.0'
    }
    
    return currentWidget.version || '1.0'
  }, [widgetData.name, savedWidgets, isUpdating])

  // Load a template as a new widget
  const handleTemplateSelected = (templateWidget: CustomWidget) => {
    handleLoadWidget(templateWidget, true)
  }

  // Handler for when import is complete
  const handleImportComplete = () => {
    loadSavedWidgets()
    setComponentToast({
      open: true,
      message: 'Widgets imported successfully',
      severity: 'success',
    })
  }
  
  // Open versioning dialog for a widget, marking the loaded preview version if any
  const handleOpenVersioningDialog = () => {
    const currentWidget = savedWidgets.find(w => w.name === widgetData.name)
    if (currentWidget) {
      // Override the version for dialog to reflect any previewed version
      const dialogWidget: CustomWidget = {
        ...currentWidget,
        version: widgetData.version ?? currentWidget.version
      }
      setCurrentVersioningWidget(dialogWidget)
      setShowVersioningDialog(true)
    } else {
      setComponentToast({
        open: true,
        message: 'Please save your widget first to access version history',
        severity: 'info'
      })
    }
  }
  
  // Open component search dialog
  const handleOpenSearchDialog = () => {
    if (widgetData.components.length === 0) {
      // Show a message if there are no components to search
      setComponentToast({
        open: true,
        message: 'No components to search. Add components to your widget first.',
        severity: 'info',
      })
      return
    }
    
    setShowSearchDialog(true)
  }
  
  // Handle component selection from search
  const handleSelectComponentFromSearch = (componentId: string) => {
    // Find the component in the widget tree
    handleEditComponent(componentId)
    
    // Show a success message
    setComponentToast({
      open: true,
      message: 'Component found and selected for editing',
      severity: 'success',
    })
  }
  
  // Handle restoring a previous version
  const handleRestoreVersion = (widgetId: string, version: WidgetVersion) => {
    // Find widget by ID
    const widget = savedWidgets.find(w => w.id === widgetId)
    if (!widget) {
      return
    }

    console.log("COSME")
    console.log("Widget", widget)
    console.log("Version", version)
    console.log("Saved Widgets", savedWidgets)

    // Create a new widget object with the restored components
    const restoredWidget: CustomWidget = {
      ...widget,
      components: version.components,
      version: version.version
    }
    
    // Preview the restored version without modifying storage
    handleLoadWidget(restoredWidget, true)
    // Inform the user this version is loaded for editing
    setComponentToast({
      open: true,
      message: `Loaded version ${version.version} for editing`,
      severity: 'info'
    })
  }

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
        position: 'relative',
        minHeight: 0,
        overflow: 'hidden',
      }}
      className="widget-editor-container"
      data-component="WidgetEditor"
    >
      {/* Editor Toolbar */}
      <EditorToolbar
        editMode={editMode}
        showSidebar={showSidebar}
        toggleSidebar={toggleSidebar}
        toggleEditMode={toggleEditMode}
        handleSaveWidget={handleSaveWidget}
        setShowWidgetList={setShowWidgetList}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        setShowSettingsModal={setShowSettingsModal}
        isUpdating={isUpdating}
        hasChanges={hasChanges}
        isEmpty={widgetData.components.length === 0}
        showTemplateDialog={showTemplateDialog}
        setShowTemplateDialog={setShowTemplateDialog}
        showExportImportDialog={showExportImportDialog}
        setShowExportImportDialog={setShowExportImportDialog}
        handleOpenVersioningDialog={handleOpenVersioningDialog}
        handleOpenSearchDialog={handleOpenSearchDialog}
        widgetHasComponents={widgetData.components.length > 0}
        isLatestVersion={isLatestVersion}
        currentWidgetVersion={currentWidgetVersion}
        showAdvancedInToolbar={showAdvancedInToolbar}
      />
      
      {/* Main editor area */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Component palette sidebar */}
        {showSidebar && editMode && (
          <ComponentPalette 
            handleDragStart={handleDragStart}
            showComponentPaletteHelp={showComponentPaletteHelp}
            setShowComponentPaletteHelp={setShowComponentPaletteHelp}
            showTooltips={showTooltips}
          />
        )}
        
        {/* Canvas area */}
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
          handleToggleFieldsetCollapse={handleToggleFieldsetCollapse}
          showSidebar={showSidebar}
          handleWidgetNameChange={handleWidgetNameChange}
        />
      </Box>
      
      {/* Dialogs */}
      <EditComponentDialog 
        open={editDialogOpen}
        component={currentEditComponent}
        onSave={handleSaveComponent}
        onClose={() => setEditDialogOpen(false)}
      />
      
      <SavedWidgetsDialog
        open={showWidgetList}
        onClose={() => setShowWidgetList(false)}
        widgets={savedWidgets}
        onLoad={(widget, useEditMode) => {
          // If useEditMode is explicitly provided (from preview/edit buttons), use that
          // Otherwise default to false (preview mode) as handled in WidgetManagementModal
          // This fixes the issue where widgets were always opening in edit mode
          const targetMode = useEditMode !== undefined ? useEditMode : false
          handleLoadWidget(widget, targetMode)
          setShowWidgetList(false)
        }}
        onDelete={handleDeleteSavedWidget}
      />
      
      <TemplateSelectionDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onTemplateSelected={handleTemplateSelected}
        currentWidget={
          isUpdating 
            ? savedWidgets.find(w => w.name === widgetData.name) 
            : (widgetData.components.length > 0 
              ? {
                id: widgetData.id || `widget-${Date.now()}`,
                name: widgetData.name,
                components: widgetData.components,
                createdAt: widgetData.createdAt ? new Date(widgetData.createdAt).toISOString() : new Date().toISOString(),
                updatedAt: widgetData.updatedAt ? new Date(widgetData.updatedAt).toISOString() : new Date().toISOString(),
                version: widgetData.version || '1.0'
              } as CustomWidget
              : null)
        }
      />
      
      <ExportImportDialog
        open={showExportImportDialog}
        onClose={() => setShowExportImportDialog(false)}
        widgets={savedWidgets}
        onImportComplete={handleImportComplete}
      />
      
      <WidgetVersioningDialog
        open={showVersioningDialog}
        onClose={() => setShowVersioningDialog(false)}
        widget={currentVersioningWidget}
        onRestoreVersion={handleRestoreVersion}
      />
      
      <ComponentSearchDialog
        open={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
        components={widgetData.components}
        onSelectComponent={handleSelectComponentFromSearch}
      />
      
      <SettingsDialog
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        showTooltips={showTooltips}
        onShowTooltipsChange={setShowTooltips}
        showDeleteConfirmation={showDeleteConfirmation}
        onShowDeleteConfirmationChange={setShowDeleteConfirmation}
        showComponentPaletteHelp={showComponentPaletteHelp}
        onShowComponentPaletteHelpChange={setShowComponentPaletteHelp}
        showDeleteWidgetConfirmation={showDeleteWidgetConfirmation}
        onShowDeleteWidgetConfirmationChange={setShowDeleteWidgetConfirmation}
        showDeleteDashboardConfirmation={showDeleteDashboardConfirmation}
        onShowDeleteDashboardConfirmationChange={setShowDeleteDashboardConfirmation}
        showAdvancedInToolbar={showAdvancedInToolbar}
        onShowAdvancedInToolbarChange={setShowAdvancedInToolbar}
      />
      
      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        title={deleteConfirmProps.title}
        content={deleteConfirmProps.content}
        onConfirm={deleteConfirmProps.onConfirm}
        onCancel={deleteConfirmProps.onCancel}
      />
      
      {/* Notification toasts */}
      <NotificationSystem
        notification={notification}
        componentToast={componentToast}
        handleCloseNotification={handleCloseNotification}
        handleCloseComponentToast={handleCloseComponentToast}
      />
    </Box>
  )
}

export default WidgetEditor 