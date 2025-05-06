// Utility class to manage custom widget storage and retrieval
import { WIDGET_STORAGE_UPDATED } from '../../customHooks/useTopNavBarWidgets'

interface ComponentData {
  id: string
  type: string
  props: Record<string, unknown>
  children?: ComponentData[]
  parentId?: string
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
      components: widget.components && Array.isArray(widget.components) ? 
        [...widget.components] : [], // Ensure we have a proper array by creating a copy
      createdAt: now,
      updatedAt: now
    }
    
    // Add to the list and save
    widgets.push(newWidget)
    this.saveToLocalStorage(widgets)
    
    // Dispatch event to notify other components
    document.dispatchEvent(new CustomEvent(WIDGET_STORAGE_UPDATED))
    
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
      // Ensure components is a proper array if it's being updated
      ...(updates.components ? { components: [...updates.components] } : {}),
      updatedAt: new Date().toISOString()
    }
    
    widgets[index] = updatedWidget
    this.saveToLocalStorage(widgets)
    
    // Dispatch event to notify other components
    document.dispatchEvent(new CustomEvent(WIDGET_STORAGE_UPDATED))
    
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
    
    this.saveToLocalStorage(newWidgets)
    
    // Dispatch event to notify other components
    document.dispatchEvent(new CustomEvent(WIDGET_STORAGE_UPDATED))
    
    return true
  }
  
  /**
   * Save widgets to localStorage with proper JSON handling
   */
  private saveToLocalStorage(widgets: CustomWidget[]): void {
    try {
      const serialized = JSON.stringify(widgets)
      localStorage.setItem(STORAGE_KEY, serialized)
      // console.log('Saved widgets to localStorage:', widgets)
    } catch (error) {
      console.error('Failed to save widgets to localStorage:', error)
    }
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
      const parsed = JSON.parse(stored)
      // Validate the parsed data
      if (!Array.isArray(parsed)) {
        console.error('Stored widgets is not an array')
        return []
      }
      
      // Validate each widget has required properties
      return parsed.map(widget => ({
        id: widget.id || `widget-${Date.now()}`,
        name: widget.name || 'Unnamed Widget',
        components: Array.isArray(widget.components) ? widget.components : [],
        createdAt: widget.createdAt || new Date().toISOString(),
        updatedAt: widget.updatedAt || new Date().toISOString()
      }))
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
    const widget = widgets.find(w => w.id === id)
    
    if (!widget) {
      return null
    }
    
    // Ensure components is a proper array
    return {
      ...widget,
      components: Array.isArray(widget.components) ? widget.components : []
    }
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
      
      this.saveToLocalStorage(widgets)
      return true
    } catch (error) {
      console.error('Failed to import widgets', error)
      return false
    }
  }
}

// Export a singleton instance
export default new WidgetStorage() 