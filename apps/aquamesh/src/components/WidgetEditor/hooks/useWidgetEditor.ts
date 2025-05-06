import { useState, useRef, useEffect } from 'react'
import React from 'react'
import { ComponentData, WidgetData, DropTarget, NotificationSeverity } from '../types/types'
import { COMPONENT_TYPES } from '../constants/componentTypes'
import { 
  findComponentById, 
  updateComponentById, 
  removeComponentById, 
  moveComponent,
} from '../utils/componentUtils'
import WidgetStorage, { CustomWidget } from '../WidgetStorage'

// Maximum history states to keep
const MAX_HISTORY_STATES = 50

// Debounce delay for name changes in milliseconds
const NAME_CHANGE_DEBOUNCE_DELAY = 750

// Interface for tracking widget history
interface WidgetHistoryItem extends WidgetData {
  widgetId?: string // Optional ID to identify the source widget
}

/**
 * Custom hook for managing widget editor state and logic
 */
export const useWidgetEditor = () => {
  // Widget data and editor state
  const [widgetData, setWidgetData] = useState<WidgetData>({
    name: 'New Widget',
    components: [],
  })
  const [editMode, setEditMode] = useState(true)
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as NotificationSeverity,
  })
  
  // Saved widgets management
  const [savedWidgets, setSavedWidgets] = useState<CustomWidget[]>([])
  const [showWidgetList, setShowWidgetList] = useState(false)
  
  // Component editing
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [currentEditComponent, setCurrentEditComponent] = useState<ComponentData | null>(null)
  
  // Confirmation dialogs for deletion
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [componentToDelete, setComponentToDelete] = useState<string | null>(null)
  const [widgetToDelete, setWidgetToDelete] = useState<string | null>(null)
  
  // Drag and drop state
  const [dropTarget, setDropTarget] = useState<DropTarget>({ id: null, isHovering: false })
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // Settings state
  const [stayOpen, setStayOpen] = useState<boolean>(() => {
    const savedValue = localStorage.getItem('widget-editor-stay-open')
    return savedValue ? JSON.parse(savedValue) : true
  })
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showTooltips, setShowTooltips] = useState<boolean>(() => {
    const savedValue = localStorage.getItem('widget-editor-show-tooltips')
    return savedValue ? JSON.parse(savedValue) : true
  })
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(() => {
    const savedValue = localStorage.getItem('widget-editor-delete-confirmation')
    return savedValue ? JSON.parse(savedValue) : true
  })
  const [showDeleteWidgetConfirmation, setShowDeleteWidgetConfirmation] = useState<boolean>(() => {
    const savedValue = localStorage.getItem('widget-editor-delete-widget-confirmation')
    return savedValue ? JSON.parse(savedValue) : true
  })
  const [showComponentPaletteHelp, setShowComponentPaletteHelp] = useState<boolean>(() => {
    const savedValue = localStorage.getItem('widget-editor-show-palette-help')
    return savedValue ? JSON.parse(savedValue) : true
  })

  // Dashboard deletion confirmation setting
  const [showDeleteDashboardConfirmation, setShowDeleteDashboardConfirmation] = useState<boolean>(() => {
    const savedValue = localStorage.getItem('widget-editor-delete-dashboard-confirmation')
    return savedValue ? JSON.parse(savedValue) : true
  })

  // History states for undo/redo functionality
  const [history, setHistory] = useState<WidgetHistoryItem[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false)
  
  // Ref for tracking the name change timeout
  const nameChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Flag to prevent recording history for widget name changes
  const [isChangingName, setIsChangingName] = useState(false)
  
  // Current active widget ID for history tracking between widgets
  const [currentWidgetId, setCurrentWidgetId] = useState<string | undefined>(undefined)

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('widget-editor-stay-open', JSON.stringify(stayOpen))
  }, [stayOpen])
  
  useEffect(() => {
    localStorage.setItem('widget-editor-show-tooltips', JSON.stringify(showTooltips))
  }, [showTooltips])
  
  useEffect(() => {
    localStorage.setItem('widget-editor-delete-confirmation', JSON.stringify(showDeleteConfirmation))
  }, [showDeleteConfirmation])
  
  useEffect(() => {
    localStorage.setItem('widget-editor-delete-widget-confirmation', JSON.stringify(showDeleteWidgetConfirmation))
  }, [showDeleteWidgetConfirmation])
  
  useEffect(() => {
    localStorage.setItem('widget-editor-show-palette-help', JSON.stringify(showComponentPaletteHelp))
  }, [showComponentPaletteHelp])

  useEffect(() => {
    localStorage.setItem('widget-editor-delete-dashboard-confirmation', JSON.stringify(showDeleteDashboardConfirmation))
  }, [showDeleteDashboardConfirmation])

  // Record widget data changes to history
  useEffect(() => {
    // Skip recording if this change was from an undo/redo action
    if (isUndoRedoAction) {
      setIsUndoRedoAction(false)
      console.log('Skipping history recording - undo/redo action')
      return
    }
    
    // Skip recording if we're in the middle of changing the widget name
    if (isChangingName) {
      console.log('Skipping history recording - name change in progress')
      return
    }

    // Skip recording if the widget data hasn't meaningfully changed
    // This helps prevent duplicate entries when loading widgets or undoing/redoing
    if (history.length > 0 && historyIndex >= 0) {
      const currentHistoryItem = history[historyIndex]
      
      // Compare current widget name and ID to prevent duplicates when switching widgets
      if (currentHistoryItem?.name === widgetData.name && 
          currentHistoryItem?.widgetId === currentWidgetId) {
        
        // For deeper comparison, check if components are equivalent
        // We need to handle when the histories are equal and no need to record
        const currentComponents = JSON.stringify(currentHistoryItem.components)
        const newComponents = JSON.stringify(widgetData.components)
        
        if (currentComponents === newComponents) {
          console.log('Skipping history recording - no meaningful change')
          return
        }
      }
    }

    // Deep clone the widget data to ensure history separation
    const stateToSave: WidgetHistoryItem = {
      ...JSON.parse(JSON.stringify(widgetData)),
      widgetId: currentWidgetId
    }
    
    // If we're in the middle of the history and make a change,
    // we should truncate the future history
    if (historyIndex >= 0 && historyIndex < history.length - 1) {
      const newHistory = history.slice(0, historyIndex + 1)
      setHistory([...newHistory, stateToSave])
      setHistoryIndex(historyIndex + 1)
    } else {
      // Normal case: add to history and increment index
      setHistory(prev => {
        // Limit history size by removing oldest states if needed
        const newHistory = prev.length >= MAX_HISTORY_STATES 
          ? [...prev.slice(prev.length - MAX_HISTORY_STATES + 1), stateToSave] 
          : [...prev, stateToSave]
        return newHistory
      })
      setHistoryIndex(prev => prev + 1)
    }
  }, [widgetData, currentWidgetId, isChangingName])

  // Handler for widget name changes with debouncing
  const handleWidgetNameChange = (newName: string) => {
    // Mark that we're changing the name - prevents history recording during typing
    setIsChangingName(true)
    
    // Update widget data with new name immediately for UI responsiveness
    setWidgetData(prev => ({
      ...prev,
      name: newName
    }))
    
    // Clear any existing timeout
    if (nameChangeTimeoutRef.current) {
      clearTimeout(nameChangeTimeoutRef.current)
    }
    
    // Set a new timeout to record history after typing stops
    nameChangeTimeoutRef.current = setTimeout(() => {
      setIsChangingName(false)
      // This will trigger the useEffect above after the debounce period
      // which will record the name change in history
    }, NAME_CHANGE_DEBOUNCE_DELAY)
  }
  
  // Clean up the timeout on component unmount
  useEffect(() => {
    return () => {
      if (nameChangeTimeoutRef.current) {
        clearTimeout(nameChangeTimeoutRef.current)
      }
    }
  }, [])

  // Handle undo action
  const handleUndo = () => {
    if (historyIndex > 0) {
      // Already moving back in history
      setIsUndoRedoAction(true)
      
      const prevState = history[historyIndex - 1]
      const newHistoryIndex = historyIndex - 1
      
      // Set current widget ID when undoing to a different widget
      if (prevState.widgetId !== currentWidgetId) {
        // We're undoing to a different widget
        setCurrentWidgetId(prevState.widgetId)
        
        // Find the widget in saved widgets for better messaging
        const targetWidget = savedWidgets.find(w => w.id === prevState.widgetId)
        
        if (targetWidget) {
          setNotification({
            open: true,
            message: `Undid to previous widget: "${targetWidget.name}"`,
            severity: 'info'
          })
        }
      } else {
        // Standard notification for same-widget undo
        setNotification({
          open: true,
          message: 'Undo successful',
          severity: 'info'
        })
      }
      
      // Create a clean version of the state without the widgetId property
      const cleanState = { ...prevState }
      delete cleanState.widgetId
      
      // Set history index before updating widget data to prevent race conditions
      setHistoryIndex(newHistoryIndex)
      
      // Finally update the widget data
      setWidgetData(cleanState)
      
    } else {
      setNotification({
        open: true,
        message: 'Nothing to undo',
        severity: 'info'
      })
    }
  }

  // Handle redo action
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      // Already moving forward in history
      setIsUndoRedoAction(true)
      
      const nextState = history[historyIndex + 1]
      const newHistoryIndex = historyIndex + 1
      
      // Set current widget ID when redoing to a different widget
      if (nextState.widgetId !== currentWidgetId) {
        // We're redoing to a different widget
        setCurrentWidgetId(nextState.widgetId)
        
        // Find the widget in saved widgets for better messaging
        const targetWidget = savedWidgets.find(w => w.id === nextState.widgetId)
        
        if (targetWidget) {
          setNotification({
            open: true,
            message: `Redid to next widget: "${targetWidget.name}"`,
            severity: 'info'
          })
        }
      } else {
        // Standard notification for same-widget redo
        setNotification({
          open: true,
          message: 'Redo successful',
          severity: 'info'
        })
      }
      
      // Create a clean version of the state without the widgetId property
      const cleanState = { ...nextState }
      delete cleanState.widgetId
      
      // Set history index before updating widget data to prevent race conditions
      setHistoryIndex(newHistoryIndex)
      
      // Finally update the widget data
      setWidgetData(cleanState)
      
    } else {
      setNotification({
        open: true,
        message: 'Nothing to redo',
        severity: 'info'
      })
    }
  }

  // Load saved widgets on component mount and listen for widget storage update events
  useEffect(() => {
    // Initial load of saved widgets
    setSavedWidgets(WidgetStorage.getAllWidgets())
    
    // Listen for widget storage updates (when widgets are deleted through TopNavBar)
    const handleWidgetUpdate = () => {
      console.log('WidgetEditor: Widget storage updated, reloading widgets')
      setSavedWidgets(WidgetStorage.getAllWidgets())
    }
    
    // Add event listener for widget storage updates
    document.addEventListener('widgetStorageUpdated', handleWidgetUpdate)
    
    // Clean up event listener on component unmount
    return () => {
      document.removeEventListener('widgetStorageUpdated', handleWidgetUpdate)
    }
  }, [])
  
  // Listen for loadWidgetInEditor events from widget management
  useEffect(() => {
    const handleExternalWidgetLoad = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail && customEvent.detail.widget) {
        const widget = customEvent.detail.widget as CustomWidget
        const shouldEditMode = Boolean(customEvent.detail.editMode)
        
        console.log('WidgetEditor: External widget load request received', {
          widgetName: widget.name,
          editMode: shouldEditMode,
          componentCount: widget.components.length
        })
        
        // Set flag to prevent recording in history
        setIsUndoRedoAction(true)
        
        // Update the current widget ID for history tracking
        setCurrentWidgetId(widget.id)
        
        // Update edit mode
        setEditMode(shouldEditMode)
        
        // Set widget data with deep clone to avoid reference issues
        setWidgetData({
          name: widget.name,
          components: JSON.parse(JSON.stringify(widget.components))
        })
        
        // Show notification
        setNotification({
          open: true,
          message: `Widget "${widget.name}" loaded in ${shouldEditMode ? 'edit' : 'preview'} mode`,
          severity: 'success'
        })
      }
    }
    
    document.addEventListener('loadWidgetInEditor', handleExternalWidgetLoad)
    
    return () => {
      document.removeEventListener('loadWidgetInEditor', handleExternalWidgetLoad)
    }
  }, [])

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save with Ctrl+S
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        handleSaveWidget()
      }
      
      // Toggle edit mode with Ctrl+E
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault()
        toggleEditMode()
      }
      
      // Toggle widget list with Ctrl+O
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        setShowWidgetList(prev => !prev)
      }
      
      // Toggle settings with Ctrl+, (comma)
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setShowSettingsModal(prev => !prev)
      }

      // Undo with Ctrl+Z
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }

      // Redo with Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault()
        handleRedo()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [widgetData, historyIndex, history]) // Dependencies for undo/redo

  // Handle drag start from component palette
  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('componentType', type)
    setIsDragging(true)
  }

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false)
    setDropTarget({ id: null, isHovering: false })
  }

  // Handle drag enter for container components
  const handleContainerDragEnter = (e: React.DragEvent, containerId: string) => {
    e.preventDefault()
    e.stopPropagation() // Prevent event bubbling to parent containers
    
    setDropTarget({
      id: containerId,
      isHovering: true
    })
  }

  // Handle drag leave for container components
  const handleContainerDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    
    // Only clear if we're not entering a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget({ id: null, isHovering: false })
    }
  }

  // Handle drag over for container components
  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  // Handle drop onto a container component
  const handleContainerDrop = (e: React.DragEvent, containerId: string) => {
    e.preventDefault()
    e.stopPropagation() // Prevent event bubbling to parent containers

    const componentType = e.dataTransfer.getData('componentType')
    if (!componentType) { return }

    const componentConfig = COMPONENT_TYPES.find(c => c.type === componentType)
    if (!componentConfig) { return }

    const newComponent: ComponentData = {
      id: `${componentType}-${Date.now()}`,
      type: componentType,
      props: { ...componentConfig.defaultProps },
    }

    // Find the container by ID
    const container = findComponentById(containerId, widgetData.components)
    
    if (container && ['FieldSet', 'FlexBox', 'GridBox'].includes(container.type)) {
      const updatedContainer = {
        ...container,
        children: [...(container.children || []), newComponent]
      }

      setWidgetData(prev => ({
        ...prev,
        components: updateComponentById(containerId, updatedContainer, prev.components)
      }))

      setNotification({
        open: true,
        message: `Added ${componentConfig.label} to ${container.type}`,
        severity: 'success'
      })
    }

    setDropTarget({ id: null, isHovering: false })
    setIsDragging(false)
  }

  // Handle adding component inside a fieldset or container
  const handleAddInsideFieldset = (parentId: string) => {
    // Show component selector or use a default component type
    const componentType = 'Label' // Default component type
    const componentConfig = COMPONENT_TYPES.find(c => c.type === componentType)
    
    if (componentConfig) {
      const newComponent: ComponentData = {
        id: `${componentType}-${Date.now()}`,
        type: componentType,
        props: { ...componentConfig.defaultProps },
      }
      
      const container = findComponentById(parentId, widgetData.components)
      
      if (container) {
        const updatedContainer = {
          ...container,
          children: [...(container.children || []), newComponent]
        }
        
        setWidgetData(prev => ({
          ...prev,
          components: updateComponentById(parentId, updatedContainer, prev.components)
        }))
        
        setNotification({
          open: true,
          message: `Added ${componentConfig.label} inside container`,
          severity: 'success'
        })
      }
    }
  }

  // Handle dropping a component into the main drop area
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    
    const componentType = e.dataTransfer.getData('componentType')
    if (!componentType) { return }
    
    const componentConfig = COMPONENT_TYPES.find(c => c.type === componentType)
    if (!componentConfig) { return }
    
    const newComponent: ComponentData = {
      id: `${componentType}-${Date.now()}`,
      type: componentType,
      props: { ...componentConfig.defaultProps },
    }
    
    setWidgetData(prev => ({
      ...prev,
      components: [...prev.components, newComponent]
    }))
    
    setNotification({
      open: true,
      message: `Added ${componentConfig.label} component`,
      severity: 'success'
    })
    
    setIsDragging(false)
  }

  // Handle drag over for the main drop area
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  // Handle deleting a component
  const handleDeleteComponent = (id: string) => {
    // If delete confirmation is turned off, delete immediately
    if (!showDeleteConfirmation) {
      setWidgetData(prev => ({
        ...prev,
        components: removeComponentById(id, prev.components)
      }))
      
      setNotification({
        open: true,
        message: 'Component deleted',
        severity: 'success'
      })
      return
    }
    
    // Otherwise show confirmation dialog
    setComponentToDelete(id)
    setDeleteConfirmOpen(true)
  }
  
  // Actual delete component function
  const confirmDeleteComponent = () => {
    if (componentToDelete) {
      setWidgetData(prev => ({
        ...prev,
        components: removeComponentById(componentToDelete, prev.components)
      }))
      
      setNotification({
        open: true,
        message: 'Component deleted',
        severity: 'error'
      })
      
      setComponentToDelete(null)
      setDeleteConfirmOpen(false)
    }
  }
  
  // Cancel delete
  const cancelDeleteComponent = () => {
    setComponentToDelete(null)
    setDeleteConfirmOpen(false)
  }

  // Handle editing a component or toggling FieldSet collapsed state
  const handleEditComponent = (id: string) => {
    const component = findComponentById(id, widgetData.components)
    
    if (component) {
      // For FieldSets, clicking edit also toggles the collapsed state
      if (component.type === 'FieldSet') {
        const updatedComponent = {
          ...component,
          props: {
            ...component.props,
            collapsed: !(component.props.collapsed as boolean)
          }
        }
        
        setWidgetData(prev => ({
          ...prev,
          components: updateComponentById(id, updatedComponent, prev.components)
        }))
      } else {
        // For other components, open the edit dialog
        setCurrentEditComponent(component)
        setEditDialogOpen(true)
      }
    }
  }

  // Handle toggling component visibility
  const handleToggleVisibility = (id: string) => {
    const component = findComponentById(id, widgetData.components)
    
    if (component) {
      const updatedComponent = {
        ...component,
        hidden: !component.hidden
      }
      
      setWidgetData(prev => ({
        ...prev,
        components: updateComponentById(id, updatedComponent, prev.components)
      }))
      
      setNotification({
        open: true,
        message: `Component ${component.hidden ? 'shown' : 'hidden'}`,
        severity: 'info'
      })
    }
  }

  // Handle saving edited component
  const handleSaveComponent = (updatedComponent: ComponentData) => {
    setWidgetData(prev => ({
      ...prev,
      components: updateComponentById(updatedComponent.id, updatedComponent, prev.components)
    }))
    
    setEditDialogOpen(false)
    setCurrentEditComponent(null)
  }

  // Handle moving component up/down
  const handleMoveComponent = (id: string, direction: 'up' | 'down') => {
    setWidgetData(prev => ({
      ...prev,
      components: moveComponent(id, direction, prev.components)
    }))
  }

  // Handle saving the widget
  const handleSaveWidget = () => {
    if (!widgetData.name.trim()) {
      setNotification({
        open: true,
        message: 'Please enter a widget name',
        severity: 'error'
      })
      return
    }

    if (widgetData.components.length === 0) {
      setNotification({
        open: true,
        message: 'Cannot save an empty widget',
        severity: 'error'
      })
      return
    }

    try {
      // Always set this flag to prevent save/update operations from being recorded in history
      setIsUndoRedoAction(true)
      
      // Find if we already have a widget with this name to replace
      const existingWidget = savedWidgets.find(w => w.name === widgetData.name)
      
      // Get a copy of the current widget data before saving
      // This prevents triggering history recording based on ID changes
      const widgetToSave = {
        name: widgetData.name,
        components: [...widgetData.components]
      }
      
      let savedWidgetId: string
      
      // Handle updating existing widget
      if (existingWidget) {
        WidgetStorage.updateWidget(existingWidget.id, widgetToSave)
        savedWidgetId = existingWidget.id
        
        setNotification({
          open: true,
          message: `Widget "${widgetData.name}" updated successfully`,
          severity: 'success'
        })
      } 
      // Handle saving new widget
      else {
        const savedWidget = WidgetStorage.saveWidget(widgetToSave)
        savedWidgetId = savedWidget.id
        
        setNotification({
          open: true,
          message: `Widget "${widgetData.name}" saved successfully`,
          severity: 'success'
        })
      }
      
      // Update current widget ID without triggering a re-render of widget data
      // This prevents the ID update from triggering another history recording
      setCurrentWidgetId(prev => {
        if (prev !== savedWidgetId) {
          return savedWidgetId
        }
        return prev
      })
      
      setSavedWidgets(WidgetStorage.getAllWidgets())
    } catch (error) {
      console.error('Failed to save widget:', error)
      setNotification({
        open: true,
        message: 'Failed to save widget',
        severity: 'error'
      })
    }
  }

  // Handle loading a widget
  const handleLoadWidget = (widget: CustomWidget, shouldEnterEditMode?: boolean) => {
    
    // Set flag BEFORE updating any state to prevent duplicate history entries
    setIsUndoRedoAction(true)
    
    // Create the widget history item first
    const widgetHistoryItem: WidgetHistoryItem = {
      name: widget.name,
      components: JSON.parse(JSON.stringify(widget.components)),
      widgetId: widget.id
    }

    // Update the current widget ID for history tracking
    setCurrentWidgetId(widget.id)
    
    // Set widget data
    setWidgetData({
      name: widget.name,
      components: widget.components
    })
    
    // Handle history for loaded widget
    if (history.length === 0) {
      // First widget ever loaded - create new history
      setHistory([widgetHistoryItem])
      setHistoryIndex(0)
    } else {
      // Check if we're loading the same widget as current
      const currentWidget = historyIndex >= 0 && historyIndex < history.length ? 
        history[historyIndex] : null
        
      if (currentWidget && currentWidget.widgetId === widget.id) {
        // We're reloading the same widget - replace current history entry
        const updatedHistory = [...history]
        updatedHistory[historyIndex] = widgetHistoryItem
        setHistory(updatedHistory)
        // Keep same history index
      } else {
        // Loading a different widget - add to history and truncate if needed
        if (historyIndex < history.length - 1) {
          // We're in the middle of history, truncate future entries
          const newHistory = history.slice(0, historyIndex + 1)
          setHistory([...newHistory, widgetHistoryItem])
        } else {
          // We're at the end of history, append
          setHistory(prev => [...prev, widgetHistoryItem])
        }
        // Move to new history position
        setHistoryIndex(prev => prev + 1)
      }
    }
    
    setShowWidgetList(false)
    
    // Set editor mode based on the passed parameter
    if (shouldEnterEditMode !== undefined) {
      setEditMode(shouldEnterEditMode)
    }
    
    setNotification({
      open: true,
      message: `Widget "${widget.name}" loaded in ${shouldEnterEditMode ? 'edit' : 'preview'} mode`,
      severity: 'success'
    })
  }

  // Handle deleting a saved widget
  const handleDeleteSavedWidget = (id: string) => {
    // If delete confirmation is turned off, delete immediately
    if (!showDeleteWidgetConfirmation) {
      const widget = WidgetStorage.getWidgetById(id)
      if (widget) {
        WidgetStorage.deleteWidget(id)
        setSavedWidgets(WidgetStorage.getAllWidgets())
        
        setNotification({
          open: true,
          message: `Widget "${widget.name}" deleted`,
          severity: 'error'
        })
      }
      return
    }
    
    // Otherwise show confirmation dialog
    setWidgetToDelete(id)
    setDeleteConfirmOpen(true)
  }
  
  // Confirm deleting a saved widget
  const confirmDeleteSavedWidget = () => {
    if (widgetToDelete) {
      const widget = WidgetStorage.getWidgetById(widgetToDelete)
      if (widget) {
        WidgetStorage.deleteWidget(widgetToDelete)
        setSavedWidgets(WidgetStorage.getAllWidgets())
        
        setNotification({
          open: true,
          message: `Widget "${widget.name}" deleted`,
          severity: 'error'
        })
      }
      
      setWidgetToDelete(null)
      setDeleteConfirmOpen(false)
    }
  }

  // Handle closing the notification
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false })
  }

  // Toggle edit mode
  const toggleEditMode = () => {
    setEditMode(prev => !prev)
  }

  return {
    // State
    widgetData,
    setWidgetData,
    editMode,
    setEditMode,
    notification,
    savedWidgets,
    showWidgetList,
    setShowWidgetList,
    editDialogOpen,
    currentEditComponent,
    dropTarget,
    dropAreaRef,
    isDragging,
    stayOpen,
    setStayOpen,
    showSettingsModal,
    setShowSettingsModal,
    showTooltips,
    setShowTooltips,
    showDeleteConfirmation,
    setShowDeleteConfirmation,
    showDeleteWidgetConfirmation,
    setShowDeleteWidgetConfirmation,
    showComponentPaletteHelp,
    setShowComponentPaletteHelp,
    showDeleteDashboardConfirmation,
    setShowDeleteDashboardConfirmation,
    deleteConfirmOpen,
    componentToDelete,
    widgetToDelete,
    
    // Event handlers
    handleDragStart,
    handleDragEnd,
    handleContainerDragEnter,
    handleContainerDragLeave,
    handleContainerDragOver,
    handleContainerDrop,
    handleAddInsideFieldset,
    handleDrop,
    handleDragOver,
    handleDeleteComponent,
    handleEditComponent,
    handleSaveComponent,
    handleMoveComponent,
    handleSaveWidget,
    handleLoadWidget,
    handleDeleteSavedWidget,
    handleCloseNotification,
    toggleEditMode,
    handleToggleVisibility,
    confirmDeleteComponent,
    cancelDeleteComponent,
    confirmDeleteSavedWidget,
    
    // History/Undo/Redo
    handleUndo,
    handleRedo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    
    // Utility
    setEditDialogOpen,
    setCurrentEditComponent,
    handleWidgetNameChange,
  }
} 