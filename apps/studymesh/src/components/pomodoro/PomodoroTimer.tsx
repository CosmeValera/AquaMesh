import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Slider,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Menu,
  MenuItem,
  Collapse,
  Tooltip,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as ResetIcon,
  SkipNext as SkipIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Timer as TimerIcon,
  Coffee as BreakIcon,
  LocalFireDepartment as StreakIcon,
  TrendingUp as StatsIcon,
  VolumeUp as SoundIcon,
  Notifications as NotifyIcon,
  CheckCircle as DoneIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export type TimerPhase = 'work' | 'shortBreak' | 'longBreak' | 'idle'

export interface PomodoroConfig {
  workDuration: number // minutes
  shortBreakDuration: number
  longBreakDuration: number
  pomodorosUntilLongBreak: number // default 4
  autoStartBreaks: boolean
  autoStartWork: boolean
  soundEnabled: boolean
  notificationEnabled: boolean
  keepAwake: boolean
}

export interface PomodoroSession {
  id: string
  type: 'work' | 'break'
  duration: number // actual minutes
  completedAt: Date
  interrupted: boolean
}

export interface PomodoroStats {
  totalPomodoros: number
  totalWorkMinutes: number
  totalBreakMinutes: number
  currentStreak: number
  longestStreak: number
  averagePerDay: number
  sessionsToday: number
}

export interface PomodoroState {
  phase: TimerPhase
  timeRemaining: number // seconds
  isRunning: boolean
  pomodoroCount: number // completed in current cycle
  totalPomodoros: number // all-time today
  sessions: PomodoroSession[]
}

// ============================================================================
// Constants
// ============================================================================

const defaultConfig: PomodoroConfig = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  pomodorosUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  soundEnabled: true,
  notificationEnabled: true,
  keepAwake: false,
}

const SOUND_URLS = {
  workEnd: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  breakEnd: 'https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3',
  tick: 'https://assets.mixkit.co/active_storage/sfx/125/125-preview.mp3',
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `pomodoro-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function getPhaseColor(phase: TimerPhase): string {
  switch (phase) {
    case 'work': return '#F44336'
    case 'shortBreak': return '#4CAF50'
    case 'longBreak': return '#2196F3'
    default: return '#9E9E9E'
  }
}

function getPhaseLabel(phase: TimerPhase): string {
  switch (phase) {
    case 'work': return '🍅 Focus Time'
    case 'shortBreak': return '☕ Short Break'
    case 'longBreak': return '🛋️ Long Break'
    default: return '⏸️ Ready'
  }
}

// ============================================================================
// Circular Progress Timer
// ============================================================================

interface CircularTimerProps {
  timeRemaining: number
  totalTime: number
  phase: TimerPhase
  size?: number
}

const CircularTimer: React.FC<CircularTimerProps> = ({
  timeRemaining,
  totalTime,
  phase,
  size = 280,
}) => {
  const radius = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  const progress = timeRemaining / totalTime
  const strokeDashoffset = circumference * (1 - progress)
  const color = getPhaseColor(phase)

  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Background circle */}
      <svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e0e0e0"
          strokeWidth={12}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease',
          }}
        />
      </svg>

      {/* Timer display */}
      <Box sx={{ textAlign: 'center', zIndex: 1 }}>
        <Typography
          variant="h2"
          sx={{
            fontSize: '4rem',
            fontWeight: 700,
            fontFamily: 'monospace',
            color: 'text.primary',
            letterSpacing: '0.05em',
          }}
        >
          {formatTime(timeRemaining)}
        </Typography>
        <Typography
          variant="subtitle1"
          sx={{
            color: color,
            fontWeight: 600,
            mt: 0.5,
          }}
        >
          {getPhaseLabel(phase)}
        </Typography>
      </Box>
    </Box>
  )
}

// ============================================================================
// Session History Item
// ============================================================================

interface SessionItemProps {
  session: PomodoroSession
  onDelete?: () => void
}

const SessionItem: React.FC<SessionItemProps> = ({ session, onDelete }) => {
  return (
    <ListItem
      sx={{
        bgcolor: session.type === 'work' ? 'error.50' : 'success.50',
        borderRadius: 1,
        mb: 0.5,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          bgcolor: session.type === 'work' ? 'error.main' : 'success.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          mr: 2,
        }}
      >
        {session.type === 'work' ? '🍅' : '☕'}
      </Box>
      <ListItemText
        primary={`${session.type === 'work' ? 'Focus' : 'Break'} - ${session.duration} min`}
        secondary={session.completedAt.toLocaleString()}
      />
      {session.interrupted && (
        <Chip label="Skipped" size="small" color="warning" sx={{ mr: 1 }} />
      )}
      {onDelete && (
        <ListItemSecondaryAction>
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </ListItemSecondaryAction>
      )}
    </ListItem>
  )
}

// ============================================================================
// Statistics View
// ============================================================================

interface StatsViewProps {
  sessions: PomodoroSession[]
  config: PomodoroConfig
}

const StatsView: React.FC<StatsViewProps> = ({ sessions, config }) => {
  const stats = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const todaySessions = sessions.filter((s) => s.completedAt >= todayStart && !s.interrupted)
    const workSessions = todaySessions.filter((s) => s.type === 'work')

    const totalWorkMinutes = workSessions.reduce((sum, s) => sum + s.duration, 0)
    const totalBreakMinutes = todaySessions.filter((s) => s.type !== 'work').reduce((sum, s) => sum + s.duration, 0)

    // Calculate streak (consecutive pomodoros)
    const sortedSessions = [...sessions].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0

    for (const session of sortedSessions) {
      if (session.type === 'work' && !session.interrupted) {
        tempStreak++
        currentStreak = tempStreak
      } else if (session.type !== 'work') {
        longestStreak = Math.max(longestStreak, tempStreak)
        tempStreak = 0
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak)

    return {
      totalPomodoros: workSessions.length,
      totalWorkMinutes,
      totalBreakMinutes,
      currentStreak,
      longestStreak,
      averagePerDay: workSessions.length,
      sessionsToday: workSessions.length,
    }
  }, [sessions])

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        📊 Today's Statistics
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        <Paper elevation={2} sx={{ p: 2, textAlign: 'center', bgcolor: 'error.50' }}>
          <Typography variant="h3" color="error.main" fontWeight={700}>
            {stats.totalPomodoros}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            🍅 Pomodoros
          </Typography>
        </Paper>

        <Paper elevation={2} sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
          <Typography variant="h3" color="primary.main" fontWeight={700}>
            {Math.floor(stats.totalWorkMinutes / 60)}h {stats.totalWorkMinutes % 60}m
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ⏱️ Focus Time
          </Typography>
        </Paper>

        <Paper elevation={2} sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
          <Typography variant="h3" color="success.main" fontWeight={700}>
            {stats.sessionsToday}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            📅 Sessions Today
          </Typography>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        <Paper elevation={1} sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <StreakIcon color="warning" />
            <Typography variant="subtitle2">Current Streak</Typography>
          </Box>
          <Typography variant="h4" fontWeight={600}>
            {stats.currentStreak} 🍅
          </Typography>
        </Paper>

        <Paper elevation={1} sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <StatsIcon color="info" />
            <Typography variant="subtitle2">Longest Streak</Typography>
          </Box>
          <Typography variant="h4" fontWeight={600}>
            {stats.longestStreak} 🍅
          </Typography>
        </Paper>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" gutterBottom>
        📅 Session History
      </Typography>
      <List dense disablePadding sx={{ maxHeight: 200, overflow: 'auto' }}>
        {sessions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No sessions recorded yet. Start your first pomodoro!
          </Typography>
        ) : (
          sessions.slice(-10).reverse().map((session) => (
            <SessionItem key={session.id} session={session} />
          ))
        )}
      </List>
    </Box>
  )
}

// ============================================================================
// Settings Dialog
// ============================================================================

interface SettingsDialogProps {
  open: boolean
  config: PomodoroConfig
  onChange: (config: PomodoroConfig) => void
  onClose: () => void
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, config, onChange, onClose }) => {
  const [localConfig, setLocalConfig] = useState(config)

  const handleSave = () => {
    onChange(localConfig)
    onClose()
  }

  const updateConfig = (key: keyof PomodoroConfig, value: any) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>⚙️ Pomodoro Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          {/* Durations */}
          <Typography variant="subtitle2" gutterBottom>
            Timer Durations (minutes)
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Focus Duration: {localConfig.workDuration}
            </Typography>
            <Slider
              value={localConfig.workDuration}
              min={5}
              max={60}
              step={5}
              onChange={(_, v) => updateConfig('workDuration', v)}
              marks={[
                { value: 15, label: '15m' },
                { value: 25, label: '25m' },
                { value: 45, label: '45m' },
              ]}
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Short Break: {localConfig.shortBreakDuration}
            </Typography>
            <Slider
              value={localConfig.shortBreakDuration}
              min={1}
              max={15}
              step={1}
              onChange={(_, v) => updateConfig('shortBreakDuration', v)}
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Long Break: {localConfig.longBreakDuration}
            </Typography>
            <Slider
              value={localConfig.longBreakDuration}
              min={5}
              max={30}
              step={5}
              onChange={(_, v) => updateConfig('longBreakDuration', v)}
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Pomodoros until long break: {localConfig.pomodorosUntilLongBreak}
            </Typography>
            <Slider
              value={localConfig.pomodorosUntilLongBreak}
              min={2}
              max={8}
              step={1}
              onChange={(_, v) => updateConfig('pomodorosUntilLongBreak', v)}
              marks={[
                { value: 2, label: '2' },
                { value: 4, label: '4' },
                { value: 6, label: '6' },
              ]}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Options */}
          <Typography variant="subtitle2" gutterBottom>
            Automation
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={localConfig.autoStartBreaks}
                onChange={(e) => updateConfig('autoStartBreaks', e.target.checked)}
              />
            }
            label="Auto-start breaks"
          />

          <FormControlLabel
            control={
              <Switch
                checked={localConfig.autoStartWork}
                onChange={(e) => updateConfig('autoStartWork', e.target.checked)}
              />
            }
            label="Auto-start work sessions"
          />

          <Divider sx={{ my: 2 }} />

          {/* Notifications */}
          <Typography variant="subtitle2" gutterBottom>
            Notifications
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={localConfig.soundEnabled}
                onChange={(e) => updateConfig('soundEnabled', e.target.checked)}
              />
            }
            label="Sound alerts"
          />

          <FormControlLabel
            control={
              <Switch
                checked={localConfig.notificationEnabled}
                onChange={(e) => updateConfig('notificationEnabled', e.target.checked)}
              />
            }
            label="Browser notifications"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================================================
// Main Pomodoro Timer Component
// ============================================================================

interface PomodoroTimerProps {
  onComplete?: (session: PomodoroSession) => void
  onClose?: () => void
}

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ onComplete, onClose }) => {
  const [config, setConfig] = useState<PomodoroConfig>(defaultConfig)
  const [state, setState] = useState<PomodoroState>({
    phase: 'idle',
    timeRemaining: config.workDuration * 60,
    isRunning: false,
    pomodoroCount: 0,
    totalPomodoros: 0,
    sessions: [],
  })
  const [showSettings, setShowSettings] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0) // for current session
  const [showMenu, setShowMenu] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studymesh-pomodoro-sessions')
      if (stored) {
        const sessions = JSON.parse(stored).map((s: any) => ({
          ...s,
          completedAt: new Date(s.completedAt),
        }))
        setState((prev) => ({ ...prev, sessions }))
      }
    } catch (e) {
      console.error('Failed to load pomodoro sessions:', e)
    }
  }, [])

  // Save sessions to localStorage
  useEffect(() => {
    localStorage.setItem('studymesh-pomodoro-sessions', JSON.stringify(state.sessions))
  }, [state.sessions])

  // Play sound helper
  const playSound = useCallback((url: string) => {
    if (config.soundEnabled && audioRef.current) {
      audioRef.current.src = url
      audioRef.current.play().catch(() => {})
    }
  }, [config.soundEnabled])

  // Send notification
  const sendNotification = useCallback((title: string, body: string) => {
    if (config.notificationEnabled && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '🍅' })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification(title, { body, icon: '🍅' })
          }
        })
      }
    }
  }, [config.notificationEnabled])

  // Timer tick
  useEffect(() => {
    if (state.isRunning && state.timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          const newTime = prev.timeRemaining - 1
          if (newTime <= 0) {
            // Timer completed
            return prev
          }
          return { ...prev, timeRemaining: newTime }
        })
        setElapsedTime((e) => e + 1)
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [state.isRunning, state.timeRemaining])

  // Handle timer completion
  useEffect(() => {
    if (state.timeRemaining === 0 && state.phase !== 'idle') {
      // Record session
      const completedSession: PomodoroSession = {
        id: generateId(),
        type: state.phase === 'work' ? 'work' : 'break',
        duration: state.phase === 'work' ? config.workDuration :
                  state.phase === 'shortBreak' ? config.shortBreakDuration :
                  config.longBreakDuration,
        completedAt: new Date(),
        interrupted: false,
      }

      setState((prev) => ({
        ...prev,
        sessions: [completedSession, ...prev.sessions],
        totalPomodoros: prev.phase === 'work' ? prev.totalPomodoros + 1 : prev.totalPomodoros,
        pomodoroCount: prev.phase === 'work' ?
                      (prev.pomodoroCount + 1) % config.pomodorosUntilLongBreak :
                      prev.pomodoroCount,
      }))

      onComplete?.(completedSession)

      // Notifications
      if (state.phase === 'work') {
        playSound(SOUND_URLS.workEnd)
        sendNotification('🍅 Pomodoro Complete!', 'Time for a break!')
      } else {
        playSound(SOUND_URLS.breakEnd)
        sendNotification('☕ Break Over!', 'Ready to focus again?')
      }

      // Determine next phase
      if (state.phase === 'work') {
        const nextPhase = (state.pomodoroCount + 1) >= config.pomodorosUntilLongBreak ? 'longBreak' : 'shortBreak'
        const nextDuration = nextPhase === 'longBreak' ? config.longBreakDuration : config.shortBreakDuration
        setState((prev) => ({
          ...prev,
          phase: nextPhase,
          timeRemaining: nextDuration * 60,
          isRunning: config.autoStartBreaks,
        }))
      } else {
        setState((prev) => ({
          ...prev,
          phase: 'work',
          timeRemaining: config.workDuration * 60,
          isRunning: config.autoStartWork,
        }))
      }
      setElapsedTime(0)
    }
  }, [state.timeRemaining, state.phase])

  const handleStart = useCallback(() => {
    if (state.phase === 'idle') {
      setState((prev) => ({
        ...prev,
        phase: 'work',
        timeRemaining: config.workDuration * 60,
        isRunning: true,
      }))
    } else {
      setState((prev) => ({ ...prev, isRunning: true }))
    }
  }, [state.phase, config.workDuration])

  const handlePause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }))
  }, [])

  const handleReset = useCallback(() => {
    const duration = state.phase === 'work' ? config.workDuration :
                   state.phase === 'shortBreak' ? config.shortBreakDuration :
                   state.phase === 'longBreak' ? config.longBreakDuration :
                   config.workDuration
    setState((prev) => ({
      ...prev,
      timeRemaining: duration * 60,
      isRunning: false,
    }))
    setElapsedTime(0)
  }, [state.phase, config])

  const handleSkip = useCallback(() => {
    // Record as interrupted
    const interruptedSession: PomodoroSession = {
      id: generateId(),
      type: state.phase === 'work' ? 'work' : 'break',
      duration: Math.floor(elapsedTime / 60),
      completedAt: new Date(),
      interrupted: true,
    }

    setState((prev) => ({
      ...prev,
      sessions: [interruptedSession, ...prev.sessions],
    }))

    // Move to next phase
    if (state.phase === 'work') {
      const nextPhase = (state.pomodoroCount + 1) >= config.pomodorosUntilLongBreak ? 'longBreak' : 'shortBreak'
      const nextDuration = nextPhase === 'longBreak' ? config.longBreakDuration : config.shortBreakDuration
      setState((prev) => ({
        ...prev,
        phase: nextPhase,
        timeRemaining: nextDuration * 60,
        isRunning: false,
      }))
    } else {
      setState((prev) => ({
        ...prev,
        phase: 'work',
        timeRemaining: config.workDuration * 60,
        isRunning: false,
      }))
    }
    setElapsedTime(0)
  }, [state.phase, state.pomodoroCount, config, elapsedTime])

  const handleConfigChange = useCallback((newConfig: PomodoroConfig) => {
    setConfig(newConfig)
    // Update time remaining if idle
    if (state.phase === 'idle') {
      setState((prev) => ({ ...prev, timeRemaining: newConfig.workDuration * 60 }))
    }
  }, [state.phase])

  const getTotalTime = () => {
    if (state.phase === 'work') return config.workDuration * 60
    if (state.phase === 'shortBreak') return config.shortBreakDuration * 60
    if (state.phase === 'longBreak') return config.longBreakDuration * 60
    return config.workDuration * 60
  }

  const phaseColor = getPhaseColor(state.phase)

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 360,
        borderRadius: 3,
        overflow: 'hidden',
        zIndex: 9999,
      }}
    >
      {/* Hidden audio for sounds */}
      <audio ref={audioRef} />

      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: phaseColor,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimerIcon />
          <Typography variant="h6">🍅 Pomodoro Timer</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            sx={{ color: 'inherit' }}
            onClick={(e) => {
              setMenuAnchor(e.currentTarget)
              setShowMenu(true)
            }}
          >
            <MoreIcon />
          </IconButton>
          {onClose && (
            <IconButton size="small" sx={{ color: 'inherit' }} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={showMenu}
        onClose={() => setShowMenu(false)}
      >
        <MenuItem onClick={() => { setShowSettings(true); setShowMenu(false); }}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem onClick={() => { setShowStats(!showStats); setShowMenu(false); }}>
          <ListItemIcon><StatsIcon fontSize="small" /></ListItemIcon>
          {showStats ? 'Hide Stats' : 'Show Stats'}
        </MenuItem>
      </Menu>

      {/* Main Timer */}
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Progress ring */}
        <CircularTimer
          timeRemaining={state.timeRemaining}
          totalTime={getTotalTime()}
          phase={state.phase}
          size={240}
        />

        {/* Controls */}
        <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
          {!state.isRunning ? (
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<PlayIcon />}
              onClick={handleStart}
            >
              {state.phase === 'idle' ? 'Start' : 'Resume'}
            </Button>
          ) : (
            <Button
              variant="outlined"
              color="primary"
              size="large"
              startIcon={<PauseIcon />}
              onClick={handlePause}
            >
              Pause
            </Button>
          )}

          <IconButton onClick={handleReset} title="Reset">
            <ResetIcon />
          </IconButton>

          <IconButton onClick={handleSkip} title="Skip to next">
            <SkipIcon />
          </IconButton>
        </Box>

        {/* Session indicators */}
        <Box sx={{ display: 'flex', gap: 0.5, mt: 2 }}>
          {Array.from({ length: config.pomodorosUntilLongBreak }).map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: i < state.pomodoroCount ? 'error.main' : 'grey.300',
                transition: 'all 0.3s',
              }}
            />
          ))}
          <Typography variant="caption" sx={{ ml: 1, alignSelf: 'center' }}>
            {state.pomodoroCount}/{config.pomodorosUntilLongBreak}
          </Typography>
        </Box>

        {/* Quick stats */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Chip
            icon={<DoneIcon />}
            label={`${state.totalPomodoros} today`}
            size="small"
            sx={{ bgcolor: 'error.50' }}
          />
          <Chip
            icon={<StreakIcon />}
            label={`${state.sessions.filter(s => !s.interrupted).length} completed`}
            size="small"
            sx={{ bgcolor: 'success.50' }}
          />
        </Box>
      </Box>

      {/* Stats Panel (collapsible) */}
      <Collapse in={showStats}>
        <StatsView sessions={state.sessions} config={config} />
      </Collapse>

      {/* Settings Dialog */}
      <SettingsDialog
        open={showSettings}
        config={config}
        onChange={handleConfigChange}
        onClose={() => setShowSettings(false)}
      />

      {/* Footer */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'grey.100',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {state.isRunning ? `Elapsed: ${Math.floor(elapsedTime / 60)}m ${elapsedTime % 60}s` : 'Paused'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {state.sessions.filter(s => !s.interrupted).length} completed today
        </Typography>
      </Box>
    </Paper>
  )
}

export default PomodoroTimer

// ============================================================================
// Hook for Pomodoro Timer
// ============================================================================

export function usePomodoro() {
  const [isOpen, setIsOpen] = useState(false)
  const [sessions, setSessions] = useState<PomodoroSession[]>([])

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studymesh-pomodoro-sessions')
      if (stored) {
        const parsed = JSON.parse(stored).map((s: any) => ({
          ...s,
          completedAt: new Date(s.completedAt),
        }))
        setSessions(parsed)
      }
    } catch (e) {
      console.error('Failed to load sessions:', e)
    }
  }, [])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const addSession = useCallback((session: PomodoroSession) => {
    setSessions((prev) => {
      const next = [session, ...prev].slice(0, 100)
      localStorage.setItem('studymesh-pomodoro-sessions', JSON.stringify(next))
      return next
    })
  }, [])

  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todaySessions = sessions.filter((s) => s.completedAt >= today && !s.interrupted)
    const workSessions = todaySessions.filter((s) => s.type === 'work')

    return {
      totalPomodoros: workSessions.length,
      totalWorkMinutes: workSessions.reduce((sum, s) => sum + s.duration, 0),
      currentStreak: workSessions.length,
    }
  }, [sessions])

  return {
    isOpen,
    sessions,
    stats,
    open,
    close,
    addSession,
    PomodoroTimer: PomodoroTimer as React.FC<{
      onComplete?: (session: PomodoroSession) => void
      onClose?: () => void
    }>,
  }
}