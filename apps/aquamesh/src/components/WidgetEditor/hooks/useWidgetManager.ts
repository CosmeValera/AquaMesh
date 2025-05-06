import { useState, useEffect } from 'react'
import { useLayout } from '../../Layout/LayoutProvider'
import { useViews } from '../../Views/ViewsProvider'
import WidgetStorage, { CustomWidget } from '../WidgetStorage'

// Custom hook for widget management
export const useWidgetManager = () => {
  // State for widget management modal
  const [isWidgetManagementOpen, setIsWidgetManagementOpen] = useState(false)
  const [widgets, setWidgets] = useState<CustomWidget[]>([])
  
  // Layout context to add widget editor component
  const { addComponent } = useLayout()
  
  // Views context to manage dashboards
  const { addView, openViews } = useViews()
  
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
  
  // Check if there are any open views/dashboards
  const hasOpenViews = (): boolean => {
    return openViews.length > 0
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
  
  // Helper function to ensure there's a view before adding a component
  const ensureViewAndAddComponent = (componentConfig: {
    id: string;
    name: string;
    component: string;
    customProps?: Record<string, unknown>;
  }) => {
    // Check if there are any open views (dashboards)
    if (!hasOpenViews()) {
      // If no views exist, create a default dashboard first
      addView()
      // Short delay to ensure the view is created before adding the component
      setTimeout(() => {
        addComponent(componentConfig)
      }, 100)
    } else {
      // If views already exist, add the component directly
      addComponent(componentConfig)
    }
  }
  
  // Open a new widget editor without loading any widget
  const openWidgetEditor = async () => {
    // Always close the widget management modal first if it's open
    if (isWidgetManagementOpen) {
      closeWidgetManagement()
    }
    
    // Use the ensureViewAndAddComponent function to properly handle view creation
    ensureViewAndAddComponent({
      id: `widget-editor-${Date.now()}`,
      name: "Widget Editor",
      component: "WidgetEditor"
    })
    
    // Return a promise that resolves after the widget editor is opened
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
      }, 300)
    })
  }
  
  // Preview a widget
  const previewWidget = async (widget: CustomWidget) => {
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
      console.log('No Widget Editor open. Opening new Widget Editor and loading widget in preview mode')
      
      // Use the ensureViewAndAddComponent approach to open a new Widget Editor
      ensureViewAndAddComponent({
        id: `widget-editor-${Date.now()}`,
        name: `Widget Editor - ${widget.name}`,
        component: "WidgetEditor"
      })
      
      // Wait for a moment to ensure Widget Editor is initialized
      setTimeout(() => {
        // Then load the widget in preview mode
        document.dispatchEvent(new CustomEvent('loadWidgetInEditor', {
          detail: {
            widget: JSON.parse(JSON.stringify(widget)), // Deep clone to avoid reference issues
            editMode: false
          }
        }))
      }, 500)
    }
  }
  
  // Edit a widget
  const editWidget = async (widget: CustomWidget) => {
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
      console.log('No Widget Editor open. Opening new Widget Editor and loading widget in edit mode')
      
      // Use the ensureViewAndAddComponent approach to open a new Widget Editor
      ensureViewAndAddComponent({
        id: `widget-editor-${Date.now()}`,
        name: `Widget Editor - ${widget.name}`,
        component: "WidgetEditor"
      })
      
      // Wait for a moment to ensure Widget Editor is initialized
      setTimeout(() => {
        // Then load the widget in edit mode
        document.dispatchEvent(new CustomEvent('loadWidgetInEditor', {
          detail: {
            widget: JSON.parse(JSON.stringify(widget)), // Deep clone to avoid reference issues
            editMode: true
          }
        }))
      }, 500)
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
    deleteWidget,
    isWidgetEditorOpen,
    openWidgetEditor,
    hasOpenViews,
    ensureViewAndAddComponent
  }
}

export default useWidgetManager 