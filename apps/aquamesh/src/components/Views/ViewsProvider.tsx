import React from 'react'
import { useContext } from 'react'

import { nanoid } from 'nanoid'

import { DEFAULT_DASHBOARD, DefaultDashboard } from './fixture'

import { useStore, StateView } from '../../state/store'

import { Model } from 'flexlayout-react'

interface ViewsProviderProps {
  children: React.ReactNode;
}

interface ViewsContextType {
  openViews: StateView[];
  selectedView: number;
  setSelectedView: (index: number) => void;
  removeView: (id: string) => void;
  addView: (view?: DefaultDashboard) => void;
  updateLayout: (model: Model) => void;
  renameView: (id: string, newName: string) => void;
}

const ViewsContext = React.createContext<ViewsContextType | null>(null)

const ViewsProvider: React.FC<ViewsProviderProps> = (props) => {
  const selectedView = useStore((state) => state.selectedView)
  const setSelectedView = useStore((state) => state.setSelectedView)
  const openViews = useStore((state) => state.openViews)
  const setViews = useStore((state) => state.setViews)

  const removeView = (id: string) => {
    const views = openViews.filter((view) => view.id !== id)

    setViews(views)

    if (selectedView >= views.length) {
      setSelectedView(selectedView - 1)
    }
  }

  const addView = (view = DEFAULT_DASHBOARD) => {
    const newView = openViews.concat(Object.assign({ id: nanoid() }, view))
    const newSelectedView = openViews.length

    setViews(newView)
    setSelectedView(newSelectedView)
  }

  const updateLayout = (model: Model) => {
    const newLayout = model.toJson().layout
    const newOpenViews = [...openViews]
    newOpenViews[selectedView] = {
      ...openViews[selectedView],
      layout: newLayout,
    }
    setViews(newOpenViews)
  }
  
  const renameView = (id: string, newName: string) => {
    const newOpenViews = openViews.map(view => {
      if (view.id === id) {
        return { ...view, name: newName };
      }
      return view;
    });
    
    setViews(newOpenViews);
  }
  
  return (
    <ViewsContext.Provider
      {...props}
      value={{
        openViews,
        selectedView,
        setSelectedView,
        removeView,
        addView,
        updateLayout,
        renameView,
      }}
    />
  )
}

export const useViews = () => {
  const context = useContext(ViewsContext)
  if(!context) {
    throw new Error("useLayout must be used within a ViewsProvider")
  }
  return context
}

export default ViewsProvider