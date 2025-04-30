import React, { useState, useEffect, lazy } from 'react'

import useTopNavBarWidgets, { Item } from '../customHooks/useTopNavBarWidgets'

import { useStore } from '../state/store'
import ModuleLoader from './ModuleLoader'

// Import WidgetEditor component
import WidgetEditor from '../components/WidgetEditor/WidgetEditor'

// Local components registry
const LocalComponents: Record<string, React.FC> = {
  WidgetEditor: WidgetEditor,
}

export interface DynamicMicrofrontendProps {
  name: string;
  component: string;
  width: number;
  height: number;
}

const DynamicMicrofrontend: React.FC<DynamicMicrofrontendProps> = (props) => {
  const [remote, setRemote] = useState<Item>()

  const { topNavBarWidgets } = useTopNavBarWidgets()

  const changePanelData = useStore((state) => state.changePanelData)
  const getCurrentView = useStore((state) => state.getCurrentView)

  // const { keycloak } = useAuth()

  useEffect(() => {
    // First check if it's a local component
    if (props.component === 'WidgetEditor') {
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
  }, [topNavBarWidgets, props.component])

  // Return proper content at the end of the component
  if (props.component === 'WidgetEditor') {
    const LocalComponent = LocalComponents[props.component]
    return <LocalComponent />
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