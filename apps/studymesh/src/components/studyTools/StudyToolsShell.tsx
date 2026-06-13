import React from 'react'
import {
  Box,
  Dialog,
  Drawer,
  IconButton,
  Snackbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import { useStudyTools } from './StudyToolsProvider'
import CanvasTool from './tools/CanvasTool'
import PomodoroTool from './tools/PomodoroTool'
import { ScratchpadTool, TodoTool } from './tools/SimpleTools'
import type { StudyToolId } from './types'

const titles: Record<StudyToolId, string> = {
  canvas: 'Canvas',
  pomodoro: 'Pomodoro',
  todo: 'Todo',
  scratchpad: 'Scratchpad',
  'private-chat': 'Private Chat',
}

const StudyToolsShell = () => {
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('md'))
  const { activeTool, closeTool, storageError, clearStorageError } = useStudyTools()
  const sideTool =
    activeTool === 'todo' ||
    activeTool === 'scratchpad'

  const content =
    activeTool === 'todo' ? (
      <TodoTool />
    ) : activeTool === 'scratchpad' ? (
      <ScratchpadTool />
    ) : null

  return (
    <>
      <Dialog
        fullScreen
        open={activeTool === 'canvas'}
        onClose={closeTool}
        PaperProps={{ sx: { bgcolor: 'background.default' } }}
      >
        <CanvasTool onClose={closeTool} />
      </Dialog>

      <Drawer
        anchor="right"
        open={sideTool}
        onClose={closeTool}
        PaperProps={{
          sx: {
            width: mobile ? '100%' : 440,
            maxWidth: '100%',
            bgcolor: 'background.paper',
          },
        }}
      >
        {activeTool && sideTool && (
          <>
            <Box
              sx={{
                height: 58,
                px: 2,
                display: 'flex',
                alignItems: 'center',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" fontWeight={900} sx={{ flex: 1 }}>
                {titles[activeTool]}
              </Typography>
              <IconButton
                aria-label={`Close ${titles[activeTool]}`}
                onClick={closeTool}
                sx={{ color: 'text.primary', bgcolor: 'action.hover' }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
              {content}
            </Box>
          </>
        )}
      </Drawer>

      <PomodoroTool open={activeTool === 'pomodoro'} onClose={closeTool} />
      <Snackbar
        open={Boolean(storageError)}
        autoHideDuration={6000}
        message={storageError}
        onClose={clearStorageError}
      />
    </>
  )
}

export default StudyToolsShell
