import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Slider,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  AccountTree as GraphIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Link as LinkIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export interface GraphNode {
  id: string
  label: string
  type: 'concept' | 'note' | 'topic' | 'source' | 'question'
  size: number // 0.5 - 2.0
  color: string
  // Position is computed via force simulation
  x?: number
  y?: number
  vx?: number // velocity
  vy?: number
  fx?: number | null // fixed x (when dragging)
  fy?: number | null
  // Metadata
  tags: string[]
  connectionCount: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  weight: number // 0.1 - 1.0
  label?: string
  type: 'default' | 'strong' | 'weak' | 'bidirectional'
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface KnowledgeGraphConfig {
  showLabels: boolean
  showEdgeLabels: boolean
  nodeSpacing: number // 50 - 200
  repulsionForce: number // 100 - 500
  attractionForce: number // 0.01 - 0.1
  centerForce: number // 0.01 - 0.1
  maxVelocity: number // 1 - 10
}

interface KnowledgeGraphPanelProps {
  data?: KnowledgeGraphData
  onNodeClick?: (node: GraphNode) => void
  onEdgeClick?: (edge: GraphEdge) => void
  onClose?: () => void
  width?: number
  height?: number
}

// ============================================================================
// Force Simulation (D3-style layout algorithm)
// ============================================================================

interface ForceSimulation {
  nodes: GraphNode[]
  edges: GraphEdge[]
  config: KnowledgeGraphConfig
  tick: () => void
}

function createForceSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: KnowledgeGraphConfig,
): ForceSimulation {
  // Initialize positions if not set
  const simNodes = nodes.map((n) => ({
    ...n,
    x: n.x ?? Math.random() * 400,
    y: n.y ?? Math.random() * 300,
    vx: 0,
    vy: 0,
  }))

  const nodeMap = new Map(simNodes.map((n) => [n.id, n]))

  function tick(): GraphNode[] {
    const { nodeSpacing, repulsionForce, attractionForce, centerForce, maxVelocity } = config

    // Apply forces
    for (const node of simNodes) {
      if (node.fx !== null && node.fx !== undefined) continue // Skip fixed nodes

      let fx = 0
      let fy = 0

      // Center force - pull towards center
      fx += (200 - node.x) * centerForce
      fy += (150 - node.y) * centerForce

      // Repulsion force between nodes
      for (const other of simNodes) {
        if (other.id === node.id) continue
        const dx = node.x - other.x
        const dy = node.y - other.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (repulsionForce * 100) / (dist * dist)
        fx += (dx / dist) * force
        fy += (dy / dist) * force
      }

      // Attraction force for edges (springs)
      for (const edge of edges) {
        const source = nodeMap.get(edge.source)
        const target = nodeMap.get(edge.target)
        if (!source || !target) continue

        let otherNode: GraphNode | undefined
        if (edge.source === node.id && target) otherNode = target
        else if (edge.target === node.id && source) otherNode = source
        if (!otherNode) continue

        const dx = otherNode.x - node.x
        const dy = otherNode.y - node.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const idealDist = nodeSpacing * (1 / (edge.weight || 0.5))
        const force = (dist - idealDist) * attractionForce
        fx += (dx / dist) * force
        fy += (dy / dist) * force
      }

      // Limit velocity
      const v = Math.sqrt(fx * fx + fy * fy) || 1
      const cappedFx = (fx / v) * Math.min(v, maxVelocity)
      const cappedFy = (fy / v) * Math.min(v, maxVelocity)

      node.vx = cappedFx
      node.vy = cappedFy
      node.x += cappedVx
      node.y += cappedFy
    }

    return simNodes
  }

  return { nodes: simNodes, edges, config, tick }
}

// ============================================================================
// Default config
// ============================================================================

const defaultConfig: KnowledgeGraphConfig = {
  showLabels: true,
  showEdgeLabels: false,
  nodeSpacing: 100,
  repulsionForce: 150,
  attractionForce: 0.05,
  centerForce: 0.02,
  maxVelocity: 5,
}

// ============================================================================
// Demo data generator
// ============================================================================

function generateDemoData(): KnowledgeGraphData {
  const concepts = [
    { id: 'node-1', label: 'Machine Learning', type: 'topic' as const, color: '#4CAF50' },
    { id: 'node-2', label: 'Neural Networks', type: 'concept' as const, color: '#2196F3' },
    { id: 'node-3', label: 'Deep Learning', type: 'concept' as const, color: '#9C27B0' },
    { id: 'node-4', label: 'Backpropagation', type: 'concept' as const, color: '#FF5722' },
    { id: 'node-5', label: 'Activation Functions', type: 'concept' as const, color: '#00BCD4' },
    { id: 'node-6', label: 'ReLU', type: 'concept' as const, color: '#E91E63' },
    { id: 'node-7', label: 'Sigmoid', type: 'concept' as const, color: '#795548' },
    { id: 'node-8', label: 'Gradient Descent', type: 'concept' as const, color: '#607D8B' },
    { id: 'node-9', label: 'Loss Functions', type: 'concept' as const, color: '#FF9800' },
    { id: 'node-10', label: 'Cross-Entropy', type: 'concept' as const, color: '#673AB7' },
    { id: 'node-11', label: 'Training Data', type: 'source' as const, color: '#3F51B5' },
    { id: 'node-12', label: 'Overfitting', type: 'concept' as const, color: '#F44336' },
    { id: 'node-13', label: 'Regularization', type: 'concept' as const, color: '#009688' },
    { id: 'node-14', label: 'Dropout', type: 'concept' as const, color: '#CDDC39' },
  ]

  const edges = [
    { id: 'e1', source: 'node-1', target: 'node-2', weight: 1.0, type: 'strong' as const },
    { id: 'e2', source: 'node-2', target: 'node-3', weight: 0.9, type: 'strong' as const },
    { id: 'e3', source: 'node-2', target: 'node-4', weight: 0.8, type: 'strong' as const },
    { id: 'e4', source: 'node-2', target: 'node-5', weight: 0.7, type: 'default' as const },
    { id: 'e5', source: 'node-5', target: 'node-6', weight: 0.8, type: 'default' as const },
    { id: 'e6', source: 'node-5', target: 'node-7', weight: 0.8, type: 'default' as const },
    { id: 'e7', source: 'node-4', target: 'node-8', weight: 0.7, type: 'default' as const },
    { id: 'e8', source: 'node-4', target: 'node-9', weight: 0.6, type: 'default' as const },
    { id: 'e9', source: 'node-9', target: 'node-10', weight: 0.9, type: 'bidirectional' as const },
    { id: 'e10', source: 'node-1', target: 'node-11', weight: 0.5, type: 'weak' as const },
    { id: 'e11', source: 'node-3', target: 'node-12', weight: 0.6, type: 'default' as const },
    { id: 'e12', source: 'node-12', target: 'node-13', weight: 0.8, type: 'default' as const },
    { id: 'e13', source: 'node-13', target: 'node-14', weight: 0.7, type: 'default' as const },
    { id: 'e14', source: 'node-3', target: 'node-8', weight: 0.5, type: 'weak' as const },
    { id: 'e15', source: 'node-1', target: 'node-9', weight: 0.4, type: 'weak' as const },
  ]

  // Add connection counts
  const connectionCounts = new Map<string, number>()
  for (const edge of edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1)
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1)
  }

  const nodes: GraphNode[] = concepts.map((c) => ({
    ...c,
    size: 0.8 + (connectionCounts.get(c.id) || 0) * 0.1,
    tags: [],
    connectionCount: connectionCounts.get(c.id) || 0,
    x: undefined,
    y: undefined,
  }))

  return { nodes, edges }
}

// ============================================================================
// Node shape renderer
// ============================================================================

const NODE_SHAPES: Record<GraphNode['type'], string> = {
  concept: '●',
  note: '■',
  topic: '◆',
  source: '▲',
  question: '?',
}

const NODE_COLORS: Record<GraphNode['type'], string> = {
  concept: '#2196F3',
  note: '#4CAF50',
  topic: '#9C27B0',
  source: '#FF9800',
  question: '#F44336',
}

// ============================================================================
// Main Component
// ============================================================================

const KnowledgeGraphPanel: React.FC<KnowledgeGraphPanelProps> = ({
  data,
  onNodeClick,
  onEdgeClick,
  onClose,
  width = 600,
  height = 450,
}) => {
  const [config, setConfig] = useState<KnowledgeGraphConfig>(defaultConfig)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterTypes, setFilterTypes] = useState<Set<GraphNode['type']>>(
    new Set(['concept', 'note', 'topic', 'source', 'question']),
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const simulationRef = useRef<ForceSimulation | null>(null)

  const graphData = useMemo(() => data || generateDemoData(), [data])

  const filteredNodes = useMemo(
    () => graphData.nodes.filter((n) => filterTypes.has(n.type)),
    [graphData.nodes, filterTypes],
  )

  const filteredEdges = useMemo(
    () => graphData.edges.filter(
      (e) => filteredNodes.some((n) => n.id === e.source) && filteredNodes.some((n) => n.id === e.target),
    ),
    [graphData.edges, filteredNodes],
  )

  // Start simulation
  useEffect(() => {
    setIsSimulating(true)
    simulationRef.current = createForceSimulation(
      [...filteredNodes],
      [...filteredEdges],
      config,
    )

    let iterations = 0
    const maxIterations = 300

    const animate = () => {
      if (!simulationRef.current) return

      const nodes = simulationRef.current.tick()
      simulationRef.current.nodes = nodes

      iterations++
      if (iterations < maxIterations) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsSimulating(false)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [filteredNodes, filteredEdges, config])

  const handleZoom = useCallback((delta: number) => {
    setConfig((c) => ({
      ...c,
      nodeSpacing: Math.max(50, Math.min(200, c.nodeSpacing + delta)),
    }))
  }, [])

  const handleCenter = useCallback(() => {
    // Reset all node positions to trigger re-centering
    if (simulationRef.current) {
      simulationRef.current.nodes.forEach((n) => {
        n.x = Math.random() * 400
        n.y = Math.random() * 300
        n.vx = 0
        n.vy = 0
      })
      setIsSimulating(true)
    }
  }, [])

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node)
      onNodeClick?.(node)
    },
    [onNodeClick],
  )

  const edgeStyle = (edge: GraphEdge) => {
    const baseWidth = edge.weight * 3
    switch (edge.type) {
      case 'strong':
        return { stroke: '#333', strokeWidth: baseWidth + 1, opacity: 0.8 }
      case 'bidirectional':
        return { stroke: '#4CAF50', strokeWidth: baseWidth, opacity: 0.6, strokeDasharray: '5,5' }
      case 'weak':
        return { stroke: '#ccc', strokeWidth: baseWidth * 0.5, opacity: 0.4 }
      default:
        return { stroke: '#999', strokeWidth: baseWidth, opacity: 0.5 }
    }
  }

  const nodeSize = (node: GraphNode) => {
    const base = 20 + node.connectionCount * 5
    return Math.max(15, Math.min(50, base * node.size * 0.3))
  }

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 80,
        right: 24,
        width: Math.min(width, 700),
        maxHeight: '85vh',
        overflow: 'hidden',
        borderRadius: 3,
        zIndex: 9999,
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
          <Typography variant="h6">🕸️ Knowledge Graph</Typography>
          {isSimulating && (
            <CircularProgress size={16} sx={{ color: 'inherit' }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={() => handleZoom(20)} sx={{ color: 'inherit' }}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={() => handleZoom(-20)} sx={{ color: 'inherit' }}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Recenter">
            <IconButton size="small" onClick={handleCenter} sx={{ color: 'inherit' }}>
              <CenterIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Filter">
            <IconButton size="small" onClick={() => setShowFilters(!showFilters)} sx={{ color: showFilters ? 'secondary.main' : 'inherit' }}>
              <FilterIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {onClose && (
            <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Filters Panel */}
      {showFilters && (
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Node Types to Show
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
            {(['concept', 'note', 'topic', 'source', 'question'] as const).map((type) => (
              <Chip
                key={type}
                label={type}
                size="small"
                variant={filterTypes.has(type) ? 'filled' : 'outlined'}
                onClick={() => {
                  setFilterTypes((prev) => {
                    const next = new Set(prev)
                    if (next.has(type)) next.delete(type)
                    else next.add(type)
                    return next
                  })
                }}
                sx={{
                  cursor: 'pointer',
                  bgcolor: filterTypes.has(type) ? NODE_COLORS[type] : 'transparent',
                  color: filterTypes.has(type) ? 'white' : 'text.primary',
                }}
              />
            ))}
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Node Spacing: {config.nodeSpacing}
            </Typography>
            <Slider
              value={config.nodeSpacing}
              min={50}
              max={200}
              step={10}
              onChange={(_, v) => setConfig((c) => ({ ...c, nodeSpacing: v as number }))}
              size="small"
            />
          </Box>
        </Box>
      )}

      {/* Graph Canvas */}
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height,
          bgcolor: 'grey.100',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
        }}
      >
        {/* SVG Graph */}
        <svg width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#999" />
            </marker>
          </defs>

          {/* Edges */}
          {filteredEdges.map((edge) => {
            const source = filteredNodes.find((n) => n.id === edge.source)
            const target = filteredNodes.find((n) => n.id === edge.target)
            if (!source || !target) return null

            const x1 = source.x ?? 0
            const y1 = source.y ?? 0
            const x2 = target.x ?? 0
            const y2 = target.y ?? 0

            return (
              <g key={edge.id}>
                {edge.type === 'bidirectional' ? (
                  <>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      style={edgeStyle({ ...edge, type: 'bidirectional' })}
                    />
                    <line
                      x1={x2}
                      y1={y2}
                      x2={x1}
                      y2={y1}
                      style={edgeStyle({ ...edge, type: 'bidirectional' })}
                    />
                  </>
                ) : (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    style={edgeStyle(edge)}
                    markerEnd={edge.type !== 'weak' ? 'url(#arrowhead)' : undefined}
                  />
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {filteredNodes.map((node) => {
            const x = node.x ?? 0
            const y = node.y ?? 0
            const r = nodeSize(node)
            const isSelected = selectedNode?.id === node.id

            return (
              <g
                key={node.id}
                transform={`translate(${x}, ${y})`}
                onClick={() => handleNodeClick(node)}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow for selected */}
                {isSelected && (
                  <circle r={r + 5} fill={node.color} opacity={0.3} />
                )}

                {/* Node circle */}
                <circle
                  r={r}
                  fill={node.color}
                  stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.5)'}
                  strokeWidth={isSelected ? 3 : 1.5}
                />

                {/* Node label */}
                {config.showLabels && (
                  <text
                    dy="0.35em"
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={Math.max(8, r * 0.4)}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {NODE_SHAPES[node.type]}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Node count overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            bgcolor: 'rgba(255,255,255,0.9)',
            borderRadius: 1,
            px: 1,
            py: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {filteredNodes.length} nodes, {filteredEdges.length} connections
          </Typography>
        </Box>
      </Box>

      {/* Selected Node Detail */}
      {selectedNode && (
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: selectedNode.color,
              }}
            />
            <Typography variant="subtitle1" fontWeight={600}>
              {selectedNode.label}
            </Typography>
            <Chip
              label={selectedNode.type}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Connections
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {selectedNode.connectionCount}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Size
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {selectedNode.size.toFixed(1)}
              </Typography>
            </Box>
          </Box>

          {/* Show connected nodes */}
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Connected to:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {filteredEdges
                .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                .map((e) => {
                  const otherId = e.source === selectedNode.id ? e.target : e.source
                  const other = filteredNodes.find((n) => n.id === otherId)
                  if (!other) return null
                  return (
                    <Chip
                      key={e.id}
                      label={other.label}
                      size="small"
                      sx={{
                        cursor: 'pointer',
                        bgcolor: other.color,
                        color: 'white',
                        '&:hover': { opacity: 0.8 },
                      }}
                      onClick={() => handleNodeClick(other)}
                    />
                  )
                })}
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  )
}

export default KnowledgeGraphPanel

// ============================================================================
// Hook for integrating Knowledge Graph into StudyMesh
// ============================================================================

const KNOWLEDGE_GRAPH_STORAGE_KEY = 'studymesh-knowledge-graph'

export function useKnowledgeGraph() {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  // Generate from existing study materials
  const generateFromStudyMaterials = useCallback((materials: Array<{ id: string; title: string; tags?: string[] }>) => {
    const nodes: GraphNode[] = materials.map((m) => ({
      id: m.id,
      label: m.title,
      type: 'concept' as const,
      size: 1.0,
      color: '#2196F3',
      tags: m.tags || [],
      connectionCount: 0,
    }))

    // Generate edges based on shared tags
    const edges: GraphEdge[] = []
    for (let i = 0; i < materials.length; i++) {
      for (let j = i + 1; j < materials.length; j++) {
        const sharedTags = (materials[i].tags || []).filter((t) =>
          (materials[j].tags || []).includes(t),
        )
        if (sharedTags.length > 0) {
          edges.push({
            id: `edge-${i}-${j}`,
            source: materials[i].id,
            target: materials[j].id,
            weight: Math.min(1, sharedTags.length * 0.3),
            type: sharedTags.length > 1 ? 'bidirectional' : 'default',
          })
        }
      }
    }

    // Update connection counts
    const connectionCounts = new Map<string, number>()
    for (const edge of edges) {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1)
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1)
    }

    const finalNodes = nodes.map((n) => ({
      ...n,
      connectionCount: connectionCounts.get(n.id) || 0,
    }))

    const data = { nodes: finalNodes, edges }
    setGraphData(data)
    return data
  }, [])

  return {
    graphData,
    isPanelOpen,
    openPanel,
    closePanel,
    generateFromStudyMaterials,
    KnowledgeGraphPanel: KnowledgeGraphPanel as React.FC<KnowledgeGraphPanelProps>,
  }
}