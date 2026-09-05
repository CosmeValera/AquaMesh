import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Link,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckIcon from '@mui/icons-material/Check'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined'
import {
  OPEN_STUDY_GUIDE_PAGE_LINK_EVENT,
  readStudyGuidePageHref,
} from '../../studyGuides/pageLinks'
import { stripDuplicateStudyGuideMarkdownTitle } from '../../studyGuides/pages'
import { sanitizeStudyGuideNextIdeas } from '../../studyGuides/studyGuideTitles'
import {
  addLearnedTopicToProfileContext,
  isUserKnownTopic,
} from '../../profileContext'
import {
  PREFILL_DASHBOARD_CHAT_EVENT,
  START_NEXT_STUDY_GUIDE_EVENT,
  type StartNextStudyGuideRequest,
} from '../workspace/workspaceEvents'
import { type HostedAiPodcast } from '../../quickCreate/ai'
import type { DashboardLayout } from '../../state/store'
import { useInterfaceText } from '../../language/interfaceLanguage'
import { PodcastPagePlayer } from '../podcast/PodcastPlayerProvider'
import {
  createChecklistItemKey,
  createChecklistScopeId,
  usePersistentChecklistState,
} from '../../studyGuides/checklistState'
/**
 * Score bands for offering the guide's topic as something the reader now
 * knows. Below the floor nothing is offered at all; at or under the confident
 * mark the offer comes with a nudge to revisit the pages first.
 */
const LEARNED_TOPIC_MIN_SCORE_PERCENT = 50
const LEARNED_TOPIC_CONFIDENT_SCORE_PERCENT = 65

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

interface StoredFocusedQuizSession {
  questionIndex: number
  answers: Record<number, number>
  resultsOpen: boolean
}

interface StoredFocusedFlashcardSession {
  cardIndex: number
  grades: Record<number, 'known' | 'missed'>
  flipped: boolean
  resultsOpen: boolean
  reviewCardIndexes?: number[]
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
  'PodcastBlock',
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

const buildFlashcardExplainPrompt = ({
  front,
  back,
}: {
  front: string
  back: string
}): string =>
  `I am studying this material with a flashcard.\n\nThe flashcard prompt is: '${front}'\n\nThe answer is: '${back}'\n\nHelp me understand this answer and why it matches the prompt.`

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

const defaultFocusedQuizSession = (): StoredFocusedQuizSession => ({
  questionIndex: 0,
  answers: {},
  resultsOpen: false,
})

const defaultFocusedFlashcardSession = (): StoredFocusedFlashcardSession => ({
  cardIndex: 0,
  grades: {},
  flipped: false,
  resultsOpen: false,
})

export const createFocusedQuizStorageKey = (
  type: string,
  props: Record<string, unknown>,
): string => {
  if (type !== 'QuizCarouselBlock' && type !== 'FocusedQuizSessionBlock') {
    return ''
  }

  try {
    return `studymesh-focused-quiz-session-${hashValue(
      JSON.stringify({
        type,
        title: props.title || '',
        items: props.items || [],
      }),
    )}`
  } catch {
    return `studymesh-focused-quiz-session-${hashValue(
      `${type}:${String(props.title || '')}`,
    )}`
  }
}

export const createFocusedFlashcardStorageKey = (
  type: string,
  props: Record<string, unknown>,
): string => {
  if (
    type !== 'FlashcardCarouselBlock' &&
    type !== 'FocusedFlashcardSessionBlock'
  ) {
    return ''
  }

  try {
    return `studymesh-focused-flashcard-session-${hashValue(
      JSON.stringify({
        type,
        title: props.title || '',
        items: props.items || [],
      }),
    )}`
  } catch {
    return `studymesh-focused-flashcard-session-${hashValue(
      `${type}:${String(props.title || '')}`,
    )}`
  }
}

const readStoredFocusedQuizSession = (
  key: string,
): StoredFocusedQuizSession => {
  if (!key) {
    return defaultFocusedQuizSession()
  }

  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) {
      return defaultFocusedQuizSession()
    }

    const parsed = JSON.parse(stored) as Partial<StoredFocusedQuizSession>
    const rawAnswers =
      parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {}
    const answers = Object.fromEntries(
      Object.entries(rawAnswers)
        .map(([questionIndex, answerIndex]) => [
          Number(questionIndex),
          Number(answerIndex),
        ])
        .filter(
          ([questionIndex, answerIndex]) =>
            Number.isInteger(questionIndex) &&
            questionIndex >= 0 &&
            Number.isInteger(answerIndex) &&
            answerIndex >= 0,
        ),
    )

    const questionIndex = Number(parsed.questionIndex)

    return {
      questionIndex:
        Number.isInteger(questionIndex) && questionIndex >= 0
          ? questionIndex
          : 0,
      answers,
      resultsOpen: parsed.resultsOpen === true,
    }
  } catch {
    return defaultFocusedQuizSession()
  }
}

const readStoredFocusedFlashcardSession = (
  key: string,
): StoredFocusedFlashcardSession => {
  if (!key) {
    return defaultFocusedFlashcardSession()
  }

  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) {
      return defaultFocusedFlashcardSession()
    }

    const parsed = JSON.parse(stored) as Partial<StoredFocusedFlashcardSession>
    const rawGrades =
      parsed.grades && typeof parsed.grades === 'object' ? parsed.grades : {}
    const grades = Object.fromEntries(
      Object.entries(rawGrades)
        .map(([cardIndex, grade]): [number, unknown] => [
          Number(cardIndex),
          grade,
        ])
        .filter(
          ([cardIndex, grade]) =>
            Number.isInteger(cardIndex) &&
            cardIndex >= 0 &&
            (grade === 'known' || grade === 'missed'),
        ),
    ) as Record<number, 'known' | 'missed'>
    const cardIndex = Number(parsed.cardIndex)
    const reviewCardIndexes = Array.isArray(parsed.reviewCardIndexes)
      ? parsed.reviewCardIndexes
          .map((index) => Number(index))
          .filter((index) => Number.isInteger(index) && index >= 0)
      : undefined

    return {
      cardIndex: Number.isInteger(cardIndex) && cardIndex >= 0 ? cardIndex : 0,
      grades,
      flipped: parsed.flipped === true,
      resultsOpen: parsed.resultsOpen === true,
      reviewCardIndexes,
    }
  } catch {
    return defaultFocusedFlashcardSession()
  }
}

const writeStoredFocusedQuizSession = (
  key: string,
  session: StoredFocusedQuizSession,
): void => {
  if (!key) {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(session))
  } catch {
    // Local storage is a convenience only. Ignore private-mode failures.
  }
}

const writeStoredFocusedFlashcardSession = (
  key: string,
  session: StoredFocusedFlashcardSession,
): void => {
  if (!key) {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(session))
  } catch {
    // Local storage is a convenience only. Ignore private-mode failures.
  }
}

export const removeStoredFocusedQuizSession = (key: string): void => {
  if (!key) {
    return
  }

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Local storage is a convenience only. Ignore private-mode failures.
  }
}

export const removeStoredFocusedFlashcardSession = (key: string): void => {
  if (!key) {
    return
  }

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Local storage is a convenience only. Ignore private-mode failures.
  }
}

const clearFocusedStudySessionFromComponent = (component: unknown): void => {
  if (!component || typeof component !== 'object') {
    return
  }

  const record = component as Record<string, unknown>
  const type = String(record.type || '')
  const props =
    record.props && typeof record.props === 'object'
      ? (record.props as Record<string, unknown>)
      : {}

  removeStoredFocusedQuizSession(createFocusedQuizStorageKey(type, props))
  removeStoredFocusedFlashcardSession(
    createFocusedFlashcardStorageKey(type, props),
  )
}

export const clearStoredFocusedQuizSessionsFromLayout = (
  layout?: DashboardLayout,
): void => {
  if (!layout) {
    return
  }

  const customProps = layout.config?.customProps
  if (customProps) {
    clearFocusedStudySessionFromComponent(customProps)

    if (Array.isArray(customProps.components)) {
      customProps.components.forEach(clearFocusedStudySessionFromComponent)
    }
  }

  layout.children?.forEach(clearStoredFocusedQuizSessionsFromLayout)
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const toPodcastTranscriptTurns = (
  value: unknown,
): HostedAiPodcast['transcriptTurns'] =>
  Array.isArray(value)
    ? value
        .filter(isRecord)
        .map((turn) => ({
          speaker: turn.speaker === 'hostB' ? 'hostB' : 'hostA',
          text: String(turn.text || '').trim(),
        }))
        .filter((turn) => turn.text)
    : []

const toPodcastChapters = (value: unknown): HostedAiPodcast['chapters'] =>
  Array.isArray(value)
    ? value
        .filter(isRecord)
        .map((chapter) => ({
          title: String(chapter.title || '').trim(),
          startTurn:
            typeof chapter.startTurn === 'number'
              ? chapter.startTurn
              : Number(chapter.startTurn) || 0,
        }))
        .filter((chapter) => chapter.title)
    : []

const toHostedAiPodcast = (value: unknown): HostedAiPodcast | null => {
  if (!isRecord(value)) {
    return null
  }

  const audioPath = String(value.audioPath || '').trim()
  const transcriptTurns = toPodcastTranscriptTurns(value.transcriptTurns)
  if (!audioPath || transcriptTurns.length === 0) {
    return null
  }

  return {
    id: String(value.id || `podcast-${hashValue(audioPath)}`),
    title: String(value.title || 'Podcast'),
    description: String(value.description || ''),
    audioPath,
    mimeType: String(value.mimeType || 'audio/mpeg'),
    transcriptTurns,
    chapters: toPodcastChapters(value.chapters),
    sourceTitle: String(value.sourceTitle || ''),
    sourceScope:
      value.sourceScope === 'currentPage' ? 'currentPage' : 'studyGuide',
    createdAt: String(value.createdAt || ''),
  }
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
  getChecklistChecked?: (itemKey: string, defaultChecked?: boolean) => boolean
  onChecklistChange?: (itemKey: string, checked: boolean) => void
}

const wholeCitationGroupPattern = /^(?:\[\d{1,2}\]|\d{1,2}|\s+)+$/
const codeLikeInlinePattern =
  /^(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?\([^()\n]{0,40}\)|[a-z_$][\w$]*(?:\.[a-z_$][\w$]*)+)$/

const removeUnbalancedInlineMarkdownMarkers = (value: string): string => {
  let cleaned = value
  const doubleMarkerCount = cleaned.match(/\*\*/g)?.length || 0
  if (doubleMarkerCount % 2 !== 0) {
    cleaned = cleaned.replace(/\*\*/g, '')
  }

  const codeMarkerCount = cleaned.match(/`/g)?.length || 0
  if (codeMarkerCount % 2 !== 0) {
    cleaned = cleaned.replace(/`/g, '')
  }

  const emphasisMarkerCount = cleaned.match(/(?<!\*)\*(?!\*)/g)?.length || 0
  if (emphasisMarkerCount % 2 !== 0) {
    cleaned = cleaned.replace(/(?<!\*)\*(?!\*)/g, '')
  }

  return cleaned
}

const cleanGeneratedInlineText = (value: string): string =>
  removeUnbalancedInlineMarkdownMarkers(value).replace(/\s+/g, ' ').trim()

const cleanGeneratedQuizQuestion = (value: string): string =>
  cleanGeneratedInlineText(value).replace(
    /\b(apply|use|explain|practice|review|understand)\s+-\s+/i,
    '$1 ',
  )

const cleanGeneratedQuizOption = (value: string): string =>
  cleanGeneratedInlineText(value).replace(/^[-*]\s+/, '')

const citationNumbersFromMatch = (
  citationMatch: RegExpMatchArray,
): number[] => {
  if (citationMatch[1]) {
    return [Number(citationMatch[1])]
  }

  return citationMatch[2].split('').map((digit) => Number(digit))
}

export const renderMarkdownInline = (
  value: string,
  options: RenderMarkdownOptions = {},
): React.ReactNode[] => {
  const inlineValue = removeUnbalancedInlineMarkdownMarkers(value)
  const nodes: React.ReactNode[] = []
  const tokenPattern =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|(?:\[\d{1,2}\]|(?:(?<=[\u00a0\u202f])\d{1,2}(?:\s+\d{1,2})*|\d{1,2}(?=\s*\[\d{1,2}\]))(?=\s*(?:\[\d{1,2}\]|[.,;:!?)]|$)))+|\*[^*]+\*|\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?\([^()\n]{0,40}\)|\b[a-z_$][\w$]*(?:\.[a-z_$][\w$]*)+\b)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(inlineValue)) !== null) {
    if (match.index > cursor) {
      nodes.push(inlineValue.slice(cursor, match.index))
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
    } else if (token.startsWith('`') || codeLikeInlinePattern.test(token)) {
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
          {token.startsWith('`') ? token.slice(1, -1) : token}
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

  if (cursor < inlineValue.length) {
    nodes.push(inlineValue.slice(cursor))
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
      const listItems: Array<{
        text: string
        checked?: boolean
        itemKey?: string
      }> = []

      while (index < lines.length) {
        const itemTrimmed = lines[index].trim()
        const unorderedItem = itemTrimmed.match(/^[-*]\s+(\[[ xX]\]\s+)?(.+)$/)
        const orderedItem = itemTrimmed.match(/^\d+[.)]\s+(.+)$/)

        if ((ordered && !orderedItem) || (!ordered && !unorderedItem)) {
          break
        }

        const itemLineIndex = index
        const checkbox = unorderedItem?.[1]
        const text = (unorderedItem?.[2] || orderedItem?.[1] || '').trim()
        listItems.push({
          text,
          checked: checkbox ? /\[[xX]\]/.test(checkbox) : undefined,
          itemKey: checkbox
            ? createChecklistItemKey(text, itemLineIndex)
            : undefined,
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
          {listItems.map((item, itemIndex) => {
            const isChecklistItem =
              item.checked !== undefined && Boolean(item.itemKey)
            const defaultChecked = item.checked === true
            const checked = isChecklistItem
              ? options.getChecklistChecked?.(item.itemKey!, defaultChecked) ??
                defaultChecked
              : false

            return (
              <Typography
                component="li"
                variant="body2"
                key={`${item.text}-${itemIndex}`}
                sx={{
                  mb: 0.5,
                  display: isChecklistItem ? 'flex' : 'list-item',
                  alignItems: 'center',
                  listStyle: isChecklistItem ? 'none' : undefined,
                  textDecoration: checked ? 'line-through' : 'none',
                  color: checked ? 'text.secondary' : 'text.primary',
                }}
              >
                {isChecklistItem && (
                  <Checkbox
                    size="small"
                    checked={checked}
                    inputProps={{ 'aria-label': item.text }}
                    onChange={(event) =>
                      options.onChecklistChange?.(
                        item.itemKey!,
                        event.target.checked,
                      )
                    }
                    sx={{ p: 0.25, mr: 0.5 }}
                  />
                )}
                {renderMarkdownInline(item.text, options)}
              </Typography>
            )
          })}
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

type StudyRoundControlTone = 'primary' | 'hint' | 'explain'

const studyRoundControlColor = (tone: StudyRoundControlTone) => {
  switch (tone) {
    case 'hint':
      return 'info.main'
    case 'explain':
      return 'info.main'
    case 'primary':
      return 'primary.main'
  }
}

const StudyRoundIconButton = ({
  label,
  disabled = false,
  onClick,
  tone = 'primary',
  showLabel = false,
  children,
}: {
  label: string
  disabled?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  tone?: StudyRoundControlTone
  showLabel?: boolean
  children: React.ReactNode
}) => (
  <Tooltip title={label}>
    <span style={{ display: 'inline-flex' }}>
      <Button
        aria-label={label}
        variant="outlined"
        disabled={disabled}
        onClick={onClick}
        sx={(theme) => {
          const color = studyRoundControlColor(tone)
          return {
            minWidth: showLabel ? { xs: 104, sm: 112 } : { xs: 42, sm: 64 },
            width: showLabel ? 'auto' : { xs: 42, sm: 64 },
            height: { xs: 42, sm: 64 },
            borderRadius: 999,
            gap: showLabel ? { xs: 1, sm: 1.1 } : 0,
            px: showLabel ? { xs: 2.25, sm: 2.5 } : 0,
            color,
            bgcolor: alpha(theme.palette.background.paper, 0.42),
            borderColor: alpha(theme.palette.text.primary, 0.18),
            '&:hover': {
              bgcolor: alpha(
                theme.palette[tone === 'primary' ? 'primary' : 'info'].main,
                0.12,
              ),
              borderColor: alpha(
                theme.palette[tone === 'primary' ? 'primary' : 'info'].main,
                0.44,
              ),
            },
            '&.Mui-disabled': {
              color: alpha(theme.palette.text.primary, 0.38),
              bgcolor: alpha(theme.palette.background.paper, 0.3),
              borderColor: alpha(theme.palette.text.primary, 0.12),
            },
            '& .MuiSvgIcon-root': {
              fontSize: { xs: 22, sm: 26 },
            },
          }
        }}
      >
        {children}
        {showLabel ? (
          <Typography
            component="span"
            variant="button"
            sx={{
              fontSize: { xs: '0.78rem', sm: '0.82rem' },
              fontWeight: 800,
              lineHeight: 1,
              textTransform: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </Typography>
        ) : null}
      </Button>
    </span>
  </Tooltip>
)

const StudyBlockView: React.FC<StudyBlockViewProps> = ({
  type,
  props,
  unframed = false,
  onAskAi,
}) => {
  const { t } = useInterfaceText()
  const explainButtonLabel = t('practice.explain')
  const focusedQuizStorageKey = useMemo(
    () => createFocusedQuizStorageKey(type, props),
    [props, type],
  )
  const initialFocusedQuizSession = useMemo(
    () => readStoredFocusedQuizSession(focusedQuizStorageKey),
    [focusedQuizStorageKey],
  )
  const focusedQuizStorageKeyRef = useRef(focusedQuizStorageKey)
  const focusedFlashcardStorageKey = useMemo(
    () => createFocusedFlashcardStorageKey(type, props),
    [props, type],
  )
  const initialFocusedFlashcardSession = useMemo(
    () => readStoredFocusedFlashcardSession(focusedFlashcardStorageKey),
    [focusedFlashcardStorageKey],
  )
  const focusedFlashcardStorageKeyRef = useRef(focusedFlashcardStorageKey)
  const [flipped, setFlipped] = useState(initialFocusedFlashcardSession.flipped)
  const [selfGrade, setSelfGrade] = useState<'known' | 'missed' | ''>('')
  const [revealed, setRevealed] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [focusedCardIndex, setFocusedCardIndex] = useState(
    initialFocusedFlashcardSession.cardIndex,
  )
  const [focusedQuestionIndex, setFocusedQuestionIndex] = useState(
    initialFocusedQuizSession.questionIndex,
  )
  const [focusedQuizAnswers, setFocusedQuizAnswers] = useState<
    Record<number, number>
  >(initialFocusedQuizSession.answers)
  const [quizResultsOpen, setQuizResultsOpen] = useState(
    initialFocusedQuizSession.resultsOpen,
  )
  const [learnedTopicAdded, setLearnedTopicAdded] = useState(false)
  // Several follow-up guides can be started in one go: finishing the quiz again
  // just to queue a second one was the whole point of the multi-select.
  const [selectedIdeaPrompts, setSelectedIdeaPrompts] = useState<string[]>([])
  // The guide this block belongs to. Both are injected by
  // `createStudyPathProps`, so they are only present on Study Guide pages,
  // which is exactly where a topic is worth offering.
  const learnedTopicGuideId = String(props.studyPathId || '')
  // One claimable name per guide, always the same one. Guides generated before
  // skill names existed only have the title, which reads like something you
  // read rather than something you know.
  const learnedTopicName = useMemo(() => {
    const offered = Array.isArray(props.studyPathLearnedSkillOptions)
      ? props.studyPathLearnedSkillOptions
          .map((option) => String(option || '').trim())
          .find(Boolean)
      : ''

    return offered || String(props.studyPathTitle || '').trim()
  }, [props.studyPathLearnedSkillOptions, props.studyPathTitle])
  // Generated with the guide, so the offer costs no extra model call. Guides
  // made before this existed, or providers that skipped the field, get none.
  const nextGuideIdeas = useMemo(
    () => sanitizeStudyGuideNextIdeas(props.studyPathNextGuideIdeas),
    [props.studyPathNextGuideIdeas],
  )
  // Read once the results open rather than on every render: the helper hits
  // localStorage, and the answer cannot change while the score is on screen.
  // A topic the reader already holds is shown claimed, never hidden, so a
  // guide always presents the same skill and the same follow-ups.
  const alreadyKnownTopic = useMemo(
    () =>
      quizResultsOpen && learnedTopicName
        ? isUserKnownTopic(learnedTopicName)
        : false,
    [quizResultsOpen, learnedTopicName],
  )
  const canOfferLearnedTopic = Boolean(
    quizResultsOpen && learnedTopicName && learnedTopicGuideId,
  )
  // Handed down by the guide view, which already owns the guide store. Reading
  // it here would pull the whole guide/creation-queue graph into every block.
  const createdNextIdeaPrompts = useMemo(
    () =>
      new Set(
        Array.isArray(props.studyPathCreatedNextIdeaPrompts)
          ? props.studyPathCreatedNextIdeaPrompts.map((prompt) =>
              String(prompt || ''),
            )
          : [],
      ),
    [props.studyPathCreatedNextIdeaPrompts],
  )
  const [focusedFlashcardGrades, setFocusedFlashcardGrades] = useState<
    Record<number, 'known' | 'missed'>
  >(initialFocusedFlashcardSession.grades)
  const [
    focusedFlashcardReviewCardIndexes,
    setFocusedFlashcardReviewCardIndexes,
  ] = useState<number[] | null>(
    initialFocusedFlashcardSession.reviewCardIndexes || null,
  )
  const [flashcardResultsOpen, setFlashcardResultsOpen] = useState(
    initialFocusedFlashcardSession.resultsOpen,
  )
  const [flashcardFeedbacks, setFlashcardFeedbacks] = useState<
    Array<{ id: number; grade: 'known' | 'missed' }>
  >([])
  const flashcardFeedbackIdRef = useRef(0)
  const flashcardFeedbackTimerRefs = useRef<number[]>([])
  const flashcardRuntimeRef = useRef<{
    cardIndex: number
    grades: Record<number, 'known' | 'missed'>
  }>({
    cardIndex: initialFocusedFlashcardSession.cardIndex,
    grades: initialFocusedFlashcardSession.grades,
  })
  const flashcardAdvanceTimerRef = useRef<number | null>(null)
  const [flashcardPracticeAnchorEl, setFlashcardPracticeAnchorEl] =
    useState<null | HTMLElement>(null)
  const [shortAnswer, setShortAnswer] = useState('')
  const [quizHintOpen, setQuizHintOpen] = useState(false)
  const [definitionStudy, setDefinitionStudy] = useState(false)
  const [reviewStatus, setReviewStatus] = useState(
    String(props.status || 'needsReview'),
  )
  const podcast = useMemo(
    () => toHostedAiPodcast(props.podcast),
    [props.podcast],
  )

  useEffect(() => {
    setQuizHintOpen(false)
  }, [focusedQuestionIndex, selectedIndex, type])

  useEffect(() => {
    return () => {
      if (flashcardAdvanceTimerRef.current !== null) {
        window.clearTimeout(flashcardAdvanceTimerRef.current)
        flashcardAdvanceTimerRef.current = null
      }
      flashcardFeedbackTimerRefs.current.forEach((timer) =>
        window.clearTimeout(timer),
      )
      flashcardFeedbackTimerRefs.current = []
    }
  }, [])

  useEffect(() => {
    if (focusedQuizStorageKeyRef.current === focusedQuizStorageKey) {
      return
    }

    const storedSession = readStoredFocusedQuizSession(focusedQuizStorageKey)
    focusedQuizStorageKeyRef.current = focusedQuizStorageKey
    setFocusedQuestionIndex(storedSession.questionIndex)
    setFocusedQuizAnswers(storedSession.answers)
    setQuizResultsOpen(storedSession.resultsOpen)
    setQuizHintOpen(false)
  }, [focusedQuizStorageKey])

  useEffect(() => {
    writeStoredFocusedQuizSession(focusedQuizStorageKey, {
      questionIndex: focusedQuestionIndex,
      answers: focusedQuizAnswers,
      resultsOpen: quizResultsOpen,
    })
  }, [
    focusedQuestionIndex,
    focusedQuizAnswers,
    focusedQuizStorageKey,
    quizResultsOpen,
  ])

  useEffect(() => {
    if (focusedFlashcardStorageKeyRef.current === focusedFlashcardStorageKey) {
      return
    }

    const storedSession = readStoredFocusedFlashcardSession(
      focusedFlashcardStorageKey,
    )
    focusedFlashcardStorageKeyRef.current = focusedFlashcardStorageKey
    setFocusedCardIndex(storedSession.cardIndex)
    setFocusedFlashcardGrades(storedSession.grades)
    setFocusedFlashcardReviewCardIndexes(
      storedSession.reviewCardIndexes || null,
    )
    setFlipped(storedSession.flipped)
    setFlashcardResultsOpen(storedSession.resultsOpen)
    setFlashcardPracticeAnchorEl(null)
  }, [focusedFlashcardStorageKey])

  useEffect(() => {
    writeStoredFocusedFlashcardSession(focusedFlashcardStorageKey, {
      cardIndex: focusedCardIndex,
      grades: focusedFlashcardGrades,
      flipped,
      resultsOpen: flashcardResultsOpen,
      reviewCardIndexes: focusedFlashcardReviewCardIndexes || undefined,
    })
  }, [
    flashcardResultsOpen,
    flipped,
    focusedCardIndex,
    focusedFlashcardGrades,
    focusedFlashcardReviewCardIndexes,
    focusedFlashcardStorageKey,
  ])

  const askAi = (content: string) => {
    if (onAskAi) {
      onAskAi(content)
      return
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(PREFILL_DASHBOARD_CHAT_EVENT, {
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
  const checklistScopeId = useMemo(
    () =>
      createChecklistScopeId([
        'study-block',
        type,
        props.studyPathId,
        props.studyPathDashboardKey,
        props.studyPathItemId,
        props.title,
        props.markdown,
        props.items,
        props.steps,
        props.text,
      ]),
    [
      props.items,
      props.markdown,
      props.steps,
      props.studyPathDashboardKey,
      props.studyPathId,
      props.studyPathItemId,
      props.text,
      props.title,
      type,
    ],
  )
  const checklistState = usePersistentChecklistState(checklistScopeId)
  const markdownOptions = useMemo<RenderMarkdownOptions>(
    () => ({
      getChecklistChecked: checklistState.isChecked,
      onChecklistChange: checklistState.setChecked,
    }),
    [checklistState.isChecked, checklistState.setChecked],
  )

  if (type === 'FlashcardBlock') {
    const front = String(props.front || t('practice.question'))
    const back = String(props.back || t('practice.answer'))
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
            {flipped ? t('practice.answer') : t('practice.prompt')}
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {renderMarkdownInline(flipped ? back : front)}
          </Typography>
          {!flipped && hint && (
            <Typography variant="body2" color="text.secondary">
              {t('practice.hint')}: {renderMarkdownInline(hint)}
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
                {t('practice.iKnewIt')}
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
                {t('practice.didntKnowIt')}
              </Button>
            </Stack>
          )}
          {flipped ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ChatBubbleOutlineIcon fontSize="small" />}
              onClick={(event) => {
                event.stopPropagation()
                askAi(buildFlashcardExplainPrompt({ front, back }))
              }}
              sx={{ alignSelf: 'flex-start' }}
            >
              {explainButtonLabel}
            </Button>
          ) : null}
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
    const allCardEntries = cards.map((card, originalIndex) => ({
      card,
      originalIndex,
    }))
    const activeCardEntries = focusedFlashcardReviewCardIndexes
      ? focusedFlashcardReviewCardIndexes
          .map((originalIndex) => allCardEntries[originalIndex])
          .filter(
            (
              entry,
            ): entry is {
              card: (typeof cards)[number]
              originalIndex: number
            } => Boolean(entry),
          )
      : allCardEntries
    const hasCustomFlashcardStack = Boolean(
      focusedFlashcardReviewCardIndexes &&
        activeCardEntries.length !== allCardEntries.length,
    )
    const safeIndex = Math.min(
      focusedCardIndex,
      Math.max(0, activeCardEntries.length - 1),
    )
    const cardEntry = activeCardEntries[safeIndex]
    const card = cardEntry?.card
    flashcardRuntimeRef.current = {
      cardIndex: safeIndex,
      grades: focusedFlashcardGrades,
    }
    const answered = activeCardEntries.reduce(
      (total, entry) =>
        focusedFlashcardGrades[entry.originalIndex] ? total + 1 : total,
      0,
    )
    const known = activeCardEntries.reduce(
      (total, entry) =>
        focusedFlashcardGrades[entry.originalIndex] === 'known'
          ? total + 1
          : total,
      0,
    )
    const missed = activeCardEntries.reduce(
      (total, entry) =>
        focusedFlashcardGrades[entry.originalIndex] === 'missed'
          ? total + 1
          : total,
      0,
    )
    const skipped = activeCardEntries.length - answered
    const flashcardScorePercent =
      activeCardEntries.length > 0
        ? Math.round((known / activeCardEntries.length) * 100)
        : 0
    const knownDegrees =
      activeCardEntries.length > 0
        ? (known / activeCardEntries.length) * 360
        : 0
    const missedDegrees =
      activeCardEntries.length > 0
        ? (missed / activeCardEntries.length) * 360
        : 0
    const flashcardResultRows = [
      { label: t('practice.known'), value: known, color: 'success.main' },
      { label: t('practice.missed'), value: missed, color: 'error.main' },
      { label: t('practice.skipped'), value: skipped, color: 'text.primary' },
    ]
    const persistFlashcardSession = (
      session: StoredFocusedFlashcardSession,
    ) => {
      writeStoredFocusedFlashcardSession(focusedFlashcardStorageKey, session)
    }
    const clearFlashcardAdvanceTimer = () => {
      if (flashcardAdvanceTimerRef.current !== null) {
        window.clearTimeout(flashcardAdvanceTimerRef.current)
        flashcardAdvanceTimerRef.current = null
      }
    }
    const clearFlashcardFeedbackAnimations = () => {
      flashcardFeedbackTimerRefs.current.forEach((timer) =>
        window.clearTimeout(timer),
      )
      flashcardFeedbackTimerRefs.current = []
      setFlashcardFeedbacks([])
    }
    const addFlashcardFeedbackAnimation = (grade: 'known' | 'missed') => {
      const id = flashcardFeedbackIdRef.current + 1
      flashcardFeedbackIdRef.current = id
      setFlashcardFeedbacks((current) => [...current, { id, grade }])
      const timer = window.setTimeout(() => {
        flashcardFeedbackTimerRefs.current =
          flashcardFeedbackTimerRefs.current.filter((item) => item !== timer)
        setFlashcardFeedbacks((current) =>
          current.filter((feedback) => feedback.id !== id),
        )
      }, 850)
      flashcardFeedbackTimerRefs.current.push(timer)
    }
    const moveToFlashcardIndex = (nextIndex: number) => {
      clearFlashcardAdvanceTimer()
      clearFlashcardFeedbackAnimations()
      flashcardRuntimeRef.current = {
        cardIndex: nextIndex,
        grades: focusedFlashcardGrades,
      }
      persistFlashcardSession({
        cardIndex: nextIndex,
        grades: focusedFlashcardGrades,
        flipped: false,
        resultsOpen: false,
        reviewCardIndexes: focusedFlashcardReviewCardIndexes || undefined,
      })
      setFocusedCardIndex(nextIndex)
      setFlipped(false)
    }
    const gradeCard = (grade: 'known' | 'missed') => {
      clearFlashcardAdvanceTimer()
      const runtimeIndex = Math.min(
        flashcardRuntimeRef.current.cardIndex,
        Math.max(0, activeCardEntries.length - 1),
      )
      const runtimeEntry = activeCardEntries[runtimeIndex]

      if (!runtimeEntry) {
        return
      }

      const nextGrades = {
        ...flashcardRuntimeRef.current.grades,
        [runtimeEntry.originalIndex]: grade,
      }
      const isLastCard = runtimeIndex >= activeCardEntries.length - 1
      const nextIndex = isLastCard
        ? runtimeIndex
        : Math.min(activeCardEntries.length - 1, runtimeIndex + 1)
      flashcardRuntimeRef.current = {
        cardIndex: nextIndex,
        grades: nextGrades,
      }
      persistFlashcardSession({
        cardIndex: nextIndex,
        grades: nextGrades,
        flipped: false,
        resultsOpen: isLastCard,
        reviewCardIndexes: focusedFlashcardReviewCardIndexes || undefined,
      })
      setFocusedFlashcardGrades(nextGrades)
      setFlipped(false)
      addFlashcardFeedbackAnimation(grade)

      if (isLastCard) {
        setFlashcardResultsOpen(true)
        return
      }

      setFocusedCardIndex(nextIndex)
    }

    if (!card) {
      return (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {t('practice.noFlashcards')}
          </Typography>
        </Paper>
      )
    }

    if (flashcardResultsOpen) {
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
              {t('practice.flashcardsComplete')}
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
                    background: `conic-gradient(${
                      theme.palette.success.main
                    } 0deg ${knownDegrees}deg, ${
                      theme.palette.error.main
                    } ${knownDegrees}deg ${knownDegrees + missedDegrees}deg, ${
                      theme.palette.action.selected
                    } ${knownDegrees + missedDegrees}deg 360deg)`,
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
                      {known}/{activeCardEntries.length}
                    </Typography>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      fontWeight={700}
                    >
                      {flashcardScorePercent}%
                    </Typography>
                  </Box>
                </Box>
                <Stack spacing={1.25} sx={{ minWidth: 180 }}>
                  {flashcardResultRows.map(({ label, value, color }) => (
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
                  const lastCardIndex = activeCardEntries.length - 1
                  persistFlashcardSession({
                    cardIndex: lastCardIndex,
                    grades: focusedFlashcardGrades,
                    flipped: false,
                    resultsOpen: false,
                    reviewCardIndexes:
                      focusedFlashcardReviewCardIndexes || undefined,
                  })
                  setFocusedCardIndex(lastCardIndex)
                  setFlipped(false)
                  setFlashcardResultsOpen(false)
                }}
              >
                {t('practice.previous')}
              </Button>
              <Button
                variant="contained"
                endIcon={<KeyboardArrowDownIcon fontSize="small" />}
                onClick={(event) => {
                  setFlashcardPracticeAnchorEl(event.currentTarget)
                }}
              >
                {t('practice.practiceAgain')}
              </Button>
              <Menu
                anchorEl={flashcardPracticeAnchorEl}
                open={Boolean(flashcardPracticeAnchorEl)}
                onClose={() => setFlashcardPracticeAnchorEl(null)}
              >
                <MenuItem
                  onClick={() => {
                    const nextSession = defaultFocusedFlashcardSession()
                    removeStoredFocusedFlashcardSession(
                      focusedFlashcardStorageKey,
                    )
                    persistFlashcardSession(nextSession)
                    setFocusedFlashcardGrades({})
                    setFocusedCardIndex(0)
                    setFocusedFlashcardReviewCardIndexes(null)
                    setFlipped(false)
                    setFlashcardResultsOpen(false)
                    setFlashcardPracticeAnchorEl(null)
                  }}
                >
                  {t('practice.allCards')}
                </MenuItem>
                {hasCustomFlashcardStack ? (
                  <MenuItem
                    onClick={() => {
                      const sameCardIndexes = activeCardEntries.map(
                        (entry) => entry.originalIndex,
                      )
                      const nextSession: StoredFocusedFlashcardSession = {
                        cardIndex: 0,
                        grades: {},
                        flipped: false,
                        resultsOpen: false,
                        reviewCardIndexes: sameCardIndexes,
                      }
                      persistFlashcardSession(nextSession)
                      setFocusedFlashcardGrades({})
                      setFocusedCardIndex(0)
                      setFocusedFlashcardReviewCardIndexes(sameCardIndexes)
                      setFlipped(false)
                      setFlashcardResultsOpen(false)
                      setFlashcardPracticeAnchorEl(null)
                    }}
                  >
                    {t('practice.sameCards')}
                  </MenuItem>
                ) : null}
                <MenuItem
                  disabled={missed === 0}
                  onClick={() => {
                    const missedCardIndexes = activeCardEntries
                      .filter(
                        (entry) =>
                          focusedFlashcardGrades[entry.originalIndex] ===
                          'missed',
                      )
                      .map((entry) => entry.originalIndex)
                    const nextSession: StoredFocusedFlashcardSession = {
                      cardIndex: 0,
                      grades: {},
                      flipped: false,
                      resultsOpen: false,
                      reviewCardIndexes: missedCardIndexes,
                    }
                    persistFlashcardSession(nextSession)
                    setFocusedFlashcardGrades({})
                    setFocusedCardIndex(0)
                    setFocusedFlashcardReviewCardIndexes(missedCardIndexes)
                    setFlipped(false)
                    setFlashcardResultsOpen(false)
                    setFlashcardPracticeAnchorEl(null)
                  }}
                >
                  {t('practice.onlyMissedCards')}
                </MenuItem>
              </Menu>
            </Stack>
          </Stack>
        </Box>
      )
    }

    return (
      <Box
        sx={(theme) => ({
          '--flashcard-face-bg': {
            xs: theme.palette.background.paper,
            sm:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.common.white, 0.06)
                : alpha(theme.palette.common.white, 0.74),
          },
          minHeight: { xs: 'calc(100dvh - 156px)', md: 'calc(100vh - 170px)' },
          display: 'grid',
          alignContent: 'center',
          px: { xs: 2, sm: 2 },
          py: { xs: 0.75, sm: 2 },
          overflow: 'hidden',
          background: {
            xs: 'none',
            sm:
              theme.palette.mode === 'dark'
                ? `radial-gradient(circle at 50% 65%, ${alpha(
                    theme.palette.success.main,
                    0.2,
                  )} 0%, ${alpha(
                    theme.palette.primary.main,
                    0.1,
                  )} 32%, transparent 62%)`
                : `radial-gradient(circle at 50% 68%, ${alpha(
                    theme.palette.success.main,
                    0.28,
                  )} 0%, ${alpha(
                    theme.palette.primary.main,
                    0.16,
                  )} 34%, ${alpha(
                    theme.palette.success.light,
                    0.08,
                  )} 54%, transparent 76%)`,
          },
          '@keyframes flashcardGradeAway': {
            '0%': {
              opacity: 0,
              transform: 'translateY(0) rotate(0deg) scale(0.98)',
            },
            '18%': {
              opacity: 1,
              transform: 'translateY(-10px) rotate(-3deg) scale(1.02)',
            },
            '100%': {
              opacity: 0,
              transform: 'translateY(180px) rotate(-9deg) scale(0.96)',
            },
          },
        })}
      >
        <Stack
          spacing={{ xs: 1.5, sm: 2 }}
          alignItems="center"
          sx={{
            width: { xs: '100%', sm: 'min(760px, 100%)' },
            mx: 'auto',
            minWidth: 0,
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            gap={2}
            sx={{ display: 'none' }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" fontWeight={600}>
                {renderMarkdownInline(title)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {safeIndex + 1} / {activeCardEntries.length}
              </Typography>
            </Box>
            <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="end">
              <Chip
                label={`${t('practice.answered')} ${answered}/${
                  activeCardEntries.length
                }`}
              />
              <Chip color="success" label={`${t('practice.known')} ${known}`} />
              <Chip color="error" label={`${t('practice.missed')} ${missed}`} />
              {card.tag && <Chip label={card.tag} />}
            </Stack>
          </Stack>
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              mx: 'auto',
            }}
          >
            <Paper
              variant="outlined"
              onClick={() => {
                const nextFlipped = !flipped
                persistFlashcardSession({
                  cardIndex: safeIndex,
                  grades: focusedFlashcardGrades,
                  flipped: nextFlipped,
                  resultsOpen: false,
                  reviewCardIndexes:
                    focusedFlashcardReviewCardIndexes || undefined,
                })
                setFlipped(nextFlipped)
              }}
              sx={(theme) => ({
                minHeight: { xs: 330, sm: 340, md: 330 },
                p: 0,
                borderRadius: { xs: 4, sm: 5 },
                display: 'block',
                cursor: 'pointer',
                textAlign: 'left',
                bgcolor: 'transparent',
                borderColor: 'transparent',
                transition:
                  'background-color 180ms ease, border-color 180ms ease',
                overflow: 'hidden',
                '&:hover .flashcard-face': {
                  borderColor: alpha(theme.palette.primary.main, 0.45),
                },
              })}
            >
              <Box
                sx={{
                  position: 'relative',
                  minHeight: { xs: 330, sm: 340, md: 330 },
                  borderRadius: 'inherit',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 500ms ease',
                  transformOrigin: 'center center',
                  willChange: 'transform',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                <Box
                  className="flashcard-face"
                  aria-hidden={flipped}
                  sx={(theme) => ({
                    position: 'absolute',
                    inset: 0,
                    p: { xs: 2.25, sm: 3.5 },
                    display: 'grid',
                    gridTemplateRows: 'auto 1fr auto',
                    gap: { xs: 1.25, sm: 2 },
                    minWidth: 0,
                    bgcolor: 'var(--flashcard-face-bg)',
                    border: 1,
                    borderColor: {
                      xs: alpha(theme.palette.text.primary, 0.12),
                      sm: alpha(theme.palette.text.primary, 0.22),
                    },
                    borderRadius: 'inherit',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transition: 'border-color 180ms ease',
                  })}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontWeight={700}
                  >
                    {safeIndex + 1}/{activeCardEntries.length}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      alignSelf: 'center',
                      whiteSpace: 'pre-wrap',
                      fontSize: { xs: '1.03rem', sm: '1.5rem' },
                      lineHeight: { xs: 1.22, sm: 1.25 },
                      fontWeight: 650,
                    }}
                  >
                    {renderMarkdownInline(card.front)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: 'center' }}
                  >
                    {t('practice.seeAnswer')}
                  </Typography>
                </Box>
                <Box
                  className="flashcard-face"
                  aria-hidden={!flipped}
                  sx={(theme) => ({
                    position: 'absolute',
                    inset: 0,
                    p: { xs: 2.25, sm: 3.5 },
                    display: 'grid',
                    gridTemplateRows: 'auto 1fr auto',
                    gap: { xs: 1.25, sm: 2 },
                    minWidth: 0,
                    bgcolor: 'var(--flashcard-face-bg)',
                    border: 1,
                    borderColor: {
                      xs: alpha(theme.palette.text.primary, 0.12),
                      sm: alpha(theme.palette.text.primary, 0.22),
                    },
                    borderRadius: 'inherit',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    pointerEvents: flipped ? 'auto' : 'none',
                    transition: 'border-color 180ms ease',
                  })}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontWeight={700}
                  >
                    {safeIndex + 1}/{activeCardEntries.length}
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      alignSelf: 'center',
                      whiteSpace: 'pre-wrap',
                      fontSize: { xs: '1.03rem', sm: '1.5rem' },
                      lineHeight: { xs: 1.22, sm: 1.25 },
                      fontWeight: 500,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {renderMarkdownInline(card.back)}
                  </Typography>
                  <Box>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ChatBubbleOutlineIcon fontSize="small" />}
                      onClick={(event) => {
                        event.stopPropagation()
                        askAi(
                          buildFlashcardExplainPrompt({
                            front: card.front,
                            back: card.back,
                          }),
                        )
                      }}
                      sx={{ justifySelf: 'start' }}
                    >
                      {explainButtonLabel}
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Paper>
            {flashcardFeedbacks.map((feedback, index) => (
              <Paper
                key={feedback.id}
                elevation={0}
                sx={(theme) => {
                  const isKnown = feedback.grade === 'known'
                  return {
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2 + index,
                    borderRadius: 5,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: isKnown
                      ? alpha(theme.palette.success.light, 0.35)
                      : alpha(theme.palette.error.light, 0.26),
                    border: 1,
                    borderColor: isKnown
                      ? alpha(theme.palette.success.main, 0.32)
                      : alpha(theme.palette.error.main, 0.32),
                    color: isKnown ? 'success.main' : 'error.main',
                    animation: 'flashcardGradeAway 850ms ease-in forwards',
                    animationDelay: `${Math.min(index * 35, 140)}ms`,
                    pointerEvents: 'none',
                  }
                }}
              >
                <Typography variant="h3" fontWeight={800} textAlign="center">
                  {feedback.grade === 'known'
                    ? t('practice.gotIt')
                    : t('practice.nextTime')}
                </Typography>
              </Paper>
            ))}
          </Box>
          <Stack
            direction="row"
            spacing={{ xs: 0.5, sm: 2 }}
            justifyContent={{ xs: 'space-between', sm: 'center' }}
            alignItems="center"
            sx={{
              width: '100%',
              minWidth: 0,
              '& .MuiButton-root': { flexShrink: 0 },
            }}
          >
            <StudyRoundIconButton
              label={t('practice.previous')}
              disabled={safeIndex === 0}
              onClick={() => moveToFlashcardIndex(Math.max(0, safeIndex - 1))}
            >
              <ArrowBackIcon />
            </StudyRoundIconButton>
            <Button
              aria-label={t('practice.wrongAnswer')}
              variant="outlined"
              onClick={() => gradeCard('missed')}
              sx={(theme) => ({
                minWidth: { xs: 68, sm: 102 },
                height: { xs: 42, sm: 64 },
                borderRadius: 999,
                gap: 0.75,
                color: 'error.main',
                bgcolor: alpha(theme.palette.background.paper, 0.42),
                borderColor: alpha(theme.palette.text.primary, 0.2),
                fontWeight: 800,
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.12),
                  borderColor: alpha(theme.palette.error.main, 0.44),
                },
              })}
            >
              <CloseIcon />
              {missed}
            </Button>
            <Button
              aria-label={t('practice.correctAnswer')}
              variant="outlined"
              onClick={() => gradeCard('known')}
              sx={(theme) => ({
                minWidth: { xs: 68, sm: 102 },
                height: { xs: 42, sm: 64 },
                borderRadius: 999,
                gap: 0.75,
                color: 'success.main',
                bgcolor: alpha(theme.palette.background.paper, 0.42),
                borderColor: alpha(theme.palette.text.primary, 0.2),
                fontWeight: 800,
                '&:hover': {
                  bgcolor: alpha(theme.palette.success.main, 0.12),
                  borderColor: alpha(theme.palette.success.main, 0.44),
                },
              })}
            >
              {known}
              <CheckIcon />
            </Button>
            <StudyRoundIconButton
              label={t('practice.next')}
              onClick={() => {
                if (safeIndex >= activeCardEntries.length - 1) {
                  persistFlashcardSession({
                    cardIndex: safeIndex,
                    grades: focusedFlashcardGrades,
                    flipped,
                    resultsOpen: true,
                    reviewCardIndexes:
                      focusedFlashcardReviewCardIndexes || undefined,
                  })
                  setFlashcardResultsOpen(true)
                  return
                }

                moveToFlashcardIndex(
                  Math.min(activeCardEntries.length - 1, safeIndex + 1),
                )
              }}
            >
              <ArrowForwardIcon />
            </StudyRoundIconButton>
          </Stack>
        </Stack>
      </Box>
    )
  }

  if (type === 'QuizBlock') {
    const question = String(props.question || t('practice.question'))
    const displayQuestion = cleanGeneratedQuizQuestion(question)
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
            {renderMarkdownInline(displayQuestion)}
          </Typography>
          <Stack spacing={1}>
            {options.map((option, index) => {
              const displayOption = cleanGeneratedQuizOption(option)
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
              const verdict =
                showResult && isCorrect
                  ? {
                      icon: <CheckIcon fontSize="small" />,
                      label: isSelected
                        ? t('practice.thatsRight')
                        : t('practice.rightAnswer'),
                      color: 'success.main',
                    }
                  : showResult && isSelected
                  ? {
                      icon: <CloseIcon fontSize="small" />,
                      label: t('practice.notQuite'),
                      color: 'error.main',
                    }
                  : null

              return (
                <Box key={`${option}-${index}`} sx={{ width: '100%' }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => setSelectedIndex(index)}
                    sx={(theme) => {
                      const stateMain = isCorrect
                        ? theme.palette.success.main
                        : theme.palette.error.main

                      return {
                        width: '100%',
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        whiteSpace: 'normal',
                        color: 'text.primary',
                        borderColor: showResult ? resultColor : 'divider',
                        alignItems: 'stretch',
                        py: 1.25,
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
                    <Stack
                      component="span"
                      spacing={0.85}
                      sx={{ width: '100%', alignItems: 'stretch' }}
                    >
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ fontWeight: 400, overflowWrap: 'anywhere' }}
                      >
                        <Box component="span" sx={{ fontWeight: 700 }}>
                          {String.fromCharCode(65 + index)}.{' '}
                        </Box>
                        {renderMarkdownInline(displayOption)}
                      </Typography>
                      {verdict ? (
                        <Stack
                          component="span"
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                          sx={{ color: verdict.color, fontWeight: 800 }}
                        >
                          {verdict.icon}
                          <Typography
                            component="span"
                            variant="body2"
                            fontWeight={800}
                          >
                            {verdict.label}
                          </Typography>
                        </Stack>
                      ) : null}
                      {showResult && feedback ? (
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.secondary"
                          sx={{ lineHeight: 1.55 }}
                        >
                          {renderMarkdownInline(feedback)}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Button>
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
                {t('practice.hint')}
              </Button>
              {quizHintOpen ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  {renderMarkdownInline(hint)}
                </Typography>
              ) : null}
            </Box>
          ) : null}
          {selectedIndex !== null && explanation && (
            <Typography variant="body2" color="text.secondary">
              {renderMarkdownInline(explanation)}
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
            {t('practice.noQuizQuestions')}
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
      { label: t('practice.right'), value: correct, color: 'success.main' },
      { label: t('practice.wrong'), value: wrong, color: 'error.main' },
      { label: t('practice.skipped'), value: skipped, color: 'text.primary' },
    ]
    const persistQuizSession = (session: StoredFocusedQuizSession) => {
      writeStoredFocusedQuizSession(focusedQuizStorageKey, session)
    }

    // The quiz is what earns the topic. Below the floor the reader has not
    // shown they know it, so nothing is shown at all; in the band above it the
    // offer stands but says the pages are worth another pass; above the
    // confident mark the offer stands on its own.
    const showLearnedTopicOffer =
      canOfferLearnedTopic && scorePercent >= LEARNED_TOPIC_MIN_SCORE_PERCENT
    const suggestRevisingPages =
      scorePercent <= LEARNED_TOPIC_CONFIDENT_SCORE_PERCENT

    const topicIsClaimed = learnedTopicAdded || alreadyKnownTopic

    const addLearnedTopicFromQuiz = () => {
      addLearnedTopicToProfileContext(learnedTopicName)
      setLearnedTopicAdded(true)
    }

    // The bridge only works once the topic is in the reader's known topics, so
    // the follow-up guides are offered after the claim, never beside it. The
    // top nav bar owns the route change: it is mounted on both the guide
    // workspace and the guide list, and this block is not always in a router.
    const startSelectedNextGuides = () => {
      const prompts: StartNextStudyGuideRequest[] = nextGuideIdeas
        .filter((idea) => selectedIdeaPrompts.includes(idea.prompt))
        .map((idea) => ({
          prompt: idea.prompt.trim(),
          knownSkill: learnedTopicName,
        }))
        .filter((entry) => entry.prompt)

      if (prompts.length) {
        window.dispatchEvent(
          new CustomEvent(START_NEXT_STUDY_GUIDE_EVENT, { detail: { prompts } }),
        )
      }
    }

    const toggleIdeaSelection = (ideaPrompt: string) => {
      setSelectedIdeaPrompts((current) =>
        current.includes(ideaPrompt)
          ? current.filter((prompt) => prompt !== ideaPrompt)
          : [...current, ideaPrompt],
      )
    }

    const learnedTopicSection = !showLearnedTopicOffer ? null : (
      <Stack spacing={1.5}>
        {topicIsClaimed ? (
          <Paper
            variant="outlined"
            sx={(theme) => ({
              p: 2,
              borderRadius: 2,
              borderColor: alpha(theme.palette.success.main, 0.5),
              bgcolor: alpha(theme.palette.success.main, 0.08),
            })}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
            >
              <Typography variant="body2" sx={{ minWidth: 0 }}>
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {learnedTopicName}
                </Box>{' '}
                {t('practice.topicAddedToKnown')}
              </Typography>
              <Tooltip title={t('practice.skillAlreadyKnown')}>
                <Box component="span" sx={{ flexShrink: 0 }}>
                  <Button
                    variant="outlined"
                    disabled
                    startIcon={<CheckIcon fontSize="small" />}
                    sx={(theme) => ({
                      textTransform: 'none',
                      fontWeight: 700,
                      '&.Mui-disabled': {
                        color: theme.palette.success.main,
                        borderColor: alpha(theme.palette.success.main, 0.5),
                      },
                    })}
                  >
                    {t('practice.addTopicToKnown')}
                  </Button>
                </Box>
              </Tooltip>
            </Stack>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {learnedTopicName}
                </Typography>
                {suggestRevisingPages ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.25, lineHeight: 1.5 }}
                  >
                    {t('practice.addTopicRevisePages')}
                  </Typography>
                ) : null}
              </Box>
              <Button
                variant="contained"
                onClick={addLearnedTopicFromQuiz}
                sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700 }}
              >
                {t('practice.addTopicToKnown')}
              </Button>
            </Stack>
          </Paper>
        )}
        {topicIsClaimed && nextGuideIdeas.length ? (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              {t('practice.nextGuidesTitle')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: `repeat(${Math.min(nextGuideIdeas.length, 3)}, 1fr)`,
                },
              }}
            >
              {nextGuideIdeas.map((idea) => {
                const alreadyCreated = createdNextIdeaPrompts.has(idea.prompt)
                const selected = selectedIdeaPrompts.includes(idea.prompt)
                const card = (
                  <Paper
                    variant="outlined"
                    role="button"
                    aria-pressed={selected}
                    aria-disabled={alreadyCreated}
                    tabIndex={alreadyCreated ? -1 : 0}
                    onClick={
                      alreadyCreated
                        ? undefined
                        : () => toggleIdeaSelection(idea.prompt)
                    }
                    onKeyDown={(event) => {
                      if (
                        alreadyCreated ||
                        (event.key !== 'Enter' && event.key !== ' ')
                      ) {
                        return
                      }

                      event.preventDefault()
                      toggleIdeaSelection(idea.prompt)
                    }}
                    sx={(theme) => ({
                      height: '100%',
                      borderRadius: 2,
                      cursor: alreadyCreated ? 'default' : 'pointer',
                      borderColor: alreadyCreated
                        ? alpha(theme.palette.success.main, 0.5)
                        : selected
                          ? theme.palette.primary.main
                          : alpha(theme.palette.text.primary, 0.25),
                      // The padding pays back the thicker selected border, so
                      // picking a card never nudges the row.
                      borderWidth: selected ? 2 : 1,
                      padding: selected ? '11px' : '12px',
                      bgcolor: alreadyCreated
                        ? alpha(theme.palette.success.main, 0.08)
                        : selected
                          ? alpha(theme.palette.primary.main, 0.1)
                          : 'background.paper',
                      '&:hover': alreadyCreated
                        ? undefined
                        : {
                            borderColor: theme.palette.primary.main,
                            bgcolor: alpha(theme.palette.primary.main, 0.06),
                          },
                    })}
                  >
                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="flex-start"
                    >
                      {alreadyCreated || selected ? (
                        <CheckIcon
                          fontSize="small"
                          sx={{
                            mt: '2px',
                            color: alreadyCreated
                              ? 'success.main'
                              : 'primary.main',
                          }}
                        />
                      ) : null}
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        color={alreadyCreated ? 'success.main' : 'text.primary'}
                      >
                        {idea.label}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5, lineHeight: 1.5 }}
                    >
                      {idea.prompt}
                    </Typography>
                  </Paper>
                )

                return alreadyCreated ? (
                  <Tooltip
                    key={idea.label}
                    title={t('practice.nextGuideAlreadyCreated')}
                  >
                    <Box>{card}</Box>
                  </Tooltip>
                ) : (
                  <Box key={idea.label}>{card}</Box>
                )
              })}
            </Box>
            <Button
              variant="contained"
              disabled={!selectedIdeaPrompts.length}
              onClick={startSelectedNextGuides}
              sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700 }}
            >
              {t('practice.createSelectedGuides').replace(
                '{count}',
                String(selectedIdeaPrompts.length),
              )}
            </Button>
          </Paper>
        ) : null}
      </Stack>
    )

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
              {t('practice.quizComplete')}
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
                    background: `conic-gradient(${
                      theme.palette.success.main
                    } 0deg ${correctDegrees}deg, ${
                      theme.palette.error.main
                    } ${correctDegrees}deg ${
                      correctDegrees + wrongDegrees
                    }deg, ${theme.palette.action.selected} ${
                      correctDegrees + wrongDegrees
                    }deg 360deg)`,
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
            {learnedTopicSection}
            <Stack direction="row" spacing={1.25} justifyContent="center">
              <Button
                variant="outlined"
                onClick={() => {
                  const lastQuestionIndex = questions.length - 1
                  persistQuizSession({
                    questionIndex: lastQuestionIndex,
                    answers: focusedQuizAnswers,
                    resultsOpen: false,
                  })
                  setFocusedQuestionIndex(lastQuestionIndex)
                  setQuizResultsOpen(false)
                }}
              >
                {t('practice.previous')}
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  removeStoredFocusedQuizSession(focusedQuizStorageKey)
                  persistQuizSession(defaultFocusedQuizSession())
                  setFocusedQuizAnswers({})
                  setFocusedQuestionIndex(0)
                  setQuizHintOpen(false)
                  setQuizResultsOpen(false)
                }}
              >
                {t('practice.retakeQuiz')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )
    }

    return (
      <Box
        sx={(theme) => ({
          minHeight: {
            xs: 'auto',
            sm: 'calc(100dvh - 180px)',
            md: 'calc(100vh - 190px)',
          },
          display: 'grid',
          placeItems: { xs: 'start stretch', sm: 'center' },
          px: { xs: 0.5, sm: 1, md: 3 },
          py: { xs: 1, sm: 2, md: 4 },
          overflow: 'hidden',
          background: {
            xs: 'none',
            sm:
              theme.palette.mode === 'dark'
                ? `radial-gradient(circle at 50% 60%, ${alpha(
                    theme.palette.success.main,
                    0.16,
                  )} 0%, ${alpha(
                    theme.palette.primary.main,
                    0.09,
                  )} 34%, transparent 68%)`
                : `radial-gradient(circle at 50% 62%, ${alpha(
                    theme.palette.success.main,
                    0.18,
                  )} 0%, ${alpha(
                    theme.palette.primary.main,
                    0.11,
                  )} 38%, ${alpha(
                    theme.palette.success.light,
                    0.07,
                  )} 58%, transparent 78%)`,
          },
        })}
      >
        <Stack
          spacing={{ xs: 1.25, sm: 2.5 }}
          sx={{ width: 'min(820px, 100%)' }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            gap={{ xs: 0.75, sm: 2 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h5"
                fontWeight={600}
                sx={{
                  fontSize: { xs: '1.15rem', sm: '1.5rem' },
                  lineHeight: { xs: 1.18, sm: 1.25 },
                  overflowWrap: 'anywhere',
                }}
              >
                {renderMarkdownInline(title)}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.78rem', sm: '0.875rem' } }}
              >
                {safeIndex + 1} / {questions.length}
              </Typography>
            </Box>
          </Stack>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1.5, sm: 4 },
              borderRadius: { xs: 1.5, sm: 2 },
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={{ xs: 1.35, sm: 2.25 }}>
              <Typography
                variant="h5"
                sx={{
                  fontSize: { xs: '1.08rem', sm: '1.5rem' },
                  lineHeight: { xs: 1.25, sm: 1.35 },
                  fontWeight: 700,
                  overflowWrap: 'anywhere',
                }}
              >
                {renderMarkdownInline(
                  cleanGeneratedQuizQuestion(question.question),
                )}
              </Typography>
              <Stack spacing={{ xs: 0.75, sm: 1.25 }}>
                {question.options.map((option, index) => {
                  const displayOption = cleanGeneratedQuizOption(option)
                  const isCorrect = index === question.correctIndex
                  const isSelected = selected === index

                  const feedback = stripFeedbackVerdict(
                    feedbackForOption(question.optionFeedback, option),
                  )
                  const verdict =
                    hasAnswered && isCorrect
                      ? {
                          icon: <CheckIcon fontSize="small" />,
                          label: isSelected
                            ? t('practice.thatsRight')
                            : t('practice.rightAnswer'),
                          color: 'success.main',
                        }
                      : hasAnswered && isSelected
                      ? {
                          icon: <CloseIcon fontSize="small" />,
                          label: t('practice.notQuite'),
                          color: 'error.main',
                        }
                      : null

                  return (
                    <Box key={`${option}-${index}`} sx={{ width: '100%' }}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          if (hasAnswered) {
                            return
                          }

                          const nextAnswers = {
                            ...focusedQuizAnswers,
                            [safeIndex]: index,
                          }
                          persistQuizSession({
                            questionIndex: safeIndex,
                            answers: nextAnswers,
                            resultsOpen: false,
                          })
                          setFocusedQuizAnswers(nextAnswers)
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
                            width: '100%',
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            minHeight: { xs: 46, sm: 52 },
                            whiteSpace: 'normal',
                            color: 'text.primary',
                            borderColor: hasAnswered ? resultBorder : 'divider',
                            alignItems: 'stretch',
                            py: { xs: 0.9, sm: 1.25 },
                            px: { xs: 1.25, sm: 2 },
                            borderRadius: 1.25,
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
                        <Stack
                          component="span"
                          spacing={0.85}
                          sx={{ width: '100%', alignItems: 'stretch' }}
                        >
                          <Typography
                            component="span"
                            variant="body2"
                            sx={{
                              fontSize: { xs: '0.82rem', sm: '0.875rem' },
                              fontWeight: 400,
                              overflowWrap: 'anywhere',
                            }}
                          >
                            <Box component="span" sx={{ fontWeight: 700 }}>
                              {String.fromCharCode(65 + index)}.{' '}
                            </Box>
                            {renderMarkdownInline(displayOption)}
                          </Typography>
                          {verdict ? (
                            <Stack
                              component="span"
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                              sx={{ color: verdict.color, fontWeight: 800 }}
                            >
                              {verdict.icon}
                              <Typography
                                component="span"
                                variant="body2"
                                fontWeight={800}
                                sx={{
                                  fontSize: { xs: '0.86rem', sm: '0.875rem' },
                                }}
                              >
                                {verdict.label}
                              </Typography>
                            </Stack>
                          ) : null}
                          {hasAnswered && feedback ? (
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                fontSize: { xs: '0.82rem', sm: '0.875rem' },
                                lineHeight: 1.5,
                              }}
                            >
                              {renderMarkdownInline(feedback)}
                            </Typography>
                          ) : null}
                        </Stack>
                      </Button>
                    </Box>
                  )
                })}
              </Stack>
              {hasAnswered && (
                <Typography variant="body2" color="text.secondary">
                  {question.explanation
                    ? renderMarkdownInline(question.explanation)
                    : [
                        `${t('practice.correctAnswer')}: `,
                        ...renderMarkdownInline(question.answer),
                      ]}
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
                {renderMarkdownInline(question.hint)}
              </Typography>
            </Paper>
          ) : null}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, auto)',
              gap: 1.25,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <StudyRoundIconButton
              label={t('practice.previous')}
              disabled={safeIndex === 0}
              onClick={() => {
                const previousIndex = Math.max(0, safeIndex - 1)
                persistQuizSession({
                  questionIndex: previousIndex,
                  answers: focusedQuizAnswers,
                  resultsOpen: false,
                })
                setFocusedQuestionIndex(previousIndex)
              }}
            >
              <ArrowBackIcon />
            </StudyRoundIconButton>
            <Box
              sx={{
                minWidth: 0,
                height: { xs: 42, sm: 64 },
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!hasAnswered && question.hint ? (
                <StudyRoundIconButton
                  label={t('practice.hint')}
                  tone="hint"
                  showLabel
                  onClick={() => setQuizHintOpen((current) => !current)}
                >
                  <TipsAndUpdatesOutlinedIcon />
                </StudyRoundIconButton>
              ) : null}
              {hasAnswered ? (
                <StudyRoundIconButton
                  label={t('practice.explain')}
                  tone="explain"
                  showLabel
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
                  <ChatBubbleOutlineIcon />
                </StudyRoundIconButton>
              ) : null}
            </Box>
            <StudyRoundIconButton
              label={t('practice.next')}
              onClick={() => {
                if (safeIndex >= questions.length - 1) {
                  persistQuizSession({
                    questionIndex: safeIndex,
                    answers: focusedQuizAnswers,
                    resultsOpen: true,
                  })
                  setQuizResultsOpen(true)
                  return
                }

                const nextIndex = Math.min(questions.length - 1, safeIndex + 1)
                persistQuizSession({
                  questionIndex: nextIndex,
                  answers: focusedQuizAnswers,
                  resultsOpen: false,
                })
                setFocusedQuestionIndex(nextIndex)
              }}
            >
              <ArrowForwardIcon />
            </StudyRoundIconButton>
          </Box>
        </Stack>
      </Box>
    )
  }

  if (type === 'QuizzSingle') {
    const question = String(props.question || t('practice.question'))
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
            {renderMarkdownInline(question)}
          </Typography>
          <Stack spacing={1}>
            <TextField
              label={t('practice.answer')}
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
                {shortAnswerCorrect
                  ? t('practice.correct')
                  : [
                      `${t('practice.expected')}: `,
                      ...renderMarkdownInline(answer),
                    ]}
              </Typography>
            )}
          </Stack>
          {submittedShortAnswer && explanation && (
            <Typography variant="body2" color="text.secondary">
              {renderMarkdownInline(explanation)}
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
            {renderMarkdownInline(String(props.prompt || t('practice.prompt')))}
          </Typography>
          {revealed ? (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {renderMarkdownInline(String(props.hiddenText || ''))}
            </Typography>
          ) : (
            <Button variant="outlined" onClick={() => setRevealed(true)}>
              {String(props.revealLabel || t('practice.showAnswer'))}
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
    const isContextBridge = Boolean(props.contextBridge)
    const setTemporaryMode = (mode: string) => {
      setNoteMode(mode)
      writeStoredMode(noteStorageKey, mode)
    }

    if (isContextBridge) {
      return (
        <Box
          sx={(theme) => ({
            mb: 2,
            py: { xs: 1, sm: 1.25 },
            pr: { xs: 1, sm: 1.5 },
            pl: { xs: 1.5, sm: 2 },
            borderLeft: `4px solid ${theme.palette.primary.main}`,
            borderRadius: 1,
            backgroundColor: alpha(
              theme.palette.primary.main,
              theme.palette.mode === 'dark' ? 0.12 : 0.06,
            ),
          })}
        >
          <Stack spacing={1.1}>
            <Typography
              variant="subtitle1"
              fontWeight={800}
              color="primary"
              sx={{ lineHeight: 1.2 }}
            >
              Context Bridge
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {renderMarkdownInline(title)}
            </Typography>
            <Stack spacing={0.9}>{renderMarkdown(text, markdownOptions)}</Stack>
          </Stack>
        </Box>
      )
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
              {flipped ? t('practice.answer') : t('practice.prompt')}
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {renderMarkdownInline(flipped ? back : front)}
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
              {renderMarkdownInline(front)}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {renderMarkdownInline(back)}
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
              {renderMarkdownInline(title)}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {renderMarkdownInline(text)}
            </Typography>
          </Stack>
        </Paper>
      )
    }

    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.25}>
          <Typography variant="subtitle1" fontWeight={700}>
            {renderMarkdownInline(title)}
          </Typography>
          <Stack spacing={0.9}>{renderMarkdown(text, markdownOptions)}</Stack>
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
            {renderMarkdownInline(title)}
          </Typography>
        )}
        <Stack spacing={1.25}>
          {renderMarkdown(markdown, markdownOptions)}
        </Stack>
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

  if (type === 'PodcastBlock') {
    if (!podcast) {
      return (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Podcast data is unavailable.
          </Typography>
        </Paper>
      )
    }

    const content = (
      <Stack spacing={2}>
        <Stack spacing={0.75}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {renderMarkdownInline(podcast.title)}
            </Typography>
          </Stack>
          {podcast.description ? (
            <Typography variant="body2" color="text.secondary">
              {podcast.description}
            </Typography>
          ) : null}
        </Stack>

        <PodcastPagePlayer podcast={podcast} />

        {podcast.chapters.length > 0 ? (
          <Stack spacing={0.75}>
            <Typography variant="subtitle2" fontWeight={700}>
              Chapters
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {podcast.chapters.map((chapter, index) => (
                <Chip
                  key={`${chapter.startTurn}-${chapter.title}-${index}`}
                  label={chapter.title}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Stack>
        ) : null}

        <Stack spacing={1}>
          <Typography variant="subtitle2" fontWeight={700}>
            Transcript
          </Typography>
          <Stack spacing={1}>
            {podcast.transcriptTurns.map((turn, index) => (
              <Box key={`${turn.speaker}-${index}`}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                >
                  {turn.speaker === 'hostB' ? 'Host 2' : 'Host 1'}
                </Typography>
                <Typography variant="body2">{turn.text}</Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
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
                {renderMarkdownInline(title)}
              </Typography>
              {language && <Chip label={language} size="small" />}
            </Stack>
            {caption && (
              <Typography variant="caption" color="text.secondary">
                {renderMarkdownInline(caption)}
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
            {renderMarkdownInline(term)}
          </Typography>
          {showDefinition ? (
            <>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {renderMarkdownInline(definition)}
              </Typography>
              {example && (
                <Typography variant="body2" color="text.secondary">
                  Example: {renderMarkdownInline(example)}
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
          {renderMarkdownInline(String(props.title || 'Comparison'))}
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
                      {renderMarkdownInline(column)}
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
                      {renderMarkdownInline(row[cellIndex] || '')}
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
          {renderMarkdownInline(String(props.title || defaultTitle))}
        </Typography>
        <Box
          component={ordered ? 'ol' : 'ul'}
          sx={{ pl: interactive ? 0 : 3, my: 0 }}
        >
          {steps.map((step, index) => {
            const itemKey = createChecklistItemKey(step, index)
            const checked = checklistState.isChecked(itemKey)

            return (
              <Typography
                component="li"
                variant="body2"
                key={`${step}-${index}`}
                sx={{
                  mb: 0.5,
                  display: interactive ? 'flex' : 'list-item',
                  alignItems: 'center',
                  listStyle: interactive ? 'none' : undefined,
                  textDecoration: checked ? 'line-through' : 'none',
                  color: checked ? 'text.secondary' : 'text.primary',
                }}
              >
                {interactive && (
                  <Checkbox
                    size="small"
                    checked={checked}
                    inputProps={{ 'aria-label': step }}
                    onChange={(event) =>
                      checklistState.setChecked(itemKey, event.target.checked)
                    }
                    sx={{ mr: 0.5, p: 0.25 }}
                  />
                )}
                {renderMarkdownInline(step)}
              </Typography>
            )
          })}
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
              {renderMarkdownInline(String(props.title || 'Review this'))}
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
            {renderMarkdownInline(String(props.prompt || ''))}
          </Typography>
          {Boolean(props.reason) && props.reason !== props.prompt && (
            <Typography variant="body2" color="text.secondary">
              {renderMarkdownInline(String(props.reason))}
            </Typography>
          )}
        </Stack>
      </Paper>
    )
  }

  return null
}

export default StudyBlockView
