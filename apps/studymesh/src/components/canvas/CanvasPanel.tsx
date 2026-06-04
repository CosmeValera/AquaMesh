import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  TextField,
  Slider,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  FormControlLabel,
  Switch,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as CloseIcon,
  PanTool as PanIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Link as LinkIcon,
  TextFields as TextIcon,
  Image as ImageIcon,
  TableChart as TableIcon,
  Note as NoteIcon,
  StickyNote2 as CardIcon,
  Handyman as ToolsIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  ArrowForward as ArrowIcon,
  ArrowBack as ArrowBackIcon,
  Clear as ClearIcon,
  MoreVert as MoreIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export type CanvasItemType = 'note' | 'card' | 'text' | 'image' | 'table' | 'free-drawing'

export interface CanvasPosition {
  x: number
  y: number
}

export interface CanvasSize {
  width: number
  height: number
}

export interface CanvasItem {
  id: string
  type: CanvasItemType
  position: CanvasPosition
  size: CanvasSize
  content: string
  color: string
  zIndex: number
  isSelected: boolean
  isLocked: boolean
  // For text/note types
  fontSize?: number
  isBold?: boolean
  isItalic?: boolean
  // For connections
  connectedFrom?: string[]
  connectedTo?: string[]
}

export interface CanvasConnection {
  id: string
  fromItemId: string
  toItemId: string
  fromSide: 'top' | 'right' | 'bottom' | 'left'
  toSide: 'top' | 'right' | 'bottom' | 'left'
  label?: string
  color: string
  style: 'solid' | 'dashed' | 'dotted'
  arrowType: 'none' | 'forward' | 'backward' | 'bidirectional'
}

export interface CanvasState {
  items: CanvasItem[]
  connections: CanvasConnection[]
  viewportX: number
  viewportY: number
  zoom: number
  selectedItemIds: string[]
  activeTool: 'select' | 'pan' | 'text' | 'note' | 'card' | 'connect'
  gridSize: number
  snapToGrid: boolean
  showGrid: boolean
}

export interface CanvasConfig {
  minZoom: number
  maxZoom: number
  gridColor: string
  backgroundColor: string
  defaultItemColor: string
}

// ============================================================================
// Constants
// ============================================================================

const defaultCanvasConfig: CanvasConfig = {
  minZoom: 0.1,
  maxZoom: 3,
  gridColor: '#e0e0e0',
  backgroundColor: '#fafafa',
  defaultItemColor: '#ffffff',
}

const ITEM_COLORS = [
  '#ffffff', // white
  '#fff9c4', // yellow
  '#c8e6c9', // green
  '#b3e5fc', // light blue
  '#f8bbd0', // pink
  '#e1bee7', // purple
  '#ffe0b2', // orange
  '#d7ccc8', // brown
]

const CONNECTION_STYLES = ['solid', 'dashed', 'dotted'] as const

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `canvas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function snapToGridValue(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ============================================================================
// Canvas Item Component
// ============================================================================

interface CanvasItemComponentProps {
  item: CanvasItem
  isSelected: boolean
  onSelect: (id: string, multiSelect: boolean) => void
  onMove: (id: string, position: CanvasPosition) => void
  onResize: (id: string, size: CanvasSize) => void
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
  onStartConnection: (id: string) => void
  onEndConnection: (id: string) => void
  zoom: number
  gridSize: number
}

const CanvasItemComponent: React.FC<CanvasItemComponentProps> = ({
  item,
  isSelected,
  onSelect,
  onMove,
  onResize,
  onEdit,
  onDelete,
  onStartConnection,
  onEndConnection,
  zoom,
  gridSize,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(item.content)
  const [showMenu, setShowMenu] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; itemX: number; itemY: number } | null>(null)
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect(item.id, e.ctrlKey || e.metaKey)

      setIsDragging(true)
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        itemX: item.position.x,
        itemY: item.position.y,
      }
    },
    [item.id, item.position.x, item.position.y, onSelect],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && dragStartRef.current) {
        const dx = (e.clientX - dragStartRef.current.x) / zoom
        const dy = (e.clientY - dragStartRef.current.y) / zoom
        const newX = snapToGridValue(dragStartRef.current.itemX + dx, gridSize)
        const newY = snapToGridValue(dragStartRef.current.itemY + dy, gridSize)
        onMove(item.id, { x: newX, y: newY })
      }

      if (isResizing && resizeStartRef.current) {
        const dx = (e.clientX - resizeStartRef.current.x) / zoom
        const dy = (e.clientY - resizeStartRef.current.y) / zoom
        const newWidth = Math.max(100, snapToGridValue(resizeStartRef.current.width + dx, gridSize / 2))
        const newHeight = Math.max(60, snapToGridValue(resizeStartRef.current.height + dy, gridSize / 2))
        onResize(item.id, { width: newWidth, height: newHeight })
      }
    },
    [isDragging, isResizing, zoom, gridSize, item.id, onMove, onResize],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    dragStartRef.current = null
    resizeStartRef.current = null
  }, [])

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true)
    setEditContent(item.content)
  }, [item.content])

  const handleEditSave = useCallback(() => {
    onEdit(item.id, editContent)
    setIsEditing(false)
  }, [item.id, editContent, onEdit])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuAnchor({ x: e.clientX, y: e.clientY })
    setShowMenu(true)
  }, [])

  const typeIcon = {
    note: <NoteIcon sx={{ fontSize: 14 }} />,
    card: <CardIcon sx={{ fontSize: 14 }} />,
    text: <TextIcon sx={{ fontSize: 14 }} />,
    image: <ImageIcon sx={{ fontSize: 14 }} />,
    table: <TableIcon sx={{ fontSize: 14 }} />,
    'free-drawing': <ToolsIcon sx={{ fontSize: 14 }} />,
  }

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          left: item.position.x,
          top: item.position.y,
          width: item.size.width,
          height: item.size.height,
          bgcolor: item.color,
          border: '2px solid',
          borderColor: isSelected ? 'primary.main' : 'transparent',
          borderRadius: 1,
          boxShadow: isSelected ? 3 : 1,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: 2,
          },
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onClick={(e) => {
          if (e.detail === 2) {
            // Double click - handled above
          } else {
            onSelect(item.id, e.ctrlKey || e.metaKey)
          }
        }}
      >
        {/* Item Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1,
            py: 0.5,
            bgcolor: 'rgba(0,0,0,0.05)',
            borderBottom: '1px solid rgba(0,0,0,0.1)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {typeIcon[item.type]}
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              {item.type}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <IconButton
              size="small"
              sx={{ p: 0.25 }}
              onClick={(e) => {
                e.stopPropagation()
                onStartConnection(item.id)
              }}
            >
              <LinkIcon sx={{ fontSize: 12 }} />
            </IconButton>
            <IconButton
              size="small"
              sx={{ p: 0.25 }}
              onClick={(e) => {
                e.stopPropagation()
                setMenuAnchor({ x: e.clientX, y: e.clientY })
                setShowMenu(true)
              }}
            >
              <MoreIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Item Content */}
        <Box sx={{ p: 1, height: 'calc(100% - 32px)', overflow: 'auto' }}>
          {isEditing ? (
            <TextField
              fullWidth
              multiline
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  handleEditSave()
                }
                if (e.key === 'Escape') {
                  setIsEditing(false)
                }
              }}
              autoFocus
              variant="standard"
              InputProps={{ disableUnderline: true }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: item.fontSize || 14,
                  fontWeight: item.isBold ? 600 : 400,
                  fontStyle: item.isItalic ? 'italic' : 'normal',
                },
              }}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{
                fontSize: item.fontSize || 14,
                fontWeight: item.isBold ? 600 : 400,
                fontStyle: item.isItalic ? 'italic' : 'normal',
                whiteSpace: 'pre-wrap',
              }}
            >
              {item.content || 'Double-click to edit...'}
            </Typography>
          )}
        </Box>

        {/* Resize Handle */}
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 16,
            height: 16,
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.2) 50%)',
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            setIsResizing(true)
            resizeStartRef.current = {
              x: e.clientX,
              y: e.clientY,
              width: item.size.width,
              height: item.size.height,
            }
          }}
        />
      </Box>

      {/* Context Menu */}
      {showMenu && menuAnchor && (
        <Box
          sx={{
            position: 'fixed',
            left: menuAnchor.x,
            top: menuAnchor.y,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: 3,
            zIndex: 10000,
            minWidth: 150,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem onClick={() => { setIsEditing(true); setShowMenu(false); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            Edit
          </MenuItem>
          <MenuItem onClick={() => { onSelect(item.id, false); setShowMenu(false); }}>
            <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
            Duplicate
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { onDelete(item.id); setShowMenu(false); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            Delete
          </MenuItem>
        </Box>
      )}
    </>
  )
}

// ============================================================================
// Connection Line Component
// ============================================================================

interface ConnectionLineProps {
  connection: CanvasConnection
  items: CanvasItem[]
  onClick?: () => void
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ connection, items, onClick }) => {
  const fromItem = items.find((i) => i.id === connection.fromItemId)
  const toItem = items.find((i) => i.id === connection.toItemId)

  if (!fromItem || !toItem) return null

  // Calculate connection points
  const getConnectionPoint = (item: CanvasItem, side: 'top' | 'right' | 'bottom' | 'left') => {
    const cx = item.position.x + item.size.width / 2
    const cy = item.position.y + item.size.height / 2

    switch (side) {
      case 'top':
        return { x: cx, y: item.position.y }
      case 'right':
        return { x: item.position.x + item.size.width, y: cy }
      case 'bottom':
        return { x: cx, y: item.position.y + item.size.height }
      case 'left':
        return { x: item.position.x, y: cy }
    }
  }

  const from = getConnectionPoint(fromItem, connection.fromSide)
  const to = getConnectionPoint(toItem, connection.toSide)

  // Calculate control points for curved line
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const dx = to.x - from.x
  const dy = to.y - from.y
  const cx1 = from.x + dx * 0.25
  const cy1 = from.y + dy * 0.25
  const cx2 = from.x + dx * 0.75
  const cy2 = from.y + dy * 0.75

  const pathD = `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`

  const strokeDasharray = connection.style === 'dashed' ? '8,4' : connection.style === 'dotted' ? '2,2' : undefined

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Invisible wider path for easier clicking */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth={20} />
      {/* Visible path */}
      <path
        d={pathD}
        fill="none"
        stroke={connection.color}
        strokeWidth={2}
        strokeDasharray={strokeDasharray}
        markerEnd={
          connection.arrowType === 'forward' || connection.arrowType === 'bidirectional'
            ? 'url(#arrowhead)'
            : undefined
        }
        markerStart={
          connection.arrowType === 'backward' || connection.arrowType === 'bidirectional'
            ? 'url(#arrowhead-start)'
            : undefined
        }
      />
      {/* Label */}
      {connection.label && (
        <text
          x={midX}
          y={midY - 8}
          textAnchor="middle"
          fill="#666"
          fontSize={10}
          fontStyle="italic"
        >
          {connection.label}
        </text>
      )}
    </g>
  )
}

// ============================================================================
// Main Canvas Component
// ============================================================================

interface CanvasPanelProps {
  initialState?: Partial<CanvasState>
  onStateChange?: (state: CanvasState) => void
  onClose?: () => void
}

const defaultState: CanvasState = {
  items: [
    {
      id: 'demo-1',
      type: 'note',
      position: { x: 100, y: 100 },
      size: { width: 200, height: 120 },
      content: 'Welcome to Canvas!\n\nDrag items, connect them, and organize your ideas spatially.',
      color: '#fff9c4',
      zIndex: 1,
      isSelected: false,
      isLocked: false,
    },
    {
      id: 'demo-2',
      type: 'card',
      position: { x: 400, y: 150 },
      size: { width: 180, height: 100 },
      content: 'Key Concept:\nUse canvas for brainstorming and visual organization',
      color: '#c8e6c9',
      zIndex: 2,
      isSelected: false,
      isLocked: false,
    },
    {
      id: 'demo-3',
      type: 'text',
      position: { x: 650, y: 200 },
      size: { width: 150, height: 80 },
      content: '💡 Tip: Double-click to edit any item',
      color: '#b3e5fc',
      zIndex: 3,
      isSelected: false,
      isLocked: false,
    },
  ],
  connections: [
    {
      id: 'conn-1',
      fromItemId: 'demo-1',
      toItemId: 'demo-2',
      fromSide: 'right',
      toSide: 'left',
      label: 'leads to',
      color: '#4CAF50',
      style: 'solid',
      arrowType: 'forward',
    },
  ],
  viewportX: 0,
  viewportY: 0,
  zoom: 1,
  selectedItemIds: [],
  activeTool: 'select',
  gridSize: 20,
  snapToGrid: true,
  showGrid: true,
}

const CanvasPanel: React.FC<CanvasPanelProps> = ({
  initialState,
  onStateChange,
  onClose,
}) => {
  const [state, setState] = useState<CanvasState>({
    ...defaultState,
    ...initialState,
  })
  const [config] = useState<CanvasConfig>(defaultCanvasConfig)
  const [showToolbar, setShowToolbar] = useState(true)
  const [history, setHistory] = useState<CanvasState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number; vpX: number; vpY: number } | null>(null)
  const [pendingConnection, setPendingConnection] = useState<string | null>(null)

  // Update parent when state changes
  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  // Save to history on state change
  useEffect(() => {
    if (historyIndex < history.length - 1) {
      setHistory((h) => h.slice(0, historyIndex + 1))
    }
    setHistory((h) => [...h, state])
    setHistoryIndex((i) => i + 1)
  }, [state.items, state.connections])

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((i) => i - 1)
      setState(history[historyIndex - 1])
    }
  }, [history, historyIndex])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((i) => i + 1)
      setState(history[historyIndex + 1])
    }
  }, [history, historyIndex])

  const handleSelect = useCallback((id: string, multiSelect: boolean) => {
    setState((prev) => ({
      ...prev,
      selectedItemIds: multiSelect
        ? prev.selectedItemIds.includes(id)
          ? prev.selectedItemIds.filter((i) => i !== id)
          : [...prev.selectedItemIds, id]
        : [id],
    }))
  }, [])

  const handleMove = useCallback((id: string, position: CanvasPosition) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, position } : item,
      ),
    }))
  }, [])

  const handleResize = useCallback((id: string, size: CanvasSize) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, size } : item,
      ),
    }))
  }, [])

  const handleEdit = useCallback((id: string, content: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, content } : item,
      ),
    }))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
      connections: prev.connections.filter(
        (c) => c.fromItemId !== id && c.toItemId !== id,
      ),
      selectedItemIds: prev.selectedItemIds.filter((i) => i !== id),
    }))
  }, [])

  const handleStartConnection = useCallback((id: string) => {
    setPendingConnection(id)
  }, [])

  const handleEndConnection = useCallback((id: string) => {
    if (pendingConnection && pendingConnection !== id) {
      const newConnection: CanvasConnection = {
        id: generateId(),
        fromItemId: pendingConnection,
        toItemId: id,
        fromSide: 'right',
        toSide: 'left',
        color: '#666',
        style: 'solid',
        arrowType: 'forward',
      }
      setState((prev) => ({
        ...prev,
        connections: [...prev.connections, newConnection],
      }))
    }
    setPendingConnection(null)
  }, [pendingConnection])

  const handleAddItem = useCallback((type: CanvasItemType) => {
    const newItem: CanvasItem = {
      id: generateId(),
      type,
      position: {
        x: snapToGridValue(200 - state.viewportX / state.zoom, state.gridSize),
        y: snapToGridValue(150 - state.viewportY / state.zoom, state.gridSize),
      },
      size: { width: 180, height: 100 },
      content: type === 'text' ? 'New text block' : type === 'card' ? 'New card' : 'Double-click to edit',
      color: ITEM_COLORS[Math.floor(Math.random() * ITEM_COLORS.length)],
      zIndex: state.items.length + 1,
      isSelected: false,
      isLocked: false,
    }
    setState((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
      selectedItemIds: [newItem.id],
    }))
  }, [state.viewportX, state.viewportY, state.gridSize, state.items.length])

  const handleDeleteSelected = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => !prev.selectedItemIds.includes(item.id)),
      connections: prev.connections.filter(
        (c) => !prev.selectedItemIds.includes(c.fromItemId) && !prev.selectedItemIds.includes(c.toItemId),
      ),
      selectedItemIds: [],
    }))
  }, [])

  const handleZoom = useCallback((delta: number) => {
    setState((prev) => ({
      ...prev,
      zoom: clamp(prev.zoom + delta, config.minZoom, config.maxZoom),
    }))
  }, [config.minZoom, config.maxZoom])

  const handleResetView = useCallback(() => {
    setState((prev) => ({
      ...prev,
      viewportX: 0,
      viewportY: 0,
      zoom: 1,
    }))
  }, [])

  // Pan handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && state.activeTool === 'pan')) {
      setIsPanning(true)
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        vpX: state.viewportX,
        vpY: state.viewportY,
      }
    }
  }, [state.activeTool, state.viewportX, state.viewportY])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        setState((prev) => ({
          ...prev,
          viewportX: panStartRef.current!.vpX + dx,
          viewportY: panStartRef.current!.vpY + dy,
        }))
      }
    },
    [isPanning],
  )

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    panStartRef.current = null
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      handleZoom(delta)
    }
  }, [handleZoom])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedItemIds.length > 0 && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
          handleDeleteSelected()
        }
      }
      if (e.key === 'Escape') {
        setState((prev) => ({ ...prev, selectedItemIds: [] }))
        setPendingConnection(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.selectedItemIds, handleDeleteSelected, handleUndo, handleRedo])

  const cursorStyle = state.activeTool === 'pan' ? 'grab' : 'default'

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 20,
        left: 100,
        right: 20,
        bottom: 20,
        borderRadius: 2,
        overflow: 'hidden',
        zIndex: 9998,
      }}
    >
      {/* Header Toolbar */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 1,
          boxShadow: 2,
        }}
      >
        <Typography variant="subtitle2" sx={{ mr: 1 }}>
          🎨 Canvas
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Tools */}
        <ToggleButtonGroup
          value={state.activeTool}
          exclusive
          onChange={(_, v) => v && setState((s) => ({ ...s, activeTool: v }))}
          size="small"
        >
          <ToggleButton value="select" title="Select (V)">
            <Tooltip title="Select"><span>⬚</span></Tooltip>
          </ToggleButton>
          <ToggleButton value="pan" title="Pan (H)">
            <PanIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="note" title="Add Note">
            <NoteIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="card" title="Add Card">
            <CardIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="text" title="Add Text">
            <TextIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="connect" title="Connect">
            <LinkIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Actions */}
        <Tooltip title="Undo (Ctrl+Z)">
          <IconButton size="small" onClick={handleUndo} disabled={historyIndex <= 0}>
            <UndoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Redo (Ctrl+Shift+Z)">
          <IconButton size="small" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
            <RedoIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Delete Selected">
          <IconButton size="small" onClick={handleDeleteSelected} disabled={state.selectedItemIds.length === 0}>
            <DeleteIcon fontSize="small" color={state.selectedItemIds.length > 0 ? 'error' : 'inherit'} />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {/* Zoom Controls */}
        <Chip
          label={`${Math.round(state.zoom * 100)}%`}
          size="small"
          sx={{ fontFamily: 'monospace' }}
        />
        <Tooltip title="Zoom Out">
          <IconButton size="small" onClick={() => handleZoom(-0.2)}>
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom In">
          <IconButton size="small" onClick={() => handleZoom(0.2)}>
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reset View">
          <IconButton size="small" onClick={handleResetView}>
            <CenterIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <FormControlLabel
          control={
            <ToggleButton
              value="grid"
              selected={state.showGrid}
              onClick={() => setState((s) => ({ ...s, showGrid: !s.showGrid }))}
              size="small"
            >
              Grid
            </ToggleButton>
          }
          label=""
        />

        {onClose && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Canvas Area */}
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: config.backgroundColor,
          cursor: cursorStyle,
          overflow: 'hidden',
          position: 'relative',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setState((s) => ({ ...s, selectedItemIds: [] }))
          }
        }}
      >
        {/* Transform Container */}
        <Box
          sx={{
            position: 'absolute',
            transform: `translate(${state.viewportX}px, ${state.viewportY}px) scale(${state.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Grid */}
          {state.showGrid && (
            <Box
              sx={{
                position: 'absolute',
                top: -5000,
                left: -5000,
                width: 10000,
                height: 10000,
                backgroundImage: `
                  linear-gradient(${config.gridColor} 1px, transparent 1px),
                  linear-gradient(90deg, ${config.gridColor} 1px, transparent 1px)
                `,
                backgroundSize: `${state.gridSize}px ${state.gridSize}px`,
                opacity: 0.5,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* SVG for Connections */}
          <svg
            style={{
              position: 'absolute',
              top: -5000,
              left: -5000,
              width: 10000,
              height: 10000,
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
              </marker>
              <marker
                id="arrowhead-start"
                markerWidth="10"
                markerHeight="7"
                refX="1"
                refY="3.5"
                orient="auto"
              >
                <polygon points="10 0, 0 3.5, 10 7" fill="#666" />
              </marker>
            </defs>

            {state.connections.map((conn) => (
              <ConnectionLine
                key={conn.id}
                connection={conn}
                items={state.items}
                onClick={() => {
                  // Handle connection click
                }}
              />
            ))}

            {/* Pending connection line */}
            {pendingConnection && (
              <line
                x1={state.items.find((i) => i.id === pendingConnection)?.position.x || 0}
                y1={state.items.find((i) => i.id === pendingConnection)?.position.y || 0}
                x2={0}
                y2={0}
                stroke="#2196F3"
                strokeWidth={2}
                strokeDasharray="4,4"
              />
            )}
          </svg>

          {/* Items */}
          {state.items.map((item) => (
            <CanvasItemComponent
              key={item.id}
              item={item}
              isSelected={state.selectedItemIds.includes(item.id)}
              onSelect={handleSelect}
              onMove={handleMove}
              onResize={handleResize}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStartConnection={handleStartConnection}
              onEndConnection={handleEndConnection}
              zoom={state.zoom}
              gridSize={state.gridSize}
            />
          ))}
        </Box>
      </Box>

      {/* Status Bar */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          bgcolor: 'rgba(255,255,255,0.95)',
          borderRadius: 1,
          px: 2,
          py: 1,
          boxShadow: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {state.items.length} items
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {state.connections.length} connections
        </Typography>
        {state.selectedItemIds.length > 0 && (
          <Chip
            label={`${state.selectedItemIds.length} selected`}
            size="small"
            color="primary"
            sx={{ height: 20 }}
          />
        )}
        {pendingConnection && (
          <Chip
            label="Click another item to connect"
            size="small"
            color="info"
            sx={{ height: 20 }}
            onDelete={() => setPendingConnection(null)}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Scroll to pan • Ctrl+Scroll to zoom • Delete to remove
        </Typography>
      </Box>
    </Paper>
  )
}

export default CanvasPanel

// ============================================================================
// Hook for Canvas
// ============================================================================

export function useCanvas() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return {
    isOpen,
    open,
    close,
    CanvasPanel: CanvasPanel as React.FC<{
      initialState?: Partial<CanvasState>
      onStateChange?: (state: CanvasState) => void
      onClose?: () => void
    }>,
  }
}