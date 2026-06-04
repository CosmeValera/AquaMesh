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
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemSecondaryAction,
  Tooltip,
  LinearProgress,
  Fade,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  Switch,
  FormControlLabel,
  CircularProgress,
} from '@mui/material'
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Article as ArticleIcon,
  Title as TitleIcon,
  TextFields as TextIcon,
  Image as ImageIcon,
  Lightbulb as LightbulbIcon,
  Tune as TuneIcon,
  History as HistoryIcon,
  Star as StarIcon,
  TrendingUp as TrendingIcon,
  Lightbulb as SuggestIcon,
  Keyboard as KeyboardIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandIcon,
  Settings as SettingsIcon,
  Bolt as AIIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Chat as ChatIcon,
  FormatQuote as QuoteIcon,
  Link as LinkIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export type SearchResultType = 'document' | 'heading' | 'block' | 'concept' | 'image'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  excerpt: string
  content: string
  score: number // 0-100 relevance score
  relevanceMatch: string // What matched the query
  context: string // Surrounding text
  source: string // Document/page it came from
  url?: string
  highlights: string[] // Matched terms
  timestamp?: Date
  isFavorite: boolean
  metadata?: {
    wordCount?: number
    readingTime?: number
    tags?: string[]
  }
}

export interface SearchQuery {
  text: string
  filters: SearchFilters
  sortBy: 'relevance' | 'date' | 'title'
  page: number
  pageSize: number
}

export interface SearchFilters {
  types: SearchResultType[]
  dateRange?: { start: Date; end: Date }
  sources: string[]
  tags: string[]
  includeContent: boolean
  fuzzyMatch: boolean
}

export interface AISearchConfig {
  enableAI: boolean
  maxResults: number
  showContext: boolean
  highlightMatches: boolean
  enableSuggestions: boolean
  searchHistory: boolean
  fuzzyThreshold: number // 0-100
}

export interface SearchHistoryItem {
  query: string
  timestamp: Date
  resultsCount: number
}

// ============================================================================
// Constants
// ============================================================================

const defaultFilters: SearchFilters = {
  types: ['document', 'heading', 'block', 'concept', 'image'],
  sources: [],
  tags: [],
  includeContent: true,
  fuzzyMatch: true,
}

const defaultConfig: AISearchConfig = {
  enableAI: true,
  maxResults: 20,
  showContext: true,
  highlightMatches: true,
  enableSuggestions: true,
  searchHistory: true,
  fuzzyThreshold: 70,
}

const RESULT_TYPE_ICONS: Record<SearchResultType, React.ReactNode> = {
  document: <ArticleIcon />,
  heading: <TitleIcon />,
  block: <TextIcon />,
  concept: <LightbulbIcon />,
  image: <ImageIcon />,
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Simulated AI search - in production this would call an AI API
function performAISearch(query: string, filters: SearchFilters, maxResults: number): SearchResult[] {
  // Demo results based on query
  const demoResults: SearchResult[] = [
    {
      id: 'result-1',
      type: 'document',
      title: 'Machine Learning Fundamentals',
      excerpt: 'A comprehensive guide to understanding machine learning concepts, algorithms, and applications in modern AI systems.',
      content: 'Machine learning is a subset of artificial intelligence that enables systems to learn from data and improve through experience...',
      score: 95,
      relevanceMatch: 'machine learning',
      context: 'This document covers the fundamentals of machine learning including supervised learning, unsupervised learning, and reinforcement learning approaches.',
      source: 'Study Guide: AI Basics',
      highlights: ['machine learning', 'artificial intelligence', 'systems'],
      timestamp: new Date(),
      isFavorite: false,
      metadata: { wordCount: 2500, readingTime: 12, tags: ['ai', 'ml', 'fundamentals'] },
    },
    {
      id: 'result-2',
      type: 'concept',
      title: 'Neural Networks',
      excerpt: 'Computing systems inspired by biological neural networks, consisting of interconnected nodes or neurons.',
      content: 'Neural networks are computing systems inspired by the structure and function of the human brain...',
      score: 88,
      relevanceMatch: 'neural networks',
      context: 'Neural networks consist of layers of interconnected nodes (neurons) that process information using connectionist approaches.',
      source: 'Deep Learning Notes',
      highlights: ['neural networks', 'neurons', 'layers'],
      timestamp: new Date(),
      isFavorite: true,
      metadata: { wordCount: 1800, readingTime: 8, tags: ['deep-learning', 'nn'] },
    },
    {
      id: 'result-3',
      type: 'heading',
      title: 'What is Deep Learning?',
      excerpt: 'Deep learning uses multiple layers to progressively extract higher-level features from raw input.',
      content: 'Deep learning is a subset of machine learning that uses neural networks with multiple hidden layers...',
      score: 82,
      relevanceMatch: 'deep learning',
      context: 'Deep learning enables models to learn representations of data with multiple levels of abstraction.',
      source: 'Study Guide: AI Basics',
      highlights: ['deep learning', 'machine learning', 'layers'],
      timestamp: new Date(),
      isFavorite: false,
      metadata: { wordCount: 950, readingTime: 5, tags: ['deep-learning'] },
    },
    {
      id: 'result-4',
      type: 'block',
      title: 'Supervised Learning Definition',
      excerpt: 'Learning from labeled training data to predict outcomes for new, unseen data.',
      content: 'Supervised learning uses labeled examples to train models that can predict outcomes for new inputs...',
      score: 75,
      relevanceMatch: 'supervised learning',
      context: 'In supervised learning, algorithms learn from labeled datasets to make predictions or decisions.',
      source: 'ML Concepts Reference',
      highlights: ['supervised learning', 'labeled', 'predictions'],
      timestamp: new Date(),
      isFavorite: false,
      metadata: { wordCount: 420, readingTime: 2, tags: ['ml', 'supervised'] },
    },
    {
      id: 'result-5',
      type: 'concept',
      title: 'Overfitting',
      excerpt: 'When a model performs well on training data but poorly generalizes to new data.',
      content: 'Overfitting occurs when a model learns the training data too well, including noise and details that do not generalize...',
      score: 70,
      relevanceMatch: 'overfitting model',
      context: 'Overfitting is a common problem where models perform excellently on training data but fail on new, unseen data.',
      source: 'Model Evaluation Guide',
      highlights: ['overfitting', 'model', 'training'],
      timestamp: new Date(),
      isFavorite: false,
      metadata: { wordCount: 650, readingTime: 3, tags: ['model-evaluation', 'ml'] },
    },
  ]

  // Filter by query relevance (simple simulation)
  if (query.trim()) {
    const queryLower = query.toLowerCase()
    return demoResults
      .filter((r) =>
        r.title.toLowerCase().includes(queryLower) ||
        r.content.toLowerCase().includes(queryLower) ||
        r.excerpt.toLowerCase().includes(queryLower)
      )
      .slice(0, maxResults)
  }

  return demoResults.slice(0, maxResults)
}

// Generate search suggestions based on query
function getSuggestions(query: string): string[] {
  if (!query.trim()) return []

  const suggestions = [
    `${query} definition`,
    `${query} examples`,
    `how to learn ${query}`,
    `${query} vs related concepts`,
    `best resources for ${query}`,
  ]

  return suggestions.slice(0, 3)
}

// Highlight matched terms in text
function highlightText(text: string, query: string): React.ReactNode[] {
  if (!query.trim()) return [text]

  const parts: React.ReactNode[] = []
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  let lastIndex = 0

  let idx = textLower.indexOf(queryLower)
  while (idx !== -1) {
    // Add text before match
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx))
    }
    // Add highlighted match
    parts.push(
      <Box
        component="span"
        key={idx}
        sx={{
          bgcolor: 'warning.light',
          px: 0.25,
          borderRadius: 0.5,
        }}
      >
        {text.slice(idx, idx + query.length)}
      </Box>,
    )
    lastIndex = idx + query.length
    idx = textLower.indexOf(queryLower, lastIndex)
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

// ============================================================================
// Search Result Card Component
// ============================================================================

interface SearchResultCardProps {
  result: SearchResult
  query: string
  onSelect: (result: SearchResult) => void
  onToggleFavorite: (id: string) => void
  onCopy: (result: SearchResult) => void
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({
  result,
  query,
  onSelect,
  onToggleFavorite,
  onCopy,
}) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <Paper
      elevation={1}
      sx={{
        mb: 1,
        overflow: 'hidden',
        transition: 'all 0.2s',
        '&:hover': { elevation: 2, bgcolor: 'grey.50' },
      }}
    >
      {/* Result Header */}
      <Box
        sx={{
          p: 1.5,
          cursor: 'pointer',
          borderLeft: `3px solid`,
          borderColor: result.isFavorite ? 'warning.main' : 'primary.main',
        }}
        onClick={() => onSelect(result)}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ mt: 0.5, color: 'text.secondary' }}>
            {RESULT_TYPE_ICONS[result.type]}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle2" fontWeight={600} noWrap>
                {highlightText(result.title, query)}
              </Typography>
              <Chip
                label={result.type}
                size="small"
                sx={{ height: 18, fontSize: '0.65rem', textTransform: 'capitalize' }}
              />
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {highlightText(result.excerpt, query)}
            </Typography>

            {/* Source and Score */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                📄 {result.source}
              </Typography>
              <Box
                sx={{
                  width: 32,
                  height: 16,
                  borderRadius: 1,
                  bgcolor: 'primary.50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" color="primary.main" fontWeight={600}>
                  {result.score}%
                </Typography>
              </Box>
              {result.metadata?.tags?.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'grey.200' }}
                />
              ))}
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite(result.id)
              }}
            >
              {result.isFavorite ? '★' : '☆'}
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                onCopy(result)
              }}
            >
              <CopyIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            >
              <ExpandIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Expanded Content */}
      {expanded && (
        <Box sx={{ px: 2, pb: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          {/* Context */}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 0.5 }}>
            Context:
          </Typography>
          <Box
            sx={{
              p: 1.5,
              bgcolor: 'grey.50',
              borderRadius: 1,
              borderLeft: '3px solid',
              borderColor: 'primary.main',
            }}
          >
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
              "{highlightText(result.context, query)}"
            </Typography>
          </Box>

          {/* Metadata */}
          {result.metadata && (
            <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
              {result.metadata.wordCount && (
                <Typography variant="caption" color="text.secondary">
                  📝 {result.metadata.wordCount} words
                </Typography>
              )}
              {result.metadata.readingTime && (
                <Typography variant="caption" color="text.secondary">
                  ⏱️ {result.metadata.readingTime} min read
                </Typography>
              )}
            </Box>
          )}

          {/* Matched Terms */}
          {result.highlights.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Matched terms:
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                {result.highlights.map((term, idx) => (
                  <Chip
                    key={idx}
                    label={term}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'warning.50' }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  )
}

// ============================================================================
// Search Suggestions Component
// ============================================================================

interface SearchSuggestionsProps {
  suggestions: string[]
  onSelect: (suggestion: string) => void
  onClose: () => void
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({ suggestions, onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [suggestions])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions[selectedIndex]) {
        onSelect(suggestions[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (suggestions.length === 0) return null

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 1000,
        mt: 0.5,
        overflow: 'hidden',
      }}
    >
      {suggestions.map((suggestion, idx) => (
        <Box
          key={idx}
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
          onClick={() => onSelect(suggestion)}
          onMouseEnter={() => setSelectedIndex(idx)}
        >
          <SuggestIcon fontSize="small" color="action" />
          <Typography variant="body2">{suggestion}</Typography>
          {selectedIndex === idx && (
            <Chip label="↵" size="small" sx={{ ml: 'auto', height: 18, fontSize: '0.65rem' }} />
          )}
        </Box>
      ))}
    </Paper>
  )
}

// ============================================================================
// Filter Panel Component
// ============================================================================

interface FilterPanelProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  onClose: () => void
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onChange, onClose }) => {
  return (
    <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" gutterBottom>
        🔍 Result Types
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
        {(['document', 'heading', 'block', 'concept', 'image'] as SearchResultType[]).map((type) => (
          <Chip
            key={type}
            label={type.charAt(0).toUpperCase() + type.slice(1)}
            size="small"
            variant={filters.types.includes(type) ? 'filled' : 'outlined'}
            onClick={() => {
              const newTypes = filters.types.includes(type)
                ? filters.types.filter((t) => t !== type)
                : [...filters.types, type]
              onChange({ ...filters, types: newTypes })
            }}
            icon={RESULT_TYPE_ICONS[type] as React.ReactElement}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={filters.fuzzyMatch}
              onChange={(e) => onChange({ ...filters, fuzzyMatch: e.target.checked })}
              size="small"
            />
          }
          label={<Typography variant="caption">Fuzzy Match</Typography>}
        />
        <FormControlLabel
          control={
            <Switch
              checked={filters.includeContent}
              onChange={(e) => onChange({ ...filters, includeContent: e.target.checked })}
              size="small"
            />
          }
          label={<Typography variant="caption">Include Content</Typography>}
        />
      </Box>
    </Box>
  )
}

// ============================================================================
// Main AI Smart Search Panel
// ============================================================================

interface AISearchPanelProps {
  onClose?: () => void
}

const AISearchPanel: React.FC<AISearchPanelProps> = ({ onClose }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters)
  const [config, setConfig] = useState<AISearchConfig>(defaultConfig)
  const [isSearching, setIsSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'title'>('relevance')

  const inputRef = useRef<HTMLInputElement>(null)
  const suggestions = useMemo(() => getSuggestions(query), [query])

  // Load search history
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studymesh-search-history')
      if (stored) {
        const parsed = JSON.parse(stored).map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }))
        setHistory(parsed)
      }
    } catch (e) {
      console.error('Failed to load search history:', e)
    }
  }, [])

  // Save search history
  useEffect(() => {
    if (results.length > 0 && query.trim()) {
      const newEntry: SearchHistoryItem = {
        query,
        timestamp: new Date(),
        resultsCount: results.length,
      }
      setHistory((prev) => {
        const next = [newEntry, ...prev].slice(0, 20)
        localStorage.setItem('studymesh-search-history', JSON.stringify(next))
        return next
      })
    }
  }, [results, query])

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsSearching(true)
    setShowSuggestions(false)

    // Simulate AI search delay
    await new Promise((r) => setTimeout(r, 500))

    const searchResults = performAISearch(searchQuery, filters, config.maxResults)
    setResults(searchResults)
    setIsSearching(false)
  }, [filters, config.maxResults])

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setShowSuggestions(true)
  }, [])

  const handleQuerySubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(query)
  }, [query, handleSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showSuggestions) {
      handleSearch(query)
    }
  }, [query, showSuggestions, handleSearch])

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setQuery(suggestion)
    setShowSuggestions(false)
    handleSearch(suggestion)
  }, [handleSearch])

  const handleToggleFavorite = useCallback((id: string) => {
    setResults((prev) => prev.map((r) =>
      r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
    ))
  }, [])

  const handleCopyResult = useCallback((result: SearchResult) => {
    const text = `${result.title}\n\n${result.excerpt}`
    navigator.clipboard.writeText(text).then(() => {
      // Could show a snackbar notification here
    })
  }, [])

  const handleResultSelect = useCallback((result: SearchResult) => {
    setSelectedResult(result)
  }, [])

  const handleHistorySelect = useCallback((historyItem: SearchHistoryItem) => {
    setQuery(historyItem.query)
    handleSearch(historyItem.query)
  }, [handleSearch])

  const handleClearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem('studymesh-search-history')
  }, [])

  // Sort results
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      if (sortBy === 'relevance') return b.score - a.score
      if (sortBy === 'date') return (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0)
      return a.title.localeCompare(b.title)
    })
  }, [results, sortBy])

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
          <AIIcon />
          <Typography variant="h6">🤖 AI Smart Search</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => {}}
            sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)' }}
          >
            History
          </Button>
          {onClose && (
            <IconButton sx={{ color: 'inherit' }} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Search Input */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box component="form" onSubmit={handleQuerySubmit} sx={{ position: 'relative' }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Search with AI... (e.g., 'machine learning basics')"
            variant="outlined"
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  {isSearching ? (
                    <CircularProgress size={20} />
                  ) : (
                    <IconButton onClick={() => handleSearch(query)}>
                      <SearchIcon />
                    </IconButton>
                  )}
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <SearchSuggestions
              suggestions={suggestions}
              onSelect={handleSuggestionSelect}
              onClose={() => setShowSuggestions(false)}
            />
          )}
        </Box>

        {/* Filter/Sort Controls */}
        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
          <Button
            size="small"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? 'contained' : 'outlined'}
          >
            Filters
          </Button>

          <ToggleButtonGroup
            value={sortBy}
            exclusive
            onChange={(_, v) => v && setSortBy(v)}
            size="small"
          >
            <ToggleButton value="relevance">Relevance</ToggleButton>
            <ToggleButton value="date">Date</ToggleButton>
            <ToggleButton value="title">Title</ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ flex: 1 }} />

          <Typography variant="caption" color="text.secondary">
            {results.length} results
          </Typography>
        </Box>

        {/* Filter Panel */}
        {showFilters && (
          <FilterPanel filters={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />
        )}
      </Box>

      {/* Search History */}
      {history.length > 0 && results.length === 0 && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Recent Searches
            </Typography>
            <Button size="small" onClick={handleClearHistory}>Clear</Button>
          </Box>
          <List dense disablePadding>
            {history.slice(0, 5).map((item, idx) => (
              <ListItem
                key={idx}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => handleHistorySelect(item)}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <HistoryIcon fontSize="small" color="action" />
                </ListItemIcon>
                <ListItemText
                  primary={item.query}
                  secondary={`${item.resultsCount} results • ${item.timestamp.toLocaleDateString()}`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Results */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {isSearching ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Searching with AI...
            </Typography>
          </Box>
        ) : sortedResults.length === 0 && query.trim() ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No results found for "{query}"
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try different keywords or remove filters
            </Typography>
          </Box>
        ) : sortedResults.length > 0 ? (
          sortedResults.map((result) => (
            <SearchResultCard
              key={result.id}
              result={result}
              query={query}
              onSelect={handleResultSelect}
              onToggleFavorite={handleToggleFavorite}
              onCopy={handleCopyResult}
            />
          ))
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AIIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Search your study materials with AI
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ask questions in natural language
            </Typography>
          </Box>
        )}
      </Box>

      {/* Result Detail Modal */}
      {selectedResult && (
        <Dialog
          open={Boolean(selectedResult)}
          onClose={() => setSelectedResult(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {RESULT_TYPE_ICONS[selectedResult.type]}
              <Typography variant="h6">{selectedResult.title}</Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {selectedResult.content}
            </Typography>
            <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Source: {selectedResult.source}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedResult(null)}>Close</Button>
            <Button
              startIcon={<OpenIcon />}
              onClick={() => {
                // Would navigate to the result
                setSelectedResult(null)
              }}
            >
              Open
            </Button>
          </DialogActions>
        </Dialog>
      )}

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
          💡 Tip: Ask natural language questions
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip
          icon={<AIIcon />}
          label="AI Powered"
          size="small"
          sx={{ bgcolor: 'primary.50' }}
        />
      </Box>
    </Paper>
  )
}

export default AISearchPanel

// ============================================================================
// Hook for AI Smart Search
// ============================================================================

export function useAISmartSearch() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [history, setHistory] = useState<SearchHistoryItem[]>([])

  // Load history
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studymesh-search-history')
      if (stored) {
        const parsed = JSON.parse(stored).map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }))
        setHistory(parsed)
      }
    } catch (e) {
      console.error('Failed to load search history:', e)
    }
  }, [])

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const search = useCallback((query: string): SearchResult[] => {
    return performAISearch(query, defaultFilters, 20)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem('studymesh-search-history')
  }, [])

  return {
    isPanelOpen,
    history,
    openPanel,
    closePanel,
    search,
    clearHistory,
    AISearchPanel: AISearchPanel as React.FC<{ onClose?: () => void }>,
  }
}