import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import EditIcon from '@mui/icons-material/Edit'
import SubdirectoryArrowLeftIcon from '@mui/icons-material/SubdirectoryArrowLeft'
import VisibilityIcon from '@mui/icons-material/Visibility'
import {
  DashboardLayout,
  StudyGuideQuickStart,
  StudyGuideQuickStartView,
  StudyPathContainerState,
} from '../../state/store'
import {
  getStudyGuidePageMarkdown,
  isEditableMarkdownStudyGuidePage,
  updateStudyGuideMarkdownPage,
  getStudyGuidePageNumberLabels,
} from '../../studyGuides/pages'
import type {
  StudyGuideGrowthSeed,
  StudyGuideGrowthTask,
} from '../../studyGuides/pageGrowth'
import StudyGuideLinearLayout from './StudyGuideLinearLayout'
import StudyGuidePageEditor from './StudyGuidePageEditor'
import { useNavigate } from 'react-router-dom'
import StudyGuidePagesPanel from './StudyGuidePagesPanel'
import { useInterfaceText } from '../../language/interfaceLanguage'
import { renderMarkdownInline } from '../study/StudyBlockView'
import TextSelectionActionBar from '../workspace/TextSelectionActionBar'
import {
  CITATION_HIGHLIGHT_REGISTRY_NAME,
  clearRegistryHighlight,
  paintTransientHighlight,
} from '../workspace/textSelectionHighlights'

type PageIconTone = 'primary' | 'error'

const pageIconButtonSx =
  (tone: PageIconTone = 'primary') =>
  (theme: Theme) => {
    const paletteColor =
      tone === 'error' ? theme.palette.error.main : theme.palette.primary.main
    const hoverColor =
      tone === 'error' ? theme.palette.error.dark : theme.palette.primary.dark

    return {
      width: 32,
      height: 32,
      border: 1,
      borderColor:
        tone === 'error' ? alpha(paletteColor, 0.36) : theme.palette.divider,
      bgcolor: 'background.paper',
      color: paletteColor,
      flex: '0 0 auto',
      '&:hover': {
        borderColor:
          tone === 'error' ? paletteColor : alpha(paletteColor, 0.54),
        bgcolor: alpha(
          paletteColor,
          theme.palette.mode === 'dark' ? 0.14 : 0.08,
        ),
        color: hoverColor,
      },
      '&.Mui-disabled': {
        borderColor: theme.palette.divider,
        bgcolor: theme.palette.action.disabledBackground,
        color: theme.palette.text.disabled,
        opacity: 0.72,
      },
    }
  }

interface StudyPathWorkspaceViewProps {
  studyPath: StudyPathContainerState
  onStudyPathChange: (studyPath: StudyPathContainerState) => void
  pageScrollPositionsRef?: React.MutableRefObject<Record<string, number>>
  editingPageKey?: string | null
  onEditingPageKeyChange?: (pageKey: string | null) => void
  onAddPage?: () => void
  /** Absent on read-only hosts such as the demo guide. */
  onGrowPage?: (seed: StudyGuideGrowthSeed) => void
  growPageCreditCost?: number
  growingPages?: StudyGuideGrowthTask[]
  onAskAi?: (question: string) => void
  /** Overrides the default "My guides" crumb, e.g. for the public /try demo. */
  breadcrumb?: { label: string; onClick: () => void }
  /**
   * Follow-up ideas the reader already turned into a guide. Resolved by the
   * page, which owns the guide store; the demo has no guides so it sends none.
   */
  createdNextIdeaPrompts?: string[]
  /** Set when an AI Chat citation with a source quote was just clicked. */
  pendingCitationHighlight?: {
    dashboardKey: string
    quote: string
    /** Source text to try when the model's quote is not on the page at all. */
    fallbackQuote?: string
    requestId: number
  } | null
}

const quickSummaryParagraphs = (value: string): string[] =>
  value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

const setElementScrollTop = (element: HTMLElement, top: number) => {
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top, behavior: 'auto' })
    return
  }

  element.scrollTop = top
}

const StudyGuideQuickStartCard = ({
  quickStart,
  selectedView,
  onViewChange,
  expanded,
  onToggle,
  t,
}: {
  quickStart: StudyGuideQuickStart
  selectedView: StudyGuideQuickStartView
  onViewChange: (view: StudyGuideQuickStartView) => void
  expanded: boolean
  onToggle: () => void
  t: ReturnType<typeof useInterfaceText>['t']
}) => {
  const forcedBridge = quickStart.forcedBridge
  const activeQuickStart =
    selectedView === 'context' && forcedBridge ? forcedBridge : quickStart

  const plainLabel = t('workspace.plainQuickStart')
  const viaLabel = (topics: string[]) =>
    t('workspace.viaTopics').replace('{topics}', topics.join(', '))
  const defaultSegmentLabel = quickStart.bridgeTopics?.length
    ? viaLabel(quickStart.bridgeTopics)
    : plainLabel
  const contextSegmentLabel = forcedBridge?.bridgeTopics?.length
    ? viaLabel(forcedBridge.bridgeTopics)
    : plainLabel
  const renderTabLabel = (
    label: string,
    badge?: { text: string; tooltip: string },
  ) =>
    badge ? (
      <Stack direction="row" spacing={0.75} alignItems="center">
        <span>{label}</span>
        <Tooltip title={badge.tooltip}>
          <Chip
            label={badge.text}
            size="small"
            color="warning"
            variant="outlined"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Tooltip>
      </Stack>
    ) : (
      label
    )
  // The default segment always leads as the stronger match, so it never
  // needs a caveat badge of its own; only the alternate context segment can
  // trail with either a weak-fit reason (topic bridge) or a generic-fit
  // notice (plain explanation losing to a confident topic bridge).
  const contextFitBadge = forcedBridge?.weakFitReason
    ? { text: t('workspace.weakBadge'), tooltip: forcedBridge.weakFitReason }
    : forcedBridge && !forcedBridge.bridgeTopics?.length
      ? {
          text: t('workspace.genericBadge'),
          tooltip: t('workspace.genericBadgeReason'),
        }
      : undefined

  return (
    <Box
      sx={{
        px: { xs: 1, md: 3 },
        pt: { xs: 1, md: 3 },
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Paper
        variant="outlined"
        data-testid="study-guide-quick-start-card"
        sx={{
          width: '100%',
          maxWidth: 960,
          borderRadius: 2,
          p: { xs: 2, md: 2.5 },
          bgcolor: 'background.paper',
        }}
      >
        <Stack spacing={expanded ? 2 : 0}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={2}
          >
            <Box minWidth={0}>
              <Typography variant="subtitle1" fontWeight={800}>
                {t('workspace.quickStart')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('workspace.keyIdeaBeforeReading')}
              </Typography>
            </Box>
            <Tooltip
              title={
                expanded
                  ? t('workspace.collapseQuickStart')
                  : t('workspace.expandQuickStart')
              }
            >
              <IconButton
                size="small"
                aria-label={
                  expanded
                    ? t('workspace.collapseQuickStart')
                    : t('workspace.expandQuickStart')
                }
                onClick={onToggle}
                sx={pageIconButtonSx()}
              >
                {expanded ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Stack>
          {expanded ? (
            <Stack spacing={1.75}>
              {forcedBridge && (
                <Tabs
                  value={selectedView}
                  onChange={(_event, value: StudyGuideQuickStartView) =>
                    onViewChange(value)
                  }
                  sx={{
                    minHeight: 0,
                    borderBottom: 1,
                    borderColor: 'divider',
                    '& .MuiTab-root': {
                      minHeight: 0,
                      minWidth: 'auto',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      py: 0.75,
                      px: 1,
                      mr: 2,
                      color: 'text.secondary',
                    },
                    '& .Mui-selected': {
                      color: 'primary.main',
                    },
                  }}
                >
                  <Tab
                    value="default"
                    label={renderTabLabel(
                      defaultSegmentLabel,
                      quickStart.weakFitReason
                        ? {
                            text: t('workspace.weakBadge'),
                            tooltip: quickStart.weakFitReason,
                          }
                        : undefined,
                    )}
                  />
                  <Tab
                    value="context"
                    label={renderTabLabel(contextSegmentLabel, contextFitBadge)}
                  />
                </Tabs>
              )}
              <Box>
                <Typography
                  variant="overline"
                  color="primary"
                  fontWeight={800}
                  sx={{ letterSpacing: 0 }}
                >
                  {t('workspace.keyIdea')}
                </Typography>
                <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
                  {renderMarkdownInline(activeQuickStart.keyIdea)}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="overline"
                  color="primary"
                  fontWeight={800}
                  sx={{ letterSpacing: 0 }}
                >
                  {t('workspace.quickSummary')}
                </Typography>
                <Stack spacing={1}>
                  {quickSummaryParagraphs(activeQuickStart.quickSummary).map(
                    (paragraph, index) => (
                      <Typography
                        key={`${paragraph.slice(0, 24)}-${index}`}
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.7 }}
                      >
                        {renderMarkdownInline(paragraph)}
                      </Typography>
                    ),
                  )}
                </Stack>
              </Box>
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  )
}

const sanitizeStudentWidgetName = (name?: string): string | undefined => {
  if (!name) {
    return name
  }

  if (/\bmisc\b/i.test(name)) {
    return 'Extra practice'
  }

  return name.replace(/\s*\(?\d+\s+(study\s+)?objects?\)?/gi, '').trim() || name
}

const sanitizeStudentComponent = (component: unknown): unknown => {
  if (typeof component !== 'object' || component === null) {
    return component
  }

  const record = component as Record<string, unknown>
  const props =
    typeof record.props === 'object' && record.props !== null
      ? ({ ...(record.props as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : undefined

  if (props) {
    if (
      typeof props.description === 'string' &&
      /study objects?/i.test(props.description)
    ) {
      delete props.description
    }

    if (typeof props.title === 'string') {
      props.title = sanitizeStudentWidgetName(props.title)
    }
  }

  return props ? { ...record, props } : record
}

const sanitizeStudentLayout = (
  layout?: DashboardLayout,
): DashboardLayout | undefined => {
  if (!layout) {
    return layout
  }

  const customProps = layout.config?.customProps
  const nextCustomProps = customProps
    ? {
        ...customProps,
        components: Array.isArray(customProps.components)
          ? customProps.components.map(sanitizeStudentComponent)
          : customProps.components,
      }
    : undefined

  return {
    ...layout,
    name: sanitizeStudentWidgetName(layout.name),
    config: layout.config
      ? {
          ...layout.config,
          customProps: nextCustomProps,
        }
      : layout.config,
    children: layout.children?.map(
      (child) => sanitizeStudentLayout(child) as DashboardLayout,
    ),
  }
}

const StudyPathWorkspaceView: React.FC<StudyPathWorkspaceViewProps> = ({
  studyPath,
  onStudyPathChange,
  pageScrollPositionsRef: externalPageScrollPositionsRef,
  editingPageKey = null,
  onEditingPageKeyChange,
  onAddPage,
  onGrowPage,
  growPageCreditCost,
  growingPages,
  onAskAi,
  breadcrumb,
  createdNextIdeaPrompts,
  pendingCitationHighlight,
}) => {
  const { t } = useInterfaceText()
  const theme = useTheme()
  const navigate = useNavigate()
  const showPageRail = useMediaQuery(theme.breakpoints.up('lg'))
  const pageScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const internalPageScrollPositionsRef = useRef<Record<string, number>>({})
  const pageScrollPositionsRef =
    externalPageScrollPositionsRef || internalPageScrollPositionsRef
  const lastPathIdRef = useRef(studyPath.pathId)
  const handledCitationRequestIdRef = useRef<number | null>(null)
  const [quickStartExpanded, setQuickStartExpanded] = useState(true)
  const quickStartView =
    studyPath.quickStartView === 'context' ? 'context' : 'default'
  const selectedIndex = Math.min(
    Math.max(studyPath.selectedIndex || 0, 0),
    Math.max(studyPath.dashboards.length - 1, 0),
  )
  const currentLesson = studyPath.dashboards[selectedIndex]
  const currentPageKey = currentLesson?.dashboardKey || null
  const currentPageEditable = isEditableMarkdownStudyGuidePage(currentLesson)
  const currentPageNumberLabel = currentPageKey
    ? getStudyGuidePageNumberLabels(studyPath).get(currentPageKey)
    : undefined
  // A page dug out of another one offers a way back up; root pages do not.
  const parentPage = useMemo(() => {
    const parentKey = currentLesson?.parentPageKey
    if (!parentKey) {
      return null
    }

    const index = studyPath.dashboards.findIndex(
      (dashboard) => dashboard.dashboardKey === parentKey,
    )
    return index < 0 ? null : { index, name: studyPath.dashboards[index].name }
  }, [currentLesson?.parentPageKey, studyPath.dashboards])
  const showQuickStart =
    selectedIndex === 0 &&
    Boolean(studyPath.quickStart?.keyIdea && studyPath.quickStart.quickSummary)
  const isEditingCurrentPage =
    currentPageEditable && currentPageKey === editingPageKey
  const currentMarkdown = getStudyGuidePageMarkdown(currentLesson)
  const editorPageLinks = useMemo(
    () =>
      studyPath.dashboards
        .filter((dashboard) => dashboard.dashboardKey !== currentPageKey)
        .map((dashboard) => ({
          title: dashboard.name || 'Untitled page',
          dashboardKey: dashboard.dashboardKey,
        })),
    [currentPageKey, studyPath.dashboards],
  )
  const studentLayout = useMemo(
    () => sanitizeStudentLayout(currentLesson?.layout),
    [currentLesson?.layout],
  )
  // Which guide and page the blocks on screen belong to. Handed down so blocks
  // that key off the guide work on every guide, not only ones generated after
  // they started needing it.
  const studyPathContext = useMemo(
    () => ({
      studyPathId: studyPath.pathId,
      studyPathTitle: studyPath.title,
      studyPathFolderName: studyPath.folderName,
      studyPathDashboardKey: currentPageKey || undefined,
      studyPathDashboardName: currentLesson?.name,
      // Passed live rather than through per-page widget props so guides made
      // before this existed still fall back to the title.
      studyPathLearnedSkillOptions: studyPath.learnedSkillOptions,
      studyPathNextGuideIdeas: studyPath.nextGuideIdeas,
      studyPathCreatedNextIdeaPrompts: createdNextIdeaPrompts,
    }),
    [
      createdNextIdeaPrompts,
      currentLesson?.name,
      currentPageKey,
      studyPath.folderName,
      studyPath.learnedSkillOptions,
      studyPath.nextGuideIdeas,
      studyPath.pathId,
      studyPath.title,
    ],
  )

  useEffect(() => {
    setQuickStartExpanded(true)
  }, [studyPath.pathId])

  useLayoutEffect(() => {
    if (lastPathIdRef.current === studyPath.pathId) {
      return
    }

    pageScrollPositionsRef.current = {}
    lastPathIdRef.current = studyPath.pathId
  }, [pageScrollPositionsRef, studyPath.pathId])

  useLayoutEffect(() => {
    const scrollContainer = pageScrollContainerRef.current
    if (!scrollContainer || !currentPageKey) {
      return
    }

    setElementScrollTop(
      scrollContainer,
      pageScrollPositionsRef.current[currentPageKey] ?? 0,
    )
  }, [currentPageKey])

  // A chat citation click already switched to this page (currentPageKey); once
  // it finishes rendering, find the quoted sentence and scroll it into view.
  // Runs after the scroll-restore effect above, so it refines that scroll
  // rather than fighting it.
  useEffect(() => {
    if (
      !pendingCitationHighlight ||
      pendingCitationHighlight.dashboardKey !== currentPageKey ||
      pendingCitationHighlight.requestId === handledCitationRequestIdRef.current
    ) {
      return undefined
    }

    let cancelled = false
    let clearTimer: number | null = null
    let frame: number | null = null

    const attempt = (retriesLeft: number) => {
      if (cancelled) {
        return
      }

      const container = pageScrollContainerRef.current
      if (!container) {
        // The page subtree can still be mid-mount right after a citation
        // click switches pages. Retry a few frames before giving up, instead
        // of marking the request handled against a container that was never
        // there to search.
        if (retriesLeft > 0) {
          frame = window.requestAnimationFrame(() => attempt(retriesLeft - 1))
        } else {
          handledCitationRequestIdRef.current =
            pendingCitationHighlight.requestId
        }
        return
      }

      // The caller never clears pendingCitationHighlight (clicking the same
      // citation twice needs a second run, and nulling it out from here would
      // race a fast second click), so the requestId comparison above is what
      // stops re-runs — mark handled now that a real search actually ran.
      handledCitationRequestIdRef.current = pendingCitationHighlight.requestId

      // The model's quote can drift far enough to exist nowhere on the page.
      // Falling back to the cited source's own text keeps the click useful
      // instead of silently navigating with nothing highlighted.
      const range = [
        pendingCitationHighlight.quote,
        pendingCitationHighlight.fallbackQuote,
      ].reduce<Range | null>(
        (found, candidate) =>
          found ||
          (candidate
            ? paintTransientHighlight(
                container,
                candidate,
                CITATION_HIGHLIGHT_REGISTRY_NAME,
              )
            : null),
        null,
      )

      if (range) {
        const anchor =
          range.startContainer.nodeType === Node.ELEMENT_NODE
            ? (range.startContainer as Element)
            : range.startContainer.parentElement
        anchor?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        clearTimer = window.setTimeout(() => {
          clearRegistryHighlight(CITATION_HIGHLIGHT_REGISTRY_NAME)
        }, 3000)
        // eslint-disable-next-line no-undef
      } else if (process.env.NODE_ENV === 'development') {
        // Silent no-op otherwise: the page still navigated, so a quote that
        // does not exist on the page is invisible without this.
        console.warn(
          '[citation-highlight] quote not found on page',
          pendingCitationHighlight.quote,
        )
      }
    }

    // Let the page finish its render/layout pass after the switch before
    // searching its text.
    frame = window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => attempt(3)),
    )

    return () => {
      cancelled = true
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
      if (clearTimer !== null) {
        window.clearTimeout(clearTimer)
      }
    }
  }, [pendingCitationHighlight, currentPageKey])

  const saveCurrentPageScroll = () => {
    if (!currentPageKey || !pageScrollContainerRef.current) {
      return
    }

    pageScrollPositionsRef.current[currentPageKey] =
      pageScrollContainerRef.current.scrollTop
  }

  const handlePageScroll = () => {
    saveCurrentPageScroll()
  }

  const selectLesson = (index: number) => {
    saveCurrentPageScroll()
    onStudyPathChange({ ...studyPath, selectedIndex: index })
  }

  const handleStudyPathChange = (nextStudyPath: StudyPathContainerState) => {
    saveCurrentPageScroll()
    onStudyPathChange(nextStudyPath)
  }

  const setQuickStartView = (view: StudyGuideQuickStartView) => {
    if (view === quickStartView) {
      return
    }

    onStudyPathChange({ ...studyPath, quickStartView: view })
  }

  const handleAddPage = () => {
    saveCurrentPageScroll()
    onAddPage?.()
  }

  const handleGrowPage = (seed: StudyGuideGrowthSeed) => {
    saveCurrentPageScroll()
    onGrowPage?.(seed)
  }

  const updateCurrentMarkdownPage = (title: string, markdown: string) => {
    if (!currentLesson) {
      return
    }

    onStudyPathChange(
      updateStudyGuideMarkdownPage(studyPath, currentLesson.dashboardKey, {
        title,
        markdown,
      }),
    )
  }

  const toggleCurrentPageEditing = () => {
    if (!currentLesson) {
      return
    }

    onEditingPageKeyChange?.(
      isEditingCurrentPage ? null : currentLesson.dashboardKey,
    )
  }

  if (!currentLesson) {
    return (
      <Paper sx={{ p: 3, m: 2 }}>
        <Typography variant="h6">{t('workspace.emptyStudyGuide')}</Typography>
        <Typography color="text.secondary">
          {t('workspace.emptyStudyGuideBody')}
        </Typography>
      </Paper>
    )
  }

  const canGoPrevious = selectedIndex > 0
  const canGoNext = selectedIndex < studyPath.dashboards.length - 1

  return (
    <Box
      data-testid="study-path-workspace"
      sx={{
        height: '100%',
        minHeight: 0,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          flex: '0 0 auto',
          px: { xs: 1.5, md: 2.25 },
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'nowrap',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          minWidth={0}
          sx={{ flex: '1 1 auto' }}
        >
          {showPageRail ? (
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                onClick={
                  breadcrumb
                    ? breadcrumb.onClick
                    : () => navigate('/study-guides')
                }
                sx={{ cursor: 'pointer' }}
              >
                {breadcrumb ? breadcrumb.label : t('workspace.myGuides')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                /
              </Typography>
            </>
          ) : null}
          <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              sx={{
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: { xs: 2, md: 1 },
              }}
            >
              {currentLesson.name}
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              flexWrap="wrap"
            >
              <Typography variant="caption" color="text.secondary">
                {t('workspace.pageLabel')}{' '}
                {currentPageNumberLabel || selectedIndex + 1}/
                {studyPath.dashboards.length}
              </Typography>
              {parentPage ? (
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<SubdirectoryArrowLeftIcon fontSize="small" />}
                  label={t('workspace.pageParentReturn').replace(
                    '{title}',
                    parentPage.name,
                  )}
                  onClick={() => selectLesson(parentPage.index)}
                  data-testid="study-guide-parent-page-chip"
                  sx={(theme) => ({
                    height: 22,
                    maxWidth: 220,
                    color: 'text.primary',
                    borderColor: theme.palette.divider,
                    bgcolor: 'background.paper',
                    '& .MuiChip-icon': { color: 'text.secondary', ml: 0.5 },
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.42),
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                    },
                  })}
                />
              ) : null}
            </Stack>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          flexWrap="nowrap"
          sx={{ flex: '0 0 auto' }}
        >
          {currentPageEditable ? (
            <Tooltip
              title={
                isEditingCurrentPage
                  ? t('workspace.previewCurrentPage')
                  : t('workspace.editCurrentPage')
              }
            >
              <IconButton
                size="small"
                aria-label={
                  isEditingCurrentPage
                    ? t('workspace.previewCurrentPage')
                    : t('workspace.editCurrentPage')
                }
                onClick={toggleCurrentPageEditing}
                sx={pageIconButtonSx()}
              >
                {isEditingCurrentPage ? (
                  <VisibilityIcon fontSize="small" />
                ) : (
                  <EditIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          ) : null}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Tooltip title={t('workspace.previousPage')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('workspace.previousPage')}
                  disabled={!canGoPrevious}
                  onClick={() => selectLesson(selectedIndex - 1)}
                  sx={pageIconButtonSx()}
                >
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('workspace.nextPage')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('workspace.nextPage')}
                  disabled={!canGoNext}
                  onClick={() => selectLesson(selectedIndex + 1)}
                  sx={pageIconButtonSx()}
                >
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>
      <Box
        data-testid="study-path-dashboard-content"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {showPageRail ? (
          <StudyGuidePagesPanel
            studyPath={studyPath}
            onStudyPathChange={handleStudyPathChange}
            onAddPage={handleAddPage}
            variant="desktop"
            onGrowPage={onGrowPage ? handleGrowPage : undefined}
            growPageCreditCost={growPageCreditCost}
            growingPages={growingPages}
          />
        ) : null}
        <Box
          ref={pageScrollContainerRef}
          data-testid="study-path-page-scroll-container"
          onScroll={handlePageScroll}
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: isEditingCurrentPage ? 2 : 0,
          }}
        >
          {isEditingCurrentPage ? (
            <StudyGuidePageEditor
              title={currentLesson.name}
              markdown={currentMarkdown}
              onChange={updateCurrentMarkdownPage}
              pageLinks={editorPageLinks}
            />
          ) : (
            <>
              {showQuickStart && studyPath.quickStart ? (
                <StudyGuideQuickStartCard
                  quickStart={studyPath.quickStart}
                  selectedView={quickStartView}
                  onViewChange={setQuickStartView}
                  expanded={quickStartExpanded}
                  onToggle={() => setQuickStartExpanded((current) => !current)}
                  t={t}
                />
              ) : null}
              <StudyGuideLinearLayout
                key={currentLesson.dashboardKey}
                layout={studentLayout}
                studyPathContext={studyPathContext}
                onAskAi={onAskAi}
              />
            </>
          )}
        </Box>
      </Box>
      <TextSelectionActionBar
        containerRef={pageScrollContainerRef}
        scopeKey={
          currentPageKey ? `${studyPath.pathId}:${currentPageKey}` : null
        }
        enabled={!isEditingCurrentPage}
        contextLabel={currentLesson.name}
        onAskAi={onAskAi}
        onGrowPage={
          onGrowPage && currentPageKey
            ? (selection) =>
                handleGrowPage({
                  kind: 'fragment',
                  sourcePageKey: currentPageKey,
                  selection,
                })
            : undefined
        }
        growPageCreditCost={growPageCreditCost}
      />
    </Box>
  )
}

export default StudyPathWorkspaceView
