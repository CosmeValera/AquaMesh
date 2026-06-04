import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  TextField,
  List,
  ListItem,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  Tooltip,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Fab,
  Collapse,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material'
import {
  Today as TodayIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  ThumbUp as ThumbsUpIcon,
  CheckCircle as CheckIcon,
  Flag as FlagIcon,
  Note as NoteIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Add as AddIcon,
  Notifications as NotifyIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export type ReviewItemType = 'gratitude' | 'accomplishment' | 'goal' | 'habit' | 'note' | 'reflection'

export interface ReviewItem {
  id: string
  type: ReviewItemType
  content: string
  isCompleted: boolean
  isStarred: boolean
  tags: string[]
  createdAt: Date
}

export interface DailyReviewEntry {
  date: string // YYYY-MM-DD format
  items: ReviewItem[]
  mood?: number // 1-5 scale
  energy?: number // 1-5 scale
  focus?: number // 1-5 scale
  notes: string
  createdAt: Date
  updatedAt: Date
}

export interface DailyReviewConfig {
  showMoodTracking: boolean
  showEnergyTracking: boolean
  showFocusTracking: boolean
  autoSave: boolean
  reminderTime: string // HH:MM format
  showOnStartup: boolean
}

// ============================================================================
// Constants
// ============================================================================

const defaultConfig: DailyReviewConfig = {
  showMoodTracking: true,
  showEnergyTracking: true,
  showFocusTracking: true,
  autoSave: true,
  reminderTime: '09:00',
  showOnStartup: false,
}

const ITEM_TYPE_ICONS: Record<ReviewItemType, React.ReactNode> = {
  gratitude: '🙏',
  accomplishment: '🎉',
  goal: '🎯',
  habit: '✓',
  note: '📝',
  reflection: '💭',
}

const ITEM_TYPE_COLORS: Record<ReviewItemType, string> = {
  gratitude: '#E91E63',
  accomplishment: '#4CAF50',
  goal: '#2196F3',
  habit: '#FF9800',
  note: '#9C27B0',
  reflection: '#00BCD4',
}

const ITEM_TYPE_LABELS: Record<ReviewItemType, string> = {
  gratitude: 'Gratitude',
  accomplishment: 'Accomplishment',
  goal: 'Goal',
  habit: 'Habit',
  note: 'Quick Note',
  reflection: 'Reflection',
}

const MOOD_EMOJIS = ['', '😫', '😕', '😐', '🙂', '😊']

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function isToday(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function getDateRange(center: Date, days: number): Date[] {
  const dates: Date[] = []
  for (let i = -Math.floor(days / 2); i <= Math.floor(days / 2); i++) {
    const d = new Date(center)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

// ============================================================================
// Calendar Mini View
// ============================================================================

interface CalendarMiniProps {
  currentDate: Date
  entries: Map<string, DailyReviewEntry>
  onSelectDate: (date: Date) => void
}

const CalendarMini: React.FC<CalendarMiniProps> = ({ currentDate, entries, onSelectDate }) => {
  const [weekDates, setWeekDates] = useState<Date[]>([])

  useEffect(() => {
    setWeekDates(getDateRange(currentDate, 7))
  }, [currentDate])

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        justifyContent: 'center',
        alignItems: 'center',
        py: 1,
        bgcolor: 'grey.50',
        borderRadius: 2,
        mb: 2,
      }}
    >
      <IconButton
        size="small"
        onClick={() => {
          const prev = new Date(currentDate)
          prev.setDate(prev.getDate() - 7)
          onSelectDate(prev)
        }}
      >
        <PrevIcon fontSize="small" />
      </IconButton>

      <Box sx={{ display: 'flex', gap: 1 }}>
        {weekDates.map((date, idx) => {
          const dateKey = formatDateKey(date)
          const entry = entries.get(dateKey)
          const hasEntry = !!entry
          const isCurrentDay = isToday(date)
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)
          const dayNum = date.getDate()

          return (
            <Box
              key={idx}
              onClick={() => onSelectDate(date)}
              sx={{
                width: 40,
                height: 50,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: 1,
                bgcolor: isCurrentDay ? 'primary.main' : 'transparent',
                color: isCurrentDay ? 'primary.contrastText' : 'text.primary',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: isCurrentDay ? 'primary.dark' : 'grey.200',
                },
              }}
            >
              <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.7 }}>
                {dayName}
              </Typography>
              <Typography variant="subtitle2" fontWeight={600}>
                {dayNum}
              </Typography>
              {hasEntry && (
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: isCurrentDay ? 'white' : 'success.main',
                    mt: 0.5,
                  }}
                />
              )}
            </Box>
          )
        })}
      </Box>

      <IconButton
        size="small"
        onClick={() => {
          const next = new Date(currentDate)
          next.setDate(next.getDate() + 7)
          onSelectDate(next)
        }}
      >
        <NextIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

// ============================================================================
// Mood/Energy/Focus Tracker
// ============================================================================

interface TrackerSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  emoji?: string[]
}

const TrackerSlider: React.FC<TrackerSliderProps> = ({
  label,
  value,
  onChange,
  min = 1,
  max = 5,
  emoji = MOOD_EMOJIS,
}) => {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="subtitle2" fontWeight={600}>
          {emoji[value]} {value}/{max}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {Array.from({ length: max }, (_, i) => i + min).map((v) => (
          <Button
            key={v}
            size="small"
            variant={value === v ? 'contained' : 'outlined'}
            onClick={() => onChange(v)}
            sx={{
              minWidth: 36,
              height: 28,
              fontSize: '0.8rem',
            }}
          >
            {emoji[v]}
          </Button>
        ))}
      </Box>
    </Box>
  )
}

// ============================================================================
// Review Item Card
// ============================================================================

interface ReviewItemCardProps {
  item: ReviewItem
  onToggleComplete: (id: string) => void
  onToggleStar: (id: string) => void
  onEdit: (item: ReviewItem) => void
  onDelete: (id: string) => void
}

const ReviewItemCard: React.FC<ReviewItemCardProps> = ({
  item,
  onToggleComplete,
  onToggleStar,
  onEdit,
  onDelete,
}) => {
  const [showActions, setShowActions] = useState(false)

  return (
    <Paper
      elevation={1}
      sx={{
        mb: 1,
        overflow: 'hidden',
        opacity: item.isCompleted ? 0.7 : 1,
        borderLeft: `4px solid ${ITEM_TYPE_COLORS[item.type]}`,
        transition: 'all 0.2s',
        '&:hover': {
          elevation: 2,
        },
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', p: 1.5 }}>
        {/* Complete Toggle */}
        <Button
          size="small"
          onClick={() => onToggleComplete(item.id)}
          sx={{
            minWidth: 32,
            height: 32,
            borderRadius: '50%',
            p: 0,
            mr: 1.5,
            bgcolor: item.isCompleted ? 'success.main' : 'grey.200',
            color: item.isCompleted ? 'white' : 'text.secondary',
            '&:hover': {
              bgcolor: item.isCompleted ? 'success.dark' : 'grey.300',
            },
          }}
        >
          {item.isCompleted ? <CheckIcon fontSize="small" /> : ''}
        </Button>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 500,
                textDecoration: item.isCompleted ? 'line-through' : 'none',
                color: item.isCompleted ? 'text.secondary' : 'text.primary',
              }}
            >
              {ITEM_TYPE_ICONS[item.type]} {ITEM_TYPE_LABELS[item.type]}
            </Typography>
          </Box>

          <Typography
            variant="body2"
            sx={{
              color: item.isCompleted ? 'text.secondary' : 'text.primary',
              textDecoration: item.isCompleted ? 'line-through' : 'none',
            }}
          >
            {item.content}
          </Typography>

          {item.tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
              {item.tags.map((tag, idx) => (
                <Chip
                  key={idx}
                  label={tag}
                  size="small"
                  sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${ITEM_TYPE_COLORS[item.type]}20` }}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onToggleStar(item.id)}
            sx={{ color: item.isStarred ? 'warning.main' : 'text.secondary' }}
          >
            {item.isStarred ? '★' : '☆'}
          </IconButton>
          <IconButton size="small" onClick={() => onEdit(item)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(item.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  )
}

// ============================================================================
// Add Item Dialog
// ============================================================================

interface AddItemDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (item: ReviewItem) => void
  defaultType?: ReviewItemType
}

const AddItemDialog: React.FC<AddItemDialogProps> = ({ open, onClose, onAdd, defaultType = 'note' }) => {
  const [type, setType] = useState<ReviewItemType>(defaultType)
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const handleAdd = () => {
    if (!content.trim()) return
    onAdd({
      id: generateId(),
      type,
      content: content.trim(),
      isCompleted: false,
      isStarred: false,
      tags,
      createdAt: new Date(),
    })
    setContent('')
    setTags([])
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        ✏️ Add {ITEM_TYPE_LABELS[type]}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          {/* Type Selector */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Type
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {(Object.keys(ITEM_TYPE_LABELS) as ReviewItemType[]).map((t) => (
                <Chip
                  key={t}
                  label={`${ITEM_TYPE_ICONS[t]} ${ITEM_TYPE_LABELS[t]}`}
                  size="small"
                  variant={type === t ? 'filled' : 'outlined'}
                  onClick={() => setType(t)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: type === t ? ITEM_TYPE_COLORS[t] : 'transparent',
                    color: type === t ? 'white' : 'text.primary',
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Content */}
          <TextField
            fullWidth
            multiline
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to add?"
            autoFocus
            sx={{ mb: 2 }}
          />

          {/* Tags */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Tags (optional)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {tags.map((tag, idx) => (
                <Chip
                  key={idx}
                  label={tag}
                  size="small"
                  onDelete={() => setTags(tags.filter((t) => t !== tag))}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                      setTags([...tags, tagInput.trim()])
                      setTagInput('')
                    }
                  }
                }}
              />
              <Button variant="outlined" size="small" onClick={() => {
                if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                  setTags([...tags, tagInput.trim()])
                  setTagInput('')
                }
              }}>
                Add
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!content.trim()}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================================================
// Statistics Summary
// ============================================================================

interface StatsSummaryProps {
  entries: Map<string, DailyReviewEntry>
  currentDate: Date
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ entries, currentDate }) => {
  const stats = useMemo(() => {
    // Get last 7 days
    const last7Days: DailyReviewEntry[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = formatDateKey(d)
      const entry = entries.get(key)
      if (entry) last7Days.push(entry)
    }

    const totalItems = last7Days.reduce((sum, e) => sum + e.items.length, 0)
    const completedItems = last7Days.reduce(
      (sum, e) => sum + e.items.filter((i) => i.isCompleted).length,
      0
    )
    const starredItems = last7Days.reduce(
      (sum, e) => sum + e.items.filter((i) => i.isStarred).length,
      0
    )

    const avgMood = last7Days.filter((e) => e.mood).reduce((sum, e, _, arr) => sum + (e.mood || 0) / arr.length, 0)
    const avgEnergy = last7Days.filter((e) => e.energy).reduce((sum, e, _, arr) => sum + (e.energy || 0) / arr.length, 0)
    const avgFocus = last7Days.filter((e) => e.focus).reduce((sum, e, _, arr) => sum + (e.focus || 0) / arr.length, 0)

    return {
      totalItems,
      completedItems,
      completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      starredItems,
      avgMood: Math.round(avgMood * 10) / 10,
      avgEnergy: Math.round(avgEnergy * 10) / 10,
      avgFocus: Math.round(avgFocus * 10) / 10,
      streak: last7Days.length,
    }
  }, [entries, currentDate])

  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.50' }}>
      <Typography variant="subtitle2" gutterBottom>
        📊 Last 7 Days Summary
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={700} color="primary.main">
            {stats.totalItems}
          </Typography>
          <Typography variant="caption">Items</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={700} color="success.main">
            {stats.completedItems}
          </Typography>
          <Typography variant="caption">Done</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={700} color="warning.main">
            {stats.completionRate}%
          </Typography>
          <Typography variant="caption">Rate</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={700} color="info.main">
            {stats.streak} 📅
          </Typography>
          <Typography variant="caption">Days</Typography>
        </Box>
      </Box>
      {(stats.avgMood > 0 || stats.avgEnergy > 0 || stats.avgFocus > 0) && (
        <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center' }}>
          <Chip label={`😊 ${stats.avgMood}`} size="small" />
          <Chip label={`⚡ ${stats.avgEnergy}`} size="small" />
          <Chip label={`🎯 ${stats.avgFocus}`} size="small" />
        </Box>
      )}
    </Paper>
  )
}

// ============================================================================
// Main Daily Review Panel
// ============================================================================

interface DailyReviewPanelProps {
  onClose?: () => void
}

// Demo entries
const createDemoEntries = (): Map<string, DailyReviewEntry> => {
  const entries = new Map<string, DailyReviewEntry>()

  // Today
  const todayKey = formatDateKey(new Date())
  entries.set(todayKey, {
    date: todayKey,
    items: [
      { id: 'item-1', type: 'gratitude', content: 'Grateful for the supportive study group', isCompleted: true, isStarred: true, tags: ['study'], createdAt: new Date() },
      { id: 'item-2', type: 'accomplishment', content: 'Completed 3 chapters of Machine Learning course', isCompleted: true, isStarred: false, tags: ['ml', 'course'], createdAt: new Date() },
      { id: 'item-3', type: 'goal', content: 'Review neural networks notes for 30 minutes', isCompleted: false, isStarred: false, tags: ['deep-learning'], createdAt: new Date() },
      { id: 'item-4', type: 'habit', content: 'Meditated for 10 minutes', isCompleted: true, isStarred: false, tags: ['wellness'], createdAt: new Date() },
    ],
    mood: 4,
    energy: 3,
    focus: 4,
    notes: 'Productive day, covered neural networks basics. Need to review backpropagation tomorrow.',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  // Yesterday
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = formatDateKey(yesterday)
  entries.set(yesterdayKey, {
    date: yesterdayKey,
    items: [
      { id: 'item-5', type: 'gratitude', content: 'Thanks for help understanding gradient descent', isCompleted: true, isStarred: false, tags: ['study'], createdAt: yesterday },
      { id: 'item-6', type: 'reflection', content: 'Should spend more time on practical coding exercises', isCompleted: true, isStarred: true, tags: ['improvement'], createdAt: yesterday },
    ],
    mood: 3,
    energy: 3,
    focus: 2,
    notes: 'Struggled with math concepts, need to find better resources.',
    createdAt: yesterday,
    updatedAt: yesterday,
  })

  return entries
}

const DailyReviewPanel: React.FC<DailyReviewPanelProps> = ({ onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entries, setEntries] = useState<Map<string, DailyReviewEntry>>(createDemoEntries())
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<ReviewItem | null>(null)
  const [config, setConfig] = useState<DailyReviewConfig>(defaultConfig)

  const currentEntry = useMemo(() => {
    const key = formatDateKey(currentDate)
    return entries.get(key) || {
      date: key,
      items: [],
      mood: undefined,
      energy: undefined,
      focus: undefined,
      notes: '',
      createdAt: currentDate,
      updatedAt: currentDate,
    }
  }, [entries, currentDate])

  // Auto-save
  useEffect(() => {
    if (config.autoSave) {
      localStorage.setItem('studymesh-daily-review', JSON.stringify(Array.from(entries.entries())))
    }
  }, [entries, config.autoSave])

  const updateEntry = useCallback((updated: DailyReviewEntry) => {
    setEntries((prev) => {
      const next = new Map(prev)
      next.set(updated.date, updated)
      return next
    })
  }, [])

  const handleAddItem = useCallback((item: ReviewItem) => {
    const updated = {
      ...currentEntry,
      items: [...currentEntry.items, item],
      updatedAt: new Date(),
    }
    updateEntry(updated)
  }, [currentEntry, updateEntry])

  const handleToggleComplete = useCallback((id: string) => {
    const updated = {
      ...currentEntry,
      items: currentEntry.items.map((item) =>
        item.id === id ? { ...item } : item
      ),
      updatedAt: new Date(),
    }
    updated.items = updated.items.map((item) =>
      item.id === id ? { ...item, isCompleted: !item.isCompleted } : item
    )
    updateEntry(updated)
  }, [currentEntry, updateEntry])

  const handleToggleStar = useCallback((id: string) => {
    const updated = {
      ...currentEntry,
      items: currentEntry.items.map((item) =>
        item.id === id ? { ...item, isStarred: !item.isStarred } : item
      ),
      updatedAt: new Date(),
    }
    updateEntry(updated)
  }, [currentEntry, updateEntry])

  const handleEditItem = useCallback((item: ReviewItem) => {
    const updated = {
      ...currentEntry,
      items: currentEntry.items.map((i) => (i.id === item.id ? item : i)),
      updatedAt: new Date(),
    }
    updateEntry(updated)
    setEditingItem(null)
  }, [currentEntry, updateEntry])

  const handleDeleteItem = useCallback((id: string) => {
    const updated = {
      ...currentEntry,
      items: currentEntry.items.filter((item) => item.id !== id),
      updatedAt: new Date(),
    }
    updateEntry(updated)
  }, [currentEntry, updateEntry])

  const handleMoodChange = useCallback((mood: number) => {
    const updated = { ...currentEntry, mood, updatedAt: new Date() }
    updateEntry(updated)
  }, [currentEntry, updateEntry])

  const handleEnergyChange = useCallback((energy: number) => {
    const updated = { ...currentEntry, energy, updatedAt: new Date() }
    updateEntry(updated)
  }, [currentEntry, updateEntry])

  const handleFocusChange = useCallback((focus: number) => {
    const updated = { ...currentEntry, focus, updatedAt: new Date() }
    updateEntry(updated)
  }, [currentEntry, updateEntry])

  const handleNotesChange = useCallback((notes: string) => {
    const updated = { ...currentEntry, notes, updatedAt: new Date() }
    updateEntry(updated)
  }, [currentEntry, updateEntry])

  const handleSelectDate = useCallback((date: Date) => {
    setCurrentDate(date)
  }, [])

  // Group items by type for display
  const groupedItems = useMemo(() => {
    const groups: Record<ReviewItemType, ReviewItem[]> = {
      gratitude: [],
      accomplishment: [],
      goal: [],
      habit: [],
      note: [],
      reflection: [],
    }
    for (const item of currentEntry.items) {
      groups[item.type].push(item)
    }
    return groups
  }, [currentEntry.items])

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: Math.min(650, '95vw'),
        maxHeight: '85vh',
        overflow: 'hidden',
        borderRadius: 3,
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'primary.dark',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TodayIcon />
          <Typography variant="h6">📅 Daily Review</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setCurrentDate(new Date())}
            sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)' }}
          >
            Today
          </Button>
          {onClose && (
            <IconButton sx={{ color: 'inherit' }} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Date Display */}
      <Box sx={{ px: 2, py: 1, textAlign: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" fontWeight={600}>
          {isToday(currentDate) ? 'Today' : getDayName(currentDate)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Typography>
      </Box>

      {/* Calendar Mini */}
      <Box sx={{ px: 2 }}>
        <CalendarMini
          currentDate={currentDate}
          entries={entries}
          onSelectDate={handleSelectDate}
        />
      </Box>

      {/* Stats Summary */}
      <Box sx={{ px: 2 }}>
        <StatsSummary entries={entries} currentDate={currentDate} />
      </Box>

      {/* Tracking */}
      {(config.showMoodTracking || config.showEnergyTracking || config.showFocusTracking) && (
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {config.showMoodTracking && (
              <Box sx={{ flex: 1 }}>
                <TrackerSlider
                  label="😊 Mood"
                  value={currentEntry.mood || 3}
                  onChange={handleMoodChange}
                  emoji={MOOD_EMOJIS}
                />
              </Box>
            )}
            {config.showEnergyTracking && (
              <Box sx={{ flex: 1 }}>
                <TrackerSlider
                  label="⚡ Energy"
                  value={currentEntry.energy || 3}
                  onChange={handleEnergyChange}
                  emoji={['', '😫', '😕', '😐', '💪', '🚀']}
                />
              </Box>
            )}
            {config.showFocusTracking && (
              <Box sx={{ flex: 1 }}>
                <TrackerSlider
                  label="🎯 Focus"
                  value={currentEntry.focus || 3}
                  onChange={handleFocusChange}
                  emoji={['', '😵', '😕', '😐', '💡', '🔥']}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Notes */}
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <TextField
          fullWidth
          multiline
          rows={2}
          value={currentEntry.notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about your day..."
          size="small"
        />
      </Box>

      {/* Items List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Starred Items First */}
        {currentEntry.items.filter((i) => i.isStarred).length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              ⭐ Starred
            </Typography>
            {currentEntry.items
              .filter((i) => i.isStarred)
              .map((item) => (
                <ReviewItemCard
                  key={item.id}
                  item={item}
                  onToggleComplete={handleToggleComplete}
                  onToggleStar={handleToggleStar}
                  onEdit={(i) => setEditingItem(i)}
                  onDelete={handleDeleteItem}
                />
              ))}
          </Box>
        )}

        {/* Grouped by Type */}
        {(Object.keys(groupedItems) as ReviewItemType[]).map((type) => {
          const items = groupedItems[type].filter((i) => !i.isStarred)
          if (items.length === 0) return null

          return (
            <Box key={type} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {ITEM_TYPE_ICONS[type]} {ITEM_TYPE_LABELS[type]}s
              </Typography>
              {items.map((item) => (
                <ReviewItemCard
                  key={item.id}
                  item={item}
                  onToggleComplete={handleToggleComplete}
                  onToggleStar={handleToggleStar}
                  onEdit={(i) => setEditingItem(i)}
                  onDelete={handleDeleteItem}
                />
              ))}
            </Box>
          )
        })}

        {currentEntry.items.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <NoteIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No items yet for this day
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add your first review item
            </Typography>
          </Box>
        )}
      </Box>

      {/* Footer Actions */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: 'grey.100',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
        }}
      >
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowAddDialog(true)}
          sx={{ flex: 1 }}
        >
          Add Item
        </Button>
      </Box>

      {/* Add Item Dialog */}
      <AddItemDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddItem}
      />

      {/* Edit Item Dialog */}
      {editingItem && (
        <AddItemDialog
          open={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          onAdd={(updated) => handleEditItem({ ...editingItem, ...updated })}
          defaultType={editingItem.type}
        />
      )}
    </Paper>
  )
}

export default DailyReviewPanel

// ============================================================================
// Hook for Daily Review
// ============================================================================

export function useDailyReview() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [entries, setEntries] = useState<Map<string, DailyReviewEntry>>(new Map())

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studymesh-daily-review')
      if (stored) {
        const parsed = JSON.parse(stored)
        setEntries(new Map(parsed))
      }
    } catch (e) {
      console.error('Failed to load daily review:', e)
    }
  }, [])

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const getEntry = useCallback(
    (date: Date): DailyReviewEntry | undefined => {
      const key = formatDateKey(date)
      return entries.get(key)
    },
    [entries],
  )

  const addItem = useCallback((date: Date, item: ReviewItem) => {
    const key = formatDateKey(date)
    setEntries((prev) => {
      const next = new Map(prev)
      const existing = next.get(key) || {
        date: key,
        items: [],
        notes: '',
        createdAt: date,
        updatedAt: date,
      }
      next.set(key, {
        ...existing,
        items: [...existing.items, item],
        updatedAt: new Date(),
      })
      return next
    })
  }, [])

  return {
    isPanelOpen,
    entries,
    openPanel,
    closePanel,
    getEntry,
    addItem,
    DailyReviewPanel: DailyReviewPanel as React.FC<{ onClose?: () => void }>,
  }
}