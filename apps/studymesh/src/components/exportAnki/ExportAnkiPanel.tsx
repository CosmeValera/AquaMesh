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
  ListItemSecondaryAction,
  Checkbox,
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
  Alert,
  Select,
  SelectChangeEvent,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Download as DownloadIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandIcon,
  Settings as SettingsIcon,
  FileDownload as ExportIcon,
  Shuffle as ShuffleIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Upload as ImportIcon,
  History as HistoryIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export type CardType = 'basic' | 'reversed' | 'cloze' | 'image-occlusion'

export interface AnkiCard {
  id: string
  front: string
  back: string
  tags: string[]
  type: CardType
  deck: string
  notes?: string // Additional notes
  imageUrls?: string[]
  selected: boolean
  isValid: boolean
  errorMessage?: string
}

export interface AnkiDeck {
  name: string
  cards: AnkiCard[]
}

export interface AnkiExportConfig {
  defaultDeck: string
  defaultTags: string[]
  includeImages: boolean
  clozeNumbering: 'paran' | 'c1' | '1'
  addTimestamp: boolean
  formatting: 'markdown' | 'html' | 'plain'
  splitBasicReversed: boolean
}

export interface ExportResult {
  success: boolean
  filePath?: string
  cardsExported: number
  errors: string[]
}

// ============================================================================
// Constants
// ============================================================================

const defaultConfig: AnkiExportConfig = {
  defaultDeck: 'StudyMesh',
  defaultTags: ['studymesh', 'exported'],
  includeImages: false,
  clozeNumbering: 'c1',
  addTimestamp: true,
  formatting: 'markdown',
  splitBasicReversed: false,
}

const CARD_TYPE_LABELS: Record<CardType, string> = {
  basic: 'Basic (Front → Back)',
  reversed: 'Basic (Reversed)',
  cloze: 'Cloze Deletion',
  'image-occlusion': 'Image Occlusion',
}

const TAG_COLORS = ['primary', 'secondary', 'success', 'warning', 'info', 'error']

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `anki-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function validateCard(card: AnkiCard): { isValid: boolean; error?: string } {
  if (!card.front.trim()) {
    return { isValid: false, error: 'Front side is empty' }
  }
  if (!card.back.trim() && card.type !== 'cloze') {
    return { isValid: false, error: 'Back side is empty' }
  }
  if (card.type === 'cloze' && !card.front.includes('{{c')) {
    return { isValid: false, error: 'Cloze cards must contain {{c...}} markers' }
  }
  return { isValid: true }
}

// Format text for Anki (handle newlines, etc)
function formatForAnki(text: string, format: 'markdown' | 'html' | 'plain'): string {
  // Escape special Anki characters
  let formatted = text
    .replace(/\[sound:([^\]]+)\]/g, '') // Remove sound references
    .replace(/\[img:([^\]]+)\]/g, '') // Remove img references for now

  if (format === 'markdown') {
    // Convert markdown to HTML for Anki
    formatted = formatted
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
  } else if (format === 'html') {
    // Already HTML, just escape properly
    formatted = formatted
      .replace(/<strong>/g, '<strong>')
      .replace(/<\/strong>/g, '</strong>')
  }

  return formatted.trim()
}

// Generate APKG (simplified - creates TSV for import)
function generateTabText(cards: AnkiCard[], config: AnkiExportConfig): string {
  const lines: string[] = []

  for (const card of cards) {
    const front = formatForAnki(card.front, config.formatting)
    const back = formatForAnki(card.back, config.formatting)
    const tags = [...config.defaultTags, ...card.tags].join(' ')

    // Anki import format: front<tab>back<tab>tags
    lines.push([front, back, tags].join('\t'))
  }

  return lines.join('\n')
}

// Generate cloze deletion text
function formatCloze(text: string, numbering: 'paran' | 'c1' | '1'): string {
  // Convert {{c1::text}} or {{c1::text::hint}} format
  return text.replace(/\{\{c(\d+)::([^}]+)(::([^}]+))?\}\}/g, (match, num, content, _, hint) => {
    if (numbering === 'paran') {
      return hint ? `(${content}) [${hint}]` : `(${content})`
    }
    return hint ? content : content
  })
}

// ============================================================================
// Card Preview Component
// ============================================================================

interface CardPreviewProps {
  card: AnkiCard
  onEdit: () => void
  onDelete: () => void
  onToggleSelect: () => void
}

const CardPreview: React.FC<CardPreviewProps> = ({ card, onEdit, onDelete, onToggleSelect }) => {
  return (
    <Paper
      elevation={1}
      sx={{
        mb: 1,
        overflow: 'hidden',
        opacity: card.isValid ? 1 : 0.7,
        borderLeft: card.isValid ? '3px solid' : '3px solid',
        borderColor: card.isValid ? 'primary.main' : 'error.main',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', p: 1 }}>
        <Checkbox
          checked={card.selected}
          onChange={onToggleSelect}
          sx={{ mt: -0.5 }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip
              label={CARD_TYPE_LABELS[card.type]}
              size="small"
              sx={{ fontSize: '0.65rem' }}
            />
            {card.isValid ? (
              <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
            ) : (
              <Tooltip title={card.errorMessage}>
                <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />
              </Tooltip>
            )}
          </Box>

          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Front:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {card.front.slice(0, 100)}{card.front.length > 100 ? '...' : ''}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Back:
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {card.back.slice(0, 100)}{card.back.length > 100 ? '...' : ''}
            </Typography>
          </Box>

          {card.tags.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {card.tags.map((tag, idx) => (
                <Chip
                  key={idx}
                  label={tag}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    bgcolor: `${TAG_COLORS[idx % TAG_COLORS.length]}.50`,
                  }}
                />
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  )
}

// ============================================================================
// Card Editor Dialog
// ============================================================================

interface CardEditorDialogProps {
  card: AnkiCard | null
  onSave: (card: AnkiCard) => void
  onClose: () => void
}

const CardEditorDialog: React.FC<CardEditorDialogProps> = ({ card, onSave, onClose }) => {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [type, setType] = useState<CardType>('basic')
  const [deck, setDeck] = useState('')
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (card) {
      setFront(card.front)
      setBack(card.back)
      setTags(card.tags)
      setType(card.type)
      setDeck(card.deck)
    }
  }, [card])

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
    if (!card) return
    const updatedCard: AnkiCard = {
      ...card,
      front,
      back,
      tags,
      type,
      deck,
    }
    const validation = validateCard(updatedCard)
    onSave({
      ...updatedCard,
      isValid: validation.isValid,
      errorMessage: validation.error,
    })
  }

  if (!card) return null

  return (
    <Dialog open={Boolean(card)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>✏️ Edit Anki Card</DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Card Type
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {(Object.keys(CARD_TYPE_LABELS) as CardType[]).map((t) => (
                <Chip
                  key={t}
                  label={CARD_TYPE_LABELS[t]}
                  size="small"
                  variant={type === t ? 'filled' : 'outlined'}
                  onClick={() => setType(t)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            sx={{ mb: 2 }}
            placeholder={type === 'cloze' ? 'Enter text with {{c1::cloze}} markers...' : 'Question or prompt...'}
            autoFocus
          />

          {type !== 'cloze' && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Back"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              sx={{ mb: 2 }}
              placeholder="Answer or definition..."
            />
          )}

          {type === 'cloze' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              💡 Use <code>{'{{c1::text}}'}</code> for cloze deletions. Add hints with {'{{c1::text::hint}}'}.
            </Alert>
          )}

          <TextField
            fullWidth
            label="Deck"
            value={deck}
            onChange={(e) => setDeck(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Default deck"
          />

          {/* Tags */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {tags.map((tag, idx) => (
                <Chip
                  key={idx}
                  label={tag}
                  size="small"
                  onDelete={() => handleRemoveTag(tag)}
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
        <Button variant="contained" onClick={handleSave}>
          Save Card
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================================================
// Import Dialog
// ============================================================================

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  onImport: (cards: AnkiCard[]) => void
}

const ImportDialog: React.FC<ImportDialogProps> = ({ open, onClose, onImport }) => {
  const [text, setText] = useState('')
  const [importFormat, setImportFormat] = useState<'tab' | 'csv' | 'json'>('tab')

  const handleImport = () => {
    const lines = text.trim().split('\n')
    const importedCards: AnkiCard[] = []

    for (const line of lines) {
      if (!line.trim()) continue

      let parts: string[]
      if (importFormat === 'tab') {
        parts = line.split('\t')
      } else if (importFormat === 'csv') {
        parts = line.split(',')
      } else {
        try {
          const obj = JSON.parse(line)
          parts = [obj.front || obj.question || '', obj.back || obj.answer || '']
        } catch {
          continue
        }
      }

      if (parts.length >= 2) {
        const card: AnkiCard = {
          id: generateId(),
          front: parts[0].trim(),
          back: parts[1].trim(),
          tags: parts[2]?.split(' ').filter(Boolean) || [],
          type: 'basic',
          deck: 'Imported',
          selected: true,
          isValid: true,
        }
        importedCards.push(card)
      }
    }

    onImport(importedCards)
    setText('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>📥 Import Cards</DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            💡 Supported formats: Tab-separated (TSV), CSV, or JSON (one card per line)
          </Alert>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Format
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {(['tab', 'csv', 'json'] as const).map((f) => (
                <Chip
                  key={f}
                  label={f.toUpperCase()}
                  size="small"
                  variant={importFormat === f ? 'filled' : 'outlined'}
                  onClick={() => setImportFormat(f)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              importFormat === 'tab'
                ? 'Question\tAnswer\ttags (one per line)'
                : importFormat === 'csv'
                ? 'Question,Answer,tags (one per line)'
                : '{"front": "Question", "back": "Answer"}'
            }
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleImport} disabled={!text.trim()}>
          Import {text.trim().split('\n').filter(l => l.trim()).length} Cards
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================================================
// Main Export to Anki Component
// ============================================================================

interface ExportAnkiPanelProps {
  initialCards?: AnkiCard[]
  onClose?: () => void
}

// Demo cards
const demoCards: AnkiCard[] = [
  { id: 'card-1', front: 'What is machine learning?', back: 'A subset of AI that enables systems to learn from data without being explicitly programmed.', tags: ['ml', 'ai'], type: 'basic', deck: 'ML Basics', selected: true, isValid: true },
  { id: 'card-2', front: '{{c1::Supervised learning}} uses labeled data to train models.', back: 'Supervised learning', tags: ['ml'], type: 'cloze', deck: 'ML Basics', selected: true, isValid: true },
  { id: 'card-3', front: 'What is a neural network?', back: 'A computing system inspired by biological neural networks, consisting of interconnected nodes (neurons).', tags: ['deep-learning', 'nn'], type: 'basic', deck: 'Deep Learning', selected: true, isValid: true },
  { id: 'card-4', front: 'What is overfitting?', back: 'When a model performs well on training data but poorly on unseen data, usually due to excessive complexity.', tags: ['ml', 'model-evaluation'], type: 'basic', deck: 'ML Basics', selected: true, isValid: true },
  { id: 'card-5', front: 'What is the purpose of {{c1::activation functions}} in neural networks?', back: 'Activation functions introduce non-linearity, allowing the network to learn complex patterns.', tags: ['deep-learning'], type: 'cloze', deck: 'Deep Learning', selected: false, isValid: true },
]

const ExportAnkiPanel: React.FC<ExportAnkiPanelProps> = ({ initialCards, onClose }) => {
  const [cards, setCards] = useState<AnkiCard[]>(initialCards || demoCards)
  const [config, setConfig] = useState<AnkiExportConfig>(defaultConfig)
  const [editingCard, setEditingCard] = useState<AnkiCard | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid'>('all')
  const [deckFilter, setDeckFilter] = useState<string>('all')

  // Get unique decks
  const decks = useMemo(() => {
    const deckSet = new Set(cards.map((c) => c.deck))
    return Array.from(deckSet).sort()
  }, [cards])

  // Filter cards
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (filter === 'valid' && !card.isValid) return false
      if (filter === 'invalid' && card.isValid) return false
      if (deckFilter !== 'all' && card.deck !== deckFilter) return false
      return true
    })
  }, [cards, filter, deckFilter])

  // Stats
  const stats = useMemo(() => {
    const total = cards.length
    const selected = cards.filter((c) => c.selected).length
    const valid = cards.filter((c) => c.isValid).length
    const exportable = cards.filter((c) => c.selected && c.isValid).length
    return { total, selected, valid, exportable }
  }, [cards])

  // Auto-save cards
  useEffect(() => {
    localStorage.setItem('studymesh-anki-cards', JSON.stringify(cards))
  }, [cards])

  const handleToggleSelect = useCallback((id: string) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, selected: !c.selected } : c))
  }, [])

  const handleEditCard = useCallback((card: AnkiCard) => {
    setEditingCard(card)
  }, [])

  const handleSaveCard = useCallback((updated: AnkiCard) => {
    setCards((prev) => prev.map((c) => c.id === updated.id ? updated : c))
    setEditingCard(null)
  }, [])

  const handleDeleteCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const handleSelectAll = useCallback(() => {
    const allSelected = filteredCards.every((c) => c.selected)
    setCards((prev) => prev.map((c) => ({
      ...c,
      selected: allSelected ? false : filteredCards.some((f) => f.id === c.id),
    })))
  }, [filteredCards])

  const handleImportCards = useCallback((imported: AnkiCard[]) => {
    setCards((prev) => [...imported, ...prev])
  }, [])

  const handleAddCard = useCallback(() => {
    const newCard: AnkiCard = {
      id: generateId(),
      front: '',
      back: '',
      tags: [],
      type: 'basic',
      deck: config.defaultDeck,
      selected: true,
      isValid: false,
      errorMessage: 'Front side is empty',
    }
    setCards((prev) => [newCard, ...prev])
    setEditingCard(newCard)
  }, [config.defaultDeck])

  const handleExport = useCallback(() => {
    const validCards = cards.filter((c) => c.selected && c.isValid)
    const errors: string[] = []

    if (validCards.length === 0) {
      setExportResult({
        success: false,
        cardsExported: 0,
        errors: ['No valid cards selected for export'],
      })
      return
    }

    // Generate export text
    const exportText = generateTabText(validCards, config)

    // Copy to clipboard
    navigator.clipboard.writeText(exportText).then(() => {
      setExportResult({
        success: true,
        cardsExported: validCards.length,
        errors: [],
      })
    }).catch((err) => {
      setExportResult({
        success: false,
        cardsExported: 0,
        errors: [err.message],
      })
    })

    // Also download as .txt file
    const blob = new Blob([exportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `studymesh-export-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [cards, config])

  const handleExportJSON = useCallback(() => {
    const validCards = cards.filter((c) => c.selected && c.isValid)
    const json = JSON.stringify(validCards, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `studymesh-cards-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    setExportResult({
      success: true,
      cardsExported: validCards.length,
      errors: [],
    })
  }, [cards])

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
          <ExportIcon />
          <Typography variant="h6">📤 Export to Anki</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ImportIcon />}
            onClick={() => setShowImport(true)}
            sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)' }}
          >
            Import
          </Button>
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

      {/* Settings Panel */}
      {showSettings && (
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            ⚙️ Export Settings
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              label="Default Deck"
              value={config.defaultDeck}
              onChange={(e) => setConfig((c) => ({ ...c, defaultDeck: e.target.value }))}
              sx={{ minWidth: 150 }}
            />

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Format</InputLabel>
              <Select
                value={config.formatting}
                label="Format"
                onChange={(e: SelectChangeEvent) => setConfig((c) => ({ ...c, formatting: e.target.value as 'markdown' | 'html' | 'plain' }))}
              >
                <MenuItem value="markdown">Markdown</MenuItem>
                <MenuItem value="html">HTML</MenuItem>
                <MenuItem value="plain">Plain Text</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={config.addTimestamp}
                  onChange={(e) => setConfig((c) => ({ ...c, addTimestamp: e.target.checked }))}
                  size="small"
                />
              }
              label={<Typography variant="caption">Add Timestamp</Typography>}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={config.includeImages}
                  onChange={(e) => setConfig((c) => ({ ...c, includeImages: e.target.checked }))}
                  size="small"
                />
              }
              label={<Typography variant="caption">Include Images</Typography>}
            />
          </Box>
        </Box>
      )}

      {/* Stats Bar */}
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip label={`${stats.total} total`} size="small" />
        <Chip label={`${stats.exportable} exportable`} size="small" color="success" />
        <Chip label={`${stats.valid} valid`} size="small" color="primary" />
        {stats.invalid > 0 && (
          <Chip label={`${stats.total - stats.valid} invalid`} size="small" color="error" />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {stats.selected} selected
        </Typography>
      </Box>

      {/* Filters */}
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button size="small" onClick={handleSelectAll}>
          {filteredCards.every((c) => c.selected) ? 'Deselect All' : 'Select All'}
        </Button>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {(['all', 'valid', 'invalid'] as const).map((f) => (
            <Chip
              key={f}
              label={f.charAt(0).toUpperCase() + f.slice(1)}
              size="small"
              variant={filter === f ? 'filled' : 'outlined'}
              onClick={() => setFilter(f)}
              sx={{ textTransform: 'capitalize' }}
            />
          ))}
        </Box>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={deckFilter}
            onChange={(e: SelectChangeEvent) => setDeckFilter(e.target.value)}
            displayEmpty
          >
            <MenuItem value="all">All Decks</MenuItem>
            {decks.map((d) => (
              <MenuItem key={d} value={d}>{d}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Cards List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {filteredCards.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ExportIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No cards to display
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddCard}
              sx={{ mt: 2 }}
            >
              Add Card
            </Button>
          </Box>
        ) : (
          filteredCards.map((card) => (
            <CardPreview
              key={card.id}
              card={card}
              onEdit={() => handleEditCard(card)}
              onDelete={() => handleDeleteCard(card.id)}
              onToggleSelect={() => handleToggleSelect(card.id)}
            />
          ))
        )}
      </Box>

      {/* Export Result Alert */}
      {exportResult && (
        <Alert
          severity={exportResult.success ? 'success' : 'error'}
          onClose={() => setExportResult(null)}
          sx={{ mx: 2, mb: 1 }}
        >
          {exportResult.success
            ? `✓ Successfully exported ${exportResult.cardsExported} cards to clipboard and downloaded file!`
            : `Export failed: ${exportResult.errors.join(', ')}`}
        </Alert>
      )}

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
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={stats.exportable === 0}
        >
          Export ({stats.exportable})
        </Button>
        <Button
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={handleExportJSON}
          disabled={stats.exportable === 0}
        >
          JSON
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddCard}
        >
          Add Card
        </Button>
      </Box>

      {/* Card Editor Dialog */}
      <CardEditorDialog
        card={editingCard}
        onSave={handleSaveCard}
        onClose={() => setEditingCard(null)}
      />

      {/* Import Dialog */}
      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImportCards}
      />
    </Paper>
  )
}

export default ExportAnkiPanel

// ============================================================================
// Hook for Export to Anki
// ============================================================================

export function useExportAnki() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [cards, setCards] = useState<AnkiCard[]>([])

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studymesh-anki-cards')
      if (stored) {
        setCards(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Failed to load Anki cards:', e)
    }
  }, [])

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const addCard = useCallback((card: AnkiCard) => {
    setCards((prev) => [card, ...prev])
  }, [])

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const updateCard = useCallback((card: AnkiCard) => {
    setCards((prev) => prev.map((c) => c.id === card.id ? card : c))
  }, [])

  const importCards = useCallback((imported: AnkiCard[]) => {
    setCards((prev) => [...imported, ...prev])
  }, [])

  const getExportableCards = useCallback(() => {
    return cards.filter((c) => c.selected && c.isValid)
  }, [cards])

  return {
    isPanelOpen,
    cards,
    openPanel,
    closePanel,
    addCard,
    removeCard,
    updateCard,
    importCards,
    getExportableCards,
    ExportAnkiPanel: ExportAnkiPanel as React.FC<{
      initialCards?: AnkiCard[]
      onClose?: () => void
    }>,
  }
}