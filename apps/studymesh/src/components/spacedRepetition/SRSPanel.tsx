import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fade,
  Collapse,
} from '@mui/material'
import {
  CheckCircle as EasyIcon,
  Cancel as HardIcon,
  SkipNext as AgainIcon,
  School as GoodIcon,
  Schedule as ScheduleIcon,
  BarChart as StatsIcon,
  PlayArrow as ReviewIcon,
  ArrowBack as BackIcon,
  Refresh as ResetIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// SM-2 Spaced Repetition Algorithm
// ============================================================================

export interface SRSCard {
  id: string
  front: string
  back: string
  // SM-2 fields
  easeFactor: number // minimum 1.3
  interval: number // days until next review
  repetitions: number // consecutive correct responses
  nextReviewDate: Date
  lastReviewDate?: Date
  // metadata
  deck: string
  tags: string[]
  createdAt: Date
  totalReviews: number
  correctReviews: number
}

export interface SRSDeck {
  id: string
  name: string
  description: string
  color: string
  cards: SRSCard[]
  createdAt: Date
}

export interface SRSStats {
  totalCards: number
  dueToday: number
  masteredCards: number
  learningCards: number
  newCards: number
  averageEaseFactor: number
  streakDays: number
  totalReviews: number
  retentionRate: number // percentage of correct answers
}

export type SRSQuality = 0 | 1 | 2 | 3 | 4 | 5

// Quality meanings:
// 0 - complete blackout
// 1 - incorrect response, but upon seeing correct answer it felt familiar
// 2 - incorrect response, but correct answer seemed easy to recall
// 3 - correct response with serious difficulty
// 4 - correct response after hesitation
// 5 - perfect response with no hesitation

const QUALITY_LABELS: Record<SRSQuality, string> = {
  0: 'Blackout',
  1: 'Wrong',
  2: 'Hard',
  3: 'Difficult',
  4: 'Good',
  5: 'Perfect',
}

const QUALITY_COLORS: Record<SRSQuality, string> = {
  0: 'error.main',
  1: 'error.light',
  2: 'warning.main',
  3: 'warning.light',
  4: 'success.light',
  5: 'success.main',
}

// Calculate next review using SM-2 algorithm
export function calculateSM2(
  card: SRSCard,
  quality: SRSQuality,
): Partial<SRSCard> {
  let { easeFactor, interval, repetitions } = card

  if (quality < 3) {
    // Incorrect response - reset to beginning
    repetitions = 0
    interval = 1
  } else {
    // Correct response
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1
  }

  // Update ease factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  easeFactor = Math.max(1.3, newEF) // Ease factor cannot be less than 1.3

  // Calculate next review date
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + interval)

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewDate,
    lastReviewDate: new Date(),
  }
}

// Check if a card is due for review
export function isCardDue(card: SRSCard): boolean {
  const now = new Date()
  return card.nextReviewDate <= now
}

// Sort cards by review priority (most overdue first)
export function sortByPriority(cards: SRSCard[]): SRSCard[] {
  const now = new Date()
  return [...cards].sort((a, b) => {
    const aOverdue = now.getTime() - a.nextReviewDate.getTime()
    const bOverdue = now.getTime() - b.nextReviewDate.getTime()
    return bOverdue - aOverdue // Most overdue first
  })
}

// Calculate deck statistics
export function calculateDeckStats(deck: SRSDeck): SRSStats {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const totalCards = deck.cards.length
  const dueToday = deck.cards.filter((c) => c.nextReviewDate <= now).length
  const masteredCards = deck.cards.filter((c) => c.repetitions >= 5).length
  const learningCards = deck.cards.filter(
    (c) => c.repetitions > 0 && c.repetitions < 5,
  ).length
  const newCards = deck.cards.filter((c) => c.repetitions === 0).length

  const totalReviews = deck.cards.reduce((sum, c) => sum + c.totalReviews, 0)
  const correctReviews = deck.cards.reduce(
    (sum, c) => sum + c.correctReviews,
    0,
  )

  const averageEaseFactor =
    totalCards > 0
      ? deck.cards.reduce((sum, c) => sum + c.easeFactor, 0) / totalCards
      : 2.5

  const retentionRate = totalReviews > 0 ? (correctReviews / totalReviews) * 100 : 0

  return {
    totalCards,
    dueToday,
    masteredCards,
    learningCards,
    newCards,
    averageEaseFactor,
    streakDays: 0, // Would need review history to calculate
    totalReviews,
    retentionRate,
  }
}

// ============================================================================
// SRS Session Component
// ============================================================================

interface ReviewSessionProps {
  deck: SRSDeck
  onUpdateCard: (cardId: string, updates: Partial<SRSCard>) => void
  onComplete: () => void
}

type ReviewState = 'front' | 'back' | 'rating'

const ReviewSession: React.FC<ReviewSessionProps> = ({
  deck,
  onUpdateCard,
  onComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewState, setReviewState] = useState<ReviewState>('front')
  const [showAnswer, setShowAnswer] = useState(false)

  // Get due cards
  const dueCards = useMemo(() => sortByPriority(deck.cards.filter(isCardDue)), [deck.cards])

  if (dueCards.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          🎉 All caught up!
        </Typography>
        <Typography color="text.secondary">
          No cards due for review in "{deck.name}"
        </Typography>
        <Button onClick={onComplete} sx={{ mt: 2 }}>
          Back to Deck
        </Button>
      </Paper>
    )
  }

  const currentCard = dueCards[currentIndex]
  const progress = ((currentIndex + 1) / dueCards.length) * 100

  const handleShowAnswer = () => {
    setShowAnswer(true)
    setReviewState('back')
  }

  const handleRating = (quality: SRSQuality) => {
    const updates = calculateSM2(currentCard, quality)
    onUpdateCard(currentCard.id, updates)

    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex((i) => i + 1)
      setShowAnswer(false)
      setReviewState('front')
    } else {
      onComplete()
    }
  }

  return (
    <Box>
      {/* Progress Bar */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Card {currentIndex + 1} of {dueCards.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Math.round(progress)}%
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
      </Box>

      {/* Card Display */}
      <Paper
        elevation={3}
        sx={{
          p: 4,
          minHeight: 300,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'center',
          borderRadius: 3,
          background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)',
        }}
      >
        {/* Front */}
        <Collapse in={reviewState === 'front'}>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>
            {currentCard.front}
          </Typography>
          {!showAnswer && (
            <Button variant="contained" size="large" onClick={handleShowAnswer}>
              Show Answer
            </Button>
          )}
        </Collapse>

        {/* Back */}
        <Collapse in={reviewState === 'back' && showAnswer}>
          <Box>
            <Typography variant="h5" color="primary" gutterBottom>
              {currentCard.front}
            </Typography>
            <Box sx={{ my: 3, borderTop: '1px solid', borderColor: 'divider' }} />
            <Typography variant="h5" sx={{ fontWeight: 500 }}>
              {currentCard.back}
            </Typography>

            {/* Rating Buttons */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                How well did you remember?
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                {([0, 1, 2, 3, 4, 5] as SRSQuality[]).map((q) => (
                  <Tooltip key={q} title={QUALITY_LABELS[q]}>
                    <Button
                      variant={q <= 2 ? 'outlined' : 'contained'}
                      color={q <= 1 ? 'error' : q <= 2 ? 'warning' : 'success'}
                      onClick={() => handleRating(q)}
                      sx={{ minWidth: 60 }}
                    >
                      {q}
                    </Button>
                  </Tooltip>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                0-2: Again/Later &nbsp;&nbsp; 3: Hard &nbsp;&nbsp; 4: Good &nbsp;&nbsp; 5: Easy
              </Typography>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Card Metadata */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
        <Chip
          label={`EF: ${currentCard.easeFactor.toFixed(2)}`}
          size="small"
          sx={{ fontSize: '0.7rem' }}
        />
        <Chip
          label={`Interval: ${currentCard.interval}d`}
          size="small"
          sx={{ fontSize: '0.7rem' }}
        />
        <Chip
          label={`Reviews: ${currentCard.totalReviews}`}
          size="small"
          sx={{ fontSize: '0.7rem' }}
        />
      </Box>
    </Box>
  )
}

// ============================================================================
// Main SRS Panel Component
// ============================================================================

interface SRSPanelProps {
  decks?: SRSDeck[]
  onDecksChange?: (decks: SRSDeck[]) => void
  onClose?: () => void
}

const defaultDecks: SRSDeck[] = [
  {
    id: 'default-deck',
    name: 'General',
    description: 'Default study deck',
    color: '#2196f3',
    cards: [],
    createdAt: new Date(),
  },
]

export const SRSPanelComponent: React.FC<SRSPanelProps> = ({
  decks = defaultDecks,
  onDecksChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'decks' | 'stats' | 'review'>('decks')
  const [selectedDeck, setSelectedDeck] = useState<SRSDeck | null>(null)
  const [reviewSessionActive, setReviewSessionActive] = useState(false)
  const [localDecks, setLocalDecks] = useState<SRSDeck[]>(decks)

  const allStats = useMemo(() => {
    return localDecks.map((deck) => ({
      deck,
      stats: calculateDeckStats(deck),
    }))
  }, [localDecks])

  const totalDueToday = allStats.reduce((sum, s) => sum + s.stats.dueToday, 0)

  const handleStartReview = (deck: SRSDeck) => {
    setSelectedDeck(deck)
    setReviewSessionActive(true)
  }

  const handleUpdateCard = useCallback((cardId: string, updates: Partial<SRSCard>) => {
    if (!selectedDeck) return

    setLocalDecks((prev) => {
      const next = prev.map((d) => {
        if (d.id !== selectedDeck.id) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            return { ...c, ...updates }
          }),
        }
      })
      return next
    })

    onDecksChange?.(localDecks)
  }, [selectedDeck, localDecks, onDecksChange])

  const handleReviewComplete = () => {
    setReviewSessionActive(false)
    setSelectedDeck(null)
    setActiveTab('decks')
  }

  // Quick add sample cards for demo
  const handleAddSampleCards = (deckId: string) => {
    const sampleCards: SRSCard[] = [
      {
        id: `card-${Date.now()}-1`,
        front: 'What is spaced repetition?',
        back: 'A learning technique that incorporates increasing intervals of time between subsequent review of previously learned material.',
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        nextReviewDate: new Date(),
        deck: deckId,
        tags: ['learning', 'technique'],
        createdAt: new Date(),
        totalReviews: 0,
        correctReviews: 0,
      },
      {
        id: `card-${Date.now()}-2`,
        front: 'What is the SM-2 algorithm?',
        back: 'The SuperMemo 2 algorithm calculates review intervals based on the quality of responses, adjusting the ease factor accordingly.',
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        nextReviewDate: new Date(),
        deck: deckId,
        tags: ['algorithm', 'supermemo'],
        createdAt: new Date(),
        totalReviews: 0,
        correctReviews: 0,
      },
      {
        id: `card-${Date.now()}-3`,
        front: 'What does "ease factor" mean?',
        back: 'A number representing how easy a card is to remember. Higher = easier. Minimum is 1.3. Starts at 2.5.',
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        nextReviewDate: new Date(),
        deck: deckId,
        tags: ['concept'],
        createdAt: new Date(),
        totalReviews: 0,
        correctReviews: 0,
      },
    ]

    setLocalDecks((prev) => {
      const next = prev.map((d) => {
        if (d.id !== deckId) return d
        return { ...d, cards: [...d.cards, ...sampleCards] }
      })
      return next
    })
  }

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        width: 480,
        maxHeight: '85vh',
        overflow: 'auto',
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
          <Typography variant="h6">🧠 Spaced Repetition</Typography>
          {totalDueToday > 0 && (
            <Chip
              label={`${totalDueToday} due`}
              size="small"
              sx={{ bgcolor: 'error.main', color: 'white', fontWeight: 600 }}
            />
          )}
        </Box>
        {onClose && (
          <IconButton onClick={onClose} sx={{ color: 'inherit' }}>
            <ScheduleIcon />
          </IconButton>
        )}
      </Box>

      {/* Review Session */}
      {reviewSessionActive && selectedDeck ? (
        <Box sx={{ p: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => setReviewSessionActive(false)}
            sx={{ mb: 2 }}
          >
            Exit Review
          </Button>
          <ReviewSession
            deck={selectedDeck}
            onUpdateCard={handleUpdateCard}
            onComplete={handleReviewComplete}
          />
        </Box>
      ) : (
        <>
          {/* Tab Navigation */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex' }}>
            {[
              { key: 'decks', label: 'Decks', icon: '📚' },
              { key: 'stats', label: 'Statistics', icon: '📊' },
            ].map((tab) => (
              <Box
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'decks' | 'stats')}
                sx={{
                  flex: 1,
                  p: 1.5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderBottom: activeTab === tab.key ? '3px solid' : '3px solid transparent',
                  borderColor: activeTab === tab.key ? 'primary.main' : 'transparent',
                  '&:hover': { bgcolor: 'grey.100' },
                }}
              >
                <Typography variant="body2">
                  {tab.icon} {tab.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Decks Tab */}
          {activeTab === 'decks' && (
            <Box sx={{ p: 2 }}>
              {localDecks.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No decks yet. Create one to get started!
                </Typography>
              ) : (
                localDecks.map((deck) => {
                  const stats = calculateDeckStats(deck)
                  return (
                    <Card key={deck.id} sx={{ mb: 2, borderLeft: `4px solid ${deck.color}` }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {deck.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {deck.description || 'No description'}
                            </Typography>
                          </Box>
                          {stats.dueToday > 0 && (
                            <Chip
                              label={`${stats.dueToday} due`}
                              size="small"
                              color="error"
                              sx={{ fontWeight: 600 }}
                            />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Total Cards
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {stats.totalCards}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Mastered
                            </Typography>
                            <Typography variant="body2" fontWeight={600} color="success.main">
                              {stats.masteredCards}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Learning
                            </Typography>
                            <Typography variant="body2" fontWeight={600} color="warning.main">
                              {stats.learningCards}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<ReviewIcon />}
                            onClick={() => handleStartReview(deck)}
                            disabled={stats.dueToday === 0}
                          >
                            Review ({stats.dueToday})
                          </Button>
                          {deck.cards.length === 0 && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<ResetIcon />}
                              onClick={() => handleAddSampleCards(deck.id)}
                            >
                              Add Sample Cards
                            </Button>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </Box>
          )}

          {/* Statistics Tab */}
          {activeTab === 'stats' && (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                📈 Overall Statistics
              </Typography>

              {allStats.map(({ deck, stats }) => (
                <Paper
                  key={deck.id}
                  sx={{
                    p: 2,
                    mb: 2,
                    borderLeft: `4px solid ${deck.color}`,
                    bgcolor: 'grey.50',
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {deck.name}
                  </Typography>

                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Due Today
                      </Typography>
                      <Typography variant="h6" color="error.main">
                        {stats.dueToday}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Cards
                      </Typography>
                      <Typography variant="h6">
                        {stats.totalCards}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Retention Rate
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {stats.retentionRate.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Avg. Ease Factor
                      </Typography>
                      <Typography variant="h6">
                        {stats.averageEaseFactor.toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Progress Bar */}
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Mastery Progress
                      </Typography>
                      <Typography variant="caption">
                        {stats.totalCards > 0
                          ? Math.round((stats.masteredCards / stats.totalCards) * 100)
                          : 0}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={stats.totalCards > 0 ? (stats.masteredCards / stats.totalCards) * 100 : 0}
                      sx={{ height: 8, borderRadius: 4 }}
                      color="success"
                    />
                  </Box>
                </Paper>
              ))}

              {/* Legend */}
              <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip label="🟢 New cards" size="small" sx={{ fontSize: '0.7rem' }} />
                <Chip label="🟡 Learning" size="small" color="warning" sx={{ fontSize: '0.7rem' }} />
                <Chip label="🟢 Mastered (5+ reps)" size="small" color="success" sx={{ fontSize: '0.7rem' }} />
              </Box>
            </Box>
          )}
        </>
      )}
    </Paper>
  )
}

export default SRSPanelComponent

// ============================================================================
// Hook for using SRS in StudyMesh
// ============================================================================

const SRS_STORAGE_KEY = 'studymesh-srs-decks'

export function useSRS() {
  const [decks, setDecks] = useState<SRSDeck[]>(() => {
    try {
      const stored = localStorage.getItem(SRS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as SRSDeck[]
        // Convert date strings back to Date objects
        return parsed.map((d) => ({
          ...d,
          cards: d.cards.map((c) => ({
            ...c,
            nextReviewDate: new Date(c.nextReviewDate),
            lastReviewDate: c.lastReviewDate ? new Date(c.lastReviewDate) : undefined,
            createdAt: new Date(c.createdAt),
          })),
          createdAt: new Date(d.createdAt),
        }))
      }
    } catch (e) {
      console.error('Failed to load SRS decks:', e)
    }
    return []
  })

  useEffect(() => {
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(decks))
  }, [decks])

  const addCard = useCallback((deckId: string, card: Omit<SRSCard, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReviewDate' | 'createdAt' | 'totalReviews' | 'correctReviews'>) => {
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        return {
          ...d,
          cards: [
            ...d.cards,
            {
              ...card,
              id: `srs-card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              easeFactor: 2.5,
              interval: 0,
              repetitions: 0,
              nextReviewDate: new Date(),
              createdAt: new Date(),
              totalReviews: 0,
              correctReviews: 0,
            },
          ],
        }
      }),
    )
  }, [])

  const updateCard = useCallback((deckId: string, cardId: string, updates: Partial<SRSCard>) => {
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        return {
          ...d,
          cards: d.cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c)),
        }
      }),
    )
  }, [])

  const createDeck = useCallback((name: string, description = '', color = '#2196f3') => {
    const newDeck: SRSDeck = {
      id: `srs-deck-${Date.now()}`,
      name,
      description,
      color,
      cards: [],
      createdAt: new Date(),
    }
    setDecks((prev) => [...prev, newDeck])
    return newDeck.id
  }, [])

  const getStats = useCallback(
    (deckId: string) => {
      const deck = decks.find((d) => d.id === deckId)
      if (!deck) return null
      return calculateDeckStats(deck)
    },
    [decks],
  )

  return {
    decks,
    addCard,
    updateCard,
    createDeck,
    getStats,
  }
}