import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import CloseIcon from '@mui/icons-material/Close'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import type { StudyGuideRecord } from '../../cloud/types'
import { createCloudRepository } from '../../cloud/repository'
import { useAuth } from '../../auth/AuthProvider'
import { isSupabaseConfigured, supabase } from '../../auth/supabaseClient'
import type { StateDashboard, StudyPathContainerState } from '../../state/store'
import {
  normalizeQuickCreateActionInput,
  type QuickCreateActionInput,
} from '../../quickCreate/quickCreateActions'
import StudyPathWorkspaceView from '../Dasboard/StudyPathWorkspaceView'
import type { StudyPathMasteryOffer } from '../Dasboard/GuideMasteryOffer'
import StudyGuidePagesPanel from '../Dasboard/StudyGuidePagesPanel'
import DashboardChatPanel, {
  type DashboardAnswerSourceRef,
  type DashboardChatMessage,
} from '../dashboardChat/DashboardChatPanel'
import type { DashboardExternalSource } from '../../dashboardChat/externalSources'
import TopNavBar from '../topnavbar/TopNavBar'
import Main from '../Main'
import {
  appendStudyGuideMarkdownPage,
  createMarkdownStudyGuidePageLayout,
  getStudyGuideCreationSourceText,
  getStudyGuidePageText,
} from '../../studyGuides/pages'
import {
  appendGeneratedStudyGuidePage,
  createAiPodcastPageDraft,
  createAiQuickCreatePageDraft,
  type AiGeneratedStudyGuidePage,
} from '../../studyGuides/generation'
import {
  STUDY_GUIDES_STORAGE_FULL_MESSAGE,
  StudyGuideStorage,
  createStudyGuideRecord,
  isStudyGuidesStorageQuotaError,
} from '../../studyGuides/storage'
import {
  createStudyGuidePageHref,
  OPEN_STUDY_GUIDE_PAGE_LINK_EVENT,
  type OpenStudyGuidePageLinkDetail,
} from '../../studyGuides/pageLinks'
import {
  addLearnedTopicToProfileContext,
  isLearnedTopicPromptResolved,
  isUserKnownTopic,
  resolveLearnedTopicPrompt,
} from '../../profileContext'
import {
  getGuideMasteryProof,
  guideHasQuiz,
  GUIDE_QUIZ_COMPLETED_EVENT,
  readGuideMastery,
  recordGuideExplainResult,
  recordGuideQuizScore,
  type GuideMasteryRecord,
  type GuideQuizCompletedDetail,
} from '../../studyGuides/mastery'
import {
  buildNextGuideIdeas,
  setPendingCreationPrompt,
  type NextGuideIdea,
} from '../../studyGuides/nextGuideIdeas'
import { useInterfaceText } from '../../language/interfaceLanguage'

export const AI_CHAT_MIN_WIDTH = 310
const AI_CHAT_MAX_WIDTH = 720
const AI_CHAT_RAIL_WIDTH = 58

const stripAssistantSourcesFooter = (content: string): string =>
  content.replace(/\s*\(?Sources:\s*[\s\S]*?\)?\s*$/i, '').trim()

const assistantCitationGroupPattern =
  /(?:\[\d{1,2}\]|(?:(?<=[\u00a0\u202f])\d{1,2}(?:\s+\d{1,2})*|\d{1,2}(?=\s*\[\d{1,2}\]))(?=\s*(?:\[\d{1,2}\]|[.,;:!?)]|$)))+/g

const assistantCitationNumbersFromMatch = (
  citationMatch: RegExpMatchArray,
): number[] => {
  if (citationMatch[1]) {
    return [Number(citationMatch[1])]
  }

  return citationMatch[2].split('').map((digit) => Number(digit))
}

const normalizeGeneratedPageLayouts = (
  studyPath: StudyPathContainerState,
): StudyPathContainerState => {
  const count = studyPath.dashboards.length
  return {
    ...studyPath,
    dashboards: studyPath.dashboards.map((dashboard, index) => {
      const pageKey =
        dashboard.dashboardKey || `${studyPath.pathId}-${index + 1}`
      return {
        ...dashboard,
        dashboardKey: pageKey,
        dashboardIndex: index + 1,
        dashboardCount: count,
        createdBy: dashboard.createdBy || 'generator',
        deletable: dashboard.deletable ?? false,
        layout:
          dashboard.layout ||
          createMarkdownStudyGuidePageLayout({
            studyPath,
            pageKey,
            title: dashboard.name,
            markdown: `# ${dashboard.name}`,
            pageIndex: index + 1,
            pageCount: count,
          }),
      }
    }),
  }
}

const isStudyGuidesStorageFullError = (error: unknown): boolean =>
  (error instanceof Error &&
    error.message === STUDY_GUIDES_STORAGE_FULL_MESSAGE) ||
  isStudyGuidesStorageQuotaError(error)

const isOpenableStudyGuideRecord = (
  value: StudyGuideRecord | null,
): value is StudyGuideRecord => Array.isArray(value?.studyPath?.dashboards)

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'

// A guide "finishes" when every page has been opened at least once. Single-page
// guides are excluded so the suggestion never fires the moment one is opened.
const hasReadEveryPage = (record: StudyGuideRecord): boolean => {
  const pageKeys = record.studyPath.dashboards
    .map((dashboard) => dashboard.dashboardKey)
    .filter(Boolean)
  if (pageKeys.length < 2) {
    return false
  }

  const visitedPageKeys = new Set(record.visitedPageKeys || [])
  return pageKeys.every((pageKey) => visitedPageKeys.has(pageKey))
}

interface LearnedTopicPromptState {
  studyGuideId: string
  topic: string
  status: 'offered' | 'added'
}

/**
 * Guides generated without practice have no quiz to pass, so finishing every
 * page stays the proof for those. Where a quiz exists, the score decides.
 */
const isGuideProvenByReading = (record: StudyGuideRecord): boolean =>
  !guideHasQuiz(record)

const GuideWorkspacePage = () => {
  const { t } = useInterfaceText()
  const { user } = useAuth()
  const repository = useMemo(() => createCloudRepository(supabase), [])
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'))
  const { studyGuideId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState<StudyGuideRecord | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loadingRemoteRecord, setLoadingRemoteRecord] = useState(false)
  const [messages, setMessages] = useState<DashboardChatMessage[]>([])
  const [editingPageKey, setEditingPageKey] = useState<string | null>(null)
  const [quickCreateError, setQuickCreateError] = useState('')
  const [workspaceStorageError, setWorkspaceStorageError] = useState(false)
  const [queuedChatDraft, setQueuedChatDraft] = useState<{
    id: string
    content: string
  } | null>(null)
  const [aiChatOpen, setAiChatOpen] = useState(true)
  const [aiChatWidth, setAiChatWidth] = useState(AI_CHAT_MIN_WIDTH)
  const [learnedTopicPrompt, setLearnedTopicPrompt] =
    useState<LearnedTopicPromptState | null>(null)
  const [mastery, setMastery] = useState<GuideMasteryRecord>({})
  const pageScrollPositionsRef = useRef<Record<string, number>>({})
  const [mobileSection, setMobileSection] = useState<
    'pages' | 'study-guide' | 'ai-chat'
  >('study-guide')
  const recordRef = useRef<StudyGuideRecord | null>(null)
  const quickCreateCommitRecordRef = useRef<StudyGuideRecord | null>(null)
  const quickCreateCommitStudyPathRef = useRef<StudyPathContainerState | null>(
    null,
  )
  const quickCreateCommitQueueRef = useRef(Promise.resolve())
  const isCreateRoute = searchParams.get('create') === '1'

  useEffect(() => {
    recordRef.current = record
    if (
      !quickCreateCommitRecordRef.current ||
      quickCreateCommitRecordRef.current.id !== record?.id
    ) {
      quickCreateCommitRecordRef.current = record
      quickCreateCommitStudyPathRef.current = record?.studyPath || null
    }
  }, [record])

  const loadRecord = () => {
    if (!studyGuideId) {
      return
    }
    const existing = StudyGuideStorage.getById(studyGuideId)
    if (existing) {
      recordRef.current = existing
      quickCreateCommitRecordRef.current = existing
      quickCreateCommitStudyPathRef.current = existing.studyPath
      setRecord(existing)
      setNotFound(false)
      setLoadingRemoteRecord(false)
      return
    }

    recordRef.current = null
    quickCreateCommitRecordRef.current = null
    quickCreateCommitStudyPathRef.current = null
    setRecord(null)
    const hasSummary = Boolean(StudyGuideStorage.getSummaryById(studyGuideId))
    setNotFound(!isCreateRoute && !hasSummary)
    if (isCreateRoute) {
      navigate('/study-guides', { replace: true })
    }
  }

  useEffect(loadRecord, [studyGuideId, isCreateRoute])

  useEffect(() => {
    if (
      record ||
      notFound ||
      isCreateRoute ||
      !studyGuideId ||
      !user ||
      !isSupabaseConfigured ||
      !StudyGuideStorage.getSummaryById(studyGuideId)
    ) {
      return undefined
    }

    let cancelled = false
    setLoadingRemoteRecord(true)
    repository
      .getStudyGuide(user.id, studyGuideId)
      .then((cloudRecord) => {
        if (cancelled) {
          return
        }
        if (isOpenableStudyGuideRecord(cloudRecord)) {
          setLoadingRemoteRecord(false)
          setRecord(StudyGuideStorage.cacheFromCloud(cloudRecord))
          setNotFound(false)
        } else {
          setLoadingRemoteRecord(false)
          setNotFound(true)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load Quick Guide from cloud', error)
          setLoadingRemoteRecord(false)
          setNotFound(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRemoteRecord(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isCreateRoute, notFound, record, repository, studyGuideId, user])

  useEffect(() => {
    pageScrollPositionsRef.current = {}
    setLearnedTopicPrompt(null)
    setMastery(readGuideMastery(studyGuideId))
  }, [studyGuideId])

  useEffect(() => {
    const handleQuizCompleted = (event: Event) => {
      const detail = (event as CustomEvent<GuideQuizCompletedDetail>).detail
      const currentId = recordRef.current?.id
      if (!currentId || !detail || !Number.isFinite(detail.scorePercent)) {
        return
      }

      setMastery(recordGuideQuizScore(currentId, detail.scorePercent))
    }

    window.addEventListener(GUIDE_QUIZ_COMPLETED_EVENT, handleQuizCompleted)

    return () => {
      window.removeEventListener(
        GUIDE_QUIZ_COMPLETED_EVENT,
        handleQuizCompleted,
      )
    }
  }, [])

  const dashboard = useMemo<StateDashboard | undefined>(() => {
    if (!record) {
      return undefined
    }

    return {
      id: record.id,
      name: record.title,
      kind: 'studyPathContainer',
      studyPath: record.studyPath,
    }
  }, [record])

  useEffect(() => {
    if (!record) {
      return
    }

    const currentPage =
      record.studyPath.dashboards[record.studyPath.selectedIndex] ||
      record.studyPath.dashboards[0]
    const pageKey = currentPage?.dashboardKey
    if (!pageKey || record.visitedPageKeys?.includes(pageKey)) {
      return
    }

    try {
      const nextRecord = StudyGuideStorage.markVisitedPage(record.id, pageKey)
      if (nextRecord) {
        setRecord((current) =>
          current?.id === record.id
            ? {
                ...current,
                visitedPageKeys: nextRecord.visitedPageKeys,
              }
            : nextRecord,
        )
      }
    } catch (error) {
      if (!handleStorageError(error)) {
        throw error
      }
    }
  }, [record?.id, record?.studyPath.selectedIndex])

  const masteryProof = useMemo(() => getGuideMasteryProof(mastery), [mastery])
  const canClaimSkill = Boolean(
    record && (masteryProof.proven || isGuideProvenByReading(record)),
  )

  useEffect(() => {
    const topic = record?.title?.trim() || ''
    if (
      !record ||
      !topic ||
      (!hasReadEveryPage(record) && !masteryProof.proven) ||
      isLearnedTopicPromptResolved(record.id) ||
      isUserKnownTopic(topic)
    ) {
      return
    }

    setLearnedTopicPrompt((current) =>
      current?.studyGuideId === record.id
        ? current
        : { studyGuideId: record.id, topic, status: 'offered' },
    )
  }, [canClaimSkill, masteryProof.proven, record])

  const addLearnedTopicToKnownTopics = () => {
    if (!learnedTopicPrompt || !canClaimSkill) {
      return
    }

    addLearnedTopicToProfileContext(learnedTopicPrompt.topic)
    resolveLearnedTopicPrompt(learnedTopicPrompt.studyGuideId, 'added')
    setLearnedTopicPrompt({ ...learnedTopicPrompt, status: 'added' })
  }

  const persistStudyPath = (
    studyPath: StudyPathContainerState,
    baseRecord: StudyGuideRecord | null = recordRef.current,
  ) => {
    const normalized = normalizeGeneratedPageLayouts(studyPath)
    try {
      const currentRecord = baseRecord
      const nextRecord = currentRecord
        ? StudyGuideStorage.save({
            ...currentRecord,
            title: normalized.title || currentRecord.title,
            folderName: normalized.folderName || currentRecord.folderName,
            studyPath: normalized,
          })
        : StudyGuideStorage.save(
            createStudyGuideRecord(normalized, {
              id: studyGuideId,
            }),
          )
      recordRef.current = nextRecord
      quickCreateCommitRecordRef.current = nextRecord
      quickCreateCommitStudyPathRef.current = nextRecord.studyPath
      setRecord(nextRecord)
      return nextRecord
    } catch (error) {
      if (handleStorageError(error)) {
        return null
      }

      throw error
    }
  }

  const appendMarkdownPage = (
    title: string,
    markdown: string,
    source: 'manual' | 'chat' | 'quickCreate',
  ) => {
    if (!record) {
      return false
    }

    return Boolean(
      persistStudyPath(
        appendStudyGuideMarkdownPage(record.studyPath, {
          title,
          markdown,
          source,
        }),
      ),
    )
  }

  const addManualPage = () => {
    if (!record) {
      return false
    }

    const nextStudyPath = appendStudyGuideMarkdownPage(record.studyPath, {
      title: t('workspace.untitledPage'),
      markdown: '',
      source: 'manual',
    })
    const nextRecord = persistStudyPath(nextStudyPath)
    if (!nextRecord) {
      return false
    }
    const newPage =
      nextRecord.studyPath.dashboards[nextRecord.studyPath.selectedIndex]
    setEditingPageKey(newPage?.dashboardKey || null)
    return true
  }

  const linkAssistantCitations = (message: DashboardChatMessage): string => {
    const content = stripAssistantSourcesFooter(message.content)
    if (!message.sourceRefs?.length) {
      return content
    }

    return content.replace(assistantCitationGroupPattern, (citationGroup) => {
      const linkedCitations = [
        ...citationGroup.matchAll(/\[(\d{1,2})\]|(\d{1,2})/g),
      ].flatMap((citationMatch) =>
        assistantCitationNumbersFromMatch(citationMatch).map(
          (citationNumber) => {
            const source = message.sourceRefs?.find(
              (candidate) => candidate.citationNumber === citationNumber,
            )
            return source?.dashboardKey
              ? `[${citationNumber}](${createStudyGuidePageHref(
                  source.dashboardKey,
                )})`
              : `[${citationNumber}]`
          },
        ),
      )

      return linkedCitations.join(' ')
    })
  }

  const addAssistantMessageToGuide = (message: DashboardChatMessage) => {
    const contentWithLinks = linkAssistantCitations(message)

    appendMarkdownPage(t('workspace.aiChatNote'), contentWithLinks, 'chat')
  }

  const addExternalSourceToGuide = (source: DashboardExternalSource) => {
    if (!source.guidePageDraft) {
      return
    }

    const added = appendMarkdownPage(
      source.guidePageDraft.title || source.title || t('workspace.webSource'),
      source.guidePageDraft.markdown,
      'chat',
    )
    if (!added) {
      return
    }
    setMobileSection('study-guide')
  }

  const showStorageFullError = () => {
    setWorkspaceStorageError(true)
  }

  const handleStorageError = (error: unknown): boolean => {
    if (!isStudyGuidesStorageFullError(error)) {
      return false
    }

    showStorageFullError()
    return true
  }

  const openStudyGuidePageKey = (dashboardKey: string) => {
    if (!record) {
      return
    }

    const pageIndex = record.studyPath.dashboards.findIndex(
      (dashboard) => dashboard.dashboardKey === dashboardKey,
    )
    if (pageIndex < 0) {
      return
    }

    const nextRecord = persistStudyPath({
      ...record.studyPath,
      selectedIndex: pageIndex,
    })
    if (!nextRecord) {
      return
    }
    setMobileSection('study-guide')
  }

  const openChatSource = (source: DashboardAnswerSourceRef) => {
    if (source.dashboardKey) {
      openStudyGuidePageKey(source.dashboardKey)
      return
    }

    if (source.url) {
      window.open(source.url, '_blank', 'noopener,noreferrer')
    }
  }

  const askAiFromStudyBlock = (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) {
      return
    }

    setAiChatOpen(true)
    setMobileSection('ai-chat')
    setQueuedChatDraft({
      id: `study-block-explain-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`,
      content: trimmed,
    })
  }

  useEffect(() => {
    const handleStudyGuidePageLink = (event: Event) => {
      const detail = (event as CustomEvent<OpenStudyGuidePageLinkDetail>).detail
      if (detail?.dashboardKey) {
        openStudyGuidePageKey(detail.dashboardKey)
      }
    }

    window.addEventListener(
      OPEN_STUDY_GUIDE_PAGE_LINK_EVENT,
      handleStudyGuidePageLink,
    )

    return () => {
      window.removeEventListener(
        OPEN_STUDY_GUIDE_PAGE_LINK_EVENT,
        handleStudyGuidePageLink,
      )
    }
  }, [record?.studyPath])

  const enqueueQuickCreatePageCommit = (
    page: AiGeneratedStudyGuidePage,
    resourceType: QuickCreateActionInput,
    signal?: AbortSignal,
  ) => {
    const commit = quickCreateCommitQueueRef.current.then(() => {
      if (signal?.aborted) {
        return
      }

      const latestRecord =
        quickCreateCommitRecordRef.current || recordRef.current
      if (!latestRecord) {
        return
      }

      const latestStudyPath =
        quickCreateCommitStudyPathRef.current || latestRecord.studyPath
      const nextStudyPath = appendGeneratedStudyGuidePage(latestStudyPath, page)
      const nextRecord = persistStudyPath(
        nextStudyPath,
        quickCreateCommitRecordRef.current || latestRecord,
      )
      if (!nextRecord) {
        return
      }
      quickCreateCommitRecordRef.current = nextRecord
      quickCreateCommitStudyPathRef.current = nextRecord.studyPath

      const request = normalizeQuickCreateActionInput(resourceType)
      const newPage =
        nextRecord.studyPath.dashboards[nextRecord.studyPath.selectedIndex]
      if (request.resourceType === 'improvedNotes') {
        setEditingPageKey(newPage?.dashboardKey || null)
      }
    })

    quickCreateCommitQueueRef.current = commit.catch(() => undefined)
    return commit
  }

  const quickCreatePage = async (
    input: QuickCreateActionInput,
    options?: { signal?: AbortSignal },
  ) => {
    const sourceRecord = recordRef.current || record
    if (!sourceRecord) {
      return
    }
    if (
      !quickCreateCommitRecordRef.current ||
      quickCreateCommitRecordRef.current.id !== sourceRecord.id
    ) {
      quickCreateCommitRecordRef.current = sourceRecord
      quickCreateCommitStudyPathRef.current = sourceRecord.studyPath
    }

    const request = normalizeQuickCreateActionInput(input)
    setQuickCreateError('')
    const currentPage =
      sourceRecord.studyPath.dashboards[sourceRecord.studyPath.selectedIndex] ||
      sourceRecord.studyPath.dashboards[0]
    const currentPageText = getStudyGuidePageText(currentPage)
    const studyGuideSourceText = getStudyGuideCreationSourceText(
      sourceRecord.studyPath,
    )
    const useCurrentPage = request.sourceScope === 'currentPage'
    const sourceText = useCurrentPage
      ? currentPageText || studyGuideSourceText || sourceRecord.studyPath.title
      : studyGuideSourceText ||
        currentPageText ||
        sourceRecord.studyPath.title ||
        t('workspace.studyGuide')
    const sourceTitle = useCurrentPage
      ? currentPage?.name || sourceRecord.title
      : sourceRecord.studyPath.title || sourceRecord.title

    try {
      const page =
        request.resourceType === 'podcast'
          ? await createAiPodcastPageDraft({
              studyPath: sourceRecord.studyPath,
              sourceTitle,
              sourceText,
              sourceScope: useCurrentPage ? 'currentPage' : 'studyGuide',
              signal: options?.signal,
            })
          : await createAiQuickCreatePageDraft({
              studyPath: sourceRecord.studyPath,
              resourceType: request.resourceType,
              sourceTitle,
              sourceText,
              signal: options?.signal,
            })
      if (options?.signal?.aborted) {
        return
      }

      await enqueueQuickCreatePageCommit(page, request, options?.signal)
    } catch (error) {
      if (isAbortError(error)) {
        return
      }

      setQuickCreateError(
        error instanceof Error
          ? error.message
          : t('workspace.couldNotCreatePage'),
      )
    }
  }

  const nextGuideIdeas = useMemo(
    () => (record ? buildNextGuideIdeas(record) : []),
    [record],
  )
  const nextGuideIdeaLabel = (idea: NextGuideIdea): string =>
    idea.kind === 'apply'
      ? t('nextGuides.apply')
      : `${
          idea.kind === 'deeper' ? t('nextGuides.deeper') : t('nextGuides.next')
        }${idea.focus ? `: ${idea.focus}` : ''}`

  /**
   * The creation panel lives on the workspace route, so the prompt is handed
   * over rather than generated here. It stays editable, and nothing is spent
   * until the learner presses generate.
   */
  const startNextGuide = (idea: NextGuideIdea) => {
    const topic = learnedTopicPrompt?.topic || record?.title || ''
    const known = `${t('nextGuides.alreadyKnow')} ${topic}.`
    const focus = idea.focus || topic
    const ask =
      idea.kind === 'deeper'
        ? `${t('nextGuides.deeperPrompt')} ${focus}.`
        : idea.kind === 'apply'
          ? t('nextGuides.applyPrompt')
          : `${t('nextGuides.nextPrompt')} ${focus}.`

    setPendingCreationPrompt(`${known} ${ask}`)
    navigate('/workspace')
  }

  const masteryOffer: StudyPathMasteryOffer | undefined =
    record && learnedTopicPrompt
      ? {
          studyGuideId: record.id,
          topic: learnedTopicPrompt.topic,
          sourceText: getStudyGuideCreationSourceText(record.studyPath),
          status: learnedTopicPrompt.status,
          canClaimSkill,
          onPassed: () =>
            setMastery(recordGuideExplainResult(record.id, true)),
          onAddSkill: addLearnedTopicToKnownTopics,
          nextGuideIdeas,
          nextGuideIdeaLabel,
          onExpandOnThis: () => quickCreatePage('improvedNotes'),
          onStartNextGuide: startNextGuide,
        }
      : undefined

  const startAiChatResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = aiChatWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const availableWidth = Math.max(
        AI_CHAT_MIN_WIDTH,
        window.innerWidth - 520,
      )
      const maxWidth = Math.min(AI_CHAT_MAX_WIDTH, availableWidth)
      const nextWidth = Math.max(
        AI_CHAT_MIN_WIDTH,
        Math.min(maxWidth, startWidth + startX - moveEvent.clientX),
      )
      setAiChatWidth(nextWidth)
    }

    const stopResize = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopResize)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResize)
  }

  const studyGuidePanel = record ? (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        border: isMobile ? 1 : 0,
        borderColor: 'divider',
        borderRadius: isMobile ? 1.5 : 0,
        bgcolor: 'background.paper',
        position: 'relative',
        flex: 1,
      }}
    >
      <StudyPathWorkspaceView
        studyPath={record.studyPath}
        onStudyPathChange={persistStudyPath}
        pageScrollPositionsRef={pageScrollPositionsRef}
        editingPageKey={editingPageKey}
        onEditingPageKeyChange={setEditingPageKey}
        onAddPage={addManualPage}
        onAskAi={askAiFromStudyBlock}
        masteryOffer={masteryOffer}
      />
    </Paper>
  ) : null

  const pagesPanel = record ? (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        position: 'relative',
        display: 'flex',
      }}
    >
      <StudyGuidePagesPanel
        studyPath={record.studyPath}
        onStudyPathChange={persistStudyPath}
        onPageSelected={() => setMobileSection('study-guide')}
        onAddPage={() => {
          if (addManualPage()) {
            setMobileSection('study-guide')
          }
        }}
        variant="mobile"
      />
    </Paper>
  ) : null

  const chatPanel = record ? (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        border: isMobile ? 1 : 0,
        borderColor: 'divider',
        borderRadius: isMobile ? 1.5 : 0,
        bgcolor: 'background.paper',
        position: 'relative',
      }}
    >
      <DashboardChatPanel
        dashboard={dashboard}
        messages={messages}
        onMessagesChange={setMessages}
        onStorageError={handleStorageError}
        onClose={() =>
          isMobile ? setMobileSection('study-guide') : setAiChatOpen(false)
        }
        showCloseButton={!isMobile}
        onAddAssistantMessageToGuide={addAssistantMessageToGuide}
        onAddExternalSourceToGuide={addExternalSourceToGuide}
        onOpenSource={openChatSource}
        onQuickCreatePage={quickCreatePage}
        supportsStudyGuideCreateScope
        queuedDraft={queuedChatDraft}
        onQueuedDraftConsumed={(id) =>
          setQueuedChatDraft((current) => (current?.id === id ? null : current))
        }
      />
      {quickCreateError ? (
        <Alert
          severity="error"
          action={
            <IconButton
              aria-label="Dismiss alert"
              size="small"
              onClick={() => setQuickCreateError('')}
              sx={{
                flexShrink: 0,
                color: 'error.dark',
                bgcolor: alpha(theme.palette.error.main, 0.08),
                border: 1,
                borderColor: alpha(theme.palette.error.main, 0.24),
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.16),
                },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          sx={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            maxWidth: 420,
            zIndex: 10,
            '& .MuiAlert-action': {
              alignItems: 'flex-start',
              ml: 'auto',
              pl: 1,
            },
          }}
        >
          {quickCreateError}
        </Alert>
      ) : null}
    </Paper>
  ) : null

  return (
    <Box
      sx={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TopNavBar creationHost="external" />
      <Main
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          height: 'auto',
          marginTop: 0,
          overflow: 'hidden',
          p: 0,
        }}
      >
        {notFound ? (
          <Box
            sx={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'background.default',
              p: 2,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                width: 'min(520px, 100%)',
                p: 4,
                borderRadius: 3,
                border: 1,
                borderColor: 'divider',
                textAlign: 'center',
              }}
            >
              <Typography variant="h5" fontWeight={600}>
                {t('workspace.notFoundTitle')}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                {t('workspace.notFoundBody')}
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/study-guides')}
              >
                {t('workspace.backToGuides')}
              </Button>
            </Paper>
          </Box>
        ) : record ? (
          <Box
            sx={{
              height: '100%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              p: isMobile ? 1 : 0,
              bgcolor: 'background.default',
              overflow: 'hidden',
            }}
          >
            {workspaceStorageError ? (
              <Alert
                severity="warning"
                action={
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => navigate('/study-guides')}
                    >
                      {t('workspace.backToGuides')}
                    </Button>
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => setWorkspaceStorageError(false)}
                    >
                      {t('settings.close')}
                    </Button>
                  </Box>
                }
                sx={{
                  flex: '0 0 auto',
                  m: isMobile ? 0 : 1,
                  mb: isMobile ? 1 : 0,
                  alignItems: 'center',
                }}
              >
                {t('studyGuides.storageFullMessage')}
              </Alert>
            ) : null}
            {isMobile ? (
              <>
                <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {mobileSection === 'pages'
                    ? pagesPanel
                    : mobileSection === 'study-guide'
                      ? studyGuidePanel
                      : chatPanel}
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 0.75,
                    pt: 0.75,
                    pb: 'calc(0.75rem + env(safe-area-inset-bottom))',
                    bgcolor: 'background.default',
                    flex: '0 0 auto',
                  }}
                >
                  {[
                    ['pages', t('workspace.pages')],
                    ['study-guide', t('workspace.studyGuide')],
                    ['ai-chat', t('workspace.aiChat')],
                  ].map(([key, label]) => (
                    <Button
                      key={key}
                      size="small"
                      variant={mobileSection === key ? 'contained' : 'outlined'}
                      onClick={() =>
                        setMobileSection(
                          key as 'pages' | 'study-guide' | 'ai-chat',
                        )
                      }
                      sx={{ borderRadius: 1, textTransform: 'none' }}
                    >
                      {label}
                    </Button>
                  ))}
                </Box>
              </>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  gap: 0,
                  overflow: 'hidden',
                }}
              >
                {studyGuidePanel}
                <Box
                  sx={{
                    width: aiChatOpen ? aiChatWidth : AI_CHAT_RAIL_WIDTH,
                    flex: '0 0 auto',
                    minHeight: 0,
                    overflow: 'hidden',
                    position: 'relative',
                    transition: theme.transitions.create('width', {
                      duration: theme.transitions.duration.shorter,
                    }),
                  }}
                >
                  {aiChatOpen ? (
                    chatPanel
                  ) : (
                    <Tooltip title={t('topnav.openAiChat')}>
                      <Box
                        component="button"
                        type="button"
                        aria-label={t('workspace.openAiChatPanel')}
                        onClick={() => setAiChatOpen(true)}
                        sx={{
                          width: '100%',
                          height: '100%',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 0,
                          bgcolor: 'background.paper',
                          color: 'text.secondary',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0.75,
                          py: 1,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            width: 32,
                            height: 32,
                            display: 'grid',
                            placeItems: 'center',
                            color: 'primary.main',
                          }}
                        >
                          <ChatBubbleOutlineIcon fontSize="small" />
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            writingMode: 'vertical-rl',
                            fontWeight: 500,
                            color: 'primary.main',
                          }}
                        >
                          {t('workspace.aiChat')}
                        </Typography>
                      </Box>
                    </Tooltip>
                  )}
                  {aiChatOpen ? (
                    <Box
                      role="separator"
                      aria-label={t('workspace.resizeAiChat')}
                      onMouseDown={startAiChatResize}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: 8,
                        cursor: 'col-resize',
                        zIndex: 2,
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          width: 2,
                          borderRadius: 1,
                          bgcolor: 'divider',
                        },
                        '&:hover::after': { bgcolor: 'primary.main' },
                      }}
                    />
                  ) : null}
                </Box>
              </Box>
            )}
          </Box>
        ) : loadingRemoteRecord ? (
          <Box
            sx={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'background.default',
              p: 2,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                width: 'min(420px, 100%)',
                p: 4,
                borderRadius: 3,
                border: 1,
                borderColor: 'divider',
                textAlign: 'center',
              }}
            >
              <CircularProgress size={28} />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                {t('workspace.loadingGuide')}
              </Typography>
            </Paper>
          </Box>
        ) : null}
      </Main>
    </Box>
  )
}

export default GuideWorkspacePage
