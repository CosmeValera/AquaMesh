import React from 'react'
import { MenuItem, Divider, Typography } from '@mui/material'

// Define types based on fixture.ts definitions
interface TabItem {
  type: 'tab'
  name: string
  component?: string
}

interface TabsetItem {
  type: 'tabset'
  weight: number
  active?: boolean
  children: TabItem[]
}

interface RowItem {
  type: 'row'
  weight: number
  children: (RowItem | TabsetItem)[]
}

interface Layout {
  type: 'row'
  weight: number
  children: (RowItem | TabsetItem)[]
}

interface PanelItem {
  name: string
  component: string
}

interface PanelGroup {
  name: string
  items: PanelItem[]
}

// FlexLayout structured layout templates
export const createSinglePanelLayout = (component: string, name: string): Layout => ({
  type: 'row',
  weight: 100,
  children: [
    {
      type: 'tabset',
      weight: 100,
      children: [
        {
          type: 'tab',
          name: name,
          component: component
        }
      ]
    }
  ]
})

export const createDualPanelLayout = (component1: string, component2: string, name1: string, name2: string): Layout => ({
  type: 'row',
  weight: 100,
  children: [
    {
      type: 'tabset',
      weight: 50,
      children: [
        {
          type: 'tab',
          name: name1,
          component: component1
        }
      ]
    },
    {
      type: 'tabset',
      weight: 50,
      children: [
        {
          type: 'tab',
          name: name2,
          component: component2
        }
      ]
    }
  ]
})

interface DashboardOptionsProps {
  topNavBarWidgets: PanelGroup[]
  createViewWithLayout: (viewName: string, layout: Layout) => void
  handleClose: () => void
}

const DashboardOptions: React.FC<DashboardOptionsProps> = ({ 
  topNavBarWidgets, 
  createViewWithLayout,
  handleClose
}) => {
  const controlFlowComponent = topNavBarWidgets[0]?.items[0]?.component
  const controlFlowName = topNavBarWidgets[0]?.items[0]?.name || "Control Flow"
  
  const systemLensComponent = topNavBarWidgets[1]?.items[0]?.component
  const systemLensName = topNavBarWidgets[1]?.items[0]?.name || "System Lens"

  return (
    <>
      <MenuItem 
        onClick={() => {
          createViewWithLayout(
            "Control Flow View", 
            createSinglePanelLayout(
              controlFlowComponent,
              controlFlowName
            )
          )
          handleClose()
        }}
      >
        Control Flow View
      </MenuItem>
      
      <MenuItem 
        onClick={() => {
          createViewWithLayout(
            "System Lens View", 
            createSinglePanelLayout(
              systemLensComponent,
              systemLensName
            )
          )
          handleClose()
        }}
      >
        System Lens View
      </MenuItem>
      
      <Divider />
      
      <Typography sx={{ px: 2, py: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
        Combined View
      </Typography>
      
      <MenuItem 
        onClick={() => {
          createViewWithLayout(
            "Combined Dashboard", 
            createDualPanelLayout(
              controlFlowComponent,
              systemLensComponent,
              controlFlowName,
              systemLensName
            )
          )
          handleClose()
        }}
      >
        Control Flow + System Lens
      </MenuItem>
    </>
  )
}

export default DashboardOptions 