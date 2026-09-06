import React, { useState } from 'react'
import {
  Box,
  Button,
  Divider,
  Drawer,
  Popover,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

import StudyCreditCostLabel from '../hostedAi/StudyCreditCostLabel'
import type { StudyPathContainerState } from '../../state/store'
import {
  deriveStudyGuidePageIdeas,
  type StudyGuideGrowthSeed,
} from '../../studyGuides/pageGrowth'
import { useInterfaceText } from '../../language/interfaceLanguage'

interface StudyGuideAddPageMenuProps {
  studyPath: StudyPathContainerState
  anchorEl: HTMLElement | null
  open: boolean
  mobile: boolean
  /** Lessons already being written, so the same one is not offered twice. */
  busyLessonTitles?: string[]
  creditCost?: number
  onClose: () => void
  onGrow: (seed: StudyGuideGrowthSeed) => void
}

const optionButtonSx = (theme: Theme) => ({
  justifyContent: 'flex-start',
  textAlign: 'left',
  textTransform: 'none',
  width: '100%',
  px: 1.25,
  py: 0.85,
  borderRadius: 1,
  border: 1,
  borderColor: theme.palette.divider,
  bgcolor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  '&:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.42),
    bgcolor: alpha(theme.palette.primary.main, 0.06),
  },
  '&.Mui-disabled': {
    borderColor: theme.palette.divider,
    color: theme.palette.text.disabled,
  },
})

const StudyGuideAddPageMenu: React.FC<StudyGuideAddPageMenuProps> = ({
  studyPath,
  anchorEl,
  open,
  mobile,
  busyLessonTitles,
  creditCost,
  onClose,
  onGrow,
}) => {
  const { t } = useInterfaceText()
  const [prompt, setPrompt] = useState('')
  const activePage = studyPath.dashboards[studyPath.selectedIndex]
  const nextLesson = studyPath.plannedLessons?.find(
    (lesson) => !(busyLessonTitles || []).includes(lesson.title),
  )
  const pageIdeas = activePage
    ? deriveStudyGuidePageIdeas(studyPath, activePage.dashboardKey)
    : []

  const grow = (seed: StudyGuideGrowthSeed) => {
    onGrow(seed)
    setPrompt('')
    onClose()
  }

  const cost =
    creditCost && creditCost > 0 ? (
      <StudyCreditCostLabel amount={creditCost} variant="badge" />
    ) : null

  const content = (
    <Stack
      spacing={1.25}
      sx={{ p: 1.5, width: mobile ? 'auto' : 332, maxWidth: '100%' }}
      data-testid="study-guide-add-page-menu"
    >
      <Typography variant="subtitle2" fontWeight={700}>
        {t('workspace.addPageMenuTitle')}
      </Typography>

      {nextLesson ? (
        <Button
          onClick={() => grow({ kind: 'continue', lesson: nextLesson })}
          data-testid="study-guide-add-page-continue"
          sx={(theme) => ({
            ...optionButtonSx(theme),
            borderColor: alpha(theme.palette.primary.main, 0.42),
            bgcolor: alpha(theme.palette.primary.main, 0.07),
          })}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ width: '100%' }}
          >
            <ArrowForwardIcon fontSize="small" color="primary" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700}>
                {t('workspace.addPageContinue')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', lineHeight: 1.4 }}
              >
                {t('workspace.addPageContinueNext').replace(
                  '{title}',
                  nextLesson.title,
                )}
              </Typography>
            </Box>
            {cost}
          </Stack>
        </Button>
      ) : null}

      {pageIdeas.length ? (
        <>
          <Divider textAlign="left">
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
            >
              {t('workspace.addPageDeeper')}
            </Typography>
          </Divider>
          {pageIdeas.map((idea) => (
            <Button
              key={idea.label}
              disabled={!activePage}
              onClick={() =>
                activePage &&
                grow({
                  kind: 'fragment',
                  sourcePageKey: activePage.dashboardKey,
                  selection: idea.prompt,
                })
              }
              sx={optionButtonSx}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ width: '100%' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {idea.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', lineHeight: 1.4 }}
                  >
                    {idea.prompt}
                  </Typography>
                </Box>
                {cost}
              </Stack>
            </Button>
          ))}
        </>
      ) : null}

      <Divider textAlign="left">
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {t('workspace.addPagePrompt')}
        </Typography>
      </Divider>
      <TextField
        size="small"
        fullWidth
        multiline
        minRows={2}
        value={prompt}
        placeholder={t('workspace.addPagePromptPlaceholder')}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <Button
        variant="contained"
        disabled={!prompt.trim()}
        onClick={() => grow({ kind: 'prompt', prompt: prompt.trim() })}
        sx={{ textTransform: 'none', fontWeight: 700 }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <span>{t('workspace.addPagePromptSubmit')}</span>
          {cost}
        </Stack>
      </Button>
    </Stack>
  )

  if (mobile) {
    return (
      <Drawer anchor="bottom" open={open} onClose={onClose}>
        {content}
      </Drawer>
    )
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      {content}
    </Popover>
  )
}

export default StudyGuideAddPageMenu
