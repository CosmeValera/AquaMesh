// Utility class to manage custom widget storage and retrieval
interface ComponentData {
  id: string
  type: string
  props: Record<string, unknown>
  children?: string
}

export interface CustomWidget {
  id: string
  name: string
  components: ComponentData[]
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'aquamesh_custom_widgets'

/**
 * Storage utility for custom widgets
 */
class WidgetStorage {
  /**
   * Save a new custom widget or update an existing one
   */
  saveWidget(widget: Omit<CustomWidget, 'id' | 'createdAt' | 'updatedAt'>): CustomWidget {
    const widgets = this.getAllWidgets()
    
    // Create a new widget with ID and timestamps
    const now = new Date().toISOString()
    const newWidget: CustomWidget = {
      id: `widget-${Date.now()}`,
      name: widget.name,
      components: widget.components,
      createdAt: now,
      updatedAt: now
    }
    
    // Add to the list and save
    widgets.push(newWidget)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
    
    return newWidget
  }
  
  /**
   * Update an existing widget
   */
  updateWidget(id: string, updates: Partial<Omit<CustomWidget, 'id' | 'createdAt'>>): CustomWidget | null {
    const widgets = this.getAllWidgets()
    const index = widgets.findIndex(w => w.id === id)
    
    if (index === -1) {
      return null
    }
    
    // Update the widget
    const updatedWidget = {
      ...widgets[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    widgets[index] = updatedWidget
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
    
    return updatedWidget
  }
  
  /**
   * Delete a widget
   */
  deleteWidget(id: string): boolean {
    const widgets = this.getAllWidgets()
    const newWidgets = widgets.filter(w => w.id !== id)
    
    if (newWidgets.length === widgets.length) {
      return false
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newWidgets))
    return true
  }
  
  /**
   * Get all custom widgets
   */
  getAllWidgets(): CustomWidget[] {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return []
    }
    
    try {
      return JSON.parse(stored)
    } catch (error) {
      console.error('Failed to parse stored widgets', error)
      return []
    }
  }
  
  /**
   * Get a widget by ID
   */
  getWidgetById(id: string): CustomWidget | null {
    const widgets = this.getAllWidgets()
    return widgets.find(w => w.id === id) || null
  }
  
  /**
   * Export widgets to a JSON file
   */
  exportWidgets(): string {
    const widgets = this.getAllWidgets()
    return JSON.stringify(widgets, null, 2)
  }
  
  /**
   * Import widgets from a JSON string
   */
  importWidgets(json: string): boolean {
    try {
      const widgets = JSON.parse(json)
      if (!Array.isArray(widgets)) {
        return false
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
      return true
    } catch (error) {
      console.error('Failed to import widgets', error)
      return false
    }
  }
}

// Export a singleton instance
export default new WidgetStorage() 