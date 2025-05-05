import { useState, useEffect } from 'react'
import { useLayout } from '../../Layout/LayoutProvider'
import WidgetStorage, { CustomWidget } from '../WidgetStorage'

// Custom hook for widget management
export const useWidgetManager = () => {
  // State for widget management modal
  const [isWidgetManagementOpen, setIsWidgetManagementOpen] = useState(false)
  const [widgets, setWidgets] = useState<CustomWidget[]>([])
  
  // Layout context to add widget editor component
  const { addComponent } = useLayout()
  
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
    const byDataAttr = document.querySelectorAll('[data-component="WidgetEditor"]')
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
  
  // Preview a widget
  const previewWidget = (widget: CustomWidget) => {
    // Always close the widget management modal first
    closeWidgetManagement()
    
    if (isWidgetEditorOpen()) {
      console.log('Widget Editor already open, loading widget in preview mode')
      // Notify existing widget editor to load widget in view mode
      document.dispatchEvent(new CustomEvent('loadWidgetInEditor', {
        detail: {
          widget: JSON.parse(JSON.stringify(widget)), // Deep clone to avoid reference issues
          editMode: false
        }
      }))
    } else {
      console.log('Opening new Widget Editor and loading widget in preview mode')
      // Open new widget editor instance with the widget in view mode
      addComponent({
        id: `widget-editor-${Date.now()}`,
        name: `Widget Editor - ${widget.name}`,
        component: "WidgetEditor",
        customProps: {
          loadWidget: widget,
          initialEditMode: false
        }
      })
    }
  }
  
  // Edit a widget
  const editWidget = (widget: CustomWidget) => {
    // Always close the widget management modal first
    closeWidgetManagement()
    
    if (isWidgetEditorOpen()) {
      console.log('Widget Editor already open, loading widget in edit mode')
      // Notify existing widget editor to load widget in edit mode
      document.dispatchEvent(new CustomEvent('loadWidgetInEditor', {
        detail: {
          widget: JSON.parse(JSON.stringify(widget)), // Deep clone to avoid reference issues
          editMode: true
        }
      }))
    } else {
      console.log('Opening new Widget Editor and loading widget in edit mode')
      // Open new widget editor instance with the widget in edit mode
      addComponent({
        id: `widget-editor-${Date.now()}`,
        name: `Widget Editor - ${widget.name}`,
        component: "WidgetEditor",
        customProps: {
          loadWidget: widget,
          initialEditMode: true
        }
      })
    }
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
    deleteWidget
  }
}

export default useWidgetManager 