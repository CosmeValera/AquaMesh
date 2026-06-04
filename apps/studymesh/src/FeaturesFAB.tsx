import React, { useState, useCallback } from 'react'
import {
  Box,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Divider,
  Typography,
} from '@mui/material'
import {
  Psychology as PsychologyIcon,
  Quiz as QuizIcon,
  Hub as HubIcon,
  PanTool as CanvasIcon,
  Link as LinkIcon,
  Timer as TimerIcon,
  ContentCut as ClipIcon,
  AccountTree as ConceptIcon,
  ListAlt as OutlineIcon,
  Download as AnkiIcon,
  Search as SearchIcon,
  Today as ReviewIcon,
  ExpandMore as ExpandIcon,
} from '@mui/icons-material'

// Import all feature panels
import { AudioOverviewPanel } from './components/audioOverview'
import { SRSPanel } from './components/spacedRepetition'
import { KnowledgeGraphPanel } from './components/knowledgeGraph'
import { QuizGeneratorPanel } from './components/quizGenerator'
import { CanvasPanel } from './components/canvas'
import { WikiLinksPanel } from './components/wikiLinks'
import { PomodoroTimer } from './components/pomodoro'
import { WebClipperPanel } from './components/webClipper'
import { ConceptMapPanel } from './components/conceptMap'
import { CollapsibleOutlinePanel } from './components/collapsibleOutline'
import { ExportAnkiPanel } from './components/exportAnki'
import { AISearchPanel } from './components/aiSmartSearch'
import { DailyReviewPanel } from './components/dailyReview'

interface FeatureMenuItem {
  id: string
  label: string
  icon: React.ReactNode
  description: string
  component: React.ReactNode
}

const featureMenuItems: FeatureMenuItem[] = [
  {
    id: 'audio-overview',
    label: '🎧 Audio Overview',
    icon: <PsychologyIcon />,
    description: 'AI-powered podcast-style audio summaries (NotebookLM style)',
    component: <AudioOverviewPanel onClose={() => {}} />,
  },
  {
    id: 'spaced-repetition',
    label: '🧠 Spaced Repetition',
    icon: <PsychologyIcon />,
    description: 'SM-2 algorithm flashcard review system',
    component: <SRSPanel onClose={() => {}} />,
  },
  {
    id: 'knowledge-graph',
    label: '🕸️ Knowledge Graph',
    icon: <HubIcon />,
    description: 'Interactive force-directed graph visualization',
    component: <KnowledgeGraphPanel onClose={() => {}} />,
  },
  {
    id: 'quiz-generator',
    label: '📝 AI Quiz Generator',
    icon: <QuizIcon />,
    description: 'Generate quizzes from your study materials',
    component: <QuizGeneratorPanel onClose={() => {}} />,
  },
  {
    id: 'canvas',
    label: '🎨 Canvas',
    icon: <CanvasIcon />,
    description: 'Infinite canvas for spatial note organization',
    component: <CanvasPanel onClose={() => {}} />,
  },
  {
    id: 'wikilinks',
    label: '🔗 WikiLinks',
    icon: <LinkIcon />,
    description: 'Bidirectional linking with [[double brackets]]',
    component: <WikiLinksPanel onClose={() => {}} />,
  },
  {
    id: 'pomodoro',
    label: '🍅 Pomodoro Timer',
    icon: <TimerIcon />,
    description: 'Focus timer with work/break cycles',
    component: <PomodoroTimer onClose={() => {}} />,
  },
  {
    id: 'web-clipper',
    label: '📌 Web Clipper',
    icon: <ClipIcon />,
    description: 'Save articles and web pages for later',
    component: <WebClipperPanel onClose={() => {}} />,
  },
  {
    id: 'concept-map',
    label: '🗺️ Concept Map',
    icon: <ConceptIcon />,
    description: 'Visual diagram creation for concepts',
    component: <ConceptMapPanel onClose={() => {}} />,
  },
  {
    id: 'collapsible-outline',
    label: '📋 Collapsible Outline',
    icon: <OutlineIcon />,
    description: 'Hierarchical content navigation',
    component: <CollapsibleOutlinePanel onClose={() => {}} />,
  },
  {
    id: 'export-anki',
    label: '📤 Export to Anki',
    icon: <AnkiIcon />,
    description: 'Export flashcards to Anki format',
    component: <ExportAnkiPanel onClose={() => {}} />,
  },
  {
    id: 'ai-search',
    label: '🤖 AI Smart Search',
    icon: <SearchIcon />,
    description: 'Search with AI-powered fuzzy matching',
    component: <AISearchPanel onClose={() => {}} />,
  },
  {
    id: 'daily-review',
    label: '📅 Daily Review',
    icon: <ReviewIcon />,
    description: 'Mood, energy, and focus tracking',
    component: <DailyReviewPanel onClose={() => {}} />,
  },
]

const FeaturesFAB: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [openFeatureId, setOpenFeatureId] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
    setIsExpanded(true)
  }

  const handleClose = () => {
    setAnchorEl(null)
    setIsExpanded(false)
  }

  const handleOpenFeature = (featureId: string) => {
    setOpenFeatureId(featureId)
    handleClose()
  }

  const handleCloseFeature = useCallback(() => {
    setOpenFeatureId(null)
  }, [])

  const openFeature = featureMenuItems.find((f) => f.id === openFeatureId)

  return (
    <>
      {/* Floating Action Button */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9997,
        }}
      >
        <Fab
          color="primary"
          aria-label="StudyMesh Features"
          onClick={handleOpen}
          sx={{
            width: 56,
            height: 56,
            fontSize: '1.5rem',
            bgcolor: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          }}
        >
          ⚡
        </Fab>
      </Box>

      {/* Feature Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: {
            width: 320,
            maxHeight: 480,
            overflow: 'auto',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            🚀 StudyMesh Features
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click to open any feature panel
          </Typography>
        </Box>
        <Divider />

        {featureMenuItems.map((feature) => (
          <MenuItem
            key={feature.id}
            onClick={() => handleOpenFeature(feature.id)}
            sx={{
              py: 1.5,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {feature.icon}
            </ListItemIcon>
            <ListItemText
              primary={feature.label}
              secondary={feature.description}
              primaryTypographyProps={{
                variant: 'body2',
                fontWeight: 500,
              }}
              secondaryTypographyProps={{
                variant: 'caption',
              }}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Feature Panels */}
      {openFeature && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9998,
            pointerEvents: 'none',
          }}
        >
          {/* Click outside to close backdrop */}
          <Box
            onClick={handleCloseFeature}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(0,0,0,0.3)',
              pointerEvents: 'auto',
            }}
          />

          {/* Feature Panel */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
            }}
          >
            {React.cloneElement(openFeature.component as React.ReactElement, {
              onClose: handleCloseFeature,
            })}
          </Box>
        </Box>
      )}
    </>
  )
}

export default FeaturesFAB
