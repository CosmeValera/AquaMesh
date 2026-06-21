import React from 'react'
import { Box, Slide, Tooltip, Typography } from '@mui/material'
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar'
import { alpha, type Theme } from '@mui/material/styles'

import { studioPanelRailWidth, workspaceCanvasSx } from './workspaceStudioModel'

interface WorkspaceMobileLayoutProps {
  children: React.ReactNode
  studioContent: React.ReactNode
  mobileCreationStatusTray: React.ReactNode
  mobileSectionTabs: React.ReactNode
  isStudioOpen: boolean
  mobileSection: 'creation' | 'dashboard' | 'ai-chat'
  visibleCreationMarkerCount: number
  theme: Theme
}

export const WorkspaceMobileLayout = ({
  children,
  studioContent,
  mobileCreationStatusTray,
  mobileSectionTabs,
  isStudioOpen,
  mobileSection,
  visibleCreationMarkerCount,
  theme,
}: WorkspaceMobileLayoutProps) => (
  <Box
    sx={{
      position: 'relative',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.default',
      '--studymesh-mobile-generation-tray-height': visibleCreationMarkerCount
        ? '48px'
        : '0px',
      ...(isStudioOpen && mobileSection === 'creation'
        ? {
            '& [data-testid="study-path-navigator-overlay"]': {
              display: 'none',
            },
          }
        : {}),
    }}
  >
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          ...workspaceCanvasSx,
        }}
      >
        {children}
      </Box>
      <Slide
        direction="right"
        in={mobileSection === 'creation'}
        mountOnEnter
        timeout={{ enter: 260, exit: 220 }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            p: '8px',
            boxSizing: 'border-box',
            zIndex: 2,
            bgcolor: 'background.default',
          }}
        >
          <Box
            sx={{
              height: '100%',
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.paper',
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 18px 40px rgba(0,0,0,0.42)'
                  : '0 18px 42px rgba(16,24,40,0.10)',
            }}
          >
            <Box
              sx={{
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  height: 48,
                  flex: '0 0 auto',
                  px: 1.25,
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={900}
                  noWrap
                  sx={{ color: 'text.primary' }}
                >
                  Creation
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {studioContent}
              </Box>
            </Box>
          </Box>
        </Box>
      </Slide>
    </Box>
    {mobileCreationStatusTray}
    {mobileSectionTabs}
  </Box>
)

interface WorkspaceDesktopLayoutProps {
  children: React.ReactNode
  studioContent: React.ReactNode
  creationStatusMarkers: React.ReactNode
  isStudioOpen: boolean
  studioWidth: number
  toggleCreatePanel: () => void
  collapsedCreationActions: React.ReactNode
  startStudioResize: (event: React.MouseEvent<HTMLDivElement>) => void
  theme: Theme
}

export const WorkspaceDesktopLayout = ({
  children,
  studioContent,
  creationStatusMarkers,
  isStudioOpen,
  studioWidth,
  toggleCreatePanel,
  collapsedCreationActions,
  startStudioResize,
  theme,
}: WorkspaceDesktopLayoutProps) => (
  <Box
    sx={{
      position: 'relative',
      height: '100%',
      display: 'flex',
      overflow: 'hidden',
      bgcolor: 'background.default',
    }}
  >
    <Box
      sx={{
        width: isStudioOpen ? studioWidth : studioPanelRailWidth,
        flex: '0 0 auto',
        minHeight: 0,
        overflow: 'hidden',
        p: '8px 0 8px 8px',
        boxSizing: 'border-box',
        position: 'relative',
        transition: theme.transitions.create(['width'], {
          duration: theme.transitions.duration.shorter,
          easing: theme.transitions.easing.easeInOut,
        }),
      }}
    >
      <Box
        sx={{
          height: '100%',
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2.5,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 18px 40px rgba(0,0,0,0.42)'
              : '0 18px 42px rgba(16,24,40,0.10)',
          display: isStudioOpen ? 'block' : 'none',
        }}
      >
        <Box
          sx={{
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          <Box
            sx={{
              height: 48,
              flex: '0 0 auto',
              px: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="subtitle2"
              fontWeight={900}
              noWrap
              sx={{ color: 'text.primary' }}
            >
              Creation
            </Typography>
            <Tooltip title="Collapse Create" placement="right">
              <Box
                component="button"
                type="button"
                aria-label="Collapse Create panel"
                onClick={toggleCreatePanel}
                sx={{
                  width: 30,
                  height: 30,
                  border: 1,
                  borderColor: alpha(theme.palette.primary.main, 0.32),
                  borderRadius: 1.25,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  transition: theme.transitions.create(
                    ['background-color', 'border-color'],
                    {
                      duration: theme.transitions.duration.shortest,
                    },
                  ),
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.18),
                  },
                  '& svg': {
                    margin: '0 -2px',
                  },
                }}
              >
                <ViewSidebarIcon fontSize="small" />
              </Box>
            </Tooltip>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {studioContent}
          </Box>
        </Box>
      </Box>
      {!isStudioOpen && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2.5,
            bgcolor: 'background.paper',
            color: 'primary.main',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.75,
            py: 0.75,
            overflow: 'hidden',
            cursor: 'pointer',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 12px 32px rgba(0,0,0,0.32)'
                : '0 12px 30px rgba(16,24,40,0.12)',
            '&:hover:not(:has(.studymesh-creation-quick-action:hover)) .studymesh-creation-rail-icon':
              {
              borderColor: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, 0.18),
            },
          }}
          onClick={toggleCreatePanel}
        >
          <Tooltip title="Open Create" placement="right">
            <Box
              className="studymesh-creation-rail-icon"
              component="button"
              type="button"
              aria-label="Open Create panel"
              onClick={(event) => {
                event.stopPropagation()
                toggleCreatePanel()
              }}
              sx={{
                width: 30,
                height: 30,
                border: 1,
                borderColor: alpha(theme.palette.primary.main, 0.32),
                borderRadius: 1.25,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                transition: theme.transitions.create(
                  ['background-color', 'border-color'],
                  {
                    duration: theme.transitions.duration.shortest,
                  },
                ),
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.18),
                },
                '& svg': {
                  margin: '0 -2px',
                },
                marginTop: 0.3,
              }}
            >
              <ViewSidebarIcon fontSize="small" />
            </Box>
          </Tooltip>
          <Box
            sx={{
              width: 'calc(100% - 16px)',
              borderTop: 1,
              borderColor: 'divider',
            }}
          />
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1.3,
              mt: 0.5,
              mb: 0.5,
            }}
          >
            {collapsedCreationActions}
          </Box>
          <Box
            sx={{
              width: 'calc(100% - 16px)',
              borderTop: 1,
              borderColor: 'divider',
            }}
          />
          <Typography
            variant="caption"
            sx={{
              writingMode: 'vertical-rl',
              fontWeight: 800,
              letterSpacing: 0.4,
              mt: 0.5,
              userSelect: 'none',
            }}
          >
            Creation
          </Typography>
        </Box>
      )}
      {isStudioOpen && (
        <Box
          role="separator"
          aria-label="Resize Create panel"
          onMouseDown={startStudioResize}
          sx={{
            position: 'absolute',
            top: 14,
            right: -3,
            width: 8,
            height: 'calc(100% - 28px)',
            cursor: 'col-resize',
            zIndex: 2,
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 3,
              width: 2,
              borderRadius: 999,
              bgcolor: 'divider',
            },
            '&:hover::after': { bgcolor: 'primary.main' },
          }}
        />
      )}
    </Box>
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        ...workspaceCanvasSx,
        transition: theme.transitions.create('padding', {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      <Box
        sx={{
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
    </Box>
    {creationStatusMarkers}
  </Box>
)
