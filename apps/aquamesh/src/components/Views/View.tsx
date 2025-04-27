import React from 'react'
import { Box, Typography, Button } from '@mui/material'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'

import { ReactComponent as AddIcon } from '../../icons/add.svg'
import { ReactComponent as CloseIcon } from '../../icons/close.svg'

import LayoutView from '../Layout/Layout'

import { useViews } from './ViewsProvider'
import './tabs.scss'

const Views = () => {
  const {
    openViews,
    selectedView,
    setSelectedView,
    removeView,
    addView,
    updateLayout,
  } = useViews()

  return (
    <Box>
      <Tabs
        selectedIndex={selectedView}
        onSelect={(index) => setSelectedView(index)}
        style={{ position: 'relative' }}
      >
        <TabList>
          {openViews.map((view) => (
            <Tab key={view.id}>
              <Typography
                variant="subtitle2"
                sx={{
                  flex: '1 0 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginLeft: '0.5rem'
                }}
              >
                {view.name}
              </Typography>
              <Box
                className="close"
                sx={{
                  display: 'flex',
                  p: 0.5,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: '999px',
                  transition: 'all .25s ease',
                  '&:hover': {
                    backgroundColor: 'action.contrastHover',
                  },
                }}
              >
                <CloseIcon
                  width={16}
                  height={16}
                  onClick={(ev) => {
                    // NOTE prevent the tab being closed from being selected too!
                    ev.stopPropagation()
                    removeView(view.id)
                  }}
                />
              </Box>
            </Tab>
          ))}
          <Button
            size="small"
            variant="text"
            disableRipple
            sx={{
              position: 'relative',
              top: '3px',
              marginBottom: '8px',
              minWidth: 'fit-content',
              display: 'flex',
              alignItems: 'middle',
              gap: '8px',
              fontSize: '13px',
              p: '4px 12px',
              color: 'primary.light',
              transition: 'all .25s ease',
              '.MuiButton-startIcon': {
                transition: 'all .25s ease',
                m: 0,
                color: 'primary.light',
              },
              ':hover': {
                backgroundColor: 'transparent',
                color: 'primary.main',
                '.MuiButton-startIcon': {
                  color: 'primary.main',
                },
              },
            }}
            startIcon={<AddIcon width={16} height={16} />}
            onClick={() => addView()}
          />
        </TabList>
        {openViews.map((view) => (
          <TabPanel key={view.id}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: 'background.default',
              }}
            >
              <Box sx={{ position: 'relative', flex: '1' }}>
                <LayoutView
                  layout={view.layout}
                  updateLayout={updateLayout}
                />
              </Box>
            </Box>
          </TabPanel>
        ))}
      </Tabs>
    </Box>
  )
}

export default Views