import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

import {
  countExplanationWords,
  EXPLAIN_MAX_WORDS,
  EXPLAIN_MIN_WORDS,
  gradeGuideExplanation,
  resolveExplainCheckCost,
  type ExplainCheckResult,
} from '../../studyGuides/explainCheck'
import { hasFreeExplainAttempt } from '../../studyGuides/mastery'
import { readQuickCreateAiSettings } from '../../quickCreate/ai/settings'
import { readContentLanguageSettings } from '../../language/contentLanguage'
import { useInterfaceText } from '../../language/interfaceLanguage'

interface ExplainItYourWayPanelProps {
  studyGuideId: string
  topic: string
  /** Guide text the grader marks the explanation against. */
  sourceText: string
  /** Called once the explanation is accepted, before the learner claims it. */
  onPassed: () => void
  /** Adds the topic to the learner's declared knowledge. */
  onAddSkill: () => void
}

const ExplainItYourWayPanel: React.FC<ExplainItYourWayPanelProps> = ({
  studyGuideId,
  topic,
  sourceText,
  onPassed,
  onAddSkill,
}) => {
  const { t } = useInterfaceText()
  const theme = useTheme()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [explanation, setExplanation] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ExplainCheckResult | null>(null)
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
    const seed = topic ? `${topic} ` : ''
    setExplanation(seed)
    setChecking(false)
    setError('')
    setResult(null)
    setClaimed(false)

    const frame = requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(seed.length, seed.length)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [studyGuideId, topic])

  const words = countExplanationWords(explanation)
  const tooShort = words < EXPLAIN_MIN_WORDS
  const tooLong = words > EXPLAIN_MAX_WORDS
  // Reading the ledger directly on every render (instead of memoizing) is what
  // keeps this caption honest right after a run spends the free attempt.
  const cost = resolveExplainCheckCost(
    readQuickCreateAiSettings().provider || 'hosted',
    hasFreeExplainAttempt(studyGuideId),
  )

  const submitExplanation = async () => {
    if (checking || tooShort || tooLong) {
      return
    }

    setChecking(true)
    setError('')
    try {
      const run = await gradeGuideExplanation({
        studyGuideId,
        topic,
        source: sourceText,
        explanation,
        outputLanguage: readContentLanguageSettings().interfaceLanguage,
      })
      setResult(run)
      if (run.passed) {
        onPassed()
      }
    } catch (checkError) {
      setError(
        checkError instanceof Error
          ? checkError.message
          : t('explainCheck.failed'),
      )
    } finally {
      setChecking(false)
    }
  }

  const claimSkill = () => {
    onAddSkill()
    setClaimed(true)
  }

  return (
    <Stack
      spacing={2}
      sx={{
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {t('explainCheck.prompt')}{' '}
        <Box component="span" sx={{ fontWeight: 700 }}>
          {topic}
        </Box>
        ?
      </Typography>
      <TextField
        autoFocus
        multiline
        minRows={4}
        fullWidth
        value={explanation}
        disabled={checking || Boolean(result?.passed)}
        onChange={(event) => setExplanation(event.target.value)}
        inputRef={textareaRef}
        inputProps={{ 'aria-label': t('explainCheck.title') }}
        helperText={`${words} / ${EXPLAIN_MAX_WORDS} ${t(
          'explainCheck.words',
        )}${
          tooShort
            ? ` — ${t('explainCheck.minimum')} ${EXPLAIN_MIN_WORDS}`
            : tooLong
              ? ` — ${t('explainCheck.tooLong')}`
              : ''
        }`}
        error={tooLong}
      />
      <Typography variant="caption" color="text.secondary">
        {cost === 'free'
          ? t('explainCheck.freeAttempt')
          : t('explainCheck.paidAttempt')}
      </Typography>
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {result ? (
        <Stack
          spacing={1.5}
          sx={{
            p: 2,
            borderRadius: 2,
            border: 1,
            borderColor: alpha(
              result.passed
                ? theme.palette.success.main
                : theme.palette.warning.main,
              0.4,
            ),
            bgcolor: alpha(
              result.passed
                ? theme.palette.success.main
                : theme.palette.warning.main,
              0.08,
            ),
          }}
        >
          <Chip
            size="small"
            color={result.passed ? 'success' : 'warning'}
            label={
              result.passed ? t('explainCheck.passed') : t('explainCheck.retry')
            }
            sx={{ alignSelf: 'flex-start', fontWeight: 700 }}
          />
          {result.feedback ? (
            <Typography variant="body2">{result.feedback}</Typography>
          ) : null}
          {result.corrections.map((correction) => (
            <Box key={`${correction.quote}-${correction.better}`}>
              <Typography
                variant="body2"
                sx={{ textDecoration: 'line-through' }}
                color="text.secondary"
              >
                {correction.quote}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {correction.better}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : null}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        {result?.passed ? (
          <Button
            variant="contained"
            onClick={claimSkill}
            disabled={claimed}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {claimed ? t('explainCheck.added') : t('mastery.addSkill')}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={submitExplanation}
            disabled={checking || tooShort || tooLong}
            startIcon={
              checking ? <CircularProgress size={16} color="inherit" /> : null
            }
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {checking ? t('explainCheck.checking') : t('explainCheck.submit')}
          </Button>
        )}
      </Box>
    </Stack>
  )
}

export default ExplainItYourWayPanel
