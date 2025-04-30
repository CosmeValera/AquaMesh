import React, { useState, useEffect } from 'react'

import useTopNavBarWidgets, { Item } from '../customHooks/useTopNavBarWidgets'

import { useStore } from '../state/store'
import ModuleLoader from './ModuleLoader'

// Import components
import WidgetEditor from '../components/WidgetEditor/WidgetEditor'
import CustomWidget from '../components/WidgetEditor/CustomWidget'

export interface DynamicMicrofrontendProps {
  name: string
  component: string
  width: number
  height: number
  customProps?: Record<string, unknown>
}

const DynamicMicrofrontend: React.FC<DynamicMicrofrontendProps> = (props) => {
  const [remote, setRemote] = useState<Item>()

  const { topNavBarWidgets } = useTopNavBarWidgets()

  const changePanelData = useStore((state) => state.changePanelData)
  const getCurrentView = useStore((state) => state.getCurrentView)

  // const { keycloak } = useAuth()

  useEffect(() => {
    // Check if it's a local component first
    if (props.component === 'WidgetEditor' || props.component === 'CustomWidget') {
      return
    }
    
    // SET REMOTE from widgets.json
    const topNavBarWidget = topNavBarWidgets.find(topNavBarWidget =>
      topNavBarWidget.items.some(item => item.name === props.name)
    )

    if (topNavBarWidget) {
      const panelItem: Item | undefined = topNavBarWidget.items.find(item => item.name === props.name)
      if (panelItem) {
        setRemote(panelItem)
      }
    }
  }, [topNavBarWidgets, props.component, props.name])

  // Return proper content for local components
  if (props.component === 'WidgetEditor') {
    return <WidgetEditor />
  }
  
  if (props.component === 'CustomWidget') {
    return <CustomWidget {...props.customProps} />
  }

  return (
    <>
      {remote && (
        <ModuleLoader 
          url={remote.url} 
          {...props} 
          {...remote.customProps} 
          changePanelData={changePanelData} 
          getCurrentView={getCurrentView} 
          component={remote.component}
        />
      )}
    </>
  )
}

export default DynamicMicrofrontend