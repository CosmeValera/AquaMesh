import React, { useState, useEffect } from 'react'

import useTopNavBarWidgets, { Item } from '../customHooks/useTopNavBarWidgets'

import { useStore } from '../state/store'
import ModuleLoader from './ModuleLoader'

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

  // SET REMOTE from widgets.json
  useEffect(() => {
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