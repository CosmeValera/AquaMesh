import React from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import { alpha, useTheme, type Theme } from '@mui/material/styles'

import ExplainItYourWayPanel from '../studyGuides/ExplainItYourWayPanel'
import { useInterfaceText } from '../../language/interfaceLanguage'
import type { NextGuideIdea } from '../../studyGuides/nextGuideIdeas'

export interface StudyPathMasteryOffer {
  studyGuideId: string
  topic: string
  /** Guide text the grader marks the explanation against. */
  sourceText: string
  status: 'offered' | 'added'
  canClaimSkill: boolean
  onPassed: () => void
  onAddSkill: () => void
  nextGuideIdeas: NextGuideIdea[]
  nextGuideIdeaLabel: (idea: NextGuideIdea) => string
  onExpandOnThis: () => void
  onStartNextGuide: (idea: NextGuideIdea) => void
}

const nextStepButtonSx = (theme: Theme) =>
  ({
    textTransform: 'none',
    fontWeight: 650,
    borderRadius: 1.5,
    color: theme.palette.mode === 'dark' ? 'success.light' : 'success.dark',
    borderColor: alpha(theme.palette.success.main, 0.5),
    bgcolor: alpha(theme.palette.success.main, 0.08),
    '&:hover': {
      bgcolor: alpha(theme.palette.success.main, 0.2),
      borderColor: alpha(theme.palette.success.main, 0.7),
    },
  }) as const

interface GuideMasteryToggleProps {
  offer: StudyPathMasteryOffer
  view: 'quiz' | 'explain'
  onViewChange: (view: 'quiz' | 'explain') => void
  /** The page's quiz card, shown while view is "quiz". */
  children: React.ReactNode
}

/** Wraps the last page's quiz card with a Quiz/Explain toggle above it. */
export const GuideMasteryToggle: React.FC<GuideMasteryToggleProps> = ({
  offer,
  view,
  onViewChange,
  children,
}) => {
  const { t } = useInterfaceText()

  return (
    <div className="studymesh-study-mastery-slot">
      <Stack direction="row" spacing={1} sx={{ px: { xs: 2, md: 3 } }}>
        <Button
          size="small"
          variant={view === 'explain' ? 'outlined' : 'contained'}
          onClick={() => onViewChange('quiz')}
          sx={{ textTransform: 'none' }}
        >
          {t('mastery.quizTab')}
        </Button>
        <Button
          size="small"
          variant={view === 'explain' ? 'contained' : 'outlined'}
          onClick={() => onViewChange('explain')}
          sx={{ textTransform: 'none' }}
        >
          {t('mastery.explainInstead')}
        </Button>
      </Stack>
      {view === 'explain' ? (
        <ExplainItYourWayPanel
          studyGuideId={offer.studyGuideId}
          topic={offer.topic}
          sourceText={offer.sourceText}
          onPassed={offer.onPassed}
          onAddSkill={offer.onAddSkill}
        />
      ) : (
        children
      )}
    </div>
  )
}

interface GuideMasteryOfferPanelProps {
  offer: StudyPathMasteryOffer
}

/** For a last page with no quiz card: the explain check with nothing to toggle to. */
export const GuideMasteryExplainOnly: React.FC<GuideMasteryOfferPanelProps> = ({
  offer,
}) => (
  <div className="studymesh-study-mastery-slot">
    <ExplainItYourWayPanel
      studyGuideId={offer.studyGuideId}
      topic={offer.topic}
      sourceText={offer.sourceText}
      onPassed={offer.onPassed}
      onAddSkill={offer.onAddSkill}
    />
  </div>
)

/** "Add to what I know", then next-guide suggestions once added. */
export const GuideMasterySkillClaim: React.FC<GuideMasteryOfferPanelProps> = ({
  offer,
}) => {
  const { t } = useInterfaceText()
  const theme = useTheme()

  if (!offer.canClaimSkill) {
    return null
  }

  return (
    <div className="studymesh-study-mastery-slot">
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: 1,
          borderColor: alpha(theme.palette.success.main, 0.32),
          bgcolor: alpha(theme.palette.success.main, 0.08),
        }}
      >
        {offer.status === 'added' ? (
          <Box>
            <Typography variant="body2">
              <Box component="span" sx={{ fontWeight: 700 }}>
                {offer.topic}
              </Box>{' '}
              {t('mastery.added')}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              {t('nextGuides.title')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={offer.onExpandOnThis}
                sx={nextStepButtonSx(theme)}
              >
                {t('nextGuides.expandOnThis')}
              </Button>
              {offer.nextGuideIdeas.map((idea) => (
                <Button
                  key={idea.id}
                  size="small"
                  variant="outlined"
                  onClick={() => offer.onStartNextGuide(idea)}
                  sx={nextStepButtonSx(theme)}
                >
                  {offer.nextGuideIdeaLabel(idea)}
                </Button>
              ))}
            </Box>
          </Box>
        ) : (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={1.5}
          >
            <Typography variant="body2">
              <Box component="span" sx={{ fontWeight: 700 }}>
                {offer.topic}
              </Box>{' '}
              {t('mastery.addQuestion')}
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={offer.onAddSkill}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {t('mastery.addSkill')}
            </Button>
          </Stack>
        )}
      </Box>
    </div>
  )
}
