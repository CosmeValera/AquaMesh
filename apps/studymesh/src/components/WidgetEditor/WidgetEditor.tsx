import React from 'react'
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material'
import { useWidgetEditor } from './hooks/useWidgetEditor'
import EditComponentDialog from './components/dialogs/EditComponentDialog'
import SavedWidgetsDialog from './components/dialogs/SavedWidgetsDialog'
import TemplateSelectionDialog from './components/dialogs/TemplateSelectionDialog'
import ExportImportDialog from './components/dialogs/ExportImportDialog'
import WidgetVersioningDialog from './components/dialogs/WidgetVersioningDialog'
import ComponentSearchDialog from './components/dialogs/ComponentSearchDialog'
import EditorToolbar from './components/core/EditorToolbar'
import ComponentPalette from './components/core/ComponentPalette'
import EditorCanvas from './components/core/EditorCanvas'
import CustomWidgetPreview from './CustomWidget'
import DeleteConfirmationDialog from './components/dialogs/DeleteConfirmationDialog'
import SettingsDialog from '../settings/SettingsDialog'
import { CustomWidget } from './WidgetStorage'
import WidgetStorage, { WidgetVersion } from './WidgetStorage'
import SaveWidgetDialog from './components/dialogs/SaveWidgetDialog'
import { cloneTemplate } from './constants/templateWidgets'
import { dispatchWorkspaceOnboardingEvent } from '../onboarding/onboardingEvents'

// Main Widget Editor component
const WidgetEditor: React.FC<{
  customProps?: {
    loadWidget?: CustomWidget // The widget to load
    initialEditMode?: boolean // Whether to start in edit mode
  }
  onSaveComplete?: () => void
}> = ({ customProps, onSaveComplete }) => {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const {
    // State
    widgetData,
    setWidgetData,
    editMode,
    viewMode,
    setViewMode,
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
    showComponentPaletteHelp,
    setShowComponentPaletteHelp,
    deleteConfirmOpen,
    showAdvancedInToolbar,
    setShowAdvancedInToolbar,
    showDeleteTemplateConfirmation,

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
    loadSavedWidgets,
    editorId,
    handleDirectAdd,
    activeContainerId,
    setActiveContainerId,
  } = useWidgetEditor()

  // State to control sidebar visibility
  const [showSidebar, setShowSidebar] = React.useState(true)

  // State to control template selection dialog visibility
  const [showTemplateDialog, setShowTemplateDialog] = React.useState(false)

  // State to control export/import dialog visibility
  const [showExportImportDialog, setShowExportImportDialog] =
    React.useState(false)

  // State to control versioning dialog visibility
  const [showVersioningDialog, setShowVersioningDialog] = React.useState(false)

  // State to control component search dialog visibility
  const [showSearchDialog, setShowSearchDialog] = React.useState(false)

  // State to control save widget dialog
  const [showSaveDialog, setShowSaveDialog] = React.useState(false)
  const [saveDialogDefaultName, setSaveDialogDefaultName] = React.useState('')
  const loadedInitialWidgetKeyRef = React.useRef<string | null>(null)

  // State to track current widget for versioning
  const [currentVersioningWidget, setCurrentVersioningWidget] =
    React.useState<CustomWidget | null>(null)

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar)
  }

  const defaultEditViewMode = isPhone ? 'edit' : 'both'
  const showEditorPane = viewMode === 'both' || viewMode === 'edit'
  const showPreviewPane = viewMode === 'both' || viewMode === 'preview'

  React.useEffect(() => {
    if (isPhone && viewMode === 'both') {
      setViewMode('edit')
    }
  }, [isPhone, setViewMode, viewMode])

  const handleGuidedDragStart = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, type: string) => {
      handleDragStart(event, type)
    },
    [handleDragStart],
  )

  const handleGuidedDrop = React.useCallback(
    (event: React.DragEvent) => {
      const componentType = event.dataTransfer.getData('componentType')
      handleDrop(event)
      if (componentType) {
        dispatchWorkspaceOnboardingEvent({
          type: 'component-added',
          componentType,
          componentId: activeContainerId || undefined,
        })
      }
    },
    [activeContainerId, handleDrop],
  )

  const handleGuidedDirectAdd = React.useCallback(
    (componentType: string) => {
      handleDirectAdd(componentType)
      dispatchWorkspaceOnboardingEvent({
        type: 'component-added',
        componentType,
        componentId: activeContainerId || undefined,
      })
    },
    [activeContainerId, handleDirectAdd],
  )

  // Listen for loadWidgetInEditor events from widget management
  React.useEffect(() => {
    const handleExternalWidgetLoad = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail && customEvent.detail.widget) {
        const requestedViewMode =
          customEvent.detail.viewMode ??
          (customEvent.detail.editMode ? defaultEditViewMode : 'preview')
        const nextViewMode =
          isPhone && requestedViewMode === 'both' ? 'edit' : requestedViewMode
        setViewMode(nextViewMode)
        handleLoadWidget(customEvent.detail.widget, nextViewMode !== 'preview')
      }
    }

    document.addEventListener('loadWidgetInEditor', handleExternalWidgetLoad)

    // Cleanup
    return () => {
      document.removeEventListener(
        'loadWidgetInEditor',
        handleExternalWidgetLoad,
      )
    }
  }, [defaultEditViewMode, handleLoadWidget, isPhone, setViewMode])

  // Handle initial widget load from customProps
  React.useEffect(() => {
    const widget = customProps?.loadWidget

    if (widget) {
      const initialWidgetKey = `${widget.id}-${
        customProps.initialEditMode ? 'edit' : 'preview'
      }`

      if (loadedInitialWidgetKeyRef.current === initialWidgetKey) {
        return
      }

      loadedInitialWidgetKeyRef.current = initialWidgetKey
      // console.log('WidgetEditor: Loading initial widget from customProps', {
      //   widgetName: customProps.loadWidget.name,
      //   editMode: customProps.initialEditMode || false,
      //   componentCount: customProps.loadWidget.components.length
      // })

      // Set the appropriate edit mode first
      if (customProps.initialEditMode !== undefined) {
        setViewMode(
          customProps.initialEditMode ? defaultEditViewMode : 'preview',
        )
      }

      // Then load the widget - use a setTimeout to ensure the edit mode is set first
      setTimeout(() => {
        // Load the widget with the proper mode
        handleLoadWidget(widget, customProps.initialEditMode || false)
      }, 0)
    }
  }, [customProps, defaultEditViewMode, handleLoadWidget, setViewMode])

  // Listen for save widget dialog requests
  React.useEffect(() => {
    const handleShowSaveDialog = (event: Event) => {
      const customEvent = event as CustomEvent
      if (
        customEvent.detail &&
        // Check if the event is for this editor instance
        customEvent.detail.editorId === editorId
      ) {
        setSaveDialogDefaultName(customEvent.detail.defaultName || '')
        setShowSaveDialog(true)
      }
    }

    document.addEventListener('showSaveWidgetDialog', handleShowSaveDialog)

    // Cleanup
    return () => {
      document.removeEventListener('showSaveWidgetDialog', handleShowSaveDialog)
    }
  }, [editorId])

  // Handle saving with a custom name from the dialog
  const handleSaveWidgetWithName = (name: string) => {
    handleSaveWidget(false, name)
    onSaveComplete?.()
  }

  const currentSavedWidget = React.useMemo(
    () =>
      widgetData.id
        ? savedWidgets.find((widget) => widget.id === widgetData.id)
        : undefined,
    [savedWidgets, widgetData.id],
  )

  // Check if we're updating an existing widget. Use the saved widget id instead
  // of the name so a fresh default "New Widget" is still treated as a new save.
  const isUpdating = Boolean(currentSavedWidget)

  const handleToolbarSaveWidget = React.useCallback(
    (isMajorUpdate?: boolean) => {
      if (isPhone && !isUpdating) {
        setSaveDialogDefaultName(widgetData.name || 'New Widget')
        setShowSaveDialog(true)
        return
      }

      handleSaveWidget(isMajorUpdate)
      onSaveComplete?.()
    },
    [handleSaveWidget, isPhone, isUpdating, onSaveComplete, widgetData.name],
  )

  // Check if there are changes to save/update
  const hasChanges = React.useMemo(() => {
    if (!isUpdating) {
      return true // Always enable save for new widgets
    }

    if (!currentSavedWidget) {
      return true
    }

    const currentJson = JSON.stringify(widgetData.components)
    const savedJson = JSON.stringify(currentSavedWidget.components)

    // If we're previewing an older version without edits, treat as no changes
    if (
      widgetData.version &&
      widgetData.version !== currentSavedWidget.version
    ) {
      const versions = WidgetStorage.getWidgetVersions(currentSavedWidget.id)
      const matching = versions.find((v) => v.version === widgetData.version)
      if (matching && JSON.stringify(matching.components) === currentJson) {
        return false
      }
    }

    // Otherwise, compare current components to saved
    return savedJson !== currentJson
  }, [currentSavedWidget, widgetData, isUpdating])

  // Check if the current widget (including any loaded preview) is the latest version
  const isLatestVersion = React.useMemo(() => {
    if (!isUpdating) {
      return true // New widgets are always the latest
    }
    if (!currentSavedWidget) {
      return true
    }
    // Get stored history versions (sorted newest first)
    const versions = WidgetStorage.getWidgetVersions(currentSavedWidget.id)
    if (versions.length === 0) {
      return true
    }
    // Helper to parse 'major.minor'
    const parseVersion = (v: string = '0.0'): [number, number] => {
      const [major = 0, minor = 0] = v.split('.').map((p) => parseInt(p, 10))
      return [major, minor]
    }
    // Use loaded widgetData.version for UI (preview or saved), fallback to stored version
    const loadedVersion =
      widgetData.version ?? currentSavedWidget.version ?? '0.0'
    const [majorCurr, minorCurr] = parseVersion(loadedVersion)
    const [majorHist, minorHist] = parseVersion(versions[0].version)
    // If loaded version is at or ahead of stored latest, consider latest
    return (
      majorCurr > majorHist ||
      (majorCurr === majorHist && minorCurr >= minorHist)
    )
  }, [currentSavedWidget, widgetData.version, isUpdating])

  // Get the current widget version
  const currentWidgetVersion = React.useMemo(() => {
    // Use the version from widgetData to reflect the current or previewed version
    return widgetData.version ?? '1.0'
  }, [widgetData.version])

  // Load a template as a new widget
  const handleTemplateSelected = (templateWidget: CustomWidget) => {
    setViewMode(defaultEditViewMode)
    handleLoadWidget(templateWidget, true)
  }

  const handleStartOperationsWidget = () => {
    const operationsWidget = cloneTemplate('template-operations-dashboard')
    if (!operationsWidget) {
      return
    }

    setViewMode(defaultEditViewMode)
    handleLoadWidget(operationsWidget, true)
  }

  // Handler for when import is complete
  const handleImportComplete = () => {
    loadSavedWidgets()
  }

  // Open versioning dialog for a widget, marking the loaded preview version if any
  const handleOpenVersioningDialog = () => {
    if (currentSavedWidget) {
      // Prepare widget for dialog to reflect any previewed version and current components
      const dialogWidget: CustomWidget = {
        ...currentSavedWidget,
        version: widgetData.version ?? currentSavedWidget.version,
        components: widgetData.components,
      }
      setCurrentVersioningWidget(dialogWidget)
      setShowVersioningDialog(true)
    }
  }

  // Open component search dialog
  const handleOpenSearchDialog = () => {
    if (widgetData.components.length === 0) {
      return
    }

    setShowSearchDialog(true)
  }

  // Handle component selection from search
  const handleSelectComponentFromSearch = (componentId: string) => {
    // Find the component in the widget tree
    handleEditComponent(componentId)
  }

  // Handle restoring a previous version
  const handleRestoreVersion = (widgetId: string, version: WidgetVersion) => {
    // Find widget by ID
    const widget = savedWidgets.find((w) => w.id === widgetId)
    if (!widget) {
      return
    }
    // Create a new widget object with the restored components
    const restoredWidget: CustomWidget = {
      ...widget,
      components: version.components,
      version: version.version,
    }

    // Preview the restored version without modifying storage
    setViewMode(defaultEditViewMode)
    handleLoadWidget(restoredWidget, true)
  }

  // Define handleMajorVersionUpdate function
  const handleMajorVersionUpdate = (widgetId: string) => {
    // Find widget by ID
    const widget = savedWidgets.find((w) => w.id === widgetId)
    if (!widget) {
      return
    }

    // Update the widget with a major version increment
    handleSaveWidget(true)
  }

  // Set up delete confirmation content based on what's being deleted
  const getDeleteConfirmationProps = () => {
    if (componentToDelete) {
      return {
        title: 'Delete Block?',
        content: 'Are you sure you want to delete this block?',
        onConfirm: confirmDeleteComponent,
        onCancel: cancelDeleteComponent,
      }
    } else if (widgetToDelete) {
      const widgetName =
        savedWidgets.find((w) => w.id === widgetToDelete)?.name || 'widget'
      return {
        title: 'Delete Widget?',
        content: `Are you sure you want to delete "${widgetName}"?`,
        onConfirm: confirmDeleteSavedWidget,
        onCancel: cancelDeleteComponent,
      }
    }
    return {
      title: 'Delete Item?',
      content: 'Are you sure you want to delete this item?',
      onConfirm: () => cancelDeleteComponent(),
      onCancel: () => cancelDeleteComponent(),
    }
  }

  const deleteConfirmProps = getDeleteConfirmationProps()
  const handleSelectContainer = React.useCallback(
    (containerId: string) => {
      setActiveContainerId(containerId)
      if (containerId) {
        dispatchWorkspaceOnboardingEvent({
          type: 'container-selected',
          componentId: containerId,
        })
      }
    },
    [setActiveContainerId],
  )

  const handleGuidedSaveComponent = React.useCallback(
    (updatedComponent: Parameters<typeof handleSaveComponent>[0]) => {
      handleSaveComponent(updatedComponent)
      dispatchWorkspaceOnboardingEvent({
        type: 'component-edit-saved',
        componentId: updatedComponent.id,
        componentType: updatedComponent.type,
      })
    },
    [handleSaveComponent],
  )

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
        bgcolor: '#F7FAFA',
      }}
      className="widget-editor-container"
      data-component="WidgetEditor"
    >
      {/* Editor Toolbar */}
      <EditorToolbar
        editMode={editMode}
        viewMode={viewMode}
        showSidebar={showSidebar}
        toggleSidebar={toggleSidebar}
        setViewMode={setViewMode}
        handleSaveWidget={handleToolbarSaveWidget}
        setShowWidgetList={setShowWidgetList}
        setShowSettingsModal={setShowSettingsModal}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
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
        widgetName={widgetData.name}
        handleWidgetNameChange={handleWidgetNameChange}
      />

      {/* Main editor area */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          flex: 1,
          overflow: 'hidden',
          bgcolor: '#F7FAFA',
        }}
      >
        {/* Component palette sidebar */}
        {showEditorPane && showSidebar && editMode && (
          <ComponentPalette
            handleDragStart={handleGuidedDragStart}
            showComponentPaletteHelp={showComponentPaletteHelp}
            showTooltips={showTooltips}
            handleDirectAdd={handleGuidedDirectAdd}
            activeContainerId={activeContainerId}
            setActiveContainerId={handleSelectContainer}
            widgetData={widgetData}
          />
        )}

        {/* Canvas area */}
        {showEditorPane && (
          <Box
            sx={{
              flex: viewMode === 'both' ? '1 1 50%' : '1 1 auto',
              minWidth: 0,
              minHeight: { xs: viewMode === 'both' ? 360 : 0, md: 0 },
              display: 'flex',
            }}
          >
            <EditorCanvas
              editMode={editMode}
              widgetData={widgetData}
              dropAreaRef={dropAreaRef}
              handleDrop={handleGuidedDrop}
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
              activeContainerId={activeContainerId}
              onSelectContainer={handleSelectContainer}
              onAddStarterComponent={handleGuidedDirectAdd}
              onStartOperationsWidget={handleStartOperationsWidget}
              onUseTemplate={() => setShowTemplateDialog(true)}
            />
          </Box>
        )}

        {showPreviewPane && (
          <Box
            data-testid="widget-preview-pane"
            sx={{
              flex: viewMode === 'both' ? '1 1 50%' : '1 1 auto',
              minWidth: 0,
              minHeight: viewMode === 'both' ? { xs: 260, md: 0 } : 0,
              borderLeft: { xs: 0, md: viewMode === 'both' ? 1 : 0 },
              borderTop: { xs: viewMode === 'both' ? 1 : 0, md: 0 },
              borderColor: 'divider',
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Typography variant="subtitle2" color="text.primary">
                Live Preview
              </Typography>
            </Box>
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                p: { xs: 1.5, md: 2 },
                bgcolor: 'background.default',
              }}
            >
              <CustomWidgetPreview components={widgetData.components} />
            </Box>
          </Box>
        )}
      </Box>

      {/* Dialogs */}
      <EditComponentDialog
        open={editDialogOpen}
        component={currentEditComponent}
        onSave={handleGuidedSaveComponent}
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
          const targetMode = useEditMode !== undefined ? useEditMode : true
          setViewMode(targetMode ? 'both' : 'preview')
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
            ? savedWidgets.find((w) => w.name === widgetData.name)
            : widgetData.components.length > 0
              ? ({
                  id: widgetData.id || `widget-${Date.now()}`,
                  name: widgetData.name,
                  components: widgetData.components,
                  createdAt: widgetData.createdAt
                    ? new Date(widgetData.createdAt).toISOString()
                    : new Date().toISOString(),
                  updatedAt: widgetData.updatedAt
                    ? new Date(widgetData.updatedAt).toISOString()
                    : new Date().toISOString(),
                  version: widgetData.version || '1.0',
                } as CustomWidget)
              : null
        }
        showDeleteTemplateConfirmation={showDeleteTemplateConfirmation}
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
        onMajorVersionUpdate={handleMajorVersionUpdate}
        isLatestVersion={isLatestVersion}
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
        title="Widget Editor Settings"
        scope="editor"
        showTooltips={showTooltips}
        onShowTooltipsChange={setShowTooltips}
        showComponentPaletteHelp={showComponentPaletteHelp}
        onShowComponentPaletteHelpChange={setShowComponentPaletteHelp}
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

      <SaveWidgetDialog
        open={showSaveDialog}
        onClose={() => {
          setShowSaveDialog(false)
          // Reset the save dialog request flag in the hook
          document.dispatchEvent(
            new CustomEvent('resetSaveDialogRequested', {
              detail: { editorId },
            }),
          )
        }}
        onSave={handleSaveWidgetWithName}
        defaultName={saveDialogDefaultName}
        existingWidgets={savedWidgets}
      />
    </Box>
  )
}

export default WidgetEditor
