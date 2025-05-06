import React from 'react'
import { useContext } from 'react'

import { nanoid } from 'nanoid'

import { DEFAULT_DASHBOARD, DefaultDashboard } from './fixture'

import { useStore, StateDashboard } from '../../state/store'

import { Model } from 'flexlayout-react'

interface DashboardProviderProps {
  children: React.ReactNode;
}

interface DashboardContextType {
  openDashboards: StateDashboard[];
  selectedDashboard: number;
  setSelectedDashboard: (index: number) => void;
  removeDashboard: (id: string) => void;
  addDashboard: (dashboard?: DefaultDashboard) => void;
  updateLayout: (model: Model) => void;
  renameDashboard: (id: string, newName: string) => void;
}

const DashboardContext = React.createContext<DashboardContextType | null>(null)

const DashboardProvider: React.FC<DashboardProviderProps> = (props) => {
  const selectedDashboard = useStore((state) => state.selectedDashboard)
  const setSelectedDashboard = useStore((state) => state.setSelectedDashboard)
  const openDashboards = useStore((state) => state.openDashboards)
  const setDashboards = useStore((state) => state.setDashboards)

  const removeDashboard = (id: string) => {
    const dashboards = openDashboards.filter((dashboard) => dashboard.id !== id)

    setDashboards(dashboards)

    if (selectedDashboard >= dashboards.length) {
      setSelectedDashboard(selectedDashboard - 1)
    }
  }

  const addDashboard = (dashboard = DEFAULT_DASHBOARD) => {
    const newDashboard = openDashboards.concat(Object.assign({ id: nanoid() }, dashboard))
    const newSelectedDashboard = openDashboards.length

    setDashboards(newDashboard)
    setSelectedDashboard(newSelectedDashboard)
  }

  const updateLayout = (model: Model) => {
    const newLayout = model.toJson().layout
    const newOpenDashboards = [...openDashboards]
    newOpenDashboards[selectedDashboard] = {
      ...openDashboards[selectedDashboard],
      layout: newLayout,
    }
    setDashboards(newOpenDashboards)
  }
  
  const renameDashboard = (id: string, newName: string) => {
    const newOpenDashboards = openDashboards.map(dashboard => {
      if (dashboard.id === id) {
        return { ...dashboard, name: newName }
      }
      return dashboard
    })
    
    setDashboards(newOpenDashboards)
  }
  
  return (
    <DashboardContext.Provider
      {...props}
      value={{
        openDashboards,
        selectedDashboard,
        setSelectedDashboard,
        removeDashboard,
        addDashboard,
        updateLayout,
        renameDashboard,
      }}
    />
  )
}

export const useDashboards = () => {
  const context = useContext(DashboardContext)
  if(!context) {
    throw new Error("useDashboards must be used within a DashboardProvider")
  }
  return context
}

export default DashboardProvider