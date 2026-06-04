import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import BugReportIcon from '@mui/icons-material/BugReport'
import CloseIcon from '@mui/icons-material/Close'
import {
  cancelAllLocalAiSessions,
  cancelLocalAiSession,
  clearCompletedLocalAiSessionHistory,
  destroyAllLocalAiSessions,
  destroyLocalAiSession,
  getLocalAiSessionDebugState,
  LocalAiManagedSession,
  subscribeToLocalAiSessionDebugState,
} from '../../studyPack/ai'

const showLocalAiDebugPanel = (): boolean => {
  const envValue = String(
    process.env.VITE_SHOW_LOCAL_AI_DEBUG_PANEL ||
      '',
  ).toLowerCase()

  return process.env.NODE_ENV !== 'production' || envValue === 'true'
}

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

const formatSince = (timestamp: number, referenceTime = Date.now()): string =>
  formatDuration(referenceTime - timestamp)

const sessionIsActive = (session: LocalAiManagedSession): boolean =>
  session.status === 'running' ||
  session.status === 'creating' ||
  session.status === 'stale'

const sessionReferenceTime = (session: LocalAiManagedSession): number =>
  sessionIsActive(session)
    ? Date.now()
    : session.destroyedAt || session.completedAt || Date.now()

const statusColor = (
  session: LocalAiManagedSession,
): 'default' | 'primary' | 'success' | 'warning' | 'error' =>
  session.stale
    ? 'warning'
    : session.status === 'running' || session.status === 'creating'
      ? 'primary'
      : session.status === 'completed'
        ? 'success'
        : session.status === 'failed'
          ? 'error'
          : 'default'

const LocalAiSessionRow: React.FC<{ session: LocalAiManagedSession }> = ({
  session,
}) => {
  const canCancel =
    sessionIsActive(session)
  const referenceTime = sessionReferenceTime(session)

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1,
        border: 1,
        borderColor: session.stale ? 'warning.main' : 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={0.75}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Typography variant="caption" fontWeight={900} sx={{ minWidth: 82 }}>
            {session.id}
          </Typography>
          <Chip
            size="small"
            color={statusColor(session)}
            label={session.status}
          />
          <Chip size="small" variant="outlined" label={session.promptType} />
          {session.destroyed ? (
            <Chip size="small" variant="outlined" label="destroyed" />
          ) : null}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {session.dashboardTitle || session.stepLabel || 'Local AI prompt'}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: 'monospace',
          }}
        >
          {session.promptPreview || 'No prompt preview'}
        </Typography>
        {session.errorMessage ? (
          <Typography variant="caption" color="error">
            {session.errorMessage}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            age {formatSince(session.createdAt, referenceTime)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            idle {formatSince(session.lastActivityAt, referenceTime)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            duration {formatDuration(session.durationMs)}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            disabled={!canCancel}
            onClick={() => cancelLocalAiSession(session.id)}
          >
            Cancel
          </Button>
          <Button size="small" onClick={() => destroyLocalAiSession(session.id)}>
            Destroy
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

const LocalAiDebugPanel: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState(getLocalAiSessionDebugState)

  useEffect(() => {
    if (!showLocalAiDebugPanel()) {
      return undefined
    }

    const refresh = () => setSessions(getLocalAiSessionDebugState())
    const unsubscribe = subscribeToLocalAiSessionDebugState(refresh)
    const intervalId = window.setInterval(refresh, 1000)

    return () => {
      unsubscribe()
      window.clearInterval(intervalId)
    }
  }, [])

  const runningCount = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.status === 'running' ||
          session.status === 'creating' ||
          session.status === 'stale',
      ).length,
    [sessions],
  )

  if (!showLocalAiDebugPanel()) {
    return null
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 2000,
      }}
    >
      {open ? (
        <Paper
          elevation={8}
          sx={{
            width: { xs: 'calc(100vw - 32px)', sm: 520 },
            maxHeight: '70vh',
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Stack spacing={1.25} sx={{ minHeight: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <BugReportIcon fontSize="small" />
              <Typography variant="subtitle2" fontWeight={900}>
                Local AI sessions
              </Typography>
              <Chip size="small" label={`${runningCount} running`} />
              <Box sx={{ flex: 1 }} />
              <IconButton
                size="small"
                aria-label="Close Local AI debug panel"
                onClick={() => setOpen(false)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="small" onClick={cancelAllLocalAiSessions}>
                Cancel all
              </Button>
              <Button size="small" onClick={destroyAllLocalAiSessions}>
                Destroy all
              </Button>
              <Button size="small" onClick={clearCompletedLocalAiSessionHistory}>
                Clear history
              </Button>
            </Stack>
            <Stack
              spacing={1}
              sx={{
                minHeight: 0,
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                pr: 0.5,
              }}
            >
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <LocalAiSessionRow key={session.id} session={session} />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No Local AI sessions.
                </Typography>
              )}
            </Stack>
          </Stack>
        </Paper>
      ) : (
        <Tooltip title="Local AI sessions">
          <Badge badgeContent={runningCount} color="warning">
            <IconButton
              aria-label="Open Local AI debug panel"
              color="primary"
              onClick={() => setOpen(true)}
              sx={{ bgcolor: 'background.paper', boxShadow: 3 }}
            >
              <BugReportIcon />
            </IconButton>
          </Badge>
        </Tooltip>
      )}
    </Box>
  )
}

export default LocalAiDebugPanel
