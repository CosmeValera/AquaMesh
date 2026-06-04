import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
  Menu,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  PaperProps,
  InputAdornment,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  PanTool as PanIcon,
  Link as LinkIcon,
  Circle as NodeIcon,
  Square as RectIcon,
  ChangeHistory as DiamondIcon,
  MoreVert as MoreIcon,
  Save as SaveIcon,
  FolderOpen as LoadIcon,
  Share as ShareIcon,
  TextFields as TextIcon,
  Note as NoteIcon,
  AutoAwesome as AIIcon,
  Download as ExportIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export type NodeType = 'concept' | 'topic' | 'definition' | 'example' | 'question' | 'note'
export type ConnectionStyle = 'solid' | 'dashed' | 'dotted'
export type ArrowType = 'none' | 'forward' | 'backward' | 'bidirectional'
export type LayoutType = 'automatic' | 'horizontal' | 'vertical' | 'radial'

export interface ConceptNode {
  id: string
  label: string
  description?: string
  type: NodeType
  x: number
  y: number
  width: number
  height: number
  color: string
  fontSize: number
  isBold: boolean
  isItalic: boolean
  connections: string[] // IDs of connected nodes
}

export interface ConceptConnection {
  id: string
  fromId: string
  toId: string
  label?: string
  style: ConnectionStyle
  arrowType: ArrowType
  color: string
  weight: number // 1-5, affects thickness
}

export interface ConceptMapState {
  nodes: ConceptNode[]
  connections: ConceptConnection[]
  viewportX: number
  viewportY: number
  zoom: number
}

export interface ConceptMapConfig {
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
  defaultNodeColor: string
  showLabels: boolean
  autoLayout: boolean
}

// ============================================================================
// Constants
// ============================================================================

const NODE_COLORS: Record<NodeType, string> = {
  concept: '#E3F2FD',    // Blue
  topic: '#E8F5E9',       // Green
  definition: '#FFF3E0',  // Orange
  example: '#F3E5F5',     // Purple
  question: '#FFEBEE',    // Red
  note: '#ECEFF1',        // Grey
}

const NODE_ICONS: Record<NodeType, string> = {
  concept: '💡',
  topic: '📚',
  definition: '📖',
  example: '💼',
  question: '❓',
  note: '📝',
}

const DEFAULT_COLORS = ['#E3F2FD', '#E8F5E9', '#FFF3E0', '#F3E5F5', '#FFEBEE', '#ECEFF1', '#FFFFFF']

const defaultConfig: ConceptMapConfig = {
  showGrid: true,
  snapToGrid: true,
  gridSize: 20,
  defaultNodeColor: '#E3F2FD',
  showLabels: true,
  autoLayout: false,
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

// ============================================================================
// Node Component
// ============================================================================

interface NodeComponentProps {
  node: ConceptNode
  isSelected: boolean
  onSelect: (id: string, multiSelect: boolean) => void
  onMove: (id: string, x: number, y: number) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onConnect: (id: string) => void
  zoom: number
  gridSize: number
}

const NodeComponent: React.FC<NodeComponentProps> = ({
  node,
  isSelected,
  onSelect,
  onMove,
  onEdit,
  onDelete,
  onConnect,
  zoom,
  gridSize,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; nodeX: number; nodeY: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(node.id, e.ctrlKey || e.metaKey)
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    }
  }, [node.id, node.x, node.y, onSelect])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && dragStartRef.current) {
      const dx = (e.clientX - dragStartRef.current.x) / zoom
      const dy = (e.clientY - dragStartRef.current.y) / zoom
      const newX = snapToGrid(dragStartRef.current.nodeX + dx, gridSize)
      const newY = snapToGrid(dragStartRef.current.nodeY + dy, gridSize)
      onMove(node.id, newX, newY)
    }
  }, [isDragging, zoom, gridSize, node.id, onMove])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(node.id)
  }, [node.id, onEdit])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuAnchor({ x: e.clientX, y: e.clientY })
    setShowMenu(true)
  }, [])

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          left: node.x,
          top: node.y,
          width: node.width,
          minHeight: node.height,
          bgcolor: node.color,
          border: '2px solid',
          borderColor: isSelected ? 'primary.main' : 'transparent',
          borderRadius: 1,
          boxShadow: isSelected ? 3 : 1,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          transition: 'box-shadow 0.15s',
          '&:hover': { boxShadow: 2 },
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            bgcolor: 'rgba(0,0,0,0.05)',
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '2px 2px 0 0',
          }}
        >
          <Typography sx={{ fontSize: '0.7rem' }}>{NODE_ICONS[node.type]}</Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.65rem',
              color: 'text.secondary',
              textTransform: 'capitalize',
            }}
          >
            {node.type}
          </Typography>
        </Box>

        {/* Label */}
        <Box
          sx={{
            p: 1,
            fontSize: node.fontSize,
            fontWeight: node.isBold ? 600 : 400,
            fontStyle: node.isItalic ? 'italic' : 'normal',
            textAlign: 'center',
            wordWrap: 'break-word',
          }}
        >
          {node.label}
        </Box>

        {/* Connection handles */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            right: -8,
            width: 16,
            height: 16,
            bgcolor: 'primary.main',
            borderRadius: '50%',
            cursor: 'crosshair',
            transform: 'translateY(-50%)',
            '&:hover': { bgcolor: 'primary.dark', transform: 'translateY(-50%) scale(1.2)' },
          }}
          onClick={(e) => {
            e.stopPropagation()
            onConnect(node.id)
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
          <MenuItem onClick={() => { onEdit(node.id); setShowMenu(false); }}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
          </MenuItem>
          <MenuItem onClick={() => { onConnect(node.id); setShowMenu(false); }}>
            <LinkIcon fontSize="small" sx={{ mr: 1 }} /> Connect
          </MenuItem>
          <MenuItem onClick={() => { /* duplicate */ setShowMenu(false); }}>
            <CopyIcon fontSize="small" sx={{ mr: 1 }} /> Duplicate
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { onDelete(node.id); setShowMenu(false); }} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} /> Delete
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
  connection: ConceptConnection
  fromNode: ConceptNode
  toNode: ConceptNode
  isSelected: boolean
  onSelect: () => void
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  connection,
  fromNode,
  toNode,
  isSelected,
  onSelect,
}) => {
  const x1 = fromNode.x + fromNode.width
  const y1 = fromNode.y + fromNode.height / 2
  const x2 = toNode.x
  const y2 = toNode.y + toNode.height / 2

  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  const strokeWidth = connection.weight
  const strokeColor = isSelected ? 'primary.main' : connection.color

  const strokeDasharray =
    connection.style === 'dashed' ? '8,4' :
    connection.style === 'dotted' ? '2,2' : undefined

  return (
    <g onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Invisible wider path for easier clicking */}
      <path
        d={`M ${x1} ${y1} L ${x2} ${y2}`}
        fill="none"
        stroke="transparent"
        strokeWidth={15}
      />
      {/* Visible path */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        markerEnd={
          (connection.arrowType === 'forward' || connection.arrowType === 'bidirectional')
            ? 'url(#arrowhead)'
            : undefined
        }
        markerStart={
          (connection.arrowType === 'backward' || connection.arrowType === 'bidirectional')
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
// Node Editor Dialog
// ============================================================================

interface NodeEditorDialogProps {
  node: ConceptNode | null
  onSave: (node: ConceptNode) => void
  onClose: () => void
}

const NodeEditorDialog: React.FC<NodeEditorDialogProps> = ({ node, onSave, onClose }) => {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<NodeType>('concept')
  const [color, setColor] = useState('#E3F2FD')
  const [fontSize, setFontSize] = useState(14)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)

  useEffect(() => {
    if (node) {
      setLabel(node.label)
      setDescription(node.description || '')
      setType(node.type)
      setColor(node.color)
      setFontSize(node.fontSize)
      setIsBold(node.isBold)
      setIsItalic(node.isItalic)
    }
  }, [node])

  const handleSave = () => {
    if (!node || !label.trim()) return
    onSave({
      ...node,
      label: label.trim(),
      description: description.trim() || undefined,
      type,
      color,
      fontSize,
      isBold,
      isItalic,
    })
  }

  if (!node) return null

  return (
    <Dialog open={Boolean(node)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        ✏️ Edit {NODE_ICONS[type]} {type.charAt(0).toUpperCase() + type.slice(1)}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <TextField
            fullWidth
            label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            sx={{ mb: 2 }}
            autoFocus
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Node Type
            </Typography>
            <ToggleButtonGroup
              value={type}
              exclusive
              onChange={(_, v) => v && setType(v)}
              fullWidth
            >
              {(Object.keys(NODE_ICONS) as NodeType[]).map((t) => (
                <ToggleButton key={t} value={t} sx={{ textTransform: 'capitalize' }}>
                  {NODE_ICONS[t]} {t}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Color
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {DEFAULT_COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setColor(c)}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: c,
                    border: color === c ? '3px solid' : '1px solid',
                    borderColor: color === c ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { transform: 'scale(1.1)' },
                  }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Font Size: {fontSize}px
            </Typography>
            <Slider
              value={fontSize}
              min={10}
              max={24}
              step={1}
              onChange={(_, v) => setFontSize(v as number)}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant={isBold ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setIsBold(!isBold)}
            >
              Bold
            </Button>
            <Button
              variant={isItalic ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setIsItalic(!isItalic)}
            >
              Italic
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!label.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================================================
// Connection Editor Dialog
// ============================================================================

interface ConnectionEditorDialogProps {
  connection: ConceptConnection | null
  fromLabel?: string
  toLabel?: string
  onSave: (connection: ConceptConnection) => void
  onClose: () => void
}

const ConnectionEditorDialog: React.FC<ConnectionEditorDialogProps> = ({
  connection,
  fromLabel,
  toLabel,
  onSave,
  onClose,
}) => {
  const [label, setLabel] = useState('')
  const [style, setStyle] = useState<ConnectionStyle>('solid')
  const [arrowType, setArrowType] = useState<ArrowType>('forward')
  const [color, setColor] = useState('#666666')
  const [weight, setWeight] = useState(2)

  useEffect(() => {
    if (connection) {
      setLabel(connection.label || '')
      setStyle(connection.style)
      setArrowType(connection.arrowType)
      setColor(connection.color)
      setWeight(connection.weight)
    }
  }, [connection])

  const handleSave = () => {
    if (!connection) return
    onSave({
      ...connection,
      label: label.trim() || undefined,
      style,
      arrowType,
      color,
      weight,
    })
  }

  if (!connection) return null

  return (
    <Dialog open={Boolean(connection)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        🔗 Edit Connection: {fromLabel} → {toLabel}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <TextField
            fullWidth
            label="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="e.g., 'is a type of', 'leads to'"
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Line Style
            </Typography>
            <ToggleButtonGroup
              value={style}
              exclusive
              onChange={(_, v) => v && setStyle(v)}
            >
              <ToggleButton value="solid">Solid</ToggleButton>
              <ToggleButton value="dashed">Dashed</ToggleButton>
              <ToggleButton value="dotted">Dotted</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Arrow Type
            </Typography>
            <ToggleButtonGroup
              value={arrowType}
              exclusive
              onChange={(_, v) => v && setArrowType(v)}
            >
              <ToggleButton value="none">None</ToggleButton>
              <ToggleButton value="forward">→</ToggleButton>
              <ToggleButton value="backward">←</ToggleButton>
              <ToggleButton value="bidirectional">↔</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Line Weight: {weight}
            </Typography>
            <Slider
              value={weight}
              min={1}
              max={5}
              step={1}
              onChange={(_, v) => setWeight(v as number)}
              marks={[
                { value: 1, label: 'Thin' },
                { value: 3, label: 'Medium' },
                { value: 5, label: 'Thick' },
              ]}
            />
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
// Main Concept Map Panel
// ============================================================================

interface ConceptMapPanelProps {
  initialState?: Partial<ConceptMapState>
  onClose?: () => void
}

const defaultState: ConceptMapState = {
  nodes: [
    { id: 'n1', label: 'Machine Learning', type: 'topic', x: 300, y: 50, width: 140, height: 50, color: '#E8F5E9', fontSize: 14, isBold: true, isItalic: false, connections: ['n2', 'n3'] },
    { id: 'n2', label: 'Supervised Learning', type: 'concept', x: 100, y: 150, width: 130, height: 45, color: '#E3F2FD', fontSize: 12, isBold: false, isItalic: false, connections: ['n4'] },
    { id: 'n3', label: 'Unsupervised Learning', type: 'concept', x: 350, y: 150, width: 140, height: 45, color: '#E3F2FD', fontSize: 12, isBold: false, isItalic: false, connections: ['n5'] },
    { id: 'n4', label: 'Classification', type: 'definition', x: 50, y: 250, width: 110, height: 40, color: '#FFF3E0', fontSize: 11, isBold: false, isItalic: true, connections: [] },
    { id: 'n5', label: 'Clustering', type: 'definition', x: 380, y: 250, width: 100, height: 40, color: '#FFF3E0', fontSize: 11, isBold: false, isItalic: true, connections: [] },
    { id: 'n6', label: 'Neural Networks', type: 'concept', x: 500, y: 150, width: 120, height: 45, color: '#E3F2FD', fontSize: 12, isBold: false, isItalic: false, connections: ['n7'] },
    { id: 'n7', label: 'Deep Learning', type: 'concept', x: 550, y: 250, width: 100, height: 40, color: '#E3F2FD', fontSize: 11, isBold: true, isItalic: false, connections: [] },
  ],
  connections: [
    { id: 'c1', fromId: 'n1', toId: 'n2', label: 'includes', style: 'solid', arrowType: 'forward', color: '#666', weight: 2 },
    { id: 'c2', fromId: 'n1', toId: 'n3', label: 'includes', style: 'solid', arrowType: 'forward', color: '#666', weight: 2 },
    { id: 'c3', fromId: 'n1', toId: 'n6', label: 'leads to', style: 'dashed', arrowType: 'forward', color: '#4CAF50', weight: 2 },
    { id: 'c4', fromId: 'n2', toId: 'n4', style: 'solid', arrowType: 'forward', color: '#666', weight: 1 },
    { id: 'c5', fromId: 'n3', toId: 'n5', style: 'solid', arrowType: 'forward', color: '#666', weight: 1 },
  ],
  viewportX: 0,
  viewportY: 0,
  zoom: 1,
}

const ConceptMapPanel: React.FC<ConceptMapPanelProps> = ({ initialState, onClose }) => {
  const [state, setState] = useState<ConceptMapState>({ ...defaultState, ...initialState })
  const [config, setConfig] = useState<ConceptMapConfig>(defaultConfig)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [editingNode, setEditingNode] = useState<ConceptNode | null>(null)
  const [editingConnection, setEditingConnection] = useState<ConceptConnection | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [showNodeMenu, setShowNodeMenu] = useState(false)
  const [nodeMenuAnchor, setNodeMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const [newNodeType, setNewNodeType] = useState<NodeType>('concept')
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number; vpX: number; vpY: number } | null>(null)

  // Auto-save
  useEffect(() => {
    localStorage.setItem('studymesh-concept-map', JSON.stringify(state))
  }, [state])

  const handleSelect = useCallback((id: string, multiSelect: boolean) => {
    setSelectedNodeIds(multiSelect
      ? (selectedNodeIds.includes(id)
        ? selectedNodeIds.filter((i) => i !== id)
        : [...selectedNodeIds, id])
      : [id]
    )
    setSelectedConnectionId(null)
  }, [selectedNodeIds])

  const handleConnectionSelect = useCallback((id: string) => {
    setSelectedConnectionId(id)
    setSelectedNodeIds([])
  }, [])

  const handleMoveNode = useCallback((id: string, x: number, y: number) => {
    setState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => n.id === id ? { ...n, x, y } : n),
    }))
  }, [])

  const handleEditNode = useCallback((id: string) => {
    const node = state.nodes.find((n) => n.id === id)
    if (node) setEditingNode(node)
  }, [state.nodes])

  const handleSaveNode = useCallback((updatedNode: ConceptNode) => {
    setState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => n.id === updatedNode.id ? updatedNode : n),
    }))
    setEditingNode(null)
  }, [])

  const handleDeleteNode = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== id),
      connections: prev.connections.filter((c) => c.fromId !== id && c.toId !== id),
      viewportX: prev.viewportX,
      viewportY: prev.viewportY,
      zoom: prev.zoom,
    }))
    setSelectedNodeIds((prev) => prev.filter((i) => i !== id))
  }, [])

  const handleConnect = useCallback((fromId: string) => {
    if (connectingFrom === null) {
      setConnectingFrom(fromId)
    } else if (connectingFrom !== fromId) {
      // Create connection
      const newConnection: ConceptConnection = {
        id: generateId(),
        fromId: connectingFrom,
        toId: fromId,
        style: 'solid',
        arrowType: 'forward',
        color: '#666',
        weight: 2,
      }
      setState((prev) => ({
        ...prev,
        connections: [...prev.connections, newConnection],
      }))
      setConnectingFrom(null)
    }
  }, [connectingFrom])

  const handleEditConnection = useCallback((id: string) => {
    const conn = state.connections.find((c) => c.id === id)
    if (conn) setEditingConnection(conn)
  }, [state.connections])

  const handleSaveConnection = useCallback((updated: ConceptConnection) => {
    setState((prev) => ({
      ...prev,
      connections: prev.connections.map((c) => c.id === updated.id ? updated : c),
    }))
    setEditingConnection(null)
  }, [])

  const handleDeleteConnection = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      connections: prev.connections.filter((c) => c.id !== id),
    }))
    setSelectedConnectionId(null)
  }, [])

  const handleAddNode = useCallback((type: NodeType) => {
    const newNode: ConceptNode = {
      id: generateId(),
      label: `New ${type}`,
      type,
      x: 200 - state.viewportX / state.zoom,
      y: 150 - state.viewportY / state.zoom,
      width: 120,
      height: 45,
      color: NODE_COLORS[type],
      fontSize: 12,
      isBold: false,
      isItalic: false,
      connections: [],
    }
    setState((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }))
    setShowNodeMenu(false)
  }, [state.viewportX, state.viewportY, state.zoom])

  const handleZoom = useCallback((delta: number) => {
    setState((prev) => ({
      ...prev,
      zoom: clamp(prev.zoom + delta, 0.2, 3),
    }))
  }, [])

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
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true)
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        vpX: state.viewportX,
        vpY: state.viewportY,
      }
    }
  }, [state.viewportX, state.viewportY])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      setState((prev) => ({
        ...prev,
        viewportX: panStartRef.current!.vpX + dx,
        viewportY: panStartRef.current!.vpY + dy,
      }))
    }
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    panStartRef.current = null
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0 && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
          selectedNodeIds.forEach((id) => handleDeleteNode(id))
        }
        if (selectedConnectionId) {
          handleDeleteConnection(selectedConnectionId)
        }
      }
      if (e.key === 'Escape') {
        setSelectedNodeIds([])
        setSelectedConnectionId(null)
        setConnectingFrom(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodeIds, selectedConnectionId, handleDeleteNode, handleDeleteConnection])

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
          🗺️ Concept Map
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Add Node Button */}
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={(e) => setNodeMenuAnchor(e.currentTarget)}
        >
          Add Node
        </Button>
        <Menu
          anchorEl={nodeMenuAnchor}
          open={Boolean(nodeMenuAnchor)}
          onClose={() => setNodeMenuAnchor(null)}
        >
          {(Object.keys(NODE_ICONS) as NodeType[]).map((type) => (
            <MenuItem key={type} onClick={() => handleAddNode(type)}>
              {NODE_ICONS[type]} {type.charAt(0).toUpperCase() + type.slice(1)}
            </MenuItem>
          ))}
        </Menu>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Zoom Controls */}
        <Chip label={`${Math.round(state.zoom * 100)}%`} size="small" sx={{ fontFamily: 'monospace' }} />
        <IconButton size="small" onClick={() => handleZoom(-0.2)}>
          <ZoomOutIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => handleZoom(0.2)}>
          <ZoomInIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={handleResetView}>
          <CenterIcon fontSize="small" />
        </IconButton>

        <Box sx={{ flex: 1 }} />

        {selectedConnectionId && (
          <>
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => handleEditConnection(selectedConnectionId)}
            >
              Edit Connection
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => handleDeleteConnection(selectedConnectionId)}
            >
              Delete
            </Button>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          </>
        )}

        {onClose && (
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      {/* Canvas Area */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: '#fafafa',
          cursor: isPanning ? 'grabbing' : 'default',
          overflow: 'hidden',
          position: 'relative',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedNodeIds([])
            setSelectedConnectionId(null)
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
          {config.showGrid && (
            <Box
              sx={{
                position: 'absolute',
                top: -5000,
                left: -5000,
                width: 10000,
                height: 10000,
                backgroundImage: `
                  linear-gradient(${config.gridColor || '#e0e0e0'} 1px, transparent 1px),
                  linear-gradient(90deg, ${config.gridColor || '#e0e0e0'} 1px, transparent 1px)
                `,
                backgroundSize: `${config.gridSize}px ${config.gridSize}px`,
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

            {state.connections.map((conn) => {
              const fromNode = state.nodes.find((n) => n.id === conn.fromId)
              const toNode = state.nodes.find((n) => n.id === conn.toId)
              if (!fromNode || !toNode) return null
              return (
                <ConnectionLine
                  key={conn.id}
                  connection={conn}
                  fromNode={fromNode}
                  toNode={toNode}
                  isSelected={selectedConnectionId === conn.id}
                  onSelect={() => handleConnectionSelect(conn.id)}
                />
              )
            })}
          </svg>

          {/* Nodes */}
          {state.nodes.map((node) => (
            <NodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNodeIds.includes(node.id)}
              onSelect={handleSelect}
              onMove={handleMoveNode}
              onEdit={handleEditNode}
              onDelete={handleDeleteNode}
              onConnect={handleConnect}
              zoom={state.zoom}
              gridSize={config.gridSize}
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
          {state.nodes.length} nodes
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {state.connections.length} connections
        </Typography>
        {selectedNodeIds.length > 0 && (
          <Chip label={`${selectedNodeIds.length} selected`} size="small" color="primary" />
        )}
        {connectingFrom && (
          <Chip
            label="Click another node to connect"
            size="small"
            color="info"
            onDelete={() => setConnectingFrom(null)}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Scroll to pan • Shift+Drag to pan • Click node handles to connect
        </Typography>
      </Box>

      {/* Node Editor Dialog */}
      <NodeEditorDialog
        node={editingNode}
        onSave={handleSaveNode}
        onClose={() => setEditingNode(null)}
      />

      {/* Connection Editor Dialog */}
      <ConnectionEditorDialog
        connection={editingConnection}
        fromLabel={editingConnection ? state.nodes.find((n) => n.id === editingConnection.fromId)?.label : undefined}
        toLabel={editingConnection ? state.nodes.find((n) => n.id === editingConnection.toId)?.label : undefined}
        onSave={handleSaveConnection}
        onClose={() => setEditingConnection(null)}
      />
    </Paper>
  )
}

export default ConceptMapPanel

// ============================================================================
// Hook for Concept Map
// ============================================================================

export function useConceptMap() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return {
    isOpen,
    open,
    close,
    ConceptMapPanel: ConceptMapPanel as React.FC<{
      initialState?: Partial<ConceptMapState>
      onClose?: () => void
    }>,
  }
}