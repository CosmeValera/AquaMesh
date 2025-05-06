import { useState, useEffect } from 'react'
import { useLayout } from '../../Layout/LayoutProvider'
import { useDashboards } from '../../Dasboard/DashboardProvider'
import WidgetStorage, { CustomWidget } from '../WidgetStorage'

// Custom hook for widget management
export const useWidgetManager = () => {
  // State for widget management modal
  const [isWidgetManagementOpen, setIsWidgetManagementOpen] = useState(false)
  const [widgets, setWidgets] = useState<CustomWidget[]>([])
  
  // Layout context to add widget editor component
  const { addComponent } = useLayout()
  
  // Dashboards context to manage dashboards
  const { addDashboard, openDashboards } = useDashboards()
  
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
  
  // Check if there are any open dashboards
  const hasOpenDashboards = (): boolean => {
    return openDashboards.length > 0
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
  
  // Helper function to ensure there's a dashboard before adding a component
  const ensureDashboardAndAddComponent = (componentConfig: {
    id: string;
    name: string;
    component: string;
    customProps?: Record<string, unknown>;
  }) => {
    // Check if there are any open dashboards
    if (!hasOpenDashboards()) {
      // Create a new dashboard if none exists
      addDashboard()
      // Short delay to ensure the dashboard is created before adding the component
      setTimeout(() => {
        addComponent(componentConfig)
      }, 100)
    } else {
      // If dashboards already exist, add the component directly
      addComponent(componentConfig)
    }
  }
  
  // Open a new widget editor without loading any widget
  const openWidgetEditor = async () => {
    // Always close the widget management modal first if it's open
    if (isWidgetManagementOpen) {
      closeWidgetManagement()
    }
    
    // Use the ensureDashboardAndAddComponent function to properly handle dashboard creation
    ensureDashboardAndAddComponent({
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
      // Notify existing widget editor to load widget in view mode
      document.dispatchEvent(new CustomEvent('loadWidgetInEditor', {
        detail: {
          widget: JSON.parse(JSON.stringify(widget)), // Deep clone to avoid reference issues
          editMode: false
        }
      }))
    } else {
      
      // Use the ensureDashboardAndAddComponent approach to open a new Widget Editor
      ensureDashboardAndAddComponent({
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
      // Notify existing widget editor to load widget in edit mode
      document.dispatchEvent(new CustomEvent('loadWidgetInEditor', {
        detail: {
          widget: JSON.parse(JSON.stringify(widget)), // Deep clone to avoid reference issues
          editMode: true
        }
      }))
    } else {
      
      // Use the ensureDashboardAndAddComponent approach to open a new Widget Editor
      ensureDashboardAndAddComponent({
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
    hasOpenDashboards,
    ensureDashboardAndAddComponent
  }
}

export default useWidgetManager 