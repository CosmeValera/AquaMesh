import React, { useMemo } from 'react'

import DynamicMicrofrontend from '../../moduleFederation/DynamicMicrofrontend'
import type { DashboardLayout } from '../../state/store'
import '../Layout/layout.scss'

interface StudyGuideWidgetNode {
  id: string
  name: string
  component: string
  customProps?: Record<string, unknown>
}

const collectStudyGuideWidgetNodes = (
  node: DashboardLayout | undefined,
  path: string[] = [],
): StudyGuideWidgetNode[] => {
  if (!node) {
    return []
  }

  if (node.component) {
    return [
      {
        id: node.id || path.join('-') || node.name || node.component,
        name: node.name || node.component,
        component: node.component,
        customProps: node.config?.customProps,
      },
    ]
  }

  return (node.children || []).flatMap((child, index) =>
    collectStudyGuideWidgetNodes(child, [...path, String(index)]),
  )
}

const StudyGuideLinearLayout = ({ layout }: { layout?: DashboardLayout }) => {
  const widgets = useMemo(() => collectStudyGuideWidgetNodes(layout), [layout])

  if (widgets.length === 0) {
    return <div className="studymesh-mobile-dashboard-empty" />
  }

  return (
    <div className="studymesh-mobile-dashboard-layout">
      {widgets.map((widget) => (
        <section key={widget.id} className="studymesh-mobile-widget-card">
          <DynamicMicrofrontend
            name={widget.name}
            component={widget.component}
            width={typeof window !== 'undefined' ? window.innerWidth - 32 : 360}
            height={0}
            customProps={widget.customProps}
          />
        </section>
      ))}
    </div>
  )
}

export default StudyGuideLinearLayout
