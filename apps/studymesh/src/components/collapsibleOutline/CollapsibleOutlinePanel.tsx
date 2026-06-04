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
  Divider,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  Tooltip,
  Switch,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  FileCopy as DuplicateIcon,
  MoveUp as MoveUpIcon,
  MoveDown as MoveDownIcon,
  DragIndicator as DragIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  FolderOpen as FolderIcon,
  Article as ArticleIcon,
  Note as NoteIcon,
  CheckBox as CheckboxIcon,
  Image as ImageIcon,
  Title as HeadingIcon,
  MoreVert as MoreIcon,
  Visibility as VisibleIcon,
  VisibilityOff as HiddenIcon,
  PushPin as PinIcon,
  FormatListBulleted as ListIcon,
  Settings as SettingsIcon,
  Download as ExportIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export type OutlineItemType = 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list' | 'checkbox' | 'image' | 'divider' | 'quote' | 'code'

export interface OutlineItem {
  id: string
  type: OutlineItemType
  content: string
  level: number // 1-6 for headings
  isCollapsed: boolean
  isHidden: boolean
  isPinned: boolean
  children: OutlineItem[]
  metadata?: {
    completed?: boolean // for checkboxes
    imageUrl?: string // for images
    language?: string // for code blocks
  }
  createdAt: Date
  modifiedAt: Date
}

export interface OutlineSection {
  id: string
  title: string
  items: OutlineItem[]
  isCollapsed: boolean
  color?: string
}

export interface OutlineViewConfig {
  showIcons: boolean
  showCounts: boolean
  highlightCurrent: boolean
  autoCollapseDepth: number // 0 = none, 3 = collapse at level 3+
  compactMode: boolean
  showHidden: boolean
}

export interface OutlineState {
  sections: OutlineSection[]
  activeItemId: string | null
  expandedItems: Set<string>
}

// ============================================================================
// Constants
// ============================================================================

const ITEM_TYPE_ICONS: Record<OutlineItemType, React.ReactNode> = {
  heading1: <HeadingIcon sx={{ fontSize: 16 }} />,
  heading2: <HeadingIcon sx={{ fontSize: 14 }} />,
  heading3: <HeadingIcon sx={{ fontSize: 12 }} />,
  paragraph: <ArticleIcon sx={{ fontSize: 14 }} />,
  list: <ListIcon sx={{ fontSize: 14 }} />,
  checkbox: <CheckboxIcon sx={{ fontSize: 14 }} />,
  image: <ImageIcon sx={{ fontSize: 14 }} />,
  divider: <Box sx={{ width: 12, height: 2, bgcolor: 'grey.400', borderRadius: 1 }} />,
  quote: <ArticleIcon sx={{ fontSize: 14 }} />,
  code: <ArticleIcon sx={{ fontSize: 14 }} />,
}

const ITEM_TYPE_LABELS: Record<OutlineItemType, string> = {
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  paragraph: 'Paragraph',
  list: 'List Item',
  checkbox: 'Checkbox',
  image: 'Image',
  divider: 'Divider',
  quote: 'Quote',
  code: 'Code Block',
}

const defaultConfig: OutlineViewConfig = {
  showIcons: true,
  showCounts: true,
  highlightCurrent: true,
  autoCollapseDepth: 0,
  compactMode: false,
  showHidden: false,
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `outline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function getItemDepth(item: OutlineItem): number {
  return item.level || 1
}

function countItems(items: OutlineItem[]): number {
  let count = 0
  for (const item of items) {
    count++
    count += countItems(item.children)
  }
  return count
}

function flattenItems(items: OutlineItem[], result: OutlineItem[] = []): OutlineItem[] {
  for (const item of items) {
    result.push(item)
    if (!item.isCollapsed) {
      flattenItems(item.children, result)
    }
  }
  return result
}

// ============================================================================
// Outline Item Row Component
// ============================================================================

interface OutlineItemRowProps {
  item: OutlineItem
  depth: number
  isActive: boolean
  config: OutlineViewConfig
  onToggleCollapse: (id: string) => void
  onSelect: (id: string) => void
  onEdit: (item: OutlineItem) => void
  onDelete: (id: string) => void
  onDuplicate: (item: OutlineItem) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onToggleHidden: (id: string) => void
  onTogglePinned: (id: string) => void
  onToggleCheckbox?: (id: string) => void
  isFirst: boolean
  isLast: boolean
}

const OutlineItemRow: React.FC<OutlineItemRowProps> = ({
  item,
  depth,
  isActive,
  config,
  onToggleCollapse,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
  onTogglePinned,
  onToggleCheckbox,
  isFirst,
  isLast,
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const hasChildren = item.children.length > 0
  const childCount = countItems(item.children)

  // Heading styles by level
  const getFontWeight = () => {
    if (item.type.startsWith('heading')) {
      return item.level === 1 ? 700 : item.level === 2 ? 600 : 500
    }
    return 400
  }

  const getFontSize = () => {
    if (config.compactMode) return '0.8rem'
    if (item.type === 'heading1') return '1rem'
    if (item.type === 'heading2') return '0.9rem'
    if (item.type === 'heading3') return '0.85rem'
    return '0.85rem'
  }

  const getIndent = () => depth * (config.compactMode ? 16 : 20)

  if (item.isHidden && !config.showHidden) return null

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          pl: `${getIndent()}px`,
          py: 0.5,
          px: 1,
          cursor: 'pointer',
          bgcolor: isActive ? 'primary.50' : 'transparent',
          borderLeft: isActive ? '3px solid' : '3px solid transparent',
          borderColor: isActive ? 'primary.main' : 'transparent',
          transition: 'all 0.15s',
          '&:hover': {
            bgcolor: isActive ? 'primary.50' : 'grey.100',
          },
          opacity: item.isHidden ? 0.5 : 1,
        }}
        onClick={() => onSelect(item.id)}
      >
        {/* Collapse/Expand Toggle */}
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse(item.id)
            }}
            sx={{ mr: 0.5, p: 0.25 }}
          >
            {item.isCollapsed ? <ExpandIcon sx={{ fontSize: 14 }} /> : <CollapseIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        ) : (
          <Box sx={{ width: 28, flexShrink: 0 }} />
        )}

        {/* Type Icon */}
        {config.showIcons && (
          <Box sx={{ color: 'text.secondary', mr: 1, display: 'flex' }}>
            {item.type === 'checkbox' ? (
              <CheckboxIcon
                sx={{
                  fontSize: 14,
                  color: item.metadata?.completed ? 'success.main' : 'text.secondary',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleCheckbox?.(item.id)
                }}
              />
            ) : (
              ITEM_TYPE_ICONS[item.type]
            )}
          </Box>
        )}

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: getFontSize(),
            fontWeight: getFontWeight(),
            color: item.metadata?.completed ? 'text.secondary' : 'text.primary',
            textDecoration: item.metadata?.completed ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.type === 'checkbox' && item.metadata?.completed ? '☐ ' : ''}
          {item.content || (item.type === 'divider' ? '─────────────────' : '')}
        </Box>

        {/* Pin indicator */}
        {item.isPinned && (
          <Chip label="📌" size="small" sx={{ height: 16, mr: 0.5, fontSize: '0.65rem' }} />
        )}

        {/* Child count */}
        {hasChildren && item.isCollapsed && (
          <Chip
            label={`${childCount}`}
            size="small"
            sx={{ height: 18, fontSize: '0.65rem', mr: 0.5 }}
          />
        )}

        {/* Actions */}
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            setMenuAnchor(e.currentTarget)
            setShowMenu(true)
          }}
          sx={{ p: 0.25 }}
        >
          <MoreIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={showMenu}
        onClose={() => setShowMenu(false)}
      >
        <MenuItem onClick={() => { onEdit(item); setShowMenu(false); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem onClick={() => { onDuplicate(item); setShowMenu(false); }}>
          <ListItemIcon><DuplicateIcon fontSize="small" /></ListItemIcon>
          Duplicate
        </MenuItem>
        <MenuItem onClick={() => { onTogglePinned(item.id); setShowMenu(false); }}>
          <ListItemIcon><PinIcon fontSize="small" /></ListItemIcon>
          {item.isPinned ? 'Unpin' : 'Pin'}
        </MenuItem>
        <MenuItem onClick={() => { onToggleHidden(item.id); setShowMenu(false); }}>
          <ListItemIcon>{item.isHidden ? <VisibleIcon fontSize="small" /> : <HiddenIcon fontSize="small" />}</ListItemIcon>
          {item.isHidden ? 'Show' : 'Hide'}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { onMoveUp(item.id); setShowMenu(false); }} disabled={isFirst}>
          <ListItemIcon><MoveUpIcon fontSize="small" /></ListItemIcon>
          Move Up
        </MenuItem>
        <MenuItem onClick={() => { onMoveDown(item.id); setShowMenu(false); }} disabled={isLast}>
          <ListItemIcon><MoveDownIcon fontSize="small" /></ListItemIcon>
          Move Down
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { onDelete(item.id); setShowMenu(false); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </>
  )
}

// ============================================================================
// Section Component
// ============================================================================

interface SectionComponentProps {
  section: OutlineSection
  activeItemId: string | null
  config: OutlineViewConfig
  onToggleSection: (id: string) => void
  onSelectItem: (id: string) => void
  onEditItem: (item: OutlineItem) => void
  onDeleteItem: (id: string) => void
  onDuplicateItem: (item: OutlineItem) => void
  onMoveItemUp: (id: string) => void
  onMoveItemDown: (id: string) => void
  onToggleItemHidden: (id: string) => void
  onToggleItemPinned: (id: string) => void
  onToggleItemCollapse: (id: string) => void
  onToggleCheckbox: (id: string) => void
}

const SectionComponent: React.FC<SectionComponentProps> = ({
  section,
  activeItemId,
  config,
  onToggleSection,
  onSelectItem,
  onEditItem,
  onDeleteItem,
  onDuplicateItem,
  onMoveItemUp,
  onMoveItemDown,
  onToggleItemHidden,
  onToggleItemPinned,
  onToggleItemCollapse,
  onToggleCheckbox,
}) => {
  const itemCount = countItems(section.items)

  return (
    <Box sx={{ mb: 1 }}>
      {/* Section Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.75,
          bgcolor: section.color ? alpha(section.color, 0.1) : 'grey.100',
          borderRadius: 1,
          cursor: 'pointer',
          '&:hover': { bgcolor: section.color ? alpha(section.color, 0.15) : 'grey.200' },
        }}
        onClick={() => onToggleSection(section.id)}
      >
        {section.isCollapsed ? <ExpandIcon sx={{ fontSize: 16, mr: 0.5 }} /> : <CollapseIcon sx={{ fontSize: 16, mr: 0.5 }} />}
        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
          {section.title}
        </Typography>
        {config.showCounts && (
          <Chip label={`${itemCount}`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
        )}
      </Box>

      {/* Section Content */}
      {!section.isCollapsed && (
        <List dense disablePadding sx={{ ml: 1 }}>
          {section.items.map((item, idx) => (
            <OutlineItemRow
              key={item.id}
              item={item}
              depth={0}
              isActive={activeItemId === item.id}
              config={config}
              onToggleCollapse={onToggleItemCollapse}
              onSelect={onSelectItem}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
              onDuplicate={onDuplicateItem}
              onMoveUp={onMoveItemUp}
              onMoveDown={onMoveItemDown}
              onToggleHidden={onToggleItemHidden}
              onTogglePinned={onToggleItemPinned}
              onToggleCheckbox={onToggleCheckbox}
              isFirst={idx === 0}
              isLast={idx === section.items.length - 1}
            />
          ))}
        </List>
      )}
    </Box>
  )
}

// ============================================================================
// Item Editor Dialog
// ============================================================================

interface ItemEditorDialogProps {
  item: OutlineItem | null
  onSave: (item: OutlineItem) => void
  onClose: () => void
}

const ItemEditorDialog: React.FC<ItemEditorDialogProps> = ({ item, onSave, onClose }) => {
  const [content, setContent] = useState('')
  const [type, setType] = useState<OutlineItemType>('paragraph')
  const [level, setLevel] = useState(1)

  useEffect(() => {
    if (item) {
      setContent(item.content)
      setType(item.type)
      setLevel(item.level || 1)
    }
  }, [item])

  const handleSave = () => {
    if (!item) return
    onSave({
      ...item,
      content,
      type,
      level,
      modifiedAt: new Date(),
    })
  }

  if (!item) return null

  return (
    <Dialog open={Boolean(item)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>✏️ Edit Item</DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <TextField
            fullWidth
            label="Content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            rows={3}
            sx={{ mb: 2 }}
            autoFocus
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Type
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {(Object.keys(ITEM_TYPE_LABELS) as OutlineItemType[]).map((t) => (
                <Chip
                  key={t}
                  label={ITEM_TYPE_LABELS[t]}
                  size="small"
                  variant={type === t ? 'filled' : 'outlined'}
                  onClick={() => setType(t)}
                  icon={ITEM_TYPE_ICONS[t] as React.ReactElement}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          {type.startsWith('heading') && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Heading Level: {level}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[1, 2, 3].map((l) => (
                  <Chip
                    key={l}
                    label={`H${l}`}
                    size="small"
                    variant={level === l ? 'filled' : 'outlined'}
                    onClick={() => setLevel(l)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}
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
// Quick Add Menu
// ============================================================================

interface QuickAddMenuProps {
  anchorEl: HTMLElement | null
  onClose: () => void
  onAdd: (type: OutlineItemType) => void
}

const QuickAddMenu: React.FC<QuickAddMenuProps> = ({ anchorEl, onClose, onAdd }) => (
  <Menu
    anchorEl={anchorEl}
    open={Boolean(anchorEl)}
    onClose={onClose}
  >
    {(Object.keys(ITEM_TYPE_LABELS) as OutlineItemType[]).map((type) => (
      <MenuItem key={type} onClick={() => { onAdd(type); onClose(); }}>
        <ListItemIcon>{ITEM_TYPE_ICONS[type]}</ListItemIcon>
        {ITEM_TYPE_LABELS[type]}
      </MenuItem>
    ))}
  </Menu>
)

// ============================================================================
// Main Collapsible Outline Panel
// ============================================================================

interface CollapsibleOutlinePanelProps {
  onClose?: () => void
}

// Demo data
const demoSections: OutlineSection[] = [
  {
    id: 'section-1',
    title: '📚 Introduction to Machine Learning',
    isCollapsed: false,
    color: '#2196F3',
    items: [
      { id: 'item-1', type: 'heading1', content: 'Machine Learning Fundamentals', level: 1, isCollapsed: false, isHidden: false, isPinned: true, children: [], createdAt: new Date(), modifiedAt: new Date() },
      { id: 'item-2', type: 'paragraph', content: 'Machine learning is a subset of artificial intelligence that enables systems to learn from data.', level: 1, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
      { id: 'item-3', type: 'heading2', content: 'Key Concepts', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [
        { id: 'item-3a', type: 'list', content: 'Supervised Learning - Learning from labeled data', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
        { id: 'item-3b', type: 'list', content: 'Unsupervised Learning - Finding patterns in data', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
        { id: 'item-3c', type: 'list', content: 'Reinforcement Learning - Learning through interaction', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
      ], createdAt: new Date(), modifiedAt: new Date() },
      { id: 'item-4', type: 'checkbox', content: 'Understand the difference between AI, ML, and DL', level: 1, isCollapsed: false, isHidden: false, isPinned: false, metadata: { completed: true }, children: [], createdAt: new Date(), modifiedAt: new Date() },
    ],
  },
  {
    id: 'section-2',
    title: '🔢 Mathematics for ML',
    isCollapsed: true,
    color: '#4CAF50',
    items: [
      { id: 'item-5', type: 'heading2', content: 'Linear Algebra', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
      { id: 'item-6', type: 'paragraph', content: 'Vectors, matrices, and operations are fundamental to understanding neural networks.', level: 1, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
      { id: 'item-7', type: 'heading2', content: 'Statistics', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
    ],
  },
  {
    id: 'section-3',
    title: '🧠 Neural Networks',
    isCollapsed: false,
    color: '#9C27B0',
    items: [
      { id: 'item-8', type: 'heading2', content: 'Perceptrons', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
      { id: 'item-9', type: 'heading2', content: 'Activation Functions', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [
        { id: 'item-9a', type: 'list', content: 'ReLU - Rectified Linear Unit', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
        { id: 'item-9b', type: 'list', content: 'Sigmoid - S-shaped curve', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
        { id: 'item-9c', type: 'list', content: 'Tanh - Hyperbolic tangent', level: 2, isCollapsed: false, isHidden: false, isPinned: false, children: [], createdAt: new Date(), modifiedAt: new Date() },
      ], createdAt: new Date(), modifiedAt: new Date() },
    ],
  },
]

const CollapsibleOutlinePanel: React.FC<CollapsibleOutlinePanelProps> = ({ onClose }) => {
  const [sections, setSections] = useState<OutlineSection[]>(demoSections)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [config, setConfig] = useState<OutlineViewConfig>(defaultConfig)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [editingItem, setEditingItem] = useState<OutlineItem | null>(null)
  const [quickAddAnchor, setQuickAddAnchor] = useState<HTMLElement | null>(null)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [showNewSection, setShowNewSection] = useState(false)

  // Auto-save
  useEffect(() => {
    localStorage.setItem('studymesh-outline', JSON.stringify({ sections, activeItemId }))
  }, [sections, activeItemId])

  const handleToggleSection = useCallback((id: string) => {
    setSections((prev) => prev.map((s) =>
      s.id === id ? { ...s, isCollapsed: !s.isCollapsed } : s
    ))
  }, [])

  const handleSelectItem = useCallback((id: string) => {
    setActiveItemId(id)
  }, [])

  const handleToggleCollapse = useCallback((id: string) => {
    const updateItem = (items: OutlineItem[]): OutlineItem[] => {
      return items.map((item) => {
        if (item.id === id) {
          return { ...item, isCollapsed: !item.isCollapsed }
        }
        return { ...item, children: updateItem(item.children) }
      })
    }

    setSections((prev) => prev.map((s) => ({
      ...s,
      items: updateItem(s.items),
    })))
  }, [])

  const handleDeleteItem = useCallback((id: string) => {
    const removeItem = (items: OutlineItem[]): OutlineItem[] => {
      return items.filter((item) => {
        if (item.id === id) return false
        item.children = removeItem(item.children)
        return true
      })
    }

    setSections((prev) => prev.map((s) => ({
      ...s,
      items: removeItem(s.items),
    })))
    if (activeItemId === id) setActiveItemId(null)
  }, [activeItemId])

  const handleEditItem = useCallback((item: OutlineItem) => {
    setEditingItem(item)
  }, [])

  const handleSaveItem = useCallback((updated: OutlineItem) => {
    const updateItem = (items: OutlineItem[]): OutlineItem[] => {
      return items.map((item) => {
        if (item.id === updated.id) return updated
        return { ...item, children: updateItem(item.children) }
      })
    }

    setSections((prev) => prev.map((s) => ({
      ...s,
      items: updateItem(s.items),
    })))
    setEditingItem(null)
  }, [])

  const handleDuplicateItem = useCallback((item: OutlineItem) => {
    const duplicate: OutlineItem = {
      ...item,
      id: generateId(),
      content: `${item.content} (copy)`,
      createdAt: new Date(),
      modifiedAt: new Date(),
      children: item.children.map((c) => ({ ...c, id: generateId() })),
    }

    const insertAfter = (items: OutlineItem[], targetId: string): OutlineItem[] => {
      const result: OutlineItem[] = []
      for (const item of items) {
        result.push(item)
        if (item.id === targetId) {
          result.push(duplicate)
        }
        if (item.children.length > 0) {
          result[result.length - 1].children = insertAfter(item.children, targetId)
        }
      }
      return result
    }

    setSections((prev) => prev.map((s) => ({
      ...s,
      items: insertAfter(s.items, item.id),
    })))
  }, [])

  const handleMoveItemUp = useCallback((id: string) => {
    const moveUp = (items: OutlineItem[]): OutlineItem[] => {
      const idx = items.findIndex((i) => i.id === id)
      if (idx <= 0) return items
      const result = [...items]
      ;[result[idx - 1], result[idx]] = [result[idx], result[idx - 1]]
      return result
    }

    setSections((prev) => prev.map((s) => ({
      ...s,
      items: moveUp(s.items),
    })))
  }, [])

  const handleMoveItemDown = useCallback((id: string) => {
    const moveDown = (items: OutlineItem[]): OutlineItem[] => {
      const idx = items.findIndex((i) => i.id === id)
      if (idx < 0 || idx >= items.length - 1) return items
      const result = [...items]
      ;[result[idx], result[idx + 1]] = [result[idx + 1], result[idx]]
      return result
    }

    setSections((prev) => prev.map((s) => ({
      ...s,
      items: moveDown(s.items),
    })))
  }, [])

  const handleToggleHidden = useCallback((id: string) => {
    const toggle = (items: OutlineItem[]): OutlineItem[] => {
      return items.map((item) => {
        if (item.id === id) return { ...item, isHidden: !item.isHidden }
        return { ...item, children: toggle(item.children) }
      })
    }

    setSections((prev) => prev.map((s) => ({
      ...s,
      items: toggle(s.items),
    })))
  }, [])

  const handleTogglePinned = useCallback((id: string) => {
    const toggle = (items: OutlineItem[]): OutlineItem[] => {
      return items.map((item) => {
        if (item.id === id) return { ...item, isPinned: !item.isPinned }
        return { ...item, children: toggle(item.children) }
      })
    }

    setSections((prev) => prev.map((s) => ({
      ...s,
      items: toggle(s.items),
    })))
  }, [])

  const handleToggleCheckbox = useCallback((id: string) => {
    const toggle = (items: OutlineItem[]): OutlineItem[] => {
      return items.map((item) => {
        if (item.id === id) {
          return { ...item, metadata: { ...item.metadata, completed: !item.metadata?.completed } }
        }
        return { ...item, children: toggle(item.children) }
      })
    }

    setSections((prev) => prev.map((s) => ({
      ...s,
      items: toggle(s.items),
    })))
  }, [])

  const handleAddItem = useCallback((type: OutlineItemType) => {
    const newItem: OutlineItem = {
      id: generateId(),
      type,
      content: type === 'heading1' ? 'New Heading' : 'New content...',
      level: type.startsWith('heading') ? (type === 'heading1' ? 1 : type === 'heading2' ? 2 : 3) : 1,
      isCollapsed: false,
      isHidden: false,
      isPinned: false,
      children: [],
      createdAt: new Date(),
      modifiedAt: new Date(),
    }

    // Add to first section or create new section
    if (sections.length > 0) {
      setSections((prev) => prev.map((s, idx) =>
        idx === 0 ? { ...s, items: [...s.items, newItem] } : s
      ))
    } else {
      const newSection: OutlineSection = {
        id: generateId(),
        title: 'Untitled Section',
        isCollapsed: false,
        items: [newItem],
      }
      setSections([newSection])
    }
    setEditingItem(newItem)
  }, [sections])

  const handleAddSection = useCallback(() => {
    if (!newSectionTitle.trim()) return
    const newSection: OutlineSection = {
      id: generateId(),
      title: newSectionTitle.trim(),
      isCollapsed: false,
      items: [],
    }
    setSections((prev) => [...prev, newSection])
    setNewSectionTitle('')
    setShowNewSection(false)
  }, [newSectionTitle])

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections

    return sections.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.content.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    })).filter((section) => section.items.length > 0)
  }, [sections, searchQuery])

  const totalItems = sections.reduce((sum, s) => sum + countItems(s.items), 0)

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: Math.min(600, '95vw'),
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
          <ListIcon />
          <Typography variant="h6">📋 Collapsible Outline</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={(e) => setQuickAddAnchor(e.currentTarget)}
            sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)' }}
          >
            Add Item
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

      {/* Quick Add Menu */}
      <QuickAddMenu
        anchorEl={quickAddAnchor}
        onClose={() => setQuickAddAnchor(null)}
        onAdd={handleAddItem}
      />

      {/* Search Bar */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search outline..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Settings Panel */}
      {showSettings && (
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            ⚙️ Display Settings
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.showIcons}
                  onChange={(e) => setConfig((c) => ({ ...c, showIcons: e.target.checked }))}
                  size="small"
                />
              }
              label={<Typography variant="caption">Icons</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.showCounts}
                  onChange={(e) => setConfig((c) => ({ ...c, showCounts: e.target.checked }))}
                  size="small"
                />
              }
              label={<Typography variant="caption">Counts</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.compactMode}
                  onChange={(e) => setConfig((c) => ({ ...c, compactMode: e.target.checked }))}
                  size="small"
                />
              }
              label={<Typography variant="caption">Compact</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.showHidden}
                  onChange={(e) => setConfig((c) => ({ ...c, showHidden: e.target.checked }))}
                  size="small"
                />
              }
              label={<Typography variant="caption">Show Hidden</Typography>}
            />
          </Box>
        </Box>
      )}

      {/* Add Section */}
      {showNewSection ? (
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Section title..."
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSection()
              if (e.key === 'Escape') setShowNewSection(false)
            }}
          />
          <Button variant="contained" size="small" onClick={handleAddSection}>Add</Button>
          <Button size="small" onClick={() => setShowNewSection(false)}>Cancel</Button>
        </Box>
      ) : (
        <Button
          fullWidth
          startIcon={<AddIcon />}
          onClick={() => setShowNewSection(true)}
          sx={{ borderRadius: 0, py: 1 }}
        >
          Add Section
        </Button>
      )}

      {/* Outline Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {filteredSections.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ListIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              {searchQuery ? 'No matching items' : 'No outline items yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchQuery ? 'Try a different search term' : 'Add items or sections to build your outline'}
            </Typography>
          </Box>
        ) : (
          filteredSections.map((section) => (
            <SectionComponent
              key={section.id}
              section={section}
              activeItemId={activeItemId}
              config={config}
              onToggleSection={handleToggleSection}
              onSelectItem={handleSelectItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onDuplicateItem={handleDuplicateItem}
              onMoveItemUp={handleMoveItemUp}
              onMoveItemDown={handleMoveItemDown}
              onToggleItemHidden={handleToggleHidden}
              onToggleItemPinned={handleTogglePinned}
              onToggleItemCollapse={handleToggleCollapse}
              onToggleCheckbox={handleToggleCheckbox}
            />
          ))
        )}
      </Box>

      {/* Footer */}
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
          📊 {sections.length} sections, {totalItems} items
        </Typography>
        <Typography variant="caption" color="text.secondary">
          💾 Saved automatically
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Click to select • Double-click to edit
        </Typography>
      </Box>

      {/* Item Editor Dialog */}
      <ItemEditorDialog
        item={editingItem}
        onSave={handleSaveItem}
        onClose={() => setEditingItem(null)}
      />
    </Paper>
  )
}

export default CollapsibleOutlinePanel

// ============================================================================
// Hook for Collapsible Outline
// ============================================================================

export function useCollapsibleOutline() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [sections, setSections] = useState<OutlineSection[]>([])

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studymesh-outline')
      if (stored) {
        const parsed = JSON.parse(stored)
        setSections(parsed.sections || [])
      }
    } catch (e) {
      console.error('Failed to load outline:', e)
    }
  }, [])

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const addItem = useCallback((item: OutlineItem, sectionId?: string) => {
    if (sectionId) {
      setSections((prev) => prev.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, item] } : s
      ))
    }
  }, [])

  const removeItem = useCallback((id: string) => {
    const remove = (items: OutlineItem[]): OutlineItem[] => {
      return items.filter((item) => {
        if (item.id === id) return false
        item.children = remove(item.children)
        return true
      })
    }

    setSections((prev) => prev.map((s) => ({
      ...s,
      items: remove(s.items),
    })))
  }, [])

  const getActiveItem = useCallback(
    (id: string): OutlineItem | undefined => {
      const findItem = (items: OutlineItem[]): OutlineItem | undefined => {
        for (const item of items) {
          if (item.id === id) return item
          const found = findItem(item.children)
          if (found) return found
        }
        return undefined
      }

      for (const section of sections) {
        const found = findItem(section.items)
        if (found) return found
      }
      return undefined
    },
    [sections],
  )

  return {
    isPanelOpen,
    sections,
    openPanel,
    closePanel,
    addItem,
    removeItem,
    getActiveItem,
    CollapsibleOutlinePanel: CollapsibleOutlinePanel as React.FC<{ onClose?: () => void }>,
  }
}