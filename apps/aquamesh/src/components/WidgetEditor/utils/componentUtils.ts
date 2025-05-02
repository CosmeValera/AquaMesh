import { ComponentData } from '../types/types'

/**
 * Find a component by ID including nested children
 */
export const findComponentById = (
  id: string,
  components: ComponentData[],
): ComponentData | null => {
  for (const component of components) {
    if (component.id === id) {
      return component
    }

    if (component.children && component.children.length > 0) {
      const found = findComponentById(id, component.children)
      if (found) {
        return found
      }
    }
  }

  return null
}

/**
 * Get parent component containing a specific child
 */
export const findParentComponent = (
  childId: string,
  components: ComponentData[],
): ComponentData | null => {
  for (const component of components) {
    if (component.children?.some((child) => child.id === childId)) {
      return component
    }

    if (component.children && component.children.length > 0) {
      const found = findParentComponent(childId, component.children)
      if (found) {
        return found
      }
    }
  }

  return null
}

/**
 * Update a component in the nested structure
 */
export const updateComponentById = (
  id: string,
  updatedComponent: ComponentData,
  components: ComponentData[],
): ComponentData[] => {
  return components.map((component) => {
    if (component.id === id) {
      return updatedComponent
    }

    if (component.children && component.children.length > 0) {
      return {
        ...component,
        children: updateComponentById(
          id,
          updatedComponent,
          component.children,
        ),
      }
    }

    return component
  })
}

/**
 * Remove a component by ID from the nested structure
 */
export const removeComponentById = (
  id: string,
  components: ComponentData[],
): ComponentData[] => {
  // Filter out the component with the given ID at the current level
  const filteredComponents = components.filter((c) => c.id !== id)

  // If we didn't remove anything at this level, check children
  if (filteredComponents.length === components.length) {
    return components.map((component) => {
      if (component.children && component.children.length > 0) {
        return {
          ...component,
          children: removeComponentById(id, component.children),
        }
      }
      return component
    })
  }

  return filteredComponents
}

/**
 * Move a component up or down in its parent's children array
 */
export const moveComponent = (
  id: string,
  direction: 'up' | 'down',
  components: ComponentData[],
): ComponentData[] => {
  // Check if the component is at the root level
  const componentIndex = components.findIndex((c) => c.id === id)
  if (componentIndex !== -1) {
    const newComponents = [...components]
    
    // If moving up and not at the top
    if (direction === 'up' && componentIndex > 0) {
      const temp = newComponents[componentIndex]
      newComponents[componentIndex] = newComponents[componentIndex - 1]
      newComponents[componentIndex - 1] = temp
    }
    
    // If moving down and not at the bottom
    if (direction === 'down' && componentIndex < newComponents.length - 1) {
      const temp = newComponents[componentIndex]
      newComponents[componentIndex] = newComponents[componentIndex + 1]
      newComponents[componentIndex + 1] = temp
    }
    
    return newComponents
  }
  
  // Look for the component in children
  return components.map((component) => {
    if (!component.children || component.children.length === 0) {
      return component
    }
    
    // Check if this component contains the target in its children
    const childIndex = component.children.findIndex((c) => c.id === id)
    if (childIndex !== -1) {
      const newChildren = [...component.children]
      
      // If moving up and not at the top
      if (direction === 'up' && childIndex > 0) {
        const temp = newChildren[childIndex]
        newChildren[childIndex] = newChildren[childIndex - 1]
        newChildren[childIndex - 1] = temp
      }
      
      // If moving down and not at the bottom
      if (direction === 'down' && childIndex < newChildren.length - 1) {
        const temp = newChildren[childIndex]
        newChildren[childIndex] = newChildren[childIndex + 1]
        newChildren[childIndex + 1] = temp
      }
      
      return { ...component, children: newChildren }
    }
    
    // Recursively check this component's children
    return {
      ...component,
      children: moveComponent(id, direction, component.children),
    }
  })
} 