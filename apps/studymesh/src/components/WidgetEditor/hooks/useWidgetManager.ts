import { useState, useEffect } from 'react'
import WidgetStorage, { CustomWidget } from '../WidgetStorage'

// Custom hook for widget management
export const useWidgetManager = () => {
  // State for widget management modal
  const [isWidgetManagementOpen, setIsWidgetManagementOpen] = useState(false)
  const [widgets, setWidgets] = useState<CustomWidget[]>([])

  // Load widgets on mount or when modal is opened
  useEffect(() => {
    if (isWidgetManagementOpen) {
      loadWidgets()
    }
  }, [isWidgetManagementOpen])

  // Load widgets from storage
  const loadWidgets = () => {
    const allWidgets = WidgetStorage.getAllWidgets()
    setWidgets(allWidgets)
  }

  // Check if widget editor is already open in the dashboard
  const isWidgetEditorOpen = (): boolean => {
    // First try to find by data attribute
    const byDataAttr = document.querySelectorAll(
      '[data-component="WidgetEditor"]',
    )
    if (byDataAttr.length > 0) {
      return true
    }

    // Fallback to other ways of detection
    const byClass = document.querySelectorAll('.widget-editor-container')
    if (byClass.length > 0) {
      return true
    }

    // Last check - look for any elements that might be part of widget editor
    const editorToolbar = document.querySelectorAll('.widget-editor-toolbar')
    const componentPalette = document.querySelectorAll('.component-palette')

    return editorToolbar.length > 0 || componentPalette.length > 0
  }

  // Opens widget management modal
  const openWidgetManagement = () => {
    loadWidgets()
    setIsWidgetManagementOpen(true)
  }

  // Closes widget management modal
  const closeWidgetManagement = () => {
    setIsWidgetManagementOpen(false)
  }

  // Open a new widget editor without loading any widget
  const openWidgetEditor = async () => {
    // Always close the widget management modal first if it's open
    if (isWidgetManagementOpen) {
      closeWidgetManagement()
    }

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
      }, 300)
    })
  }

  const loadWidgetInEditor = async (
    widget: CustomWidget,
    viewMode: 'both' | 'edit' | 'preview',
  ) => {
    // Always close the widget management modal first
    closeWidgetManagement()

    const payload = {
      widget: JSON.parse(JSON.stringify(widget)),
      viewMode,
      editMode: viewMode !== 'preview',
    }

    if (isWidgetEditorOpen()) {
      document.dispatchEvent(
        new CustomEvent('loadWidgetInEditor', {
          detail: payload,
        }),
      )
    } else {
      return
    }
  }

  // Preview a widget
  const previewWidget = async (widget: CustomWidget) => {
    await loadWidgetInEditor(widget, 'preview')
  }

  // Edit a widget
  const editWidget = async (widget: CustomWidget) => {
    await loadWidgetInEditor(widget, 'both')
  }

  // Delete a widget
  const deleteWidget = (id: string) => {
    const widget = WidgetStorage.getWidgetById(id)
    if (widget) {
      WidgetStorage.deleteWidget(id)
      loadWidgets() // Refresh the widgets list
    }
  }

  return {
    widgets,
    isWidgetManagementOpen,
    openWidgetManagement,
    closeWidgetManagement,
    previewWidget,
    editWidget,
    deleteWidget,
    isWidgetEditorOpen,
    openWidgetEditor,
  }
}

export default useWidgetManager
