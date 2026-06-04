import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
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
  Tabs,
  Tab,
  Menu,
  MenuItem,
  ListItemIcon,
  Tooltip,
  Avatar,
  Badge,
  InputAdornment,
  Fade,
  Popper,
  ClickAwayListener,
  PaperProps,
} from '@mui/material'
import {
  Link as LinkIcon,
  Add as AddIcon,
  Search as SearchIcon,
  ArrowBack as BackIcon,
  Visibility as VisibleIcon,
  VisibilityOff as HiddenIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
  MoreVert as MoreIcon,
  Psychology as PsychologyIcon,
  Note as NoteIcon,
  Hub as HubIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export interface WikiLink {
  id: string
  sourceId: string // Document that contains the link
  targetId: string // Document being linked to
  context: string // Surrounding text of the link
  position: number // Character position in source
  isBroken: boolean // Target doesn't exist
  createdAt: Date
}

export interface BacklinkInfo {
  sourceId: string
  sourceTitle: string
  context: string // Excerpt showing the link in context
  preview: string // Surrounding text for preview
}

export interface LinkPreview {
  id: string
  title: string
  excerpt: string
  type: 'document' | 'heading' | 'block'
  backlinks: BacklinkInfo[]
  forwardLinks: number
}

export interface WikiLinkState {
  links: WikiLink[]
  documents: Map<string, { id: string; title: string; content: string }>
  activeLinkId: string | null
  showUnlinkedMentions: boolean
  highlightedLinkId: string | null
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Parse wikilink syntax: [[Target]] or [[Target|Alias]]
function parseWikilink(text: string): { target: string; alias: string; fullMatch: string; position: number }[] {
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  const matches: { target: string; alias: string; fullMatch: string; position: number }[] = []
  let match

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      target: match[1].trim(),
      alias: match[2]?.trim() || match[1].trim(),
      fullMatch: match[0],
      position: match.index,
    })
  }

  return matches
}

// Extract all wikilinks from content
function extractWikiLinks(content: string, sourceId: string): WikiLink[] {
  const links: WikiLink[] = []
  const parsed = parseWikilink(content)

  for (const p of parsed) {
    links.push({
      id: generateId(),
      sourceId,
      targetId: p.target,
      context: p.alias,
      position: p.position,
      isBroken: false, // Would check against document map in real app
      createdAt: new Date(),
    })
  }

  return links
}

// Get context around a link (for preview)
function getLinkContext(content: string, position: number, contextLength: number = 100): string {
  const start = Math.max(0, position - contextLength)
  const end = Math.min(content.length, position + contextLength)

  let excerpt = content.slice(start, end)

  // Clean up boundaries
  if (start > 0) excerpt = '...' + excerpt
  if (end < content.length) excerpt = excerpt + '...'

  return excerpt.replace(/\n/g, ' ').trim()
}

// ============================================================================
// Wikilink Inline Component
// ============================================================================

interface InlineWikiLinkProps {
  link: WikiLink
  targetExists: boolean
  onClick: (link: WikiLink) => void
  onHover: (linkId: string | null) => void
  isHighlighted: boolean
}

const InlineWikiLink: React.FC<InlineWikiLinkProps> = ({
  link,
  targetExists,
  onClick,
  onHover,
  isHighlighted,
}) => {
  return (
    <Box
      component="span"
      onClick={(e) => {
        e.preventDefault()
        onClick(link)
      }}
      onMouseEnter={() => onHover(link.id)}
      onMouseLeave={() => onHover(null)}
      sx={{
        display: 'inline-block',
        cursor: 'pointer',
        textDecoration: 'none',
        px: 0.5,
        mx: 0.25,
        borderRadius: 0.5,
        bgcolor: isHighlighted
          ? 'primary.light'
          : targetExists
          ? 'primary.50'
          : 'error.50',
        color: isHighlighted
          ? 'primary.contrastText'
          : targetExists
          ? 'primary.main'
          : 'error.main',
        fontWeight: 500,
        transition: 'all 0.15s ease',
        borderBottom: `2px solid ${targetExists ? 'primary.main' : 'error.main'}`,
        '&:hover': {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
        },
      }}
    >
      {link.context || link.targetId}
      {!targetExists && (
        <Box
          component="span"
          sx={{
            ml: 0.5,
            fontSize: '0.7em',
            opacity: 0.7,
          }}
          title="Broken link - target doesn't exist"
        >
          ❌
        </Box>
      )}
    </Box>
  )
}

// ============================================================================
// Link Preview Popper
// ============================================================================

interface LinkPreviewPopperProps {
  link: WikiLink
  preview: LinkPreview | null
  anchorEl: HTMLElement | null
  onClose: () => void
  documents: Map<string, { id: string; title: string; content: string }>
}

const LinkPreviewPopper: React.FC<LinkPreviewPopperProps> = ({
  link,
  preview,
  anchorEl,
  onClose,
  documents,
}) => {
  const targetDoc = link.isBroken ? null : documents.get(link.targetId)

  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement="right-start"
      transition
      style={{ zIndex: 10000 }}
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={200}>
          <ClickAwayListener onClickAway={onClose}>
            <Paper
              elevation={8}
              sx={{
                width: 350,
                maxHeight: 400,
                overflow: 'auto',
                borderRadius: 2,
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'primary.dark',
                  color: 'primary.contrastText',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinkIcon fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {link.isBroken ? '⚠️ Broken Link' : '📄 Link Preview'}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8 }}>
                  {link.targetId}
                </Typography>
              </Box>

              <Box sx={{ p: 2 }}>
                {link.isBroken ? (
                  <Box>
                    <Typography variant="body2" color="error.main" sx={{ mb: 2 }}>
                      This link points to a document that doesn't exist.
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      sx={{ mb: 1 }}
                    >
                      Create "{link.targetId}"
                    </Button>
                  </Box>
                ) : targetDoc ? (
                  <>
                    {/* Target Document Info */}
                    <Typography variant="subtitle2" gutterBottom>
                      {targetDoc.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {targetDoc.content.slice(0, 200)}...
                    </Typography>

                    {/* Backlinks Section */}
                    {preview?.backlinks && preview.backlinks.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 1 }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          📎 {preview.backlinks.length} Backlink(s)
                        </Typography>
                        <List dense disablePadding>
                          {preview.backlinks.slice(0, 5).map((bl, idx) => (
                            <ListItem
                              key={idx}
                              sx={{ px: 0, py: 0.5 }}
                              alignItems="flex-start"
                            >
                              <ListItemIcon sx={{ minWidth: 24 }}>
                                <NoteIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={bl.sourceTitle}
                                secondary={
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      display: 'block',
                                      maxWidth: 260,
                                    }}
                                  >
                                    ...{bl.context}...
                                  </Typography>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No preview available
                  </Typography>
                )}
              </Box>
            </Paper>
          </ClickAwayListener>
        </Fade>
      )}
    </Popper>
  )
}

// ============================================================================
// Backlinks Panel Component
// ============================================================================

interface BacklinksPanelProps {
  documentId: string
  backlinks: BacklinkInfo[]
  onNavigate: (documentId: string) => void
  onDismiss: () => void
  showUnlinked?: boolean
  unlinkedMentions?: { sourceId: string; sourceTitle: string; context: string }[]
  onConvertUnlinked?: (sourceId: string, mention: string) => void
}

const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  documentId,
  backlinks,
  onNavigate,
  onDismiss,
  showUnlinked = false,
  unlinkedMentions = [],
  onConvertUnlinked,
}) => {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 0,
        right: -320,
        width: 300,
        maxHeight: '100%',
        overflow: 'auto',
        borderRadius: 2,
        zIndex: 100,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'grey.100',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          📎 Links to this note
        </Typography>
        <IconButton size="small" onClick={onDismiss}>
          <BackIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="fullWidth"
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab label={`Backlinks (${backlinks.length})`} />
        {showUnlinked && <Tab label={`Unlinked (${unlinkedMentions.length})`} />}
      </Tabs>

      {/* Content */}
      <Box sx={{ p: 1 }}>
        {activeTab === 0 && (
          <>
            {backlinks.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No backlinks yet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Other notes that link here will appear in this panel
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {backlinks.map((bl, idx) => (
                  <React.Fragment key={idx}>
                    <ListItem
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => onNavigate(bl.sourceId)}
                    >
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <NoteIcon fontSize="small" color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={bl.sourceTitle}
                        secondary={
                          <Box
                            component="span"
                            sx={{
                              fontSize: '0.75rem',
                              color: 'text.secondary',
                              fontStyle: 'italic',
                            }}
                          >
                            ...{bl.context}...
                          </Box>
                        }
                      />
                    </ListItem>
                    {idx < backlinks.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </>
        )}

        {activeTab === 1 && (
          <>
            {unlinkedMentions.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No unlinked mentions
                </Typography>
              </Box>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1, mb: 1, display: 'block' }}>
                  These notes mention this page but don't link to it:
                </Typography>
                <List dense disablePadding>
                  {unlinkedMentions.map((um, idx) => (
                    <ListItem
                      key={idx}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <UpIcon fontSize="small" color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={um.sourceTitle}
                        secondary={
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="span"
                          >
                            ...{um.context}...
                          </Typography>
                        }
                      />
                      {onConvertUnlinked && (
                        <ListItemSecondaryAction>
                          <Tooltip title="Convert to link">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation()
                                onConvertUnlinked(um.sourceId, um.context)
                              }}
                            >
                              <LinkIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </>
        )}
      </Box>
    </Paper>
  )
}

// ============================================================================
// Quick Switcher (Command Palette for Linking)
// ============================================================================

interface QuickSwitcherProps {
  documents: Map<string, { id: string; title: string; content: string }>
  onSelect: (documentId: string) => void
  onClose: () => void
  onCreateNew: (title: string) => void
}

const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  documents,
  onSelect,
  onClose,
  onCreateNew,
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const docList = useMemo(() => {
    const docs = Array.from(documents.values())
    if (!query.trim()) return docs.slice(0, 10)

    const lowerQuery = query.toLowerCase()
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(lowerQuery) ||
        d.content.toLowerCase().includes(lowerQuery),
    ).slice(0, 10)
  }, [documents, query])

  const showCreateOption = query.trim().length > 0 &&
    !Array.from(documents.values()).some((d) => d.title.toLowerCase() === query.toLowerCase())

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = docList.length + (showCreateOption ? 1 : 0)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i + 1) % totalItems)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i - 1 + totalItems) % totalItems)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex < docList.length) {
        onSelect(docList[selectedIndex].id)
      } else if (showCreateOption) {
        onCreateNew(query)
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'visible',
        },
      }}
      BackdropProps={{
        sx: { backdropFilter: 'blur(4px)' },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <TextField
          inputRef={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or create a note..."
          fullWidth
          variant="outlined"
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px 8px 0 0',
            },
          }}
        />

        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {docList.map((doc, idx) => (
            <Box
              key={doc.id}
              sx={{
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                bgcolor: selectedIndex === idx ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
              onClick={() => onSelect(doc.id)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <NoteIcon fontSize="small" color="primary" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} noWrap>
                  {doc.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {doc.content.slice(0, 60)}...
                </Typography>
              </Box>
              {selectedIndex === idx && (
                <Chip label="↵" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
              )}
            </Box>
          ))}

          {showCreateOption && (
            <Box
              sx={{
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                bgcolor: selectedIndex === docList.length ? 'primary.50' : 'transparent',
                '&:hover': { bgcolor: 'primary.50' },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
              onClick={() => onCreateNew(query)}
              onMouseEnter={() => setSelectedIndex(docList.length)}
            >
              <AddIcon fontSize="small" color="primary" />
              <Typography variant="body2" color="primary.main" fontWeight={500}>
                Create "{query}"
              </Typography>
            </Box>
          )}
        </Box>

        <Box
          sx={{
            px: 2,
            py: 1,
            bgcolor: 'grey.50',
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            gap: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            ↑↓ navigate
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ↵ select
          </Typography>
          <Typography variant="caption" color="text.secondary">
            esc close
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Link Stats Sidebar
// ============================================================================

interface LinkStatsProps {
  links: WikiLink[]
  documents: Map<string, { id: string; title: string; content: string }>
  onNavigate: (docId: string) => void
}

const LinkStats: React.FC<LinkStatsProps> = ({ links, documents, onNavigate }) => {
  // Calculate most linked documents
  const linkCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const link of links) {
      if (!link.isBroken) {
        counts.set(link.targetId, (counts.get(link.targetId) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [links])

  // Most connected documents
  const backlinksCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const link of links) {
      if (!link.isBroken) {
        counts.set(link.sourceId, (counts.get(link.sourceId) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [links])

  return (
    <Box
      sx={{
        p: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        mt: 2,
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        🔗 Link Statistics
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Most referenced:
        </Typography>
        {linkCounts.length === 0 ? (
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            No links yet
          </Typography>
        ) : (
          <List dense disablePadding>
            {linkCounts.slice(0, 5).map(([docId, count]) => {
              const doc = documents.get(docId)
              return doc ? (
                <ListItem
                  key={docId}
                  sx={{ px: 0, py: 0.25, cursor: 'pointer' }}
                  onClick={() => onNavigate(docId)}
                >
                  <ListItemIcon sx={{ minWidth: 20 }}>
                    <HubIcon sx={{ fontSize: 14 }} color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={doc.title}
                    secondary={`${count} link${count > 1 ? 's' : ''}`}
                    primaryTypographyProps={{ variant: 'caption' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ) : null
            })}
          </List>
        )}
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">
          Most outgoing links:
        </Typography>
        {backlinksCounts.length === 0 ? (
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            No links yet
          </Typography>
        ) : (
          <List dense disablePadding>
            {backlinksCounts.slice(0, 5).map(([docId, count]) => {
              const doc = documents.get(docId)
              return doc ? (
                <ListItem
                  key={docId}
                  sx={{ px: 0, py: 0.25, cursor: 'pointer' }}
                  onClick={() => onNavigate(docId)}
                >
                  <ListItemIcon sx={{ minWidth: 20 }}>
                    <TimelineIcon sx={{ fontSize: 14 }} color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={doc.title}
                    secondary={`${count} outgoing`}
                    primaryTypographyProps={{ variant: 'caption' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ) : null
            })}
          </List>
        )}
      </Box>
    </Box>
  )
}

// ============================================================================
// Main WikiLinks Panel
// ============================================================================

interface WikiLinksPanelProps {
  documents?: Map<string, { id: string; title: string; content: string }>
  initialDocumentId?: string
  onClose?: () => void
}

// Demo documents for showcase
const demoDocuments = new Map([
  ['doc-1', { id: 'doc-1', title: 'Machine Learning', content: 'Machine learning is a subset of artificial intelligence. It enables systems to learn from data. Key concepts include [[Neural Networks]], [[Deep Learning]], and [[Supervised Learning]]. See also [[Gradient Descent]] for optimization.' }],
  ['doc-2', { id: 'doc-2', title: 'Neural Networks', content: 'Neural networks are inspired by the human brain. They consist of layers: input layer, hidden layers, and output layer. Each connection has a [[Weight]] that determines signal strength. [[Backpropagation]] is used for training.' }],
  ['doc-3', { id: 'doc-3', title: 'Deep Learning', content: 'Deep learning uses multiple hidden layers to learn complex patterns. Key architectures include [[CNNs]] for images and [[RNNs]] for sequences. Also related to [[Transformers]] and [[Attention Mechanisms]].' }],
  ['doc-4', { id: 'doc-4', title: 'Gradient Descent', content: 'Gradient descent is an optimization algorithm. It iteratively adjusts parameters to minimize loss. Variants include [[Stochastic Gradient Descent]] and [[Adam]] optimizer. Learning rate is a crucial [[Hyperparameter]].' }],
  ['doc-5', { id: 'doc-5', title: 'Supervised Learning', content: 'Supervised learning uses labeled training data. Examples include [[Classification]] and [[Regression]] tasks. The model learns to map inputs to correct outputs. Common algorithms: [[Decision Trees]], [[SVM]], and [[Logistic Regression]].' }],
  ['doc-6', { id: 'doc-6', title: 'Backpropagation', content: 'Backpropagation is the algorithm used to train neural networks. It computes gradients by propagating errors backward through the network. Chain rule is fundamental to the computation. Works with [[Gradient Descent]]. Also called "backprop".' }],
])

const WikiLinksPanel: React.FC<WikiLinksPanelProps> = ({
  documents = demoDocuments,
  initialDocumentId = 'doc-1',
  onClose,
}) => {
  const [activeDocId, setActiveDocId] = useState(initialDocumentId)
  const [links, setLinks] = useState<WikiLink[]>([])
  const [highlightedLink, setHighlightedLink] = useState<string | null>(null)
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)
  const [hoveredLinkEl, setHoveredLinkEl] = useState<HTMLElement | null>(null)
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false)
  const [showLinkStats, setShowLinkStats] = useState(false)
  const [newLinkMode, setNewLinkMode] = useState(false)

  const activeDoc = documents.get(activeDocId)

  // Extract links from all documents on mount
  useEffect(() => {
    const allLinks: WikiLink[] = []
    documents.forEach((doc, docId) => {
      const extracted = extractWikiLinks(doc.content, docId)
      allLinks.push(...extracted)
    })
    setLinks(allLinks)
  }, [documents])

  // Get backlinks for active document
  const backlinks = useMemo(() => {
    return links
      .filter((l) => l.targetId === activeDoc?.title && l.sourceId !== activeDocId)
      .map((l) => {
        const source = documents.get(l.sourceId)
        return {
          sourceId: l.sourceId,
          sourceTitle: source?.title || l.sourceId,
          context: getLinkContext(source?.content || '', l.position),
        }
      })
  }, [links, activeDoc?.title, activeDocId, documents])

  // Get unlinked mentions (simple mock)
  const unlinkedMentions = useMemo(() => {
    if (!activeDoc) return []
    // In real app, would search for title mentions without [[ ]]
    return [
      { sourceId: 'doc-4', sourceTitle: 'Gradient Descent', context: 'related to ML optimization' },
      { sourceId: 'doc-6', sourceTitle: 'Backpropagation', context: 'used in training networks' },
    ]
  }, [activeDoc])

  // Parse content for rendering with wikilinks
  const renderContentWithLinks = useCallback((content: string) => {
    const parts: React.ReactNode[] = []
    const parsed = parseWikilink(content)

    let lastIndex = 0

    parsed.forEach((p, idx) => {
      // Add text before the link
      if (p.position > lastIndex) {
        parts.push(content.slice(lastIndex, p.position))
      }

      // Find the link info
      const linkInfo = links.find(
        (l) => l.sourceId === activeDocId && l.targetId === p.target && l.position === p.position,
      )

      const targetExists = documents.has(p.target)

      parts.push(
        <InlineWikiLink
          key={`link-${idx}`}
          link={linkInfo || {
            id: generateId(),
            sourceId: activeDocId,
            targetId: p.target,
            context: p.alias,
            position: p.position,
            isBroken: !targetExists,
            createdAt: new Date(),
          }}
          targetExists={targetExists}
          onClick={(link) => {
            if (documents.has(link.targetId)) {
              const targetDoc = Array.from(documents.entries()).find(([, d]) => d.title === link.targetId)
              if (targetDoc) setActiveDocId(targetDoc[0])
            }
          }}
          onHover={(linkId) => {
            setHoveredLink(linkId)
            setHoveredLinkEl(window.document.querySelector(`[data-link-id="${linkId}"]`) as HTMLElement)
          }}
          isHighlighted={highlightedLink === p.fullMatch}
        />,
      )

      lastIndex = p.position + p.fullMatch.length
    })

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex))
    }

    return parts
  }, [activeDocId, links, documents, highlightedLink])

  const handleCreateLink = useCallback((linkText: string) => {
    // In real app, would insert [[linkText]] at cursor position
    setNewLinkMode(false)
  }, [])

  const handleQuickSwitcherSelect = useCallback((docId: string) => {
    setActiveDocId(docId)
    setShowQuickSwitcher(false)
  }, [])

  const handleQuickSwitcherCreate = useCallback((title: string) => {
    // In real app, would create new document
    setShowQuickSwitcher(false)
  }, [])

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: Math.min(900, '95vw'),
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LinkIcon />
          <Typography variant="h6">🔗 Bidirectional WikiLinks</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SearchIcon />}
            onClick={() => setShowQuickSwitcher(true)}
            sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)' }}
          >
            Quick Switch (Ctrl+O)
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<HubIcon />}
            onClick={() => setShowLinkStats(!showLinkStats)}
            sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)' }}
          >
            Stats
          </Button>
          {onClose && (
            <IconButton sx={{ color: 'inherit' }} onClick={onClose}>
              <BackIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Document Navigation */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          overflowX: 'auto',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          Documents:
        </Typography>
        {Array.from(documents.values()).map((doc) => (
          <Chip
            key={doc.id}
            label={doc.title}
            size="small"
            variant={doc.id === activeDocId ? 'filled' : 'outlined'}
            onClick={() => setActiveDocId(doc.id)}
            icon={<NoteIcon />}
            sx={{
              cursor: 'pointer',
              '&:hover': { bgcolor: doc.id === activeDocId ? 'primary.main' : 'action.hover' },
            }}
          />
        ))}
      </Box>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Document Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {activeDoc ? (
            <>
              {/* Document Header */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" fontWeight={600} gutterBottom>
                  {activeDoc.title}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    icon={<LinkIcon />}
                    label={`${links.filter((l) => l.sourceId === activeDocId).length} outgoing`}
                    size="small"
                    sx={{ bgcolor: 'primary.50' }}
                  />
                  <Chip
                    icon={<HubIcon />}
                    label={`${backlinks.length} backlinks`}
                    size="small"
                    sx={{ bgcolor: 'secondary.50' }}
                  />
                </Box>
              </Box>

              {/* Content with Rendered Links */}
              <Box
                sx={{
                  fontSize: '1rem',
                  lineHeight: 1.8,
                  '& p': { mb: 2 },
                }}
              >
                {renderContentWithLinks(activeDoc.content)}
              </Box>

              {/* Link Stats */}
              {showLinkStats && (
                <LinkStats links={links} documents={documents} onNavigate={setActiveDocId} />
              )}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No document selected
              </Typography>
            </Box>
          )}
        </Box>

        {/* Backlinks Panel */}
        {activeDoc && (
          <Box
            sx={{
              width: 280,
              borderLeft: '1px solid',
              borderColor: 'divider',
              bgcolor: 'grey.50',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <BacklinksPanel
              documentId={activeDocId}
              backlinks={backlinks}
              onNavigate={setActiveDocId}
              onDismiss={() => {}}
              showUnlinked
              unlinkedMentions={unlinkedMentions}
              onConvertUnlinked={(sourceId, mention) => {
                // In real app, would update source document to add [[ ]]
              }}
            />
          </Box>
        )}
      </Box>

      {/* Footer Tips */}
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
          💡 Type [[note name]] to create a link, Ctrl+O to quick switch
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Broken links shown in red ❌
        </Typography>
      </Box>

      {/* Quick Switcher Dialog */}
      {showQuickSwitcher && (
        <QuickSwitcher
          documents={documents}
          onSelect={handleQuickSwitcherSelect}
          onClose={() => setShowQuickSwitcher(false)}
          onCreateNew={handleQuickSwitcherCreate}
        />
      )}

      {/* Hover Preview */}
      {hoveredLink && (
        <LinkPreviewPopper
          link={links.find((l) => l.id === hoveredLink) || {
            id: hoveredLink,
            sourceId: activeDocId,
            targetId: hoveredLink.replace('link-', ''),
            context: '',
            position: 0,
            isBroken: false,
            createdAt: new Date(),
          }}
          preview={null}
          anchorEl={hoveredLinkEl}
          onClose={() => setHoveredLink(null)}
          documents={documents}
        />
      )}
    </Paper>
  )
}

export default WikiLinksPanel

// ============================================================================
// Hook for WikiLinks
// ============================================================================

export function useWikiLinks() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [links, setLinks] = useState<WikiLink[]>([])
  const [documents, setDocuments] = useState<Map<string, { id: string; title: string; content: string }>>(new Map())

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const addDocument = useCallback((doc: { id: string; title: string; content: string }) => {
    setDocuments((prev) => new Map(prev).set(doc.id, doc))
    // Extract and add links
    const newLinks = extractWikiLinks(doc.content, doc.id)
    setLinks((prev) => [...prev, ...newLinks])
  }, [])

  const updateDocument = useCallback((id: string, content: string) => {
    setDocuments((prev) => {
      const next = new Map(prev)
      const existing = next.get(id)
      if (existing) {
        next.set(id, { ...existing, content })
      }
      return next
    })
    // Recalculate links for this document
    const newLinks = extractWikiLinks(content, id)
    setLinks((prev) => [
      ...prev.filter((l) => l.sourceId !== id),
      ...newLinks,
    ])
  }, [])

  const getBacklinks = useCallback(
    (docTitle: string): BacklinkInfo[] => {
      return links
        .filter((l) => l.targetId === docTitle)
        .map((l) => {
          const source = documents.get(l.sourceId)
          return {
            sourceId: l.sourceId,
            sourceTitle: source?.title || l.sourceId,
            context: l.context,
            preview: source ? getLinkContext(source.content, l.position) : '',
          }
        })
    },
    [links, documents],
  )

  return {
    isPanelOpen,
    links,
    documents,
    openPanel,
    closePanel,
    addDocument,
    updateDocument,
    getBacklinks,
    WikiLinksPanel: WikiLinksPanel as React.FC<{
      documents?: Map<string, { id: string; title: string; content: string }>
      initialDocumentId?: string
      onClose?: () => void
    }>,
  }
}