import React, { useMemo } from 'react'
import { Layout, Model, TabNode } from 'flexlayout-react'

import { ReactComponent as EmptyPanelIcon } from '../../icons/gui.svg'
import { ReactComponent as CloseIcon } from '../../icons/close.svg'
import { ReactComponent as OpenInNewIcon } from '../../icons/launch.svg'
import { ReactComponent as MaximizeIcon } from '../../icons/maximize.svg'
import { ReactComponent as MinimizeIcon } from '../../icons/minimize.svg'
// import { ReactComponent as MoreIcon } from '../icons/overflow-menu-vertical.svg'

import DynamicMicrofrontend from '../../moduleFederation/DynamicMicrofrontend'

import { useLayout } from './LayoutProvider'
import { ViewLayout } from '../../state/store'

import 'flexlayout-react/style/light.css'
import './layout.scss'

interface LayoutViewProps {
  layout: ViewLayout;
  updateLayout: (model: Model) => void; 
}

const CONFIG = {
  global: {
    tabEnableFloat: true,
    tabSetEnableClose: true,
    // tabSetEnableTabStrip: false,
    tabSetTabStripHeight: 32,
    // tabSetHeaderHeight: 24,
    tabEnableRename: false,
    tabDragSpeed: 0.15,
  },
  borders: [],
}

const EmptyPanel = () => (
  <div
    style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <EmptyPanelIcon width={60} height={60} opacity={0.16} />
  </div>
)

const LayoutView: React.FC<LayoutViewProps>= ({ layout, updateLayout }) => {
  const { ref } = useLayout()

  const factory = (node: TabNode) => {
    const { width, height } = node.getRect()
    const name = node.getName()
    const component = node.getComponent()

    if (!component) {
      return <EmptyPanel />
    }

    return (
      <DynamicMicrofrontend name={name} component={component} width={width} height={height}/>
    )
  }

  const model = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = Object.assign({}, CONFIG, { layout })
    return Model.fromJson(config)
  }, [layout])

  return (
    <Layout
      ref={ref}
      model={model}
      factory={factory}
      icons={{
        close: (
          <CloseIcon
            width={16}
            height={16}
            color="var(--foreground-primary, #001026DE)"
          />
        ),
        closeTabset: (
          <CloseIcon
            width={16}
            height={16}
            color="var(--foreground-primary, #001026DE)"
          />
        ),
        maximize: (
          <MaximizeIcon
            width={16}
            height={16}
            color="var(--foreground-primary, #001026DE)"
          />
        ),
        restore: (
          <MinimizeIcon
            width={16}
            height={16}
            color="var(--foreground-primary, #001026DE)"
          />
        ),
        popout: (
          <OpenInNewIcon
            width={16}
            height={16}
            color="var(--foreground-primary, #001026DE)"
          />
        ),
        // NOTE displayed when some tabs are hidden
        // more: (
        //   <MoreIcon
        //     width={16}
        //     height={16}
        //     color="var(--foreground-primary, #001026DE)"
        //   />
        // ),
      }}
      onTabSetPlaceHolder={() => (
        <EmptyPanelIcon width={60} height={60} opacity={0.16} />
      )}
      onModelChange={updateLayout}
    />
  )
}

export default LayoutView
