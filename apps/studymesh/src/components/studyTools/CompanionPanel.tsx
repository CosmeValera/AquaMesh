import React, { useState } from 'react'
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CloseIcon from '@mui/icons-material/Close'
import DrawIcon from '@mui/icons-material/Draw'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import NotesIcon from '@mui/icons-material/Notes'
import TimerIcon from '@mui/icons-material/Timer'
import TopicIcon from '@mui/icons-material/Topic'

import { useStudyTools } from './StudyToolsProvider'
import type { CompanionMode } from './types'
import CanvasTool from './tools/CanvasTool'
import PomodoroTool from './tools/PomodoroTool'
import { QuickCaptureTool, ScratchpadTool, TodoTool } from './tools/SimpleTools'

export const companionModeLabels: Record<CompanionMode, string> = {
  'ai-chat': 'AI Chat',
  'quick-capture': 'Quick Capture',
  todo: 'Todo',
  scratchpad: 'Scratchpad',
  pomodoro: 'Pomodoro',
  canvas: 'Canvas',
}

export const companionSectionLabel = (mode: CompanionMode, pomodoroStatus = '') =>
  mode === 'ai-chat'
    ? 'Companion'
    : mode === 'pomodoro' && pomodoroStatus
      ? `Study Tools · ${pomodoroStatus}`
      : 'Study Tools'

export const CompanionModeIcon = ({
  mode,
  fontSize = 'small',
}: {
  mode: CompanionMode
  fontSize?: 'small' | 'medium'
}) => {
  const props = { fontSize } as const
  if (mode === 'ai-chat') return <AutoAwesomeIcon {...props} />
  if (mode === 'quick-capture') return <TopicIcon {...props} />
  if (mode === 'todo') return <CheckBoxIcon {...props} />
  if (mode === 'scratchpad') return <NotesIcon {...props} />
  if (mode === 'pomodoro') return <TimerIcon {...props} />
  return <DrawIcon {...props} />
}

const modes: Array<{
  id: CompanionMode
  description: string
  icon: React.ReactNode
}> = [
  { id: 'ai-chat', description: 'Ask about current study context', icon: <CompanionModeIcon mode="ai-chat" /> },
  { id: 'quick-capture', description: 'Capture thoughts, images, and voice', icon: <CompanionModeIcon mode="quick-capture" /> },
  { id: 'todo', description: 'Personal task list', icon: <CompanionModeIcon mode="todo" /> },
  { id: 'scratchpad', description: 'Quick personal notes', icon: <CompanionModeIcon mode="scratchpad" /> },
  { id: 'pomodoro', description: 'Focus timer', icon: <CompanionModeIcon mode="pomodoro" /> },
  { id: 'canvas', description: 'Spatial notes and links', icon: <CompanionModeIcon mode="canvas" /> },
]

const CompanionPanel = ({
  aiChat,
  onClose,
}: {
  aiChat: React.ReactNode
  onClose: () => void
}) => {
  const { activeMode, pomodoroStatus, setActiveMode } = useStudyTools()
  const [switcherAnchor, setSwitcherAnchor] = useState<HTMLElement | null>(null)
  const [canvasFullscreen, setCanvasFullscreen] = useState(false)

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          height: 48,
          px: 1,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          flex: '0 0 auto',
        }}
      >
        <Box
          component="button"
          type="button"
          aria-label="Switch Companion mode"
          onClick={(event) => setSwitcherAnchor(event.currentTarget)}
          sx={{
            minWidth: 0,
            flex: 1,
            border: 0,
            bgcolor: 'transparent',
            color: 'text.primary',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            textAlign: 'left',
          }}
        >
          <Typography variant="subtitle2" fontWeight={900} noWrap>
            {companionModeLabels[activeMode]}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {companionSectionLabel(activeMode, pomodoroStatus)}
          </Typography>
          <ExpandMoreIcon fontSize="small" />
        </Box>
        <IconButton
          size="small"
          aria-label={`Close ${companionSectionLabel(activeMode, pomodoroStatus)}`}
          onClick={onClose}
          sx={{ color: 'text.primary', bgcolor: 'action.hover' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Menu
        anchorEl={switcherAnchor}
        open={Boolean(switcherAnchor)}
        onClose={() => setSwitcherAnchor(null)}
        PaperProps={{ sx: { width: 320, maxWidth: 'calc(100vw - 24px)' } }}
      >
        {modes.map((mode, index) => (
          <MenuItem
            key={mode.id}
            selected={activeMode === mode.id}
            onClick={() => {
              setActiveMode(mode.id)
              setSwitcherAnchor(null)
            }}
            sx={index === 1 ? { borderTop: 1, borderColor: 'divider' } : undefined}
          >
            <ListItemIcon sx={{ color: 'primary.main' }}>{mode.icon}</ListItemIcon>
            <ListItemText
              primary={companionModeLabels[mode.id]}
                secondary={
                  mode.id === 'pomodoro' && pomodoroStatus
                    ? `Running · ${pomodoroStatus}`
                    : mode.description
                }
            />
          </MenuItem>
        ))}
      </Menu>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', display: activeMode === 'ai-chat' ? 'block' : 'none' }}>
          {aiChat}
        </Box>
        <Box sx={{ height: '100%', overflow: 'auto', p: 1.5, display: activeMode === 'todo' ? 'block' : 'none' }}>
          <TodoTool />
        </Box>
        <Box sx={{ height: '100%', overflow: 'auto', p: 1.5, display: activeMode === 'scratchpad' ? 'block' : 'none' }}>
          <ScratchpadTool />
        </Box>
        <Box sx={{ height: '100%', display: activeMode === 'quick-capture' ? 'block' : 'none' }}>
          <QuickCaptureTool />
        </Box>
        <Box sx={{ height: '100%', display: activeMode === 'pomodoro' ? 'block' : 'none' }}>
          <PomodoroTool />
        </Box>
        <Box sx={{ height: '100%', display: activeMode === 'canvas' ? 'block' : 'none' }}>
          <CanvasTool
            fullscreen={canvasFullscreen}
            onFullscreenChange={setCanvasFullscreen}
          />
        </Box>
      </Box>
    </Box>
  )
}

export default CompanionPanel
