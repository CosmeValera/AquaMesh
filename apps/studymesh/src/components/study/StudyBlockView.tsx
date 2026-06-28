import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import {
  OPEN_STUDY_GUIDE_PAGE_LINK_EVENT,
  readStudyGuidePageHref,
} from '../../studyGuides/pageLinks'
import { stripDuplicateStudyGuideMarkdownTitle } from '../../studyGuides/pages'
import { ASK_DASHBOARD_CHAT_EVENT } from '../workspace/workspaceEvents'
import StudyCreditIcon from '../hostedAi/StudyCreditIcon'
interface StudyBlockViewProps {
  type: string
  props: Record<string, unknown>
  unframed?: boolean
  onAskAi?: (question: string) => void
}

interface QuizFeedbackItem {
  option: string
  explanation: string
}

const STUDY_BLOCK_TYPES = [
  'FlashcardBlock',
  'QuizBlock',
  'QuizzSingle',
  'RevealBlock',
  'StudyNoteBlock',
  'CodeBlock',
  'DefinitionBlock',
  'ComparisonBlock',
  'ListBlock',
  'SequenceBlock',
  'ReviewPromptBlock',
  'MarkdownBlock',
  'FlashcardCarouselBlock',
  'QuizCarouselBlock',
  'FocusedFlashcardSessionBlock',
  'FocusedQuizSessionBlock',
]

export const isStudyBlockType = (type: string) =>
  STUDY_BLOCK_TYPES.includes(type)

const normalizeAnswer = (value: string) => value.trim().toLowerCase()

const hashValue = (value: string): string => {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(36)
}

const toFocusedItems = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object',
      )
    : []

const normalizeFeedbackKey = (value: string): string =>
  normalizeAnswer(value).replace(/\s+/g, ' ')

const toOptionFeedback = (value: unknown): QuizFeedbackItem[] =>
  Array.isArray(value)
    ? value
        .map((item): QuizFeedbackItem | null => {
          if (!item || typeof item !== 'object') {
            return null
          }

          const record = item as Record<string, unknown>
          const option = String(record.option || '').trim()
          const explanation = String(record.explanation || '').trim()

          return option && explanation ? { option, explanation } : null
        })
        .filter((item): item is QuizFeedbackItem => Boolean(item))
    : []

const feedbackForOption = (
  feedback: QuizFeedbackItem[],
  option: string,
): string =>
  feedback.find(
    (item) =>
      normalizeFeedbackKey(item.option) === normalizeFeedbackKey(option),
  )?.explanation || ''

const stripFeedbackVerdict = (value: string): string =>
  value
    .replace(/^\s*(?:correct|incorrect|right|wrong)\s*(?:[-–—:]\s*)?/i, '')
    .trim()

const buildQuizExplainPrompt = ({
  question,
  selectedAnswer,
  correctAnswer,
  wasCorrect,
}: {
  question: string
  selectedAnswer: string
  correctAnswer: string
  wasCorrect: boolean
}): string =>
  wasCorrect
    ? `I am taking a quiz on this material and was given this question: '${question}'\n\nI chose this as the answer: '${selectedAnswer}'\n\nThat answer was correct. Help me understand why this answer was correct.`
    : `I am taking a quiz on this material and was given this question: '${question}'\n\nI chose this as the answer: '${selectedAnswer}'\n\nThat answer was incorrect. The correct answer is '${correctAnswer}'\n\nHelp me understand why my answer was incorrect.`

const explainButtonLabel = (
  <Stack
    component="span"
    direction="row"
    spacing={0.5}
    alignItems="center"
    sx={{ display: 'inline-flex' }}
  >
    <span>Explain (1</span>
    <StudyCreditIcon size={14} />
    <span>)</span>
  </Stack>
)

const readStoredMode = (key: string): string => {
  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

const writeStoredMode = (key: string, value: string): void => {
  try {
    if (value) {
      window.localStorage.setItem(key, value)
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Local storage is a convenience only. Ignore private-mode failures.
  }
}

const createFlashcardParts = (
  title: string,
  text: string,
): { front: string; back: string } => {
  const definitionMatch = text.match(/^(.+?)\s*(?:=|:|\bis\b)\s*(.+)$/i)

  if (definitionMatch) {
    return {
      front: definitionMatch[1].trim(),
      back: definitionMatch[2].trim(),
    }
  }

  return {
    front: title,
    back: text,
  }
}

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item))
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

const toFourOptions = (value: unknown): string[] => {
  const options = toStringArray(value).slice(0, 4)

  while (options.length < 4) {
    options.push(`Option ${String.fromCharCode(65 + options.length)}`)
  }

  return options
}

const toRows = (value: unknown): string[][] =>
  Array.isArray(value)
    ? value.map((row) => (Array.isArray(row) ? row.map(String) : [String(row)]))
    : []

const isMarkdownTableDivider = (line: string): boolean =>
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)

const isMarkdownThematicBreak = (line: string): boolean =>
  /^(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line.trim())

const splitMarkdownTableRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

const isSafeMarkdownHref = (href: string): boolean => {
  const trimmed = href.trim()
  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)
  if (!schemeMatch) {
    return Boolean(trimmed)
  }

  return (
    ['http', 'https', 'mailto', 'tel'].includes(schemeMatch[1].toLowerCase()) ||
    trimmed.startsWith('studymesh-page:')
  )
}

const openStudyGuidePageLink = (href: string): boolean => {
  const detail = readStudyGuidePageHref(href)
  if (!detail) {
    return false
  }

  window.dispatchEvent(
    new CustomEvent(OPEN_STUDY_GUIDE_PAGE_LINK_EVENT, { detail }),
  )
  return true
}

interface RenderMarkdownOptions {
  renderCitation?: (citationNumber: number, key: string) => React.ReactNode
}

const wholeCitationGroupPattern = /^(?:\[\d{1,2}\]|\d{1,2}|\s+)+$/

const citationNumbersFromMatch = (
  citationMatch: RegExpMatchArray,
): number[] => {
  if (citationMatch[1]) {
    return [Number(citationMatch[1])]
  }

  return citationMatch[2].split('').map((digit) => Number(digit))
}

const renderMarkdownInline = (
  value: string,
  options: RenderMarkdownOptions = {},
): React.ReactNode[] => {
  const nodes: React.ReactNode[] = []
  const tokenPattern =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|(?:\[\d{1,2}\]|(?:(?<=[\u00a0\u202f])\d{1,2}(?:\s+\d{1,2})*|\d{1,2}(?=\s*\[\d{1,2}\]))(?=\s*(?:\[\d{1,2}\]|[.,;:!?)]|$)))+|\*[^*]+\*)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(value)) !== null) {
    if (match.index > cursor) {
      nodes.push(value.slice(cursor, match.index))
    }

    const token = match[0]
    const key = `${token}-${match.index}`
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    const citationMatches = [...token.matchAll(/\[(\d{1,2})\]|(\d{1,2})/g)]

    if (citationMatches.length > 0 && wholeCitationGroupPattern.test(token)) {
      citationMatches.forEach((citationMatch, citationIndex) => {
        citationNumbersFromMatch(citationMatch).forEach(
          (citationNumber, digitIndex) => {
            nodes.push(
              options.renderCitation
                ? options.renderCitation(
                    citationNumber,
                    `${key}-${citationIndex}-${digitIndex}`,
                  )
                : `[${citationNumber}]`,
            )
          },
        )
      })
    } else if (linkMatch && isSafeMarkdownHref(linkMatch[2])) {
      const href = linkMatch[2]
      const linkLabel = linkMatch[1]
      const studyGuidePageLink = readStudyGuidePageHref(href)
      const studyGuideCitationLink =
        Boolean(studyGuidePageLink) && /^\d{1,2}$/.test(linkLabel.trim())
      nodes.push(
        <Link
          key={key}
          href={href}
          data-link-kind={
            studyGuideCitationLink
              ? 'study-guide-citation'
              : studyGuidePageLink
                ? 'study-guide-page'
                : undefined
          }
          target={studyGuidePageLink ? undefined : '_blank'}
          rel={studyGuidePageLink ? undefined : 'noreferrer'}
          onClick={(event) => {
            if (openStudyGuidePageLink(href)) {
              event.preventDefault()
            }
          }}
          sx={
            studyGuideCitationLink
              ? (theme) => ({
                  mx: 0.25,
                  minWidth: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: 1,
                  borderColor: alpha(theme.palette.primary.main, 0.35),
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  lineHeight: '20px',
                  textDecoration: 'none',
                  verticalAlign: 'baseline',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.16),
                    borderColor: alpha(theme.palette.primary.main, 0.55),
                    textDecoration: 'none',
                  },
                })
              : studyGuidePageLink
                ? (theme) => ({
                    px: 0.75,
                    py: 0.1,
                    borderRadius: 999,
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.32),
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                    fontWeight: 700,
                    textDecoration: 'none',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.15),
                      textDecoration: 'none',
                    },
                  })
                : undefined
          }
        >
          {linkLabel}
        </Link>,
      )
    } else if (linkMatch) {
      nodes.push(linkMatch[1])
    } else if (token.startsWith('**')) {
      nodes.push(
        <Box component="strong" key={key}>
          {token.slice(2, -2)}
        </Box>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <Box
          component="code"
          key={key}
          sx={{
            px: 0.5,
            py: 0.1,
            borderRadius: 0.75,
            bgcolor: 'action.hover',
            fontFamily: 'JetBrains Mono, Consolas, monospace',
            fontSize: '0.9em',
          }}
        >
          {token.slice(1, -1)}
        </Box>,
      )
    } else {
      nodes.push(
        <Box component="em" key={key}>
          {token.slice(1, -1)}
        </Box>,
      )
    }

    cursor = match.index + token.length
  }

  if (cursor < value.length) {
    nodes.push(value.slice(cursor))
  }

  return nodes
}

export const renderMarkdown = (
  markdown: string,
  options: RenderMarkdownOptions = {},
): React.ReactNode[] => {
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (isMarkdownThematicBreak(trimmed)) {
      blocks.push(
        <Box
          key={`hr-${index}`}
          component="hr"
          sx={{
            width: '100%',
            border: 0,
            borderTop: 1,
            borderColor: 'divider',
            my: 1,
          }}
        />,
      )
      index += 1
      continue
    }

    const fenceMatch = trimmed.match(/^```([\w-]*)\s*$/)
    if (fenceMatch) {
      const codeLines: string[] = []
      const language = fenceMatch[1]
      index += 1

      while (index < lines.length && !lines[index].trim().match(/^```\s*$/)) {
        codeLines.push(lines[index])
        index += 1
      }

      if (index < lines.length) {
        index += 1
      }

      blocks.push(
        <Paper
          key={`code-${index}`}
          variant="outlined"
          sx={{ overflow: 'hidden', bgcolor: '#111827' }}
        >
          {language && (
            <Box
              sx={{ px: 2, py: 0.75, color: '#cbd5e1', fontSize: '0.75rem' }}
            >
              {language}
            </Box>
          )}
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              overflowX: 'auto',
              color: '#f9fafb',
              fontFamily: 'JetBrains Mono, Consolas, monospace',
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              whiteSpace: 'pre',
            }}
          >
            <Box component="code">{codeLines.join('\n')}</Box>
          </Box>
        </Paper>,
      )
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      blocks.push(
        <Typography
          key={`heading-${index}`}
          variant={level <= 1 ? 'h5' : level === 2 ? 'h6' : 'subtitle1'}
          fontWeight={600}
          sx={{ mt: blocks.length === 0 ? 0 : 1.5 }}
        >
          {renderMarkdownInline(headingMatch[2], options)}
        </Typography>,
      )
      index += 1
      continue
    }

    if (
      line.includes('|') &&
      lines[index + 1] &&
      isMarkdownTableDivider(lines[index + 1])
    ) {
      const headers = splitMarkdownTableRow(line)
      const rows: string[][] = []
      index += 2

      while (index < lines.length && lines[index].includes('|')) {
        rows.push(splitMarkdownTableRow(lines[index]))
        index += 1
      }

      blocks.push(
        <TableContainer
          key={`table-${index}`}
          component={Paper}
          variant="outlined"
          sx={{ overflowX: 'auto' }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                {headers.map((header, headerIndex) => (
                  <TableCell
                    key={`${header}-${headerIndex}`}
                    sx={{ fontWeight: 700 }}
                  >
                    {renderMarkdownInline(header, options)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={`markdown-table-row-${rowIndex}`}>
                  {headers.map((_header, cellIndex) => (
                    <TableCell
                      key={`markdown-table-cell-${rowIndex}-${cellIndex}`}
                    >
                      {renderMarkdownInline(row[cellIndex] || '', options)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>,
      )
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(\[[ xX]\]\s+)?(.+)$/)
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch)
      const listItems: Array<{ text: string; checked?: boolean }> = []

      while (index < lines.length) {
        const itemTrimmed = lines[index].trim()
        const unorderedItem = itemTrimmed.match(/^[-*]\s+(\[[ xX]\]\s+)?(.+)$/)
        const orderedItem = itemTrimmed.match(/^\d+[.)]\s+(.+)$/)

        if ((ordered && !orderedItem) || (!ordered && !unorderedItem)) {
          break
        }

        const checkbox = unorderedItem?.[1]
        listItems.push({
          text: (unorderedItem?.[2] || orderedItem?.[1] || '').trim(),
          checked: checkbox ? /\[[xX]\]/.test(checkbox) : undefined,
        })
        index += 1
      }

      blocks.push(
        <Box
          key={`list-${index}`}
          component={ordered ? 'ol' : 'ul'}
          sx={{
            pl: listItems.some((item) => item.checked !== undefined) ? 0 : 3,
            my: 0,
          }}
        >
          {listItems.map((item, itemIndex) => (
            <Typography
              component="li"
              variant="body2"
              key={`${item.text}-${itemIndex}`}
              sx={{
                mb: 0.5,
                display: item.checked === undefined ? 'list-item' : 'flex',
                alignItems: 'center',
                listStyle: item.checked === undefined ? undefined : 'none',
              }}
            >
              {item.checked !== undefined && (
                <Checkbox
                  size="small"
                  checked={item.checked}
                  readOnly
                  sx={{ p: 0.25, mr: 0.5 }}
                />
              )}
              {renderMarkdownInline(item.text, options)}
            </Typography>
          ))}
        </Box>,
      )
      continue
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []

      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }

      blocks.push(
        <Box
          key={`quote-${index}`}
          sx={{
            borderLeft: 3,
            borderColor: 'divider',
            pl: 2,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">
            {renderMarkdownInline(quoteLines.join(' '), options)}
          </Typography>
        </Box>,
      )
      continue
    }

    const paragraphLines = [trimmed]
    index += 1

    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6}\s+|```|[-*]\s+|\d+[.)]\s+|>)/.test(lines[index].trim()) &&
      !isMarkdownThematicBreak(lines[index].trim()) &&
      !(
        lines[index].includes('|') &&
        lines[index + 1] &&
        isMarkdownTableDivider(lines[index + 1])
      )
    ) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }

    blocks.push(
      <Typography
        key={`paragraph-${index}`}
        variant="body2"
        sx={{ lineHeight: 1.7 }}
      >
        {renderMarkdownInline(paragraphLines.join(' '), options)}
      </Typography>,
    )
  }

  return blocks
}

const StudyBlockView: React.FC<StudyBlockViewProps> = ({
  type,
  props,
  unframed = false,
  onAskAi,
}) => {
  const [flipped, setFlipped] = useState(false)
  const [selfGrade, setSelfGrade] = useState<'known' | 'missed' | ''>('')
  const [revealed, setRevealed] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [focusedCardIndex, setFocusedCardIndex] = useState(0)
  const [focusedQuestionIndex, setFocusedQuestionIndex] = useState(0)
  const [focusedQuizAnswers, setFocusedQuizAnswers] = useState<
    Record<number, number>
  >({})
  const [quizResultsOpen, setQuizResultsOpen] = useState(false)
  const [focusedFlashcardGrades, setFocusedFlashcardGrades] = useState<
    Record<number, 'known' | 'missed'>
  >({})
  const [shortAnswer, setShortAnswer] = useState('')
  const [quizHintOpen, setQuizHintOpen] = useState(false)
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({})
  const [definitionStudy, setDefinitionStudy] = useState(false)
  const [reviewStatus, setReviewStatus] = useState(
    String(props.status || 'needsReview'),
  )

  useEffect(() => {
    setQuizHintOpen(false)
  }, [focusedQuestionIndex, selectedIndex, type])

  const askAi = (content: string) => {
    if (onAskAi) {
      onAskAi(content)
      return
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ASK_DASHBOARD_CHAT_EVENT, {
          detail: { content },
        }),
      )
    }
  }

  const noteStorageKey = `studymesh-study-note-mode-${hashValue(
    `${String(props.title || '')}:${String(props.text || '')}`,
  )}`
  const [noteMode, setNoteMode] = useState(() => readStoredMode(noteStorageKey))
  const options = useMemo(() => toFourOptions(props.options), [props.options])
  const steps = useMemo(
    () => toStringArray(props.steps || props.items),
    [props.steps, props.items],
  )
  const columns = useMemo(() => toStringArray(props.columns), [props.columns])
  const rows = useMemo(() => toRows(props.rows), [props.rows])

  if (type === 'FlashcardBlock') {
    const front = String(props.front || 'Question')
    const back = String(props.back || 'Answer')
    const hint = String(props.hint || '')
    const tag = String(props.tag || '')
    const registerFlashcardGrade = (grade: 'known' | 'missed') => {
      setSelfGrade(grade)
    }

    return (
      <Paper
        variant="outlined"
        sx={{ p: 2, mb: 2, cursor: 'pointer' }}
        onClick={() => setFlipped((current) => !current)}
      >
        <Stack spacing={1.25}>
          {tag && (
            <Chip label={tag} size="small" sx={{ alignSelf: 'flex-start' }} />
          )}
          <Typography variant="caption" color="text.secondary">
            {flipped ? 'Answer' : 'Prompt'}
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {flipped ? back : front}
          </Typography>
          {!flipped && hint && (
            <Typography variant="body2" color="text.secondary">
              Hint: {hint}
            </Typography>
          )}
          {flipped && Boolean(props.selfGrade) && (
            <Stack
              direction="row"
              spacing={1}
              onClick={(event) => event.stopPropagation()}
            >
              <Button
                size="small"
                variant={selfGrade === 'known' ? 'contained' : 'outlined'}
                color="success"
                onClick={() => registerFlashcardGrade('known')}
                sx={(theme) => ({
                  '&:hover': {
                    bgcolor:
                      selfGrade === 'known'
                        ? 'success.dark'
                        : alpha(theme.palette.success.main, 0.18),
                  },
                })}
              >
                I knew it
              </Button>
              <Button
                size="small"
                variant={selfGrade === 'missed' ? 'contained' : 'outlined'}
                color="error"
                onClick={() => registerFlashcardGrade('missed')}
                sx={(theme) => ({
                  '&:hover': {
                    bgcolor:
                      selfGrade === 'missed'
                        ? 'error.dark'
                        : alpha(theme.palette.error.main, 0.18),
                  },
                })}
              >
                I didn&apos;t know it
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    )
  }

  if (
    type === 'FlashcardCarouselBlock' ||
    type === 'FocusedFlashcardSessionBlock'
  ) {
    const title = String(props.title || 'Flashcards')
    const cards = toFocusedItems(props.items)
      .map((item) => ({
        front: String(item.question || item.prompt || item.title || ''),
        back: String(item.answer || item.hiddenText || ''),
        tag: String(item.title || ''),
      }))
      .filter((item) => item.front && item.back)
    const safeIndex = Math.min(focusedCardIndex, Math.max(0, cards.length - 1))
    const card = cards[safeIndex]
    const answered = Object.keys(focusedFlashcardGrades).length
    const known = Object.values(focusedFlashcardGrades).filter(
      (grade) => grade === 'known',
    ).length
    const missed = Object.values(focusedFlashcardGrades).filter(
      (grade) => grade === 'missed',
    ).length
    const gradeCard = (grade: 'known' | 'missed') => {
      setFocusedFlashcardGrades((current) => ({
        ...current,
        [safeIndex]: grade,
      }))
    }

    if (!card) {
      return (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700}>
            No flashcards available.
          </Typography>
        </Paper>
      )
    }

    return (
      <Box
        sx={{
          minHeight: { xs: 'calc(100dvh - 180px)', md: 'calc(100vh - 190px)' },
          display: 'grid',
          placeItems: 'center',
          px: { xs: 1, md: 3 },
          py: { xs: 2, md: 4 },
        }}
      >
        <Stack spacing={2.5} sx={{ width: 'min(760px, 100%)' }}>
          <Stack direction="row" justifyContent="space-between" gap={2}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" fontWeight={600}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {safeIndex + 1} / {cards.length}
              </Typography>
            </Box>
            <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="end">
              <Chip label={`Answered ${answered}/${cards.length}`} />
              <Chip color="success" label={`Known ${known}`} />
              <Chip color="error" label={`Missed ${missed}`} />
              {card.tag && <Chip label={card.tag} />}
            </Stack>
          </Stack>
          <Paper
            variant="outlined"
            onClick={() => setFlipped((current) => !current)}
            sx={{
              minHeight: { xs: 300, sm: 360 },
              p: { xs: 3, sm: 5 },
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              textAlign: 'center',
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={2} alignItems="center">
              <Typography variant="overline" color="text.secondary">
                {flipped ? 'Answer' : 'Prompt'}
              </Typography>
              <Typography
                variant="h5"
                sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.35 }}
              >
                {flipped ? card.back : card.front}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click card to flip
              </Typography>
            </Stack>
          </Paper>
          <Stack direction="row" spacing={1.25} justifyContent="center">
            <Button
              variant={
                focusedFlashcardGrades[safeIndex] === 'known'
                  ? 'contained'
                  : 'outlined'
              }
              color="success"
              onClick={() => gradeCard('known')}
              sx={(theme) => ({
                '&:hover': {
                  bgcolor:
                    focusedFlashcardGrades[safeIndex] === 'known'
                      ? 'success.dark'
                      : alpha(theme.palette.success.main, 0.18),
                },
              })}
            >
              Known
            </Button>
            <Button
              variant={
                focusedFlashcardGrades[safeIndex] === 'missed'
                  ? 'contained'
                  : 'outlined'
              }
              color="error"
              onClick={() => gradeCard('missed')}
              sx={(theme) => ({
                '&:hover': {
                  bgcolor:
                    focusedFlashcardGrades[safeIndex] === 'missed'
                      ? 'error.dark'
                      : alpha(theme.palette.error.main, 0.18),
                },
              })}
            >
              Missed
            </Button>
          </Stack>
          <Stack direction="row" spacing={1.25} justifyContent="center">
            <Button
              variant="outlined"
              disabled={safeIndex === 0}
              onClick={() => {
                setFocusedCardIndex((current) => Math.max(0, current - 1))
                setFlipped(false)
              }}
            >
              Previous
            </Button>
            <Button
              variant="contained"
              disabled={safeIndex >= cards.length - 1}
              onClick={() => {
                setFocusedCardIndex((current) =>
                  Math.min(cards.length - 1, current + 1),
                )
                setFlipped(false)
              }}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      </Box>
    )
  }

  if (type === 'QuizBlock') {
    const question = String(props.question || 'Question')
    const correctIndex = Math.max(
      0,
      Math.min(3, Number(props.correctIndex || 0)),
    )
    const explanation = String(props.explanation || '')
    const hint = String(props.hint || '')
    const optionFeedback = toOptionFeedback(props.optionFeedback)
    const selectedAnswer =
      selectedIndex !== null ? options[selectedIndex] || '' : ''
    const correctAnswer = options[correctIndex] || String(props.answer || '')
    const wasCorrect = selectedIndex === correctIndex

    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" fontWeight={700}>
            {question}
          </Typography>
          <Stack spacing={1}>
            {options.map((option, index) => {
              const isSelected = selectedIndex === index
              const isCorrect = index === correctIndex
              const showResult = selectedIndex !== null
              const resultColor = isCorrect
                ? 'success.main'
                : isSelected
                  ? 'error.main'
                  : 'divider'

              const feedback = stripFeedbackVerdict(
                feedbackForOption(optionFeedback, option),
              )

              return (
                <Box key={`${option}-${index}`}>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => setSelectedIndex(index)}
                    sx={(theme) => {
                      const stateMain = isCorrect
                        ? theme.palette.success.main
                        : theme.palette.error.main

                      return {
                        justifyContent: 'flex-start',
                        color: 'text.primary',
                        borderColor: showResult ? resultColor : 'divider',
                        bgcolor:
                          showResult && (isCorrect || isSelected)
                            ? alpha(stateMain, 0.12)
                            : 'transparent',
                        '&:hover': {
                          borderColor: showResult
                            ? resultColor
                            : 'primary.main',
                          bgcolor:
                            showResult && (isCorrect || isSelected)
                              ? alpha(stateMain, 0.18)
                              : 'action.hover',
                        },
                      }
                    }}
                  >
                    {option}
                  </Button>
                  {showResult && feedback ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ px: 1, pt: 0.75 }}
                    >
                      {feedback}
                    </Typography>
                  ) : null}
                </Box>
              )
            })}
          </Stack>
          {selectedIndex === null && hint ? (
            <Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<HelpOutlineIcon fontSize="small" />}
                onClick={() => setQuizHintOpen((current) => !current)}
              >
                Hint
              </Button>
              {quizHintOpen ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  {hint}
                </Typography>
              ) : null}
            </Box>
          ) : null}
          {selectedIndex !== null && explanation && (
            <Typography variant="body2" color="text.secondary">
              {explanation}
            </Typography>
          )}
          {selectedIndex !== null ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ChatBubbleOutlineIcon fontSize="small" />}
              onClick={() =>
                askAi(
                  buildQuizExplainPrompt({
                    question,
                    selectedAnswer,
                    correctAnswer,
                    wasCorrect,
                  }),
                )
              }
              sx={{ alignSelf: 'flex-start' }}
            >
              {explainButtonLabel}
            </Button>
          ) : null}
        </Stack>
      </Paper>
    )
  }

  if (type === 'QuizCarouselBlock' || type === 'FocusedQuizSessionBlock') {
    const title = String(props.title || 'Quiz')
    const questions = toFocusedItems(props.items)
      .map((item) => {
        const options = Array.isArray(item.options)
          ? item.options.map((option) => String(option)).filter(Boolean)
          : []
        const correctIndex = Math.max(
          0,
          Math.min(options.length - 1, Number(item.correctIndex || 0)),
        )
        const answer = String(item.answer || options[correctIndex] || '')

        return {
          question: String(item.question || item.title || ''),
          options,
          correctIndex,
          answer,
          explanation: String(item.explanation || ''),
          hint: String(item.hint || ''),
          optionFeedback: toOptionFeedback(item.optionFeedback),
          quizMode: 'multipleChoice' as const,
        }
      })
      .filter((item) => item.question && item.options.length >= 2)
    const safeIndex = Math.min(
      focusedQuestionIndex,
      Math.max(0, questions.length - 1),
    )
    const question = questions[safeIndex]

    if (!question) {
      return (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700}>
            No quiz questions available.
          </Typography>
        </Paper>
      )
    }

    const selected = focusedQuizAnswers[safeIndex]
    const hasMultipleChoiceAnswer = selected !== undefined
    const hasAnswered = hasMultipleChoiceAnswer
    const selectedAnswer =
      selected !== undefined ? question.options[selected] || '' : ''
    const correctAnswer =
      question.options[question.correctIndex] || question.answer
    const wasCorrect = selected === question.correctIndex
    const answered = questions.reduce((total, _item, index) => {
      return focusedQuizAnswers[index] !== undefined ? total + 1 : total
    }, 0)
    const correct = questions.reduce((total, item, index) => {
      return focusedQuizAnswers[index] === item.correctIndex ? total + 1 : total
    }, 0)
    const wrong = answered - correct
    const skipped = questions.length - answered
    const scorePercent =
      questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0
    const correctDegrees =
      questions.length > 0 ? (correct / questions.length) * 360 : 0
    const wrongDegrees =
      questions.length > 0 ? (wrong / questions.length) * 360 : 0
    const resultRows = [
      { label: 'Right', value: correct, color: 'success.main' },
      { label: 'Wrong', value: wrong, color: 'error.main' },
      { label: 'Skipped', value: skipped, color: 'text.primary' },
    ]

    if (quizResultsOpen) {
      return (
        <Box
          sx={{
            minHeight: {
              xs: 'calc(100dvh - 180px)',
              md: 'calc(100vh - 190px)',
            },
            display: 'grid',
            placeItems: 'center',
            px: { xs: 1, md: 3 },
            py: { xs: 2, md: 4 },
          }}
        >
          <Stack spacing={2.5} sx={{ width: 'min(820px, 100%)' }}>
            <Typography variant="h4" fontWeight={700}>
              You did it! Quiz complete.
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2.5, sm: 4 },
                borderRadius: 2,
                bgcolor: 'background.paper',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 3, sm: 6 }}
                alignItems="center"
                justifyContent="space-around"
              >
                <Box
                  sx={(theme) => ({
                    width: 184,
                    height: 184,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: `conic-gradient(${theme.palette.success.main} 0deg ${correctDegrees}deg, ${theme.palette.error.main} ${correctDegrees}deg ${correctDegrees + wrongDegrees}deg, ${theme.palette.action.selected} ${correctDegrees + wrongDegrees}deg 360deg)`,
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 18,
                      borderRadius: '50%',
                      bgcolor: 'background.paper',
                    },
                  })}
                >
                  <Box sx={{ position: 'relative', textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={800}>
                      {correct}/{questions.length}
                    </Typography>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      fontWeight={700}
                    >
                      {scorePercent}%
                    </Typography>
                  </Box>
                </Box>
                <Stack spacing={1.25} sx={{ minWidth: 180 }}>
                  {resultRows.map(({ label, value, color }) => (
                    <Stack
                      key={label}
                      direction="row"
                      justifyContent="space-between"
                      spacing={4}
                    >
                      <Typography variant="h6" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography variant="h6" color={color} fontWeight={800}>
                        {value}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Paper>
            <Stack direction="row" spacing={1.25} justifyContent="center">
              <Button
                variant="outlined"
                onClick={() => {
                  setFocusedQuestionIndex(questions.length - 1)
                  setQuizResultsOpen(false)
                }}
              >
                Previous
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  setFocusedQuizAnswers({})
                  setFocusedQuestionIndex(0)
                  setQuizHintOpen(false)
                  setQuizResultsOpen(false)
                }}
              >
                Retake quiz
              </Button>
            </Stack>
          </Stack>
        </Box>
      )
    }

    return (
      <Box
        sx={{
          minHeight: { xs: 'calc(100dvh - 180px)', md: 'calc(100vh - 190px)' },
          display: 'grid',
          placeItems: 'center',
          px: { xs: 1, md: 3 },
          py: { xs: 2, md: 4 },
        }}
      >
        <Stack spacing={2.5} sx={{ width: 'min(820px, 100%)' }}>
          <Stack direction="row" justifyContent="space-between" gap={2}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" fontWeight={600}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {safeIndex + 1} / {questions.length}
              </Typography>
            </Box>
            <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="end">
              <Chip label={`Answered ${answered}/${questions.length}`} />
              <Chip color="success" label={`Correct ${correct}`} />
              <Chip color="error" label={`Wrong ${wrong}`} />
            </Stack>
          </Stack>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2.25, sm: 4 },
              borderRadius: 2,
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={2.25}>
              <Typography variant="h5" sx={{ lineHeight: 1.35 }}>
                {question.question}
              </Typography>
              <Stack spacing={1.25}>
                {question.options.map((option, index) => {
                  const isCorrect = index === question.correctIndex
                  const isSelected = selected === index

                  const feedback = stripFeedbackVerdict(
                    feedbackForOption(question.optionFeedback, option),
                  )

                  return (
                    <Box key={`${option}-${index}`}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          if (hasAnswered) {
                            return
                          }

                          setFocusedQuizAnswers((current) => ({
                            ...current,
                            [safeIndex]: index,
                          }))
                        }}
                        sx={(theme) => {
                          const stateMain = isCorrect
                            ? theme.palette.success.main
                            : theme.palette.error.main
                          const resultBorder = isCorrect
                            ? 'success.main'
                            : isSelected
                              ? 'error.main'
                              : 'divider'

                          return {
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            minHeight: 52,
                            whiteSpace: 'normal',
                            color: 'text.primary',
                            borderColor: hasAnswered ? resultBorder : 'divider',
                            cursor: hasAnswered ? 'default' : 'pointer',
                            bgcolor:
                              hasAnswered && (isCorrect || isSelected)
                                ? alpha(stateMain, 0.12)
                                : 'transparent',
                            '&:hover': {
                              borderColor: hasAnswered
                                ? resultBorder
                                : 'primary.main',
                              bgcolor:
                                hasAnswered && (isCorrect || isSelected)
                                  ? alpha(stateMain, 0.18)
                                  : 'action.hover',
                            },
                          }
                        }}
                      >
                        {option}
                      </Button>
                      {hasAnswered && feedback ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ px: 1, pt: 0.75 }}
                        >
                          {feedback}
                        </Typography>
                      ) : null}
                    </Box>
                  )
                })}
              </Stack>
              {hasAnswered && (
                <Typography variant="body2" color="text.secondary">
                  {question.explanation || `Correct answer: ${question.answer}`}
                </Typography>
              )}
            </Stack>
          </Paper>
          {!hasAnswered && question.hint && quizHintOpen ? (
            <Paper
              variant="outlined"
              sx={{ px: 2, py: 1.25, borderRadius: 1.5 }}
            >
              <Typography variant="body2" color="text.secondary">
                {question.hint}
              </Typography>
            </Paper>
          ) : null}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr auto 1fr' },
              gap: 1.25,
              alignItems: 'center',
            }}
          >
            <Box sx={{ justifySelf: { xs: 'center', sm: 'start' } }}>
              {!hasAnswered && question.hint ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<HelpOutlineIcon fontSize="small" />}
                  onClick={() => setQuizHintOpen((current) => !current)}
                >
                  Hint
                </Button>
              ) : null}
              {hasAnswered ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ChatBubbleOutlineIcon fontSize="small" />}
                  onClick={() =>
                    askAi(
                      buildQuizExplainPrompt({
                        question: question.question,
                        selectedAnswer,
                        correctAnswer,
                        wasCorrect,
                      }),
                    )
                  }
                >
                  {explainButtonLabel}
                </Button>
              ) : null}
            </Box>
            <Stack direction="row" spacing={1.25} justifyContent="center">
              <Button
                variant="outlined"
                disabled={safeIndex === 0}
                onClick={() =>
                  setFocusedQuestionIndex((current) => Math.max(0, current - 1))
                }
              >
                Previous
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  if (safeIndex >= questions.length - 1) {
                    setQuizResultsOpen(true)
                    return
                  }

                  setFocusedQuestionIndex((current) =>
                    Math.min(questions.length - 1, current + 1),
                  )
                }}
              >
                {safeIndex >= questions.length - 1 ? 'Done' : 'Next'}
              </Button>
            </Stack>
            <Box />
          </Box>
        </Stack>
      </Box>
    )
  }

  if (type === 'QuizzSingle') {
    const question = String(props.question || 'Question')
    const answer = String(props.answer || '')
    const explanation = String(props.explanation || '')
    const submittedShortAnswer = Boolean(shortAnswer.trim())
    const shortAnswerCorrect =
      submittedShortAnswer &&
      normalizeAnswer(shortAnswer) === normalizeAnswer(answer)

    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" fontWeight={700}>
            {question}
          </Typography>
          <Stack spacing={1}>
            <TextField
              label="Answer"
              value={shortAnswer}
              onChange={(event) => setShortAnswer(event.target.value)}
              size="small"
              fullWidth
            />
            {submittedShortAnswer && (
              <Typography
                variant="body2"
                color={shortAnswerCorrect ? 'success.main' : 'error.main'}
              >
                {shortAnswerCorrect ? 'Correct' : `Expected: ${answer}`}
              </Typography>
            )}
          </Stack>
          {submittedShortAnswer && explanation && (
            <Typography variant="body2" color="text.secondary">
              {explanation}
            </Typography>
          )}
        </Stack>
      </Paper>
    )
  }

  if (type === 'RevealBlock') {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" fontWeight={700}>
            {String(props.prompt || 'Prompt')}
          </Typography>
          {revealed ? (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {String(props.hiddenText || '')}
            </Typography>
          ) : (
            <Button variant="outlined" onClick={() => setRevealed(true)}>
              {String(props.revealLabel || 'Show answer')}
            </Button>
          )}
        </Stack>
      </Paper>
    )
  }

  if (type === 'StudyNoteBlock') {
    const suggestions = toStringArray(props.suggestedTypes)
    const title = String(props.title || 'Study note')
    const text = String(props.text || '')
    const setTemporaryMode = (mode: string) => {
      setNoteMode(mode)
      writeStoredMode(noteStorageKey, mode)
    }

    if (noteMode === 'flashcard') {
      const { front, back } = createFlashcardParts(title, text)

      return (
        <Paper
          variant="outlined"
          sx={{ p: 2, mb: 2, cursor: 'pointer' }}
          onClick={() => setFlipped((current) => !current)}
        >
          <Stack spacing={1.25}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
            >
              <Chip label="temporary flashcard" size="small" />
              <Button
                size="small"
                variant="text"
                onClick={(event) => {
                  event.stopPropagation()
                  setTemporaryMode('')
                }}
              >
                Back to note
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {flipped ? 'Answer' : 'Prompt'}
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {flipped ? back : front}
            </Typography>
          </Stack>
        </Paper>
      )
    }

    if (noteMode === 'definition') {
      const { front, back } = createFlashcardParts(title, text)

      return (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.25}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
            >
              <Chip label="temporary definition" size="small" />
              <Button
                size="small"
                variant="text"
                onClick={() => setTemporaryMode('')}
              >
                Back to note
              </Button>
            </Stack>
            <Typography variant="subtitle1" fontWeight={700}>
              {front}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {back}
            </Typography>
          </Stack>
        </Paper>
      )
    }

    if (noteMode === 'review') {
      return (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
            >
              <Chip label="need review" size="small" color="warning" />
              <Button
                size="small"
                variant="text"
                onClick={() => setTemporaryMode('')}
              >
                Back to note
              </Button>
            </Stack>
            <Typography variant="subtitle1" fontWeight={700}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {text}
            </Typography>
          </Stack>
        </Paper>
      )
    }

    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.25}>
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {text}
          </Typography>
          {suggestions.length > 0 && (
            <Stack direction="row" gap={1} flexWrap="wrap">
              {suggestions.map((suggestion) => (
                <Chip
                  key={suggestion}
                  label={suggestion}
                  size="small"
                  clickable
                  onClick={() => setTemporaryMode(suggestion)}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>
    )
  }

  if (type === 'MarkdownBlock') {
    const title = String(props.title || 'Markdown notes')
    const isStudyGuidePage = Boolean(props.studyPathId)
    const markdown = isStudyGuidePage
      ? stripDuplicateStudyGuideMarkdownTitle(
          String(props.markdown || ''),
          title,
        )
      : String(props.markdown || '')

    const content = (
      <Stack spacing={1.5}>
        {title && !isStudyGuidePage && (
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
        )}
        <Stack spacing={1.25}>{renderMarkdown(markdown)}</Stack>
      </Stack>
    )

    if (unframed) {
      return content
    }

    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        {content}
      </Paper>
    )
  }

  if (type === 'CodeBlock') {
    const title = String(props.title || 'Code note')
    const code = String(props.code || '')
    const language = String(props.language || '')
    const caption = String(props.caption || '')

    return (
      <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
        <Stack spacing={0}>
          <Box
            sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
            >
              <Typography variant="subtitle1" fontWeight={700}>
                {title}
              </Typography>
              {language && <Chip label={language} size="small" />}
            </Stack>
            {caption && (
              <Typography variant="caption" color="text.secondary">
                {caption}
              </Typography>
            )}
          </Box>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              overflowX: 'auto',
              bgcolor: '#111827',
              color: '#f9fafb',
              fontFamily: 'JetBrains Mono, Consolas, monospace',
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              whiteSpace: 'pre',
              tabSize: 2,
            }}
          >
            <Box component="code">{code}</Box>
          </Box>
        </Stack>
      </Paper>
    )
  }

  if (type === 'DefinitionBlock') {
    const term = String(props.term || 'Term')
    const definition = String(props.definition || 'Definition')
    const example = String(props.example || '')
    const showDefinition = !Boolean(props.makeFlashcard) || definitionStudy

    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.25}>
          <Typography variant="subtitle1" fontWeight={700}>
            {term}
          </Typography>
          {showDefinition ? (
            <>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {definition}
              </Typography>
              {example && (
                <Typography variant="body2" color="text.secondary">
                  Example: {example}
                </Typography>
              )}
            </>
          ) : (
            <Button variant="outlined" onClick={() => setDefinitionStudy(true)}>
              Show definition
            </Button>
          )}
        </Stack>
      </Paper>
    )
  }

  if (type === 'ComparisonBlock') {
    const columnCount = Math.max(
      columns.length,
      ...rows.map((row) => row.length),
      1,
    )

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          {String(props.title || 'Comparison')}
        </Typography>
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ overflowX: 'auto' }}
        >
          <Table size="small">
            {columns.length > 0 && (
              <TableHead>
                <TableRow>
                  {columns.map((column, index) => (
                    <TableCell
                      key={`${column}-${index}`}
                      sx={{ fontWeight: 700 }}
                    >
                      {column}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
            )}
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={`comparison-row-${rowIndex}`}>
                  {Array.from({ length: columnCount }, (_, cellIndex) => (
                    <TableCell key={`comparison-cell-${rowIndex}-${cellIndex}`}>
                      {row[cellIndex] || ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    )
  }

  if (type === 'SequenceBlock' || type === 'ListBlock') {
    const ordered = Boolean(props.ordered)
    const interactive = Boolean(props.interactiveChecklist)
    const defaultTitle = type === 'ListBlock' ? 'Study list' : 'Sequence'

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          {String(props.title || defaultTitle)}
        </Typography>
        <Box
          component={ordered ? 'ol' : 'ul'}
          sx={{ pl: interactive ? 0 : 3, my: 0 }}
        >
          {steps.map((step, index) => (
            <Typography
              component="li"
              variant="body2"
              key={`${step}-${index}`}
              sx={{
                mb: 0.5,
                display: interactive ? 'flex' : 'list-item',
                alignItems: 'center',
                listStyle: interactive ? 'none' : undefined,
                textDecoration: checkedSteps[index] ? 'line-through' : 'none',
                color: checkedSteps[index] ? 'text.secondary' : 'text.primary',
              }}
            >
              {interactive && (
                <Checkbox
                  size="small"
                  checked={Boolean(checkedSteps[index])}
                  onChange={(event) =>
                    setCheckedSteps((current) => ({
                      ...current,
                      [index]: event.target.checked,
                    }))
                  }
                  sx={{ mr: 0.5, p: 0.25 }}
                />
              )}
              {step}
            </Typography>
          ))}
        </Box>
      </Box>
    )
  }

  if (type === 'ReviewPromptBlock') {
    const statusLabels: Record<string, string> = {
      needsReview: 'need review',
      reviewing: 'reviewing',
      mastered: 'mastered',
    }
    const nextStatus = {
      needsReview: 'reviewing',
      reviewing: 'mastered',
      mastered: 'needsReview',
    }[reviewStatus]
    const statusColor = reviewStatus === 'mastered' ? 'success' : 'warning'

    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {String(props.title || 'Review this')}
            </Typography>
            <Chip
              label={statusLabels[reviewStatus] || reviewStatus}
              size="small"
              color={statusColor}
              onClick={() => setReviewStatus(nextStatus || 'needsReview')}
              sx={{ cursor: 'pointer' }}
            />
          </Stack>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {String(props.prompt || '')}
          </Typography>
          {Boolean(props.reason) && props.reason !== props.prompt && (
            <Typography variant="body2" color="text.secondary">
              {String(props.reason)}
            </Typography>
          )}
        </Stack>
      </Paper>
    )
  }

  return null
}

export default StudyBlockView
