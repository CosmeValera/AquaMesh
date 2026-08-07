import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Divider, GlobalStyles, IconButton, Paper, Tooltip } from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import CheckIcon from '@mui/icons-material/Check'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import FormatColorResetOutlinedIcon from '@mui/icons-material/FormatColorResetOutlined'

import { useInterfaceText } from '../../language/interfaceLanguage'
import { PREFILL_DASHBOARD_CHAT_EVENT } from './workspaceEvents'
import {
  buildContainerTextIndex,
  buildSelectionAiPrompt,
  CITATION_HIGHLIGHT_REGISTRY_NAME,
  clearPaintedHighlights,
  createHighlightId,
  describeSelection,
  findHighlightsOverlappingSpan,
  paintStoredHighlights,
  readStoredHighlights,
  TEXT_HIGHLIGHT_REGISTRY_NAME,
  writeStoredHighlights,
  type StoredTextHighlight,
  type TextSpan,
} from './textSelectionHighlights'

const BAR_MARGIN = 8
const COPIED_FEEDBACK_MS = 1600

interface ActiveSelection {
  text: string
  occurrence: number
  span: TextSpan
  overlappingIds: string[]
}

interface TextSelectionActionBarProps {
  containerRef: React.RefObject<HTMLElement | null>
  scopeKey: string | null
  enabled?: boolean
  contextLabel?: string | null
  onAskAi?: (question: string) => void
}

const highlightPaintStyles = (theme: Theme) => ({
  [`::highlight(${TEXT_HIGHLIGHT_REGISTRY_NAME})`]: {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? 'rgba(202, 138, 4, 0.55)'
        : 'rgba(250, 204, 21, 0.55)',
    color: theme.palette.mode === 'dark' ? '#FDF6DC' : '#111827',
  },
  // Distinct from the user's saved highlights: a chat citation jump is
  // ephemeral, so it gets its own registry and a cooler, more "pointer" color.
  [`::highlight(${CITATION_HIGHLIGHT_REGISTRY_NAME})`]: {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? 'rgba(56, 189, 248, 0.45)'
        : 'rgba(56, 189, 248, 0.4)',
    color: theme.palette.mode === 'dark' ? '#F0F9FF' : '#0C2A3D',
  },
})

const barIconButtonSx = (active: boolean) => (theme: Theme) => {
  const accent = theme.palette.primary.main

  return {
    width: 34,
    height: 34,
    borderRadius: 1,
    color: active ? accent : theme.palette.text.primary,
    bgcolor: active
      ? alpha(accent, theme.palette.mode === 'dark' ? 0.2 : 0.12)
      : 'transparent',
    '&:hover': {
      color: accent,
      bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.24 : 0.14),
    },
    '&.Mui-disabled': {
      color: theme.palette.text.disabled,
      opacity: 0.72,
    },
  }
}

// A selection dragged past the last paragraph can end outside the page
// container, so accept anything that still covers part of it.
const rangeTouchesContainer = (range: Range, container: HTMLElement): boolean => {
  if (container.contains(range.commonAncestorContainer)) {
    return true
  }

  try {
    return range.intersectsNode(container)
  } catch {
    return false
  }
}

const copySelectedText = async (text: string): Promise<void> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // Falls back to the selection-based copy below.
  }

  try {
    document.execCommand('copy')
  } catch {
    // Copy is best effort; nothing else to do here.
  }
}

const TextSelectionActionBar: React.FC<TextSelectionActionBarProps> = ({
  containerRef,
  scopeKey,
  enabled = true,
  contextLabel,
  onAskAi,
}) => {
  const { t } = useInterfaceText()
  const barRef = useRef<HTMLDivElement | null>(null)
  const rangeRef = useRef<Range | null>(null)
  const pointerDownRef = useRef(false)
  const readSelectionFrameRef = useRef<number | null>(null)
  const repaintFrameRef = useRef<number | null>(null)
  const copiedTimeoutRef = useRef<number | null>(null)
  const [highlights, setHighlights] = useState<StoredTextHighlight[]>([])
  const [activeSelection, setActiveSelection] = useState<ActiveSelection | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  const highlightsRef = useRef(highlights)
  highlightsRef.current = highlights

  useEffect(() => {
    setActiveSelection(null)
    rangeRef.current = null
    setHighlights(scopeKey ? readStoredHighlights(scopeKey) : [])
  }, [scopeKey])

  const repaint = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    paintStoredHighlights(container, highlightsRef.current)
  }, [containerRef])

  useEffect(() => {
    repaint()
  }, [highlights, repaint])

  useEffect(() => () => clearPaintedHighlights(), [])

  // Study pages re-render as the user navigates or edits, so re-anchor the
  // painted ranges whenever the container content changes.
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof MutationObserver === 'undefined') {
      return
    }

    const observer = new MutationObserver(() => {
      if (repaintFrameRef.current !== null) {
        return
      }

      repaintFrameRef.current = window.requestAnimationFrame(() => {
        repaintFrameRef.current = null
        repaint()
      })
    })

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => {
      observer.disconnect()
      if (repaintFrameRef.current !== null) {
        window.cancelAnimationFrame(repaintFrameRef.current)
        repaintFrameRef.current = null
      }
    }
  }, [containerRef, repaint, scopeKey])

  const clearSelectionBar = useCallback(() => {
    rangeRef.current = null
    setActiveSelection(null)
    setCopied(false)
  }, [])

  const readSelection = useCallback(() => {
    const container = containerRef.current
    if (!container || !enabled || !scopeKey) {
      clearSelectionBar()
      return
    }

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      clearSelectionBar()
      return
    }

    const range = selection.getRangeAt(0)
    if (!rangeTouchesContainer(range, container)) {
      clearSelectionBar()
      return
    }

    const index = buildContainerTextIndex(container)
    const descriptor = describeSelection(index, range)
    if (!descriptor) {
      clearSelectionBar()
      return
    }

    rangeRef.current = range.cloneRange()
    setCopied(false)
    setActiveSelection({
      text: descriptor.text,
      occurrence: descriptor.occurrence,
      span: descriptor.span,
      overlappingIds: findHighlightsOverlappingSpan(
        index,
        highlightsRef.current,
        descriptor.span,
      ),
    })
  }, [clearSelectionBar, containerRef, enabled, scopeKey])

  const scheduleReadSelection = useCallback(() => {
    if (readSelectionFrameRef.current !== null) {
      return
    }

    readSelectionFrameRef.current = window.requestAnimationFrame(() => {
      readSelectionFrameRef.current = null
      readSelection()
    })
  }, [readSelection])

  useEffect(() => {
    if (!enabled) {
      clearSelectionBar()
      return
    }

    const isInsideBar = (target: EventTarget | null): boolean =>
      Boolean(barRef.current && target instanceof Node && barRef.current.contains(target))

    const handlePointerDown = (event: Event) => {
      if (isInsideBar(event.target)) {
        return
      }

      pointerDownRef.current = true
    }

    const handlePointerUp = (event: Event) => {
      pointerDownRef.current = false
      if (isInsideBar(event.target)) {
        return
      }

      scheduleReadSelection()
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        clearSelectionBar()
        return
      }

      // While a drag is in progress the bar would chase the cursor, so wait
      // for the pointer to be released before showing it.
      if (pointerDownRef.current) {
        return
      }

      scheduleReadSelection()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelectionBar()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointerup', handlePointerUp, true)
    document.addEventListener('touchend', handlePointerUp, true)
    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('touchend', handlePointerUp, true)
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('keydown', handleKeyDown)
      if (readSelectionFrameRef.current !== null) {
        window.cancelAnimationFrame(readSelectionFrameRef.current)
        readSelectionFrameRef.current = null
      }
    }
  }, [clearSelectionBar, enabled, scheduleReadSelection])

  useEffect(
    () => () => {
      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current)
      }
    },
    [],
  )

  const positionBar = useCallback(() => {
    const bar = barRef.current
    const range = rangeRef.current
    if (!bar || !range || typeof range.getBoundingClientRect !== 'function') {
      return
    }

    const rect = range.getBoundingClientRect()
    if (!rect.width && !rect.height) {
      return
    }

    const width = bar.offsetWidth
    const height = bar.offsetHeight
    const minLeft = BAR_MARGIN + width / 2
    const maxLeft = Math.max(minLeft, window.innerWidth - width / 2 - BAR_MARGIN)
    const left = Math.min(Math.max(rect.left + rect.width / 2, minLeft), maxLeft)
    const above = rect.top - height - BAR_MARGIN
    const top =
      above >= BAR_MARGIN
        ? above
        : Math.min(rect.bottom + BAR_MARGIN, window.innerHeight - height - BAR_MARGIN)

    bar.style.left = `${Math.round(left)}px`
    bar.style.top = `${Math.round(Math.max(top, BAR_MARGIN))}px`
  }, [])

  useLayoutEffect(() => {
    positionBar()
  }, [activeSelection, positionBar])

  useEffect(() => {
    if (!activeSelection) {
      return
    }

    const reposition = () => positionBar()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)

    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [activeSelection, positionBar])

  const dropSelection = () => {
    window.getSelection()?.removeAllRanges()
    clearSelectionBar()
  }

  const handleCopy = () => {
    if (!activeSelection) {
      return
    }

    void copySelectedText(activeSelection.text)
    setCopied(true)
    if (copiedTimeoutRef.current !== null) {
      window.clearTimeout(copiedTimeoutRef.current)
    }

    copiedTimeoutRef.current = window.setTimeout(() => {
      copiedTimeoutRef.current = null
      setCopied(false)
    }, COPIED_FEEDBACK_MS)
  }

  const handleToggleHighlight = () => {
    if (!activeSelection || !scopeKey) {
      return
    }

    const removedIds = activeSelection.overlappingIds
    let nextHighlights: StoredTextHighlight[]
    if (removedIds.length) {
      nextHighlights = highlights.filter(
        (highlight) => !removedIds.includes(highlight.id),
      )
    } else {
      nextHighlights = [
        ...highlights,
        {
          id: createHighlightId(),
          text: activeSelection.text,
          occurrence: activeSelection.occurrence,
          createdAt: Date.now(),
        },
      ]
    }

    setHighlights(nextHighlights)
    writeStoredHighlights(scopeKey, nextHighlights)
    dropSelection()
  }

  const handleAskAi = () => {
    if (!activeSelection) {
      return
    }

    const question = buildSelectionAiPrompt(activeSelection.text, contextLabel)
    if (onAskAi) {
      onAskAi(question)
    } else {
      window.dispatchEvent(
        new CustomEvent(PREFILL_DASHBOARD_CHAT_EVENT, {
          detail: { content: question },
        }),
      )
    }

    dropSelection()
  }

  const isHighlighted = Boolean(activeSelection?.overlappingIds.length)
  const highlightLabel = isHighlighted
    ? t('selection.removeHighlight')
    : t('selection.highlight')
  const copyLabel = copied ? t('selection.copied') : t('selection.copy')

  return (
    <>
      <GlobalStyles styles={highlightPaintStyles} />
      {activeSelection ? (
        <Paper
          ref={barRef}
          elevation={8}
          data-testid="text-selection-action-bar"
          role="toolbar"
          aria-label={t('selection.actions')}
          onMouseDown={(event) => event.preventDefault()}
          sx={(theme) => ({
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: theme.zIndex.tooltip,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            px: 0.5,
            py: 0.25,
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          })}
        >
          <Tooltip title={highlightLabel}>
            <IconButton
              size="small"
              aria-label={highlightLabel}
              onClick={handleToggleHighlight}
              sx={barIconButtonSx(isHighlighted)}
            >
              {isHighlighted ? (
                <FormatColorResetOutlinedIcon fontSize="small" />
              ) : (
                <BorderColorOutlinedIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={t('selection.askAi')}>
            <IconButton
              size="small"
              aria-label={t('selection.askAi')}
              onClick={handleAskAi}
              sx={barIconButtonSx(false)}
            >
              <ChatBubbleOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Divider flexItem orientation="vertical" sx={{ my: 0.75 }} />
          <Tooltip title={copyLabel}>
            <IconButton
              size="small"
              aria-label={copyLabel}
              onClick={handleCopy}
              sx={barIconButtonSx(copied)}
            >
              {copied ? (
                <CheckIcon fontSize="small" />
              ) : (
                <ContentCopyOutlinedIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Paper>
      ) : null}
    </>
  )
}

export default TextSelectionActionBar
