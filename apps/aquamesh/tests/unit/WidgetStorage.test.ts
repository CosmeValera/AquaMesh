import { describe, it, expect, beforeEach, vi } from 'vitest'
import WidgetStorage, { CustomWidget } from '../../src/components/WidgetEditor/WidgetStorage'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    clear: () => {
      store = {}
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  }
})()

// Mock CustomEvent
// @ts-expect-error CustomEvent not defined in window
window.CustomEvent = vi.fn().mockImplementation((event, options) => ({
  event,
  ...options,
}))

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock document.dispatchEvent
document.dispatchEvent = vi.fn()

describe('WidgetStorage', () => {
  let widgetStorage: typeof WidgetStorage
  let sampleWidget: Omit<CustomWidget, 'id' | 'createdAt' | 'updatedAt'>
  
  beforeEach(() => {
    // Reset localStorage before each test
    localStorageMock.clear()
    
    // Reset the mocks
    vi.clearAllMocks()
    
    // Get a fresh instance
    widgetStorage = WidgetStorage
    
    // Create a sample widget for testing
    sampleWidget = {
      name: 'Test Widget',
      components: [
        {
          id: 'comp-1',
          type: 'TextField',
          props: { label: 'Test Field' },
        },
      ],
      category: 'Test',
      tags: ['test'],
      description: 'A test widget',
      version: '1.0',
      author: 'Test User',
    }
  })
  
  it('should save a widget', () => {
    const savedWidget = widgetStorage.saveWidget(sampleWidget)
    
    expect(savedWidget).toHaveProperty('id')
    expect(savedWidget.name).toBe('Test Widget')
    expect(savedWidget.components).toHaveLength(1)
    expect(savedWidget.components[0].id).toBe('comp-1')
    expect(document.dispatchEvent).toHaveBeenCalled()
  })
  
  it('should get all widgets', () => {
    // Save two widgets
    widgetStorage.saveWidget(sampleWidget)
    widgetStorage.saveWidget({
      ...sampleWidget,
      name: 'Second Widget',
    })
    
    const allWidgets = widgetStorage.getAllWidgets()
    
    expect(allWidgets).toHaveLength(2)
    expect(allWidgets[0].name).toBe('Test Widget')
    expect(allWidgets[1].name).toBe('Second Widget')
  })
  
  it('should get a widget by id', () => {
    const savedWidget = widgetStorage.saveWidget(sampleWidget)
    
    const retrievedWidget = widgetStorage.getWidgetById(savedWidget.id)
    
    expect(retrievedWidget).not.toBeNull()
    expect(retrievedWidget?.name).toBe('Test Widget')
  })
  
  it('should update a widget', () => {
    const savedWidget = widgetStorage.saveWidget(sampleWidget)
    
    const updatedWidget = widgetStorage.updateWidget(savedWidget.id, {
      name: 'Updated Widget',
      components: [
        {
          id: 'comp-1',
          type: 'TextField',
          props: { label: 'Updated Field' },
        },
      ],
    })
    
    expect(updatedWidget).not.toBeNull()
    expect(updatedWidget?.name).toBe('Updated Widget')
    expect(updatedWidget?.components[0].props.label).toBe('Updated Field')
    expect(updatedWidget?.version).toBe('1.1') // Minor version increment
  })
  
  it('should create a version when updating a widget', () => {
    const savedWidget = widgetStorage.saveWidget(sampleWidget)
    
    widgetStorage.updateWidget(savedWidget.id, {
      components: [
        {
          id: 'comp-2',
          type: 'Button',
          props: { label: 'New Button' },
        },
      ],
    })
    
    const versions = widgetStorage.getWidgetVersions(savedWidget.id)
    
    expect(versions.length).toBeGreaterThan(0)
    // Two versions: initial save creates v1.0, update creates v1.1
    expect(versions).toHaveLength(2)
  })
  
  it('should delete a widget', () => {
    const savedWidget = widgetStorage.saveWidget(sampleWidget)
    
    const result = widgetStorage.deleteWidget(savedWidget.id)
    
    expect(result).toBe(true)
    expect(widgetStorage.getWidgetById(savedWidget.id)).toBeNull()
  })
  
  it('should search widgets by query', () => {
    widgetStorage.saveWidget(sampleWidget)
    widgetStorage.saveWidget({
      ...sampleWidget,
      name: 'Another Widget',
      description: 'Different description',
    })
    
    const results = widgetStorage.searchWidgets('test')
    
    expect(results).toHaveLength(2)
    
    const narrowResults = widgetStorage.searchWidgets('another')
    
    expect(narrowResults).toHaveLength(1)
    expect(narrowResults[0].name).toBe('Another Widget')
  })
  
  it('should export and import widgets', () => {
    widgetStorage.saveWidget(sampleWidget)
    
    const exportedJson = widgetStorage.exportWidgets()
    
    // Clear storage
    localStorageMock.clear()
    
    expect(widgetStorage.getAllWidgets()).toHaveLength(0)
    
    // Import the widgets
    const importResult = widgetStorage.importWidgets(exportedJson)
    
    expect(importResult).toBe(true)
    expect(widgetStorage.getAllWidgets()).toHaveLength(1)
    expect(widgetStorage.getAllWidgets()[0].name).toBe('Test Widget')
  })
}) 