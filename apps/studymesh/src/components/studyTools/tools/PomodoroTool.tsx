import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsIcon from '@mui/icons-material/Settings'
import SkipNextIcon from '@mui/icons-material/SkipNext'

const STORAGE_KEY = 'studymesh-pomodoro-config-v1'
const RUNTIME_KEY = 'studymesh-pomodoro-runtime-v1'
type Phase = 'focus' | 'shortBreak' | 'longBreak'
interface Config {
  focus: number
  shortBreak: number
  longBreak: number
  cycle: number
  autoStart: boolean
  sound: boolean
  notifications: boolean
}
const defaults: Config = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
  cycle: 4,
  autoStart: false,
  sound: true,
  notifications: false,
}
const readConfig = (): Config => {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  } catch {
    return defaults
  }
}
const secondsFor = (phase: Phase, config: Config) => config[phase] * 60
const labelFor = (phase: Phase) =>
  phase === 'focus' ? 'Focus time' : phase === 'shortBreak' ? 'Short break' : 'Long break'

const PomodoroTool = ({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) => {
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('md'))
  const [config, setConfig] = useState(readConfig)
  const [editingConfig, setEditingConfig] = useState(config)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('focus')
  const [remaining, setRemaining] = useState(() => secondsFor('focus', config))
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [focusLabel, setFocusLabel] = useState('')
  const [history, setHistory] = useState<Array<{ at: number; label: string }>>([])

  const finishPhase = () => {
    if (config.sound) {
      const audio = new Audio(
        'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YRAAAAAAAP//AAD//wAA//8AAP//',
      )
      void audio.play().catch(() => undefined)
    }
    if (config.notifications && Notification.permission === 'granted') {
      new Notification('StudyMesh Pomodoro', { body: `${labelFor(phase)} complete.` })
    }
    if (phase === 'focus') {
      const nextCompleted = completed + 1
      const nextPhase = nextCompleted % config.cycle === 0 ? 'longBreak' : 'shortBreak'
      setCompleted(nextCompleted)
      setHistory((current) => [
        { at: Date.now(), label: focusLabel || 'Focus session' },
        ...current,
      ].slice(0, 20))
      setPhase(nextPhase)
      setRemaining(secondsFor(nextPhase, config))
    } else {
      setPhase('focus')
      setRemaining(secondsFor('focus', config))
    }
    setRunning(config.autoStart)
  }

  useEffect(() => {
    if (!running) return undefined
    const interval = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [running])

  useEffect(() => {
    let stored: {
      phase?: Phase
      remaining?: number
      running?: boolean
      completed?: number
      focusLabel?: string
      history?: Array<{ at: number; label: string }>
      savedAt?: number
    } | null = null
    try {
      stored = JSON.parse(localStorage.getItem(RUNTIME_KEY) || 'null')
    } catch {
      localStorage.removeItem(RUNTIME_KEY)
    }
    if (stored?.phase && typeof stored.remaining === 'number') {
      const elapsed = stored.running && stored.savedAt
        ? Math.floor((Date.now() - stored.savedAt) / 1000)
        : 0
      setPhase(stored.phase)
      setRemaining(Math.max(0, stored.remaining - elapsed))
      setRunning(Boolean(stored.running))
      setCompleted(stored.completed || 0)
      setFocusLabel(stored.focusLabel || '')
      setHistory(stored.history || [])
    }
    const focusTask = (event: Event) => {
      setFocusLabel((event as CustomEvent<{ label?: string }>).detail?.label || '')
      setPhase('focus')
      setRunning(true)
    }
    window.addEventListener('studymesh-pomodoro-focus-task', focusTask)
    return () => window.removeEventListener('studymesh-pomodoro-focus-task', focusTask)
  }, [])

  useEffect(() => {
    localStorage.setItem(RUNTIME_KEY, JSON.stringify({
      phase,
      remaining,
      running,
      completed,
      focusLabel,
      history,
      savedAt: Date.now(),
    }))
  }, [completed, focusLabel, history, phase, remaining, running])

  useEffect(() => {
    if (remaining === 0) finishPhase()
  }, [remaining])

  const progress = useMemo(
    () => 1 - remaining / secondsFor(phase, config),
    [config, phase, remaining],
  )
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0')
  const seconds = (remaining % 60).toString().padStart(2, '0')

  const panel = (
    <Paper
      elevation={10}
      sx={{
        width: mobile ? '100%' : 370,
        maxHeight: mobile ? '92dvh' : 'calc(100dvh - 32px)',
        overflow: 'auto',
        borderRadius: mobile ? '20px 20px 0 0' : 3,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          bgcolor: phase === 'focus' ? 'error.main' : 'success.main',
          color: 'common.white',
        }}
      >
        <Typography fontWeight={900} sx={{ flex: 1 }}>Pomodoro</Typography>
        <IconButton aria-label="Pomodoro settings" sx={{ color: 'inherit' }} onClick={() => setSettingsOpen(true)}>
          <SettingsIcon />
        </IconButton>
        <IconButton aria-label="Close Pomodoro" sx={{ color: 'inherit' }} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Stack spacing={2.5} alignItems="center" sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'center' }}>
          {([
            ['focus', 'Focus'],
            ['shortBreak', 'Short break'],
            ['longBreak', 'Long break'],
          ] as const).map(([nextPhase, label]) => (
            <Button
              key={nextPhase}
              size="small"
              variant={phase === nextPhase ? 'contained' : 'outlined'}
              onClick={() => {
                setRunning(false)
                setPhase(nextPhase)
                setRemaining(secondsFor(nextPhase, config))
              }}
            >
              {label}
            </Button>
          ))}
        </Box>
        <Box
          sx={{
            width: 230,
            height: 230,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: `conic-gradient(${phase === 'focus' ? theme.palette.error.main : theme.palette.success.main} ${progress * 360}deg, ${theme.palette.action.hover} 0deg)`,
            p: 1.5,
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              bgcolor: 'background.paper',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
            }}
          >
            <Box>
              <Typography variant="h2" fontWeight={900} fontFamily="monospace">
                {minutes}:{seconds}
              </Typography>
              <Typography fontWeight={800}>{labelFor(phase)}</Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={running ? <PauseIcon /> : <PlayArrowIcon />}
            onClick={() => setRunning((value) => !value)}
          >
            {running ? 'Pause' : 'Start'}
          </Button>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => {
              setRunning(false)
              setRemaining(secondsFor(phase, config))
            }}
          >
            Reset
          </Button>
          <Button size="small" startIcon={<SkipNextIcon />} onClick={finishPhase}>
            Skip
          </Button>
        </Box>
        <TextField
          size="small"
          fullWidth
          label="Focus on"
          placeholder="Optional task or study goal"
          value={focusLabel}
          onChange={(event) => setFocusLabel(event.target.value)}
        />
        <Typography color="text.secondary">
          {completed} focus sessions this run
        </Typography>
        {history.length > 0 && (
          <Stack spacing={0.5} sx={{ width: '100%' }}>
            <Typography fontWeight={800}>Recent focus</Typography>
            {history.slice(0, 3).map((entry) => (
              <Typography key={entry.at} variant="caption" color="text.secondary">
                {entry.label} · {new Date(entry.at).toLocaleTimeString()}
              </Typography>
            ))}
          </Stack>
        )}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[15, 25, 45].map((minutes) => (
            <Button
              key={minutes}
              size="small"
              variant="text"
              onClick={() => {
                setRunning(false)
                setPhase('focus')
                setRemaining(minutes * 60)
              }}
            >
              {minutes}m focus
            </Button>
          ))}
        </Box>
      </Stack>
    </Paper>
  )

  return (
    <>
      {open && (
        <Box
          sx={{
            position: 'fixed',
            left: mobile ? 0 : 16,
            bottom: mobile ? 0 : 16,
            zIndex: 1400,
          }}
        >
          {panel}
        </Box>
      )}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Pomodoro settings</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {(['focus', 'shortBreak', 'longBreak', 'cycle'] as const).map((key) => (
              <TextField
                key={key}
                type="number"
                label={key === 'cycle' ? 'Focus sessions per cycle' : `${labelFor(key as Phase)} minutes`}
                value={editingConfig[key]}
                onChange={(event) =>
                  setEditingConfig((current) => ({
                    ...current,
                    [key]: Math.max(1, Number(event.target.value)),
                  }))
                }
              />
            ))}
            {(['autoStart', 'sound', 'notifications'] as const).map((key) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography sx={{ flex: 1 }}>
                  {key === 'autoStart' ? 'Auto-start next phase' : key}
                </Typography>
                <Switch
                  checked={editingConfig[key]}
                  onChange={async (_, checked) => {
                    if (key === 'notifications' && checked && 'Notification' in window) {
                      await Notification.requestPermission()
                    }
                    setEditingConfig((current) => ({ ...current, [key]: checked }))
                  }}
                />
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfig(editingConfig)
              localStorage.setItem(STORAGE_KEY, JSON.stringify(editingConfig))
              if (!running) setRemaining(secondsFor(phase, editingConfig))
              setSettingsOpen(false)
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default PomodoroTool
