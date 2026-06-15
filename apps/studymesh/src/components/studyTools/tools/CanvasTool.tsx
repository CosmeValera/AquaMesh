import React, { useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import GridOnIcon from '@mui/icons-material/GridOn'
import LinkIcon from '@mui/icons-material/Link'
import PanToolIcon from '@mui/icons-material/PanTool'
import RedoIcon from '@mui/icons-material/Redo'
import UndoIcon from '@mui/icons-material/Undo'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'

import { useStudyTools } from '../StudyToolsProvider'
import type { CanvasItem } from '../types'
import {
  canvasHandlePoint,
  routeCanvasConnection,
  type CanvasPoint,
  type CanvasSide,
} from '../canvasGeometry'

const cardColors = ['#fff6b8', '#bde5c5', '#b9e4f7', '#ffd5e2', '#e4d4ff']
const id = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
const now = () => new Date().toISOString()

const CanvasTool = ({
  fullscreen,
  onFullscreenChange,
}: {
  fullscreen: boolean
  onFullscreenChange: (fullscreen: boolean) => void
}) => {
  const { state, updateState } = useStudyTools()
  const canvas = state.canvas
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [connectSide, setConnectSide] = useState<CanvasSide>('right')
  const [pointer, setPointer] = useState<CanvasPoint | null>(null)
  const [panMode, setPanMode] = useState(false)
  const history = useRef<typeof canvas[]>([])
  const future = useRef<typeof canvas[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const interaction = useRef<{
    kind: 'item' | 'pan' | 'resize'
    id?: string
    startX: number
    startY: number
    originalX: number
    originalY: number
  } | null>(null)

  const setCanvas = (
    updater: (current: typeof canvas) => typeof canvas,
    remember = true,
  ) =>
    updateState((current) => {
      const nextCanvas = { ...updater(current.canvas), updatedAt: now() }
      if (remember) {
        history.current = [...history.current.slice(-39), current.canvas]
        future.current = []
      }
      return { ...current, canvas: nextCanvas }
    })

  const rememberInteraction = () => {
    history.current = [...history.current.slice(-39), canvas]
    future.current = []
  }

  const addItem = () => {
    const bounds = containerRef.current?.getBoundingClientRect()
    const firstX = ((bounds?.width || window.innerWidth) / 2 - canvas.viewportX) / canvas.zoom - 110
    const firstY = ((bounds?.height || window.innerHeight) / 2 - canvas.viewportY) / canvas.zoom - 70
    const previous = canvas.items[canvas.items.length - 1]
    const item: CanvasItem = {
      id: id('canvas-item'),
      x: canvas.items.length === 0
        ? firstX
        : previous.x + previous.width + 80,
      y: canvas.items.length === 0
        ? firstY
        : previous.y,
      width: 220,
      height: 140,
      content: '',
      color: cardColors[canvas.items.length % cardColors.length],
    }
    setCanvas((current) => ({ ...current, items: [...current.items, item] }))
    setSelectedId(item.id)
  }

  const editItem = (itemId: string, content: string) => {
    setCanvas((current) => ({
      ...current,
      items: current.items.map((entry) =>
        entry.id === itemId ? { ...entry, content } : entry,
      ),
    }), false)
  }

  const handleItemClick = (itemId: string) => {
    setSelectedId(itemId)
    setSelectedConnectionId(null)
    if (connectFrom && connectFrom !== itemId) {
      setCanvas((current) => ({
        ...current,
        connections: current.connections.some(
          (connection) =>
            connection.fromItemId === connectFrom &&
            connection.toItemId === itemId,
        )
          ? current.connections
          : [
              ...current.connections,
              { id: id('canvas-link'), fromItemId: connectFrom, toItemId: itemId },
            ],
      }))
      setConnectFrom(null)
      setPointer(null)
    }
  }

  const deleteSelection = () => {
    if (selectedConnectionId) {
      setCanvas((current) => ({
        ...current,
        connections: current.connections.filter(
          (connection) => connection.id !== selectedConnectionId,
        ),
      }))
      setSelectedConnectionId(null)
      return
    }
    if (!selectedId) return
    setCanvas((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== selectedId),
      connections: current.connections.filter(
        (connection) =>
          connection.fromItemId !== selectedId &&
          connection.toItemId !== selectedId,
      ),
    }))
    setSelectedId(null)
  }

  const duplicateSelected = () => {
    const selected = selectedId ? itemById(selectedId) : undefined
    if (!selected) return
    const duplicate = {
      ...selected,
      id: id('canvas-item'),
      x: selected.x + 40,
      y: selected.y + 40,
    }
    setCanvas((current) => ({ ...current, items: [...current.items, duplicate] }))
    setSelectedId(duplicate.id)
  }

  const pointerMove = (event: React.PointerEvent) => {
    if (connectFrom) {
      const bounds = containerRef.current?.getBoundingClientRect()
      setPointer({
        x: (event.clientX - (bounds?.left || 0) - canvas.viewportX) / canvas.zoom,
        y: (event.clientY - (bounds?.top || 0) - canvas.viewportY) / canvas.zoom,
      })
    }
    const active = interaction.current
    if (!active) return
    const dx = (event.clientX - active.startX) / canvas.zoom
    const dy = (event.clientY - active.startY) / canvas.zoom
    if (active.kind === 'pan') {
      setCanvas(
        (current) => ({
          ...current,
          viewportX: active.originalX + event.clientX - active.startX,
          viewportY: active.originalY + event.clientY - active.startY,
        }),
        false,
      )
      return
    }
    if (active.kind === 'resize') {
      setCanvas(
        (current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === active.id
              ? {
                  ...item,
                  width: Math.max(160, active.originalX + dx),
                  height: Math.max(100, active.originalY + dy),
                }
              : item,
          ),
        }),
        false,
      )
      return
    }
    const snap = (value: number) =>
      canvas.snapToGrid
        ? Math.round(value / canvas.gridSize) * canvas.gridSize
        : value
    setCanvas(
      (current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === active.id
            ? { ...item, x: snap(active.originalX + dx), y: snap(active.originalY + dy) }
            : item,
        ),
      }),
      false,
    )
  }

  const undo = () => {
    const previous = history.current.pop()
    if (!previous) return
    future.current.push(canvas)
    updateState((current) => ({ ...current, canvas: previous }))
  }
  const redo = () => {
    const next = future.current.pop()
    if (!next) return
    history.current.push(canvas)
    updateState((current) => ({ ...current, canvas: next }))
  }

  const itemById = (itemId: string) =>
    canvas.items.find((item) => item.id === itemId)

  const connectionRoutes = canvas.connections.map((connection, index) => {
    const from = itemById(connection.fromItemId)
    const to = itemById(connection.toItemId)
    if (!from || !to) return null
    const siblings = canvas.connections.filter(
      (candidate) =>
        candidate.fromItemId === connection.fromItemId &&
        candidate.toItemId === connection.toItemId,
    )
    const siblingIndex = siblings.findIndex((candidate) => candidate.id === connection.id)
    const lane = siblingIndex - (siblings.length - 1) / 2
    return { connection, route: routeCanvasConnection(from, to, lane), index }
  }).filter(Boolean) as Array<{
    connection: (typeof canvas.connections)[number]
    route: ReturnType<typeof routeCanvasConnection>
    index: number
  }>

  return (
    <Box
      ref={containerRef}
      sx={{
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        zIndex: fullscreen ? 1500 : undefined,
        width: '100%',
        height: fullscreen ? '100dvh' : '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          zIndex: 4,
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 'calc(100% - 24px)',
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          overflowX: 'auto',
          bgcolor: 'rgba(255,255,255,.92)',
          border: '1px solid rgba(36,59,58,.08)',
          borderRadius: 999,
          boxShadow: '0 12px 32px rgba(36,59,58,.12)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={addItem}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Add note
        </Button>
        <Tooltip title="Pan canvas">
          <IconButton
            aria-label="Pan canvas"
            onClick={() => setPanMode((value) => !value)}
            color={panMode ? 'primary' : 'default'}
          >
            <PanToolIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Connect selected item">
          <span>
            <IconButton
              aria-label="Connect selected item"
              disabled={!selectedId}
              color={connectFrom ? 'primary' : 'default'}
              onClick={() => {
                setConnectFrom(selectedId)
                setConnectSide('right')
              }}
            >
              <LinkIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Duplicate selected card">
          <span>
            <IconButton
              aria-label="Duplicate selected canvas card"
              disabled={!selectedId}
              onClick={duplicateSelected}
            >
              <ContentCopyIcon />
            </IconButton>
          </span>
        </Tooltip>
        <IconButton aria-label="Undo canvas change" disabled={!history.current.length} onClick={undo}>
          <UndoIcon />
        </IconButton>
        <IconButton aria-label="Redo canvas change" disabled={!future.current.length} onClick={redo}>
          <RedoIcon />
        </IconButton>
        <IconButton
          aria-label="Delete selected canvas item"
          disabled={!selectedId && !selectedConnectionId}
          color="error"
          onClick={deleteSelection}
        >
          <DeleteOutlineIcon />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <Chip size="small" label={`${Math.round(canvas.zoom * 100)}%`} />
        <IconButton
          aria-label="Zoom out"
          onClick={() => setCanvas((current) => ({ ...current, zoom: Math.max(0.3, current.zoom - 0.1) }))}
        >
          <ZoomOutIcon />
        </IconButton>
        <IconButton
          aria-label="Zoom in"
          onClick={() => setCanvas((current) => ({ ...current, zoom: Math.min(3, current.zoom + 0.1) }))}
        >
          <ZoomInIcon />
        </IconButton>
        <IconButton
          aria-label="Toggle canvas grid"
          color={canvas.showGrid ? 'primary' : 'default'}
          onClick={() => setCanvas((current) => ({ ...current, showGrid: !current.showGrid }))}
        >
          <GridOnIcon />
        </IconButton>
        <Button
          size="small"
          onClick={() =>
            setCanvas((current) => ({
              ...current,
              viewportX: 80,
              viewportY: 100,
              zoom: 1,
            }))
          }
        >
          Reset view
        </Button>
        <Button
          size="small"
          disabled={!canvas.items.length}
          onClick={() =>
            setCanvas((current) => ({
              ...current,
              items: current.items.map((item, index) => ({
                ...item,
                x: 80 + (index % 4) * 260,
                y: 120 + Math.floor(index / 4) * 190,
              })),
            }))
          }
        >
          Arrange
        </Button>
        <Button
          size="small"
          disabled={!canvas.items.length}
          onClick={() => {
            const minX = Math.min(...canvas.items.map((item) => item.x))
            const minY = Math.min(...canvas.items.map((item) => item.y))
            const maxX = Math.max(...canvas.items.map((item) => item.x + item.width))
            const maxY = Math.max(...canvas.items.map((item) => item.y + item.height))
            const bounds = containerRef.current?.getBoundingClientRect()
            const zoom = Math.min(1.5, Math.max(0.3, Math.min(
              ((bounds?.width || window.innerWidth) - 80) / Math.max(1, maxX - minX),
              ((bounds?.height || window.innerHeight) - 120) / Math.max(1, maxY - minY),
            )))
            setCanvas((current) => ({
              ...current,
              zoom,
              viewportX: 80 - minX * zoom,
              viewportY: 100 - minY * zoom,
            }))
          }}
        >
          Fit all
        </Button>
        <Button
          size="small"
          disabled={!canvas.connections.length}
          onClick={() =>
            setCanvas((current) => ({ ...current, connections: [] }))
          }
        >
          Clear links
        </Button>
        <IconButton
          aria-label={fullscreen ? 'Restore Canvas to Study Tools' : 'Maximize Canvas'}
          onClick={() => onFullscreenChange(!fullscreen)}
          sx={{ color: 'text.primary', bgcolor: 'action.hover' }}
        >
          {fullscreen ? <CloseFullscreenIcon /> : <OpenInFullIcon />}
        </IconButton>
      </Box>

      <Box
        tabIndex={0}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest('textarea,input')) return
          if (event.key === 'Escape') {
            setConnectFrom(null)
            setPointer(null)
            setSelectedConnectionId(null)
          }
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault()
            deleteSelection()
          }
        }}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (!panMode) {
            setSelectedId(null)
            setSelectedConnectionId(null)
            return
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          interaction.current = {
            kind: 'pan',
            startX: event.clientX,
            startY: event.clientY,
            originalX: canvas.viewportX,
            originalY: canvas.viewportY,
          }
          rememberInteraction()
        }}
        onPointerMove={pointerMove}
        onPointerUp={() => {
          interaction.current = null
        }}
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) return
          event.preventDefault()
          const nextZoom = Math.min(3, Math.max(0.3, canvas.zoom + (event.deltaY > 0 ? -0.1 : 0.1)))
          const bounds = containerRef.current?.getBoundingClientRect()
          const localX = event.clientX - (bounds?.left || 0)
          const localY = event.clientY - (bounds?.top || 0)
          const canvasX = (localX - canvas.viewportX) / canvas.zoom
          const canvasY = (localY - canvas.viewportY) / canvas.zoom
          setCanvas((current) => ({
            ...current,
            zoom: nextZoom,
            viewportX: localX - canvasX * nextZoom,
            viewportY: localY - canvasY * nextZoom,
          }), false)
        }}
        onDoubleClick={(event) => {
          if (event.target === event.currentTarget) addItem()
        }}
        sx={{
          position: 'absolute',
          inset: 0,
          cursor: panMode ? 'grab' : 'default',
          bgcolor: '#f8f6ef',
          backgroundImage: canvas.showGrid
            ? 'radial-gradient(circle, rgba(73,92,88,.15) 1.25px, transparent 1.5px)'
            : 'none',
          backgroundSize: `${canvas.gridSize * canvas.zoom}px ${canvas.gridSize * canvas.zoom}px`,
          backgroundPosition: `${canvas.viewportX}px ${canvas.viewportY}px`,
        }}
      >
        {canvas.items.length === 0 && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeContent: 'center',
              justifyItems: 'center',
              gap: 2,
              pointerEvents: 'none',
            }}
          >
            <Typography
              sx={{
                color: '#42525d',
                fontFamily: 'Georgia, serif',
                fontSize: { xs: '1.2rem', md: '1.5rem' },
              }}
            >
              No notes yet. Add your first planning note.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={addItem}
              sx={{
                pointerEvents: 'auto',
                borderRadius: 2.5,
                px: 5,
                py: 1.5,
                bgcolor: '#1f2d38',
                fontWeight: 900,
                '&:hover': { bgcolor: '#304351' },
              }}
            >
              Add note
            </Button>
          </Box>
        )}
        <Box
          sx={{
            position: 'absolute',
            transform: `translate(${canvas.viewportX}px, ${canvas.viewportY}px) scale(${canvas.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <svg
            width="10000"
            height="10000"
            style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
          >
            <defs>
              <marker
                id="canvas-arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#55706c" />
              </marker>
            </defs>
            {connectionRoutes.map(({ connection, route }) => {
              return (
                <g key={connection.id}>
                  <path
                    d={route.path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                    pointerEvents="stroke"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedConnectionId(connection.id)
                      setSelectedId(null)
                    }}
                  />
                  <path
                    d={route.path}
                    fill="none"
                    stroke={selectedConnectionId === connection.id ? '#00866f' : '#55706c'}
                    strokeWidth={selectedConnectionId === connection.id ? 4 : 3}
                    markerEnd="url(#canvas-arrowhead)"
                  />
                </g>
              )
            })}
            {connectFrom && pointer && (() => {
              const source = itemById(connectFrom)
              if (!source) return null
              const start = canvasHandlePoint(source, connectSide)
              return (
                <path
                  d={`M ${start.x} ${start.y} L ${pointer.x} ${pointer.y}`}
                  fill="none"
                  stroke="#00866f"
                  strokeWidth="3"
                  strokeDasharray="8 6"
                  markerEnd="url(#canvas-arrowhead)"
                />
              )
            })()}
          </svg>
          {connectionRoutes.map(({ connection, route }) => (
            <TextField
              key={`label-${connection.id}`}
              size="small"
              variant="standard"
              placeholder="Label"
              value={connection.label || ''}
              onFocus={() => {
                setSelectedConnectionId(connection.id)
                setSelectedId(null)
              }}
              onChange={(event) =>
                setCanvas((current) => ({
                  ...current,
                  connections: current.connections.map((candidate) =>
                    candidate.id === connection.id
                      ? { ...candidate, label: event.target.value }
                      : candidate,
                  ),
                }), false)
              }
              InputProps={{ disableUnderline: true }}
              sx={{
                position: 'absolute',
                left: route.label.x - 45,
                top: route.label.y - 16,
                width: 90,
                bgcolor: 'background.paper',
                borderRadius: 1,
                px: 0.5,
                opacity: connection.label || selectedConnectionId === connection.id ? 1 : 0,
                '&:hover': { opacity: 1 },
              }}
            />
          ))}
          {canvas.items.map((item) => (
            <Box
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                handleItemClick(item.id)
              }}
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest('textarea')) return
                if (panMode) return
                event.stopPropagation()
                event.currentTarget.setPointerCapture(event.pointerId)
                interaction.current = {
                  kind: 'item',
                  id: item.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  originalX: item.x,
                  originalY: item.y,
                }
                rememberInteraction()
                handleItemClick(item.id)
              }}
              onKeyDown={(event) => {
                if ((event.target as HTMLElement).closest('textarea,input')) return
                const step = event.shiftKey ? canvas.gridSize : 5
                const movement = {
                  ArrowLeft: [-step, 0],
                  ArrowRight: [step, 0],
                  ArrowUp: [0, -step],
                  ArrowDown: [0, step],
                }[event.key]
                if (!movement) return
                event.preventDefault()
                setCanvas((current) => ({
                  ...current,
                  items: current.items.map((entry) =>
                    entry.id === item.id
                      ? {
                          ...entry,
                          x: entry.x + movement[0],
                          y: entry.y + movement[1],
                        }
                      : entry,
                  ),
                }))
              }}
              onPointerMove={pointerMove}
              onPointerUp={() => {
                interaction.current = null
              }}
              sx={{
                position: 'absolute',
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                p: 1.25,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                bgcolor: item.color,
                color: '#243b3a',
                border: 2,
                borderColor:
                  selectedId === item.id || connectFrom === item.id
                    ? 'primary.main'
                    : 'rgba(36,59,58,.25)',
                borderRadius: 2,
                boxShadow:
                  selectedId === item.id
                    ? '0 16px 32px rgba(36,59,58,.18)'
                    : '0 8px 18px rgba(36,59,58,.10)',
                cursor: 'move',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              <Box
                aria-label="Drag card"
                sx={{
                  height: 24,
                  mx: -1.25,
                  mt: -1.25,
                  mb: 0.5,
                  px: 0.75,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'rgba(36,59,58,.65)',
                  cursor: 'move',
                  borderBottom: '1px solid rgba(36,59,58,.08)',
                }}
              >
                <DragIndicatorIcon fontSize="small" />
              </Box>
              <TextField
                autoFocus={selectedId === item.id && !item.content}
                multiline
                fullWidth
                minRows={4}
                variant="standard"
                placeholder="Write on this card..."
                value={item.content}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  if (connectFrom) handleItemClick(item.id)
                }}
                onChange={(event) => editItem(item.id, event.target.value)}
                InputProps={{
                  disableUnderline: true,
                  sx: {
                    alignItems: 'flex-start',
                    color: '#243b3a',
                    fontSize: '1rem',
                    lineHeight: 1.5,
                  },
                }}
              />
              <Box
                aria-label="Change card color"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation()
                  const colorIndex = cardColors.indexOf(item.color)
                  const color = cardColors[(colorIndex + 1) % cardColors.length]
                  setCanvas((current) => ({
                    ...current,
                    items: current.items.map((entry) =>
                      entry.id === item.id ? { ...entry, color } : entry,
                    ),
                  }))
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  const colorIndex = cardColors.indexOf(item.color)
                  const color = cardColors[(colorIndex + 1) % cardColors.length]
                  setCanvas((current) => ({
                    ...current,
                    items: current.items.map((entry) =>
                      entry.id === item.id ? { ...entry, color } : entry,
                    ),
                  }))
                }}
                sx={{
                  position: 'absolute',
                  top: 7,
                  right: 7,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: item.color,
                  border: '2px solid rgba(36,59,58,.45)',
                  cursor: 'pointer',
                }}
              />
              <Box
                aria-label="Resize card"
                role="button"
                tabIndex={0}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  event.currentTarget.setPointerCapture(event.pointerId)
                  interaction.current = {
                    kind: 'resize',
                    id: item.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    originalX: item.width,
                    originalY: item.height,
                  }
                  rememberInteraction()
                }}
                onPointerMove={pointerMove}
                onPointerUp={() => {
                  interaction.current = null
                }}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? canvas.gridSize : 5
                  const movement = {
                    ArrowLeft: [-step, 0],
                    ArrowRight: [step, 0],
                    ArrowUp: [0, -step],
                    ArrowDown: [0, step],
                  }[event.key]
                  if (!movement) return
                  event.preventDefault()
                  setCanvas((current) => ({
                    ...current,
                    items: current.items.map((entry) =>
                      entry.id === item.id
                        ? {
                            ...entry,
                            width: Math.max(160, entry.width + movement[0]),
                            height: Math.max(100, entry.height + movement[1]),
                          }
                        : entry,
                    ),
                  }))
                }}
                sx={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: 18,
                  height: 18,
                  cursor: 'nwse-resize',
                  borderRight: '4px solid rgba(36,59,58,.45)',
                  borderBottom: '4px solid rgba(36,59,58,.45)',
                  touchAction: 'none',
                }}
              />
              {selectedId === item.id && (['top', 'right', 'bottom', 'left'] as CanvasSide[]).map((side) => (
                <Box
                  key={side}
                  component="button"
                  type="button"
                  aria-label={`Connect from ${side}`}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    setConnectFrom(item.id)
                    setConnectSide(side)
                    const point = canvasHandlePoint(item, side)
                    setPointer(point)
                  }}
                  sx={{
                    position: 'absolute',
                    width: 16,
                    height: 16,
                    p: 0,
                    borderRadius: '50%',
                    border: '3px solid',
                    borderColor: 'primary.main',
                    bgcolor: 'background.paper',
                    cursor: 'crosshair',
                    zIndex: 3,
                    ...(side === 'top' && { top: -10, left: 'calc(50% - 8px)' }),
                    ...(side === 'right' && { right: -10, top: 'calc(50% - 8px)' }),
                    ...(side === 'bottom' && { bottom: -10, left: 'calc(50% - 8px)' }),
                    ...(side === 'left' && { left: -10, top: 'calc(50% - 8px)' }),
                  }}
                />
              ))}
            </Box>
          ))}
          {selectedId && (() => {
            const selected = itemById(selectedId)
            if (!selected) return null
            return (
              <Box
                sx={{
                  position: 'absolute',
                  left: selected.x + selected.width / 2,
                  top: selected.y + selected.height + 12,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  p: 0.5,
                  bgcolor: 'rgba(255,255,255,.96)',
                  border: '1px solid rgba(36,59,58,.10)',
                  borderRadius: 2,
                  boxShadow: '0 8px 20px rgba(36,59,58,.15)',
                  zIndex: 4,
                }}
              >
                <Tooltip title="Change note color">
                  <IconButton
                    size="small"
                    aria-label="Change selected note color"
                    onClick={() => {
                      const colorIndex = cardColors.indexOf(selected.color)
                      const color = cardColors[(colorIndex + 1) % cardColors.length]
                      setCanvas((current) => ({
                        ...current,
                        items: current.items.map((item) =>
                          item.id === selected.id ? { ...item, color } : item,
                        ),
                      }))
                    }}
                    sx={{ bgcolor: selected.color, border: '1px solid rgba(36,59,58,.18)' }}
                  />
                </Tooltip>
                <Tooltip title="Connect note">
                  <IconButton size="small" onClick={() => {
                    setConnectFrom(selected.id)
                    setConnectSide('right')
                  }}>
                    <LinkIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Duplicate note">
                  <IconButton size="small" onClick={duplicateSelected}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete note">
                  <IconButton size="small" color="error" onClick={deleteSelection}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )
          })()}
        </Box>
      </Box>
      <Box
        sx={{
          position: 'absolute',
          zIndex: 4,
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 10,
          display: 'flex',
          gap: 1,
          px: 1.5,
          py: 0.75,
          bgcolor: 'rgba(255,255,255,.92)',
          borderRadius: 999,
          boxShadow: '0 8px 22px rgba(36,59,58,.10)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Typography variant="caption">{canvas.items.length} items</Typography>
        <Typography variant="caption">{canvas.connections.length} links</Typography>
        {connectFrom && <Chip size="small" label="Select another item to connect" />}
        {selectedConnectionId && <Chip size="small" color="primary" label="Connection selected · Delete to remove" />}
      </Box>
    </Box>
  )
}

export default CanvasTool
