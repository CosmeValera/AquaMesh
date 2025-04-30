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

const useTopNavBarWidgets = () => {
  const [topNavBarWidgets, setTopNavBarWidgets] = useState<Panel[]>([])

  useEffect(() => {
    // Fetch built-in widgets from configuration
    fetch('/config/widgets.json')
      .then(response => response.json())
      .then(data => {
        // Get custom widgets from storage
        const customWidgets = WidgetStorage.getAllWidgets()
        
        // Create a new panel for custom widgets if there are any
        if (customWidgets.length > 0) {
          const customWidgetsPanel: Panel = {
            name: "Custom Widgets",
            items: customWidgets.map((widget: CustomWidget) => ({
              name: widget.name,
              component: "CustomWidget",
              url: "", // Local component, no remote URL
              customProps: {
                widgetId: widget.id,
                components: widget.components
              }
            }))
          }
          
          // Add the custom widgets panel to the list
          setTopNavBarWidgets([...data, customWidgetsPanel])
        } else {
          setTopNavBarWidgets(data)
        }
      })
      .catch(error => console.error('Error fetching widgets.json:', error))
  }, [])

  return { topNavBarWidgets }
}

export default useTopNavBarWidgets
