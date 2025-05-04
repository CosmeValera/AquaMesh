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
  const [showComponentPaletteHelp, setShowComponentPaletteHelp] = useState<boolean>(() => {
    const savedValue = localStorage.getItem('widget-editor-show-palette-help')
    return savedValue ? JSON.parse(savedValue) : true
  })

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
    localStorage.setItem('widget-editor-show-palette-help', JSON.stringify(showComponentPaletteHelp))
  }, [showComponentPaletteHelp])

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
      
      // Open widget list with Ctrl+O
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        setShowWidgetList(true)
      }
      
      // Open settings with Ctrl+, (comma)
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setShowSettingsModal(true)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [widgetData]) // Depend on widgetData to ensure handleSaveWidget has the latest data

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
        severity: 'info'
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
      // Find if we already have a widget with this name to replace
      const existingWidget = savedWidgets.find(w => w.name === widgetData.name)
      
      if (existingWidget) {
        WidgetStorage.updateWidget(existingWidget.id, {
          name: widgetData.name,
          components: widgetData.components
        })
        
        setNotification({
          open: true,
          message: `Widget "${widgetData.name}" updated successfully`,
          severity: 'success'
        })
      } else {
        WidgetStorage.saveWidget({
          name: widgetData.name,
          components: widgetData.components
        })
        
        setNotification({
          open: true,
          message: `Widget "${widgetData.name}" saved successfully`,
          severity: 'success'
        })
      }
      
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
    setWidgetData({
      name: widget.name,
      components: widget.components
    })
    
    setShowWidgetList(false)
    
    // Set editor mode based on the passed parameter (true = edit mode, false = preview mode)
    // If no parameter is provided, maintain current mode
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
    setWidgetToDelete(id)
    setDeleteConfirmOpen(true)
  }
  
  // Actual delete widget function
  const confirmDeleteSavedWidget = () => {
    if (widgetToDelete) {
      WidgetStorage.deleteWidget(widgetToDelete)
      
      setSavedWidgets(WidgetStorage.getAllWidgets())
      
      setNotification({
        open: true,
        message: 'Widget deleted',
        severity: 'info'
      })
      
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
    showComponentPaletteHelp,
    setShowComponentPaletteHelp,
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
    
    // Utility
    setEditDialogOpen,
    setCurrentEditComponent,
  }
} 