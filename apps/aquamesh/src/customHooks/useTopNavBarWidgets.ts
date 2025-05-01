import { useState, useEffect } from 'react'
import WidgetStorage, { CustomWidget } from '../components/WidgetEditor/WidgetStorage'

export interface Panel {
  name: string;
  items: Item[];
}

export interface Item {
  name: string;
  component: string;
  url: string;
  customProps: CustomProps;
}

interface CustomProps {
  [key: string]: unknown;
}

// Create a custom event for widget updates
export const WIDGET_STORAGE_UPDATED = 'widgetStorageUpdated'
export const widgetStorageEvent = new CustomEvent(WIDGET_STORAGE_UPDATED)

const useTopNavBarWidgets = () => {
  const [topNavBarWidgets, setTopNavBarWidgets] = useState<Panel[]>([])

  // Helper function to load widgets
  const loadWidgets = () => {
    // Fetch built-in widgets from configuration
    fetch('/config/widgets.json')
      .then(response => response.json())
      .then(data => {
        // Get custom widgets from storage
        const customWidgets = WidgetStorage.getAllWidgets()
        console.log('useTopNavBarWidgets: Loaded custom widgets:', JSON.stringify(customWidgets, null, 2))
        
        // Create a new panel for custom widgets if there are any
        if (customWidgets.length > 0) {
          const customWidgetsPanel: Panel = {
            name: "Custom Widgets",
            items: customWidgets.map((widget: CustomWidget) => {
              // Ensure we have components data
              if (!widget.components || !Array.isArray(widget.components)) {
                console.warn(`Widget ${widget.id} (${widget.name}) has invalid components data`)
              }
              
              return {
                name: widget.name,
                component: "CustomWidget",
                url: "", // Local component, no remote URL
                customProps: {
                  widgetId: widget.id,
                  components: Array.isArray(widget.components) ? widget.components : []
                }
              }
            })
          }
          
          console.log('useTopNavBarWidgets: Created custom widgets panel:', JSON.stringify(customWidgetsPanel, null, 2))
          
          // Add the custom widgets panel to the list
          setTopNavBarWidgets([...data, customWidgetsPanel])
        } else {
          setTopNavBarWidgets(data)
        }
      })
      .catch(error => console.error('Error fetching widgets.json:', error))
  }

  useEffect(() => {
    // Initial load
    loadWidgets()
    
    // Set up event listener for widget storage updates
    const handleWidgetUpdate = () => {
      console.log('useTopNavBarWidgets: Widget storage updated, reloading widgets')
      loadWidgets()
    }
    
    // Add event listener
    document.addEventListener(WIDGET_STORAGE_UPDATED, handleWidgetUpdate)
    
    // Clean up event listener on component unmount
    return () => {
      document.removeEventListener(WIDGET_STORAGE_UPDATED, handleWidgetUpdate)
    }
  }, [])

  return { topNavBarWidgets }
}

export default useTopNavBarWidgets
