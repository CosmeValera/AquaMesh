import React, { useState, useCallback, useEffect, useRef } from 'react'
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
  ListItemSecondaryAction,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Tooltip,
  LinearProgress,
  Alert,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Snackbar,
  Fade,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  OpenInNew as OpenIcon,
  MoreVert as MoreIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  FormatQuote as QuoteIcon,
  TextFields as TextIcon,
  Title as TitleIcon,
  LocalOffer as TagIcon,
  Folder as FolderIcon,
  CheckCircle as SavedIcon,
  Error as ErrorIcon,
  CloudUpload as UploadIcon,
  Visibility as PreviewIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Download as ImportIcon,
  Share as ShareIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export type ClipType = 'full-page' | 'article' | 'selection' | 'screenshot' | 'bookmark'

export interface WebClip {
  id: string
  url: string
  title: string
  excerpt: string
  content: string // HTML or markdown
  type: ClipType
  thumbnail?: string
  favicon?: string
  createdAt: Date
  tags: string[]
  folder?: string
  isRead: boolean
  isFavorite: boolean
  highlightColor?: string
  annotations?: string // User's notes
}

export interface ClipConfig {
  defaultClipType: ClipType
  autoExtractContent: boolean
  saveMetadata: boolean
  addTags: string[]
  defaultFolder: string
  showPreview: boolean
  clipboardMonitoring: boolean
}

// ============================================================================
// Constants
// ============================================================================

const defaultConfig: ClipConfig = {
  defaultClipType: 'article',
  autoExtractContent: true,
  saveMetadata: true,
  addTags: [],
  defaultFolder: 'Inbox',
  showPreview: true,
  clipboardMonitoring: false,
}

const CLIP_TYPE_LABELS: Record<ClipType, string> = {
  'full-page': 'Full Page',
  'article': 'Article',
  'selection': 'Selection',
  'screenshot': 'Screenshot',
  'bookmark': 'Bookmark',
}

const CLIP_TYPE_ICONS: Record<ClipType, React.ReactNode> = {
  'full-page': <TextIcon />,
  'article': <TitleIcon />,
  'selection': <QuoteIcon />,
  'screenshot': <ImageIcon />,
  'bookmark': <LinkIcon />,
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function extractExcerpt(html: string, maxLength: number = 200): string {
  // Strip HTML and get text
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

// ============================================================================
// URL Input Component
// ============================================================================

interface URLInputProps {
  value: string
  onChange: (url: string) => void
  onClip: (url: string, type: ClipType) => void
  isLoading: boolean
}

const URLInput: React.FC<URLInputProps> = ({ value, onChange, onClip, isLoading }) => {
  const [clipType, setClipType] = useState<ClipType>('article')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!value.trim()) {
      setError('Please enter a URL')
      return
    }

    // Basic URL validation
    try {
      new URL(value)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    onClip(value, clipType)
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Paste URL to clip..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={!!error}
          helperText={error}
          size="small"
          InputProps={{
            startAdornment: (
              <Box sx={{ mr: 1, color: 'text.secondary' }}>
                <LinkIcon fontSize="small" />
              </Box>
            ),
          }}
        />
        <Button
          variant="contained"
          type="submit"
          disabled={isLoading || !value.trim()}
          startIcon={isLoading ? null : <AddIcon />}
        >
          {isLoading ? 'Clipping...' : 'Clip'}
        </Button>
      </Box>

      <ToggleButtonGroup
        value={clipType}
        exclusive
        onChange={(_, v) => v && setClipType(v)}
        size="small"
      >
        {(Object.keys(CLIP_TYPE_LABELS) as ClipType[]).map((type) => (
          <ToggleButton key={type} value={type} sx={{ textTransform: 'capitalize' }}>
            {CLIP_TYPE_ICONS[type]}
            <Box component="span" sx={{ ml: 0.5, display: { xs: 'none', sm: 'inline' } }}>
              {CLIP_TYPE_LABELS[type]}
            </Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  )
}

// ============================================================================
// Clip Card Component
// ============================================================================

interface ClipCardProps {
  clip: WebClip
  onOpen: (clip: WebClip) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onToggleRead: (id: string) => void
  onEdit: (clip: WebClip) => void
  onShare: (clip: WebClip) => void
}

const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  onOpen,
  onDelete,
  onToggleFavorite,
  onToggleRead,
  onEdit,
  onShare,
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  return (
    <Paper
      elevation={1}
      sx={{
        mb: 1,
        overflow: 'hidden',
        opacity: clip.isRead ? 0.7 : 1,
        transition: 'all 0.2s',
        '&:hover': {
          elevation: 2,
          bgcolor: 'grey.50',
        },
      }}
    >
      <Box sx={{ display: 'flex' }}>
        {/* Thumbnail */}
        {clip.thumbnail && (
          <Box
            sx={{
              width: 120,
              height: 80,
              backgroundImage: `url(${clip.thumbnail})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            onClick={() => onOpen(clip)}
          />
        )}

        {/* Content */}
        <Box sx={{ flex: 1, p: 2, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                onClick={() => onOpen(clip)}
              >
                {clip.isRead ? clip.title : <strong>{clip.title}</strong>}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                {clip.favicon && (
                  <img src={clip.favicon} alt="" width={14} height={14} style={{ borderRadius: 2 }} />
                )}
                <Typography variant="caption" color="text.secondary">
                  {getDomainFromUrl(clip.url)}
                </Typography>
                <Chip
                  icon={CLIP_TYPE_ICONS[clip.type]}
                  label={CLIP_TYPE_LABELS[clip.type]}
                  size="small"
                  sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-icon': { fontSize: 12 } }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              {clip.isFavorite && (
                <Chip label="★" size="small" sx={{ height: 20, bgcolor: 'warning.50' }} />
              )}
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite(clip.id)
                }}
              >
                {clip.isFavorite ? '★' : '☆'}
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  setMenuAnchor(e.currentTarget)
                  setShowMenu(true)
                }}
              >
                <MoreIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {clip.excerpt && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                fontSize: '0.8rem',
              }}
            >
              {clip.excerpt}
            </Typography>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            {clip.tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'primary.50' }}
              />
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {timeAgo(clip.createdAt)}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={showMenu}
        onClose={() => setShowMenu(false)}
      >
        <MenuItem onClick={() => { onOpen(clip); setShowMenu(false); }}>
          <ListItemIcon><PreviewIcon fontSize="small" /></ListItemIcon>
          Preview
        </MenuItem>
        <MenuItem onClick={() => { onToggleRead(clip.id); setShowMenu(false); }}>
          <ListItemIcon><CheckCircle fontSize="small" /></ListItemIcon>
          {clip.isRead ? 'Mark Unread' : 'Mark Read'}
        </MenuItem>
        <MenuItem onClick={() => { onEdit(clip); setShowMenu(false); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem onClick={() => { onShare(clip); setShowMenu(false); }}>
          <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
          Share
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { onDelete(clip.id); setShowMenu(false); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Paper>
  )
}

// ============================================================================
// Clip Preview Modal
// ============================================================================

interface ClipPreviewProps {
  clip: WebClip | null
  onClose: () => void
  onEdit: () => void
}

const ClipPreview: React.FC<ClipPreviewProps> = ({ clip, onClose, onEdit }) => {
  if (!clip) return null

  return (
    <Dialog
      open={Boolean(clip)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {CLIP_TYPE_ICONS[clip.type]}
            <Typography variant="h6" component="span">
              {clip.title}
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Meta info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {clip.favicon && (
            <img src={clip.favicon} alt="" width={16} height={16} />
          )}
          <Typography variant="body2" color="text.secondary">
            {getDomainFromUrl(clip.url)}
          </Typography>
          <Chip label={CLIP_TYPE_LABELS[clip.type]} size="small" />
          {clip.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" sx={{ bgcolor: 'primary.50' }} />
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            Clipped {timeAgo(clip.createdAt)}
          </Typography>
        </Box>

        {/* Content */}
        <Box
          sx={{
            '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
            '& a': { color: 'primary.main' },
            '& blockquote': {
              borderLeft: '4px solid',
              borderColor: 'primary.main',
              pl: 2,
              ml: 0,
              fontStyle: 'italic',
            },
          }}
          dangerouslySetInnerHTML={{ __html: clip.content }}
        />

        {/* Annotations */}
        {clip.annotations && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'warning.50', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
            <Typography variant="subtitle2" color="warning.main" gutterBottom>
              📝 Your Notes
            </Typography>
            <Typography variant="body2">{clip.annotations}</Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={onEdit}>Edit</Button>
        <Button
          startIcon={<OpenIcon />}
          onClick={() => window.open(clip.url, '_blank')}
        >
          Open Original
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================================================
// Edit Clip Dialog
// ============================================================================

interface EditClipDialogProps {
  clip: WebClip | null
  onSave: (clip: WebClip) => void
  onClose: () => void
}

const EditClipDialog: React.FC<EditClipDialogProps> = ({ clip, onSave, onClose }) => {
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [folder, setFolder] = useState('')
  const [annotations, setAnnotations] = useState('')
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (clip) {
      setTitle(clip.title)
      setExcerpt(clip.excerpt)
      setTags(clip.tags)
      setFolder(clip.folder || '')
      setAnnotations(clip.annotations || '')
    }
  }, [clip])

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleSave = () => {
    if (!clip) return
    onSave({
      ...clip,
      title,
      excerpt,
      tags,
      folder: folder || undefined,
      annotations,
    })
  }

  if (!clip) return null

  return (
    <Dialog open={Boolean(clip)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>✏️ Edit Clip</DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <TextField
            fullWidth
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Your Notes"
            value={annotations}
            onChange={(e) => setAnnotations(e.target.value)}
            sx={{ mb: 2 }}
          />

          {/* Tags */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => handleRemoveTag(tag)}
                  sx={{ bgcolor: 'primary.50' }}
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
                    handleAddTag()
                  }
                }}
              />
              <Button variant="outlined" size="small" onClick={handleAddTag}>
                Add
              </Button>
            </Box>
          </Box>
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
// Main Web Clipper Panel
// ============================================================================

interface WebClipperPanelProps {
  onClose?: () => void
}

// Demo clips for showcase
const demoClips: WebClip[] = [
  {
    id: 'clip-1',
    url: 'https://arxiv.org/abs/1706.03762',
    title: 'Attention Is All You Need',
    excerpt: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder...',
    content: '<p>The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism...</p>',
    type: 'article',
    favicon: 'https://arxiv.org/favicon.ico',
    createdAt: new Date(Date.now() - 3600000 * 2),
    tags: ['transformers', 'NLP', 'deep-learning'],
    isRead: false,
    isFavorite: true,
  },
  {
    id: 'clip-2',
    url: 'https://github.com/features',
    title: "GitHub: Let's build from here",
    excerpt: 'GitHub is the complete development environment that takes you from code to cloud...',
    content: '<p>GitHub is the complete development environment that takes you from code to cloud...</p>',
    type: 'bookmark',
    favicon: 'https://github.githubassets.com/favicons/favicon.svg',
    createdAt: new Date(Date.now() - 3600000 * 24),
    tags: ['development', 'tools'],
    isRead: true,
    isFavorite: false,
  },
  {
    id: 'clip-3',
    url: 'https://docs.python.org/3/tutorial/',
    title: 'Python Tutorial',
    excerpt: 'Python is an easy to learn, powerful programming language...',
    content: '<p>Python is an easy to learn, powerful programming language...</p>',
    type: 'article',
    favicon: 'https://www.python.org/favicon.ico',
    createdAt: new Date(Date.now() - 3600000 * 48),
    tags: ['python', 'programming', 'tutorial'],
    isRead: false,
    isFavorite: false,
  },
]

const WebClipperPanel: React.FC<WebClipperPanelProps> = ({ onClose }) => {
  const [clips, setClips] = useState<WebClip[]>([])
  const [url, setUrl] = useState('')
  const [isClipping, setIsClipping] = useState(false)
  const [selectedClip, setSelectedClip] = useState<WebClip | null>(null)
  const [editingClip, setEditingClip] = useState<WebClip | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread' | 'favorites'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [config, setConfig] = useState<ClipConfig>(defaultConfig)
  const [showSnackbar, setShowSnackbar] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')

  // Load clips from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studymesh-web-clips')
      if (stored) {
        const parsed = JSON.parse(stored).map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
        }))
        setClips(parsed.length > 0 ? parsed : demoClips)
      } else {
        setClips(demoClips)
      }
    } catch (e) {
      setClips(demoClips)
    }
  }, [])

  // Save clips to localStorage
  useEffect(() => {
    if (clips.length > 0) {
      localStorage.setItem('studymesh-web-clips', JSON.stringify(clips))
    }
  }, [clips])

  const showNotification = (message: string) => {
    setSnackbarMessage(message)
    setShowSnackbar(true)
  }

  const handleClip = useCallback(async (urlToClip: string, type: ClipType) => {
    setIsClipping(true)

    // Simulate clipping process
    await new Promise((r) => setTimeout(r, 1500))

    // Create mock clip data
    const newClip: WebClip = {
      id: generateId(),
      url: urlToClip,
      title: `Clipped: ${getDomainFromUrl(urlToClip)}`,
      excerpt: `Content from ${getDomainFromUrl(urlToClip)} - this is a demo clip that simulates what would be saved when clipping a web page...`,
      content: `<p>Simulated content from <strong>${urlToClip}</strong>. In a real implementation, this would be the extracted HTML content from the page.</p>`,
      type,
      favicon: `https://www.google.com/s2/favicons?domain=${getDomainFromUrl(urlToClip)}&sz=32`,
      createdAt: new Date(),
      tags: config.addTags,
      folder: config.defaultFolder,
      isRead: false,
      isFavorite: false,
    }

    setClips((prev) => [newClip, ...prev])
    setUrl('')
    setIsClipping(false)
    showNotification('Page clipped successfully!')

    // Clear preview/selection if any
    setSelectedClip(null)
  }, [config.addTags, config.defaultFolder])

  const handleDelete = useCallback((id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id))
    showNotification('Clip deleted')
  }, [])

  const handleToggleFavorite = useCallback((id: string) => {
    setClips((prev) => prev.map((c) =>
      c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
    ))
  }, [])

  const handleToggleRead = useCallback((id: string) => {
    setClips((prev) => prev.map((c) =>
      c.id === id ? { ...c, isRead: !c.isRead } : c
    ))
  }, [])

  const handleSaveEdit = useCallback((editedClip: WebClip) => {
    setClips((prev) => prev.map((c) => c.id === editedClip.id ? editedClip : c))
    setEditingClip(null)
    showNotification('Clip updated')
  }, [])

  const handleShare = useCallback((clip: WebClip) => {
    // In real app, would open share dialog
    if (navigator.share) {
      navigator.share({
        title: clip.title,
        text: clip.excerpt,
        url: clip.url,
      })
    } else {
      navigator.clipboard.writeText(clip.url)
      showNotification('URL copied to clipboard')
    }
  }, [])

  // Filter clips
  const filteredClips = clips.filter((clip) => {
    if (filter === 'unread') return !clip.isRead
    if (filter === 'favorites') return clip.isFavorite
    return true
  }).filter((clip) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      clip.title.toLowerCase().includes(query) ||
      clip.excerpt.toLowerCase().includes(query) ||
      clip.tags.some((t) => t.toLowerCase().includes(query))
    )
  })

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: Math.min(700, '95vw'),
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
          <LinkIcon />
          <Typography variant="h6">📌 Web Clipper</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setShowSettings(!showSettings)}
            sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)' }}
          >
            Settings
          </Button>
          {onClose && (
            <IconButton sx={{ color: 'inherit' }} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* URL Input */}
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
        <URLInput
          value={url}
          onChange={setUrl}
          onClip={handleClip}
          isLoading={isClipping}
        />
      </Box>

      {/* Settings Panel */}
      {showSettings && (
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            ⚙️ Default Settings
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Default Type</InputLabel>
              <Select
                value={config.defaultClipType}
                label="Default Type"
                onChange={(e: SelectChangeEvent) => setConfig((c) => ({ ...c, defaultClipType: e.target.value as ClipType }))}
              >
                {(Object.keys(CLIP_TYPE_LABELS) as ClipType[]).map((type) => (
                  <MenuItem key={type} value={type}>{CLIP_TYPE_LABELS[type]}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Default Folder"
              value={config.defaultFolder}
              onChange={(e) => setConfig((c) => ({ ...c, defaultFolder: e.target.value }))}
              sx={{ minWidth: 150 }}
            />

            <FormControlLabel
              control={
                <ToggleButton
                  selected={config.showPreview}
                  onClick={() => setConfig((c) => ({ ...c, showPreview: !c.showPreview }))}
                >
                  Preview
                </ToggleButton>
              }
              label=""
            />
          </Box>
        </Box>
      )}

      {/* Filters and Search */}
      <Box sx={{
        px: 2,
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, v) => v && setFilter(v)}
          size="small"
        >
          <ToggleButton value="all">All ({clips.length})</ToggleButton>
          <ToggleButton value="unread">Unread ({clips.filter((c) => !c.isRead).length})</ToggleButton>
          <ToggleButton value="favorites">★ ({clips.filter((c) => c.isFavorite).length})</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          size="small"
          placeholder="Search clips..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flex: 1, maxWidth: 200 }}
        />
      </Box>

      {/* Clips List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {filteredClips.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <LinkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              {filter === 'all' ? 'No clips yet' : `No ${filter} clips`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Paste a URL above to clip a web page
            </Typography>
          </Box>
        ) : (
          filteredClips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onOpen={setSelectedClip}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
              onToggleRead={handleToggleRead}
              onEdit={setEditingClip}
              onShare={handleShare}
            />
          ))
        )}
      </Box>

      {/* Footer Stats */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'grey.100',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          📎 {clips.length} clips saved
        </Typography>
        <Typography variant="caption" color="text.secondary">
          💾 Stored locally
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          ⌘+V to quick clip from clipboard
        </Typography>
      </Box>

      {/* Clip Preview Modal */}
      <ClipPreview
        clip={selectedClip}
        onClose={() => setSelectedClip(null)}
        onEdit={() => {
          setEditingClip(selectedClip)
          setSelectedClip(null)
        }}
      />

      {/* Edit Dialog */}
      <EditClipDialog
        clip={editingClip}
        onSave={handleSaveEdit}
        onClose={() => setEditingClip(null)}
      />

      {/* Notification Snackbar */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSnackbar(false)}
        message={snackbarMessage}
      />
    </Paper>
  )
}

export default WebClipperPanel

// ============================================================================
// Hook for Web Clipper
// ============================================================================

const CLIPS_STORAGE_KEY = 'studymesh-web-clips'

export function useWebClipper() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [clips, setClips] = useState<WebClip[]>([])

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CLIPS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored).map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
        }))
        setClips(parsed)
      }
    } catch (e) {
      console.error('Failed to load clips:', e)
    }
  }, [])

  // Save to localStorage
  useEffect(() => {
    if (clips.length > 0) {
      localStorage.setItem(CLIPS_STORAGE_KEY, JSON.stringify(clips))
    }
  }, [clips])

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const addClip = useCallback((clip: WebClip) => {
    setClips((prev) => [clip, ...prev])
  }, [])

  const removeClip = useCallback((id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const getClipById = useCallback(
    (id: string) => clips.find((c) => c.id === id),
    [clips],
  )

  const getByTag = useCallback(
    (tag: string) => clips.filter((c) => c.tags.includes(tag)),
    [clips],
  )

  const getByFolder = useCallback(
    (folder: string) => clips.filter((c) => c.folder === folder),
    [clips],
  )

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    clips.forEach((c) => c.tags.forEach((t) => tags.add(t)))
    return Array.from(tags).sort()
  }, [clips])

  const allFolders = useMemo(() => {
    const folders = new Set<string>()
    clips.forEach((c) => c.folder && folders.add(c.folder))
    return Array.from(folders).sort()
  }, [clips])

  return {
    isPanelOpen,
    clips,
    allTags,
    allFolders,
    openPanel,
    closePanel,
    addClip,
    removeClip,
    getClipById,
    getByTag,
    getByFolder,
    WebClipperPanel: WebClipperPanel as React.FC<{ onClose?: () => void }>,
  }
}