import React, { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'

import type { StudyPathContainerState } from '../../state/store'
import {
  deleteStudyGuidePage,
  getStudyGuidePageDepths,
  getStudyGuidePageNumberLabels,
  reorderStudyGuidePage,
} from '../../studyGuides/pages'
import type {
  StudyGuideGrowthSeed,
  StudyGuideGrowthTask,
} from '../../studyGuides/pageGrowth'
import StudyGuideAddPageMenu from './StudyGuideAddPageMenu'
import { collectPodcastAudioPathsFromPage } from '../../studyGuides/podcasts'
import { deleteHostedAiPodcastAudio } from '../../quickCreate/ai'
import { isStaticPodcastAudioPath } from '../podcast/PodcastPlayerProvider'
import { useInterfaceText } from '../../language/interfaceLanguage'

type StudyGuidePagesPanelVariant = 'desktop' | 'mobile'

const PAGES_PANEL_MIN_WIDTH = 220
const PAGES_PANEL_MAX_WIDTH = 440

const stripLeadingPageNumber = (title: string): string => {
  const cleanedTitle = title
    .replace(/^\s*\d{1,3}\s*(?:[-.):]|\u2013|\u2014)\s*/, '')
    .trim()

  return cleanedTitle || title
}

interface StudyGuidePagesPanelProps {
  studyPath: StudyPathContainerState
  onStudyPathChange: (studyPath: StudyPathContainerState) => void
  onAddPage?: () => void
  onPageSelected?: () => void
  variant: StudyGuidePagesPanelVariant
  /** Absent on read-only hosts such as the demo guide. */
  onGrowPage?: (seed: StudyGuideGrowthSeed) => void
  growPageCreditCost?: number
  /** Pages being written right now. Several can run at once. */
  growingPages?: StudyGuideGrowthTask[]
}

const pageIconButtonSx =
  (tone: 'primary' | 'error' = 'primary') =>
  (theme: Theme) => {
    const color =
      tone === 'error' ? theme.palette.error.main : theme.palette.primary.main

    return {
      width: 32,
      height: 32,
      border: 1,
      borderColor:
        tone === 'error' ? alpha(color, 0.36) : theme.palette.divider,
      bgcolor: 'background.paper',
      color,
      flex: '0 0 auto',
      '&:hover': {
        borderColor: tone === 'error' ? color : theme.palette.text.secondary,
        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.14 : 0.08),
      },
      '&.Mui-disabled': {
        borderColor: theme.palette.divider,
        bgcolor: theme.palette.action.disabledBackground,
        color: theme.palette.text.disabled,
        opacity: 0.72,
      },
    }
  }

const StudyGuidePagesPanel: React.FC<StudyGuidePagesPanelProps> = ({
  studyPath,
  onStudyPathChange,
  onAddPage,
  onPageSelected,
  variant,
  onGrowPage,
  growPageCreditCost,
  growingPages,
}) => {
  const { t } = useInterfaceText()
  const [open, setOpen] = useState(true)
  const [panelWidth, setPanelWidth] = useState(248)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)
  const [addPageAnchor, setAddPageAnchor] = useState<HTMLElement | null>(null)
  const [growNow, setGrowNow] = useState(0)
  const pageRowRefs = useRef<Array<HTMLDivElement | null>>([])
  const mobile = variant === 'mobile'
  const pageDepths = getStudyGuidePageDepths(studyPath)
  const pageNumberLabels = getStudyGuidePageNumberLabels(studyPath)
  const selectedIndex = Math.min(
    Math.max(studyPath.selectedIndex || 0, 0),
    Math.max(studyPath.dashboards.length - 1, 0),
  )

  const pendingPages = growingPages || []
  // A page takes long enough that a still spinner reads as a hang, so a clock
  // ticks while any page is being written.
  useEffect(() => {
    if (!pendingPages.length) {
      setGrowNow(0)
      return
    }

    const tick = () => setGrowNow(Date.now())
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [pendingPages.length])

  const selectPage = (index: number) => {
    onStudyPathChange({ ...studyPath, selectedIndex: index })
    onPageSelected?.()
  }

  const movePage = (fromIndex: number, toIndex: number) => {
    onStudyPathChange(reorderStudyGuidePage(studyPath, fromIndex, toIndex))
  }

  const deletePage = (pageKey: string) => {
    const page = studyPath.dashboards.find(
      (dashboard) => dashboard.dashboardKey === pageKey,
    )
    if (page) {
      collectPodcastAudioPathsFromPage(page)
        // Static demo audio lives in public/, so there is nothing to delete and
        // no signed-in user to delete it as.
        .filter((audioPath) => !isStaticPodcastAudioPath(audioPath))
        .forEach((audioPath) => {
          void deleteHostedAiPodcastAudio(audioPath).catch(() => undefined)
        })
    }

    onStudyPathChange(deleteStudyGuidePage(studyPath, pageKey))
  }

  const getInsertionIndex = (clientY: number): number => {
    const targetIndex = pageRowRefs.current.findIndex((row) => {
      if (!row) {
        return false
      }

      const rect = row.getBoundingClientRect()
      return clientY < rect.top + rect.height / 2
    })

    return targetIndex < 0 ? studyPath.dashboards.length : targetIndex
  }

  const allowPanelDrop = (event: React.DragEvent) => {
    if (mobile || draggedIndex === null) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setInsertionIndex(getInsertionIndex(event.clientY))
  }

  const dropPage = (event: React.DragEvent) => {
    event.preventDefault()
    const rawIndex = event.dataTransfer.getData('text/plain')
    const sourceIndex = draggedIndex ?? Number.parseInt(rawIndex, 10)
    const targetSlot = insertionIndex ?? getInsertionIndex(event.clientY)
    if (Number.isInteger(sourceIndex) && sourceIndex !== null) {
      const targetIndex = sourceIndex < targetSlot ? targetSlot - 1 : targetSlot
      movePage(
        sourceIndex,
        Math.max(0, Math.min(studyPath.dashboards.length - 1, targetIndex)),
      )
    }
    setDraggedIndex(null)
    setInsertionIndex(null)
  }

  const startPanelResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setPanelWidth(
        Math.max(
          PAGES_PANEL_MIN_WIDTH,
          Math.min(
            PAGES_PANEL_MAX_WIDTH,
            startWidth + moveEvent.clientX - startX,
          ),
        ),
      )
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

  if (!mobile && !open) {
    return (
      <Tooltip title={t('workspace.openPages')}>
        <Box
          component="button"
          type="button"
          aria-label={t('workspace.openPagesPanel')}
          onClick={() => setOpen(true)}
          sx={{
            width: 58,
            height: '100%',
            flex: '0 0 auto',
            border: 0,
            borderRight: 1,
            borderColor: 'divider',
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
            <MenuBookOutlinedIcon fontSize="small" />
          </Box>
          <Typography
            variant="caption"
            sx={{
              writingMode: 'vertical-rl',
              fontWeight: 500,
              color: 'primary.main',
            }}
          >
            {t('workspace.pages')}
          </Typography>
        </Box>
      </Tooltip>
    )
  }

  return (
    <Box
      data-testid={`study-guide-pages-panel-${variant}`}
      onDragOver={mobile ? undefined : allowPanelDrop}
      onDrop={mobile ? undefined : dropPage}
      sx={{
        width: mobile ? '100%' : panelWidth,
        height: '100%',
        flex: mobile ? 1 : '0 0 auto',
        minHeight: 0,
        borderRight: mobile ? 0 : 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{
          pl: 2.25,
          pr: 1.5,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          {t('workspace.pages')}
        </Typography>
        {!mobile ? (
          <Tooltip title={t('workspace.closePages')}>
            <IconButton
              size="small"
              aria-label={t('workspace.closePagesPanel')}
              onClick={() => setOpen(false)}
              sx={pageIconButtonSx()}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 0.75 }}>
        <Stack spacing={0.5}>
          {studyPath.dashboards.map((page, index) => {
            const active = index === selectedIndex
            const depth = pageDepths.get(page.dashboardKey) || 0
            const pageOrder =
              pageNumberLabels.get(page.dashboardKey) ||
              String(index + 1).padStart(2, '0')
            const pageTitle = stripLeadingPageNumber(page.name)
            return (
              <Box
                key={page.dashboardKey}
                ref={(element: HTMLDivElement | null) => {
                  pageRowRefs.current[index] = element
                }}
                data-testid={`study-guide-page-row-${index}`}
                data-drop-before={
                  !mobile && insertionIndex === index ? 'true' : undefined
                }
                draggable={!mobile}
                aria-label={
                  mobile
                    ? undefined
                    : `${t('workspace.dragPageToReorder')}: ${pageTitle}`
                }
                onDragStart={
                  mobile
                    ? undefined
                    : (event) => {
                        setDraggedIndex(index)
                        setInsertionIndex(index)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', String(index))
                      }
                }
                onDragEnd={
                  mobile
                    ? undefined
                    : () => {
                        setDraggedIndex(null)
                        setInsertionIndex(null)
                      }
                }
                sx={(theme) => ({
                  mx: 0,
                  // Pages dug out of another page sit under it, indented.
                  pl: 2.25 + depth * 1.5,
                  pr: mobile ? 0.75 : 1,
                  py: 0.5,
                  borderRadius: 1,
                  border: 1,
                  borderColor: active
                    ? alpha(theme.palette.primary.main, 0.24)
                    : 'transparent',
                  bgcolor: active
                    ? alpha(theme.palette.primary.main, 0.055)
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  position: 'relative',
                  opacity: draggedIndex === index ? 0.52 : 1,
                  cursor: mobile
                    ? 'default'
                    : draggedIndex === index
                      ? 'grabbing'
                      : 'grab',
                  transition: theme.transitions.create([
                    'background-color',
                    'border-color',
                    'opacity',
                    'transform',
                  ]),
                  animation: active
                    ? 'studymesh-page-row-selected 180ms ease-out'
                    : 'none',
                  '@keyframes studymesh-page-row-selected': {
                    '0%': {
                      transform: 'translateX(-4px)',
                      boxShadow: `0 0 0 0 ${alpha(
                        theme.palette.primary.main,
                        0.18,
                      )}`,
                    },
                    '100%': {
                      transform: 'translateX(0)',
                      boxShadow: `0 0 0 6px ${alpha(
                        theme.palette.primary.main,
                        0,
                      )}`,
                    },
                  },
                  '&::before': {
                    content: '""',
                    display: active
                      ? 'block'
                      : !mobile && insertionIndex === index
                        ? 'block'
                        : 'none',
                    position: 'absolute',
                    top: active ? 8 : -4,
                    bottom: active ? 8 : 'auto',
                    left: active ? theme.spacing(2.25) : 8,
                    right: active ? 'auto' : 4,
                    width: active ? 3 : 'auto',
                    height: active ? 'auto' : 3,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.82),
                    pointerEvents: 'none',
                  },
                  '&:hover': {
                    bgcolor: active
                      ? alpha(theme.palette.primary.main, 0.07)
                      : theme.palette.action.hover,
                  },
                  '&:hover .study-guide-page-delete-action, &:focus-within .study-guide-page-delete-action':
                    {
                      opacity: 1,
                      pointerEvents: 'auto',
                    },
                })}
              >
                <Button
                  onClick={() => selectPage(index)}
                  sx={{
                    minWidth: 0,
                    flex: 1,
                    px: 0,
                    pl: active ? 1.5 : 0,
                    py: 0.25,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    textTransform: 'none',
                    color: 'text.primary',
                    transition: 'padding-left 160ms ease-out',
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="flex-start"
                    minWidth={0}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{
                        minWidth: 24,
                        flex: '0 0 auto',
                        fontVariantNumeric: 'tabular-nums',
                        color: active ? 'primary.main' : 'text.secondary',
                        lineHeight: 1.4,
                      }}
                    >
                      {pageOrder}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={active ? 600 : 500}
                      sx={{
                        lineHeight: 1.25,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {pageTitle}
                    </Typography>
                  </Stack>
                </Button>
                {mobile ? (
                  <>
                    <IconButton
                      size="small"
                      aria-label={`${t('workspace.movePageUp')}: ${pageTitle}`}
                      disabled={index === 0}
                      onClick={() => movePage(index, index - 1)}
                      sx={pageIconButtonSx()}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`${t(
                        'workspace.movePageDown',
                      )}: ${pageTitle}`}
                      disabled={index === studyPath.dashboards.length - 1}
                      onClick={() => movePage(index, index + 1)}
                      sx={pageIconButtonSx()}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </>
                ) : null}
                {page.deletable ? (
                  <Tooltip title={t('workspace.deletePage')}>
                    <IconButton
                      className="study-guide-page-delete-action"
                      size="small"
                      aria-label={`${t('workspace.deletePage')}: ${pageTitle}`}
                      onClick={() => deletePage(page.dashboardKey)}
                      sx={(theme) => ({
                        ...pageIconButtonSx('error')(theme),
                        mr: mobile ? 0 : 0.25,
                        opacity: mobile ? 1 : 0,
                        pointerEvents: mobile ? 'auto' : 'none',
                        transition: theme.transitions.create([
                          'background-color',
                          'border-color',
                          'opacity',
                        ]),
                      })}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Box>
            )
          })}
          {!mobile ? (
            <Box
              data-testid="study-guide-page-end-slot"
              data-drop-active={
                insertionIndex === studyPath.dashboards.length
                  ? 'true'
                  : undefined
              }
              sx={{
                height: 3,
                mx: 1.25,
                borderRadius: 999,
                bgcolor:
                  insertionIndex === studyPath.dashboards.length
                    ? 'primary.main'
                    : 'transparent',
                pointerEvents: 'none',
              }}
            />
          ) : null}
        </Stack>
      </Box>
      {onAddPage || onGrowPage ? (
        <Box sx={{ p: 1.25, borderTop: 1, borderColor: 'divider' }}>
          {pendingPages.length ? (
            <Stack spacing={0.5} sx={{ mb: 1 }}>
              {pendingPages.map((pending) => (
                <Box
                  key={pending.id}
                  data-testid="study-guide-growing-page"
                  sx={(theme) => ({
                    px: 1,
                    py: 0.75,
                    borderRadius: 1,
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.34),
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                  })}
                >
                  <CircularProgress size={14} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      noWrap
                      display="block"
                    >
                      {t('workspace.growingPage')}
                    </Typography>
                    {pending.label ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        display="block"
                        sx={{ fontSize: '0.7rem' }}
                      >
                        {pending.label}
                      </Typography>
                    ) : null}
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      fontSize: '0.7rem',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {Math.max(
                      0,
                      Math.floor(
                        ((growNow || pending.startedAt) - pending.startedAt) /
                          1000,
                      ),
                    )}
                    s
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : null}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddIcon fontSize="small" />}
            onClick={(event) => {
              // Without growth wired up the button keeps its old behaviour of
              // dropping a blank page straight in.
              if (!onGrowPage) {
                onAddPage?.()
                return
              }

              setAddPageAnchor(event.currentTarget)
            }}
            sx={{
              borderRadius: 1,
              textTransform: 'none',
              bgcolor: 'background.paper',
              borderColor: 'divider',
              color: 'text.primary',
              '&.Mui-disabled': {
                borderColor: 'divider',
                color: 'text.disabled',
              },
            }}
          >
            {t('workspace.addPage')}
          </Button>
        </Box>
      ) : null}
      {onGrowPage ? (
        <StudyGuideAddPageMenu
          studyPath={studyPath}
          anchorEl={addPageAnchor}
          open={Boolean(addPageAnchor)}
          mobile={mobile}
          busyLessonTitles={pendingPages
            .map((pending) => pending.lessonTitle)
            .filter((title): title is string => Boolean(title))}
          creditCost={growPageCreditCost}
          onClose={() => setAddPageAnchor(null)}
          onGrow={onGrowPage}
          onAddBlankPage={onAddPage}
        />
      ) : null}
      {!mobile ? (
        <Box
          role="separator"
          aria-label={t('workspace.resizePagesPanel')}
          onMouseDown={startPanelResize}
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: 9,
            cursor: 'col-resize',
            zIndex: 3,
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: 2,
              borderRadius: 999,
              bgcolor: 'divider',
            },
            '&:hover::after': { bgcolor: 'primary.main' },
          }}
        />
      ) : null}
    </Box>
  )
}

export default StudyGuidePagesPanel
