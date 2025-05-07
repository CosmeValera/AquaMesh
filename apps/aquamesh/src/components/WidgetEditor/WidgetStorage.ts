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
  category?: string
  tags?: string[]
  description?: string
  version?: string
  author?: string
}

export interface WidgetVersion {
  id: string
  widgetId: string
  version: string
  components: ComponentData[]
  createdAt: string
  notes?: string
  isCurrent?: boolean
}

// Preset widget categories
export const WIDGET_CATEGORIES = [
  'Dashboard',
  'Form',
  'Status',
  'Chart',
  'Administration',
  'User Interface',
  'Navigation',
  'Data Entry',
  'System',
  'Other'
]

const STORAGE_KEY = 'aquamesh_custom_widgets'
const VERSION_STORAGE_KEY = 'aquamesh_widget_versions'

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
      updatedAt: now,
      category: widget.category || 'Other',
      tags: widget.tags || [],
      description: widget.description || '',
      version: widget.version || '1.0',
      author: widget.author || ''
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

    // Only create a version if there are actual changes to components
    if (updates.components) {
      const currentComponentsJSON = JSON.stringify(widgets[index].components)
      const newComponentsJSON = JSON.stringify(updates.components)
      
      // Only create version if the components have actually changed
      if (currentComponentsJSON !== newComponentsJSON) {
        this.createWidgetVersion(widgets[index])
      }
    }
    
    // Increment version number if components are being updated
    let nextVersion = widgets[index].version || '1.0'
    if (updates.components) {
      // Check if this is a restore operation by comparing with existing versions
      const isRestoreOperation = updates.version !== undefined
      
      if (!isRestoreOperation) {
        // Parse current version and increment
        const versionParts = nextVersion.split('.')
        if (versionParts.length >= 2) {
          const major = parseInt(versionParts[0], 10)
          const minor = parseInt(versionParts[1], 10) + 1
          nextVersion = `${major}.${minor}`
        } else {
          nextVersion = '1.1' // Default increment if parsing fails
        }
      } else if (updates.version) {
        // Use the provided version during a restore operation
        nextVersion = updates.version
      }
    }
    
    // Update the widget
    const updatedWidget = {
      ...widgets[index],
      ...updates,
      // Ensure components is a proper array if it's being updated
      ...(updates.components ? { components: [...updates.components] } : {}),
      updatedAt: new Date().toISOString(),
      version: nextVersion
    }
    
    widgets[index] = updatedWidget
    this.saveToLocalStorage(widgets)
    
    // Dispatch event to notify other components
    document.dispatchEvent(new CustomEvent(WIDGET_STORAGE_UPDATED))
    
    return updatedWidget
  }
  
  /**
   * Create a version record for a widget
   */
  createWidgetVersion(widget: CustomWidget, notes: string = ''): WidgetVersion {
    const versions = this.getAllWidgetVersions()
    
    // Check if an identical version already exists
    const existingVersion = versions.find(v => 
      v.widgetId === widget.id && 
      v.version === widget.version && 
      JSON.stringify(v.components) === JSON.stringify(widget.components)
    )
    
    if (existingVersion) {
      return existingVersion
    }
    
    const version: WidgetVersion = {
      id: `version-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      widgetId: widget.id,
      version: widget.version || '1.0',
      components: widget.components ? [...widget.components] : [],
      createdAt: new Date().toISOString(),
      notes
    }
    
    versions.push(version)
    this.saveVersionsToLocalStorage(versions)
    
    return version
  }
  
  /**
   * Get all versions for a specific widget
   */
  getWidgetVersions(widgetId: string): WidgetVersion[] {
    const versions = this.getAllWidgetVersions()
    
    // Return versions for the specific widget, sorted by creation date (newest first)
    return versions
      .filter(v => v.widgetId === widgetId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
  
  /**
   * Get all widget versions
   */
  getAllWidgetVersions(): WidgetVersion[] {
    const stored = localStorage.getItem(VERSION_STORAGE_KEY)
    if (!stored) {
      return []
    }
    
    try {
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error('Failed to parse stored widget versions', error)
      return []
    }
  }
  
  /**
   * Save versions to localStorage
   */
  private saveVersionsToLocalStorage(versions: WidgetVersion[]): void {
    try {
      const serialized = JSON.stringify(versions)
      localStorage.setItem(VERSION_STORAGE_KEY, serialized)
    } catch (error) {
      console.error('Failed to save widget versions to localStorage:', error)
    }
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
        updatedAt: widget.updatedAt || new Date().toISOString(),
        category: widget.category || 'Other',
        tags: Array.isArray(widget.tags) ? widget.tags : [],
        description: widget.description || '',
        version: widget.version || '1.0',
        author: widget.author || ''
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
   * Get widgets by category
   */
  getWidgetsByCategory(category: string): CustomWidget[] {
    const widgets = this.getAllWidgets()
    return widgets.filter(w => w.category === category)
  }
  
  /**
   * Get widgets by tag
   */
  getWidgetsByTag(tag: string): CustomWidget[] {
    const widgets = this.getAllWidgets()
    return widgets.filter(w => w.tags && w.tags.includes(tag))
  }
  
  /**
   * Get all used categories from widgets
   */
  getAllCategories(): string[] {
    const widgets = this.getAllWidgets()
    const categories = new Set<string>()
    
    // Add all preset categories
    WIDGET_CATEGORIES.forEach(cat => categories.add(cat))
    
    // Add any custom categories that may have been added
    widgets.forEach(widget => {
      if (widget.category) {
        categories.add(widget.category)
      }
    })
    
    return Array.from(categories)
  }
  
  /**
   * Get all used tags from widgets
   */
  getAllTags(): string[] {
    const widgets = this.getAllWidgets()
    const tags = new Set<string>()
    
    widgets.forEach(widget => {
      if (widget.tags && Array.isArray(widget.tags)) {
        widget.tags.forEach(tag => tags.add(tag))
      }
    })
    
    return Array.from(tags)
  }
  
  /**
   * Search widgets by name, description, category, or tags
   */
  searchWidgets(query: string): CustomWidget[] {
    if (!query || query.trim() === '') {
      return this.getAllWidgets()
    }
    
    const searchTerm = query.toLowerCase().trim()
    const widgets = this.getAllWidgets()
    
    return widgets.filter(widget => {
      // Search in name
      if (widget.name.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      // Search in description
      if (widget.description && widget.description.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      // Search in category
      if (widget.category && widget.category.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      // Search in tags
      if (widget.tags && Array.isArray(widget.tags)) {
        for (const tag of widget.tags) {
          if (tag.toLowerCase().includes(searchTerm)) {
            return true
          }
        }
      }
      
      return false
    })
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