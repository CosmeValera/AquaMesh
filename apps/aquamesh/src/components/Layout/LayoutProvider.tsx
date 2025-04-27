/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useCallback } from 'react'
import { useContext } from 'react'
import { Layout as FlexLayout } from 'flexlayout-react'

interface LayoutProviderProps {
  children: React.ReactNode;
}

interface LayoutContextType {
  ref: React.RefObject<FlexLayout>;
  addComponent: (item: any) => void;
  dragComponent: (item: any, ev: React.DragEvent<HTMLLIElement>) => void;
}

const LayoutContext = React.createContext<LayoutContextType | undefined>(undefined)

const LayoutProvider: React.FC<LayoutProviderProps> = (props) => {
  const layoutRef = useRef<FlexLayout>(null)

  const addComponent = useCallback((item: any) => {
    const { name, component } = item
    layoutRef.current?.addTabToActiveTabSet({ component, name })
  }, [])

  const dragComponent = useCallback((item:any, ev: React.DragEvent<HTMLLIElement>) => {
    const { name, component } = item

    // NOTE prevent default dragging behavior
    ev.preventDefault()

    layoutRef.current?.addTabWithDragAndDrop(name, { component, name })
  }, [])

  return (
    <LayoutContext.Provider
      {...props}
      value={{ ref: layoutRef, addComponent, dragComponent }}
    />
  )
}

export const useLayout = () => {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider")
  }
  return context
}

export default LayoutProvider
