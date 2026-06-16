import React from 'react'
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize'
import ExtensionIcon from '@mui/icons-material/Extension'

import { ReactComponent as CloseIcon } from '../../icons/close.svg'
import { DashboardLayout, StateDashboard } from '../../state/store'
import type { Panel } from '../../customHooks/useTopNavBarWidgets'
import DashboardLayoutView from '../Layout/Layout'
import type { DashboardEditorWidgetConfig } from './dashboardEditorTypes'

interface DashboardEditorResponsivePanelsProps {
  dashboard: StateDashboard | null
  isPhoneOrTablet: boolean
  isAdmin: boolean
  isEmpty: boolean
  widgetTabs: DashboardLayout[]
  customWidgetPanels: Panel[]
  onMoveMobileWidget: (index: number, direction: -1 | 1) => void
  onRemoveMobileWidget: (index: number) => void
  onAddWidget: (item: DashboardEditorWidgetConfig & { id?: string }) => void
  onUpdateLayout: (layout: DashboardLayout) => void
}

export const DashboardEditorResponsivePanels = ({
  dashboard,
  isPhoneOrTablet,
  isAdmin,
  isEmpty,
  widgetTabs,
  customWidgetPanels,
  onMoveMobileWidget,
  onRemoveMobileWidget,
  onAddWidget,
  onUpdateLayout,
}: DashboardEditorResponsivePanelsProps) => {
  if (!dashboard) {
    return null
  }

  if (isPhoneOrTablet) {
    return (
      <Box
        sx={{
          height: '100%',
          overflow: 'auto',
          p: 2,
          bgcolor: 'background.default',
        }}
      >
        <Stack spacing={2}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="subtitle1" fontWeight={800}>
              Phone dashboard widgets
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pick the widgets to show on phone and arrange the order they
              appear in the dashboard.
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="subtitle2" fontWeight={800} mb={1}>
              Selected widgets
            </Typography>
            {widgetTabs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No widgets selected yet. Add widgets below to build this phone
                dashboard.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {widgetTabs.map((widgetTab, index) => (
                  <Paper
                    key={`${widgetTab.name}-${widgetTab.component}-${index}`}
                    variant="outlined"
                    sx={{
                      p: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      bgcolor: 'background.default',
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ flex: 1, minWidth: 0 }}
                      noWrap
                    >
                      {index + 1}. {widgetTab.name}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label={`Move ${widgetTab.name} up`}
                      disabled={index === 0}
                      onClick={() => onMoveMobileWidget(index, -1)}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Move ${widgetTab.name} down`}
                      disabled={index === widgetTabs.length - 1}
                      onClick={() => onMoveMobileWidget(index, 1)}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Remove ${widgetTab.name}`}
                      onClick={() => onRemoveMobileWidget(index)}
                    >
                      <CloseIcon width={16} height={16} />
                    </IconButton>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="subtitle2" fontWeight={800} mb={1}>
              Add widgets
            </Typography>
            {customWidgetPanels.length > 0 ? (
              <Stack spacing={1}>
                {customWidgetPanels.flatMap((topNavBarWidget) =>
                  topNavBarWidget.items.map((item) => (
                    <Button
                      key={`${topNavBarWidget.name}-${item.name}`}
                      variant="outlined"
                      fullWidth
                      startIcon={<ExtensionIcon />}
                      onClick={() =>
                        onAddWidget({
                          id: `panel-${Date.now()}`,
                          ...item,
                        })
                      }
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                      }}
                    >
                      {item.name}
                    </Button>
                  )),
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No saved widgets are available.
              </Typography>
            )}
          </Paper>
        </Stack>
      </Box>
    )
  }

  if (isEmpty) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, md: 4 },
          bgcolor: 'background.default',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: 'min(640px, 100%)',
            p: { xs: 2.5, sm: 4 },
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            textAlign: 'center',
          }}
        >
          <DashboardCustomizeIcon
            sx={{ fontSize: 48, color: 'primary.main', mb: 1 }}
          />
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Empty study dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Add a saved study widget from Widgets, or create a reusable note,
            exercise, formula, or review block first.
          </Typography>
        </Paper>
      </Box>
    )
  }

  return (
    <DashboardLayoutView
      key={dashboard.id}
      layout={dashboard.layout}
      updateLayout={(model) => {
        if (!isAdmin) {
          return
        }

        onUpdateLayout(model.toJson().layout)
      }}
    />
  )
}
