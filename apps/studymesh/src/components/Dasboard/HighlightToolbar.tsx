import React, { useCallback, useEffect, useState } from 'react'
import {
  Fab,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import {
  HighlightColor,
  HIGHLIGHT_COLORS,
} from './dashboardHighlights'

interface HighlightToolbarProps {
  onHighlight: (color: HighlightColor) => void
  onClose: () => void
}

export const HighlightToolbar: React.FC<HighlightToolbarProps> = ({
  onHighlight,
  onClose,
}) => {
  return (
    <Paper
      elevation={4}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        p: 1,
        pb: 'calc(1rem + env(safe-area-inset-bottom))',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Typography variant="caption" fontWeight={900} color="text.secondary" sx={{ mr: 1 }}>
        Highlight:
      </Typography>
      {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
        <Tooltip key={color} title={HIGHLIGHT_COLORS[color].label}>
          <IconButton
            onClick={() => onHighlight(color)}
            sx={{
              width: 40,
              height: 40,
              bgcolor: HIGHLIGHT_COLORS[color].bg,
              border: '2px solid transparent',
              '&:hover': {
                borderColor: color === 'yellow' ? '#f9a825' : HIGHLIGHT_COLORS[color].bg.replace('0.5', '1'),
              },
            }}
          />
        </Tooltip>
      ))}
      <Tooltip title="Cancel">
        <IconButton
          onClick={onClose}
          sx={{
            width: 40,
            height: 40,
            ml: 1,
            bgcolor: 'action.hover',
          }}
        >
          ✕
        </IconButton>
      </Tooltip>
    </Paper>
  )
}

interface HighlightFabProps {
  onClick: () => void
  visible: boolean
}

export const HighlightFab: React.FC<HighlightFabProps> = ({ onClick, visible }) => {
  return (
    <Tooltip title="Add Highlight">
      <Fab
        color="primary"
        onClick={onClick}
        sx={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          zIndex: 9998,
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.8)',
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 150ms ease, transform 150ms ease',
        }}
      >
        <AddIcon />
      </Fab>
    </Tooltip>
  )
}

export const useHighlightSelection = (): string => {
  const [selectedText, setSelectedText] = useState('')

  const updateSelection = useCallback(() => {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      setSelectedText(selection.toString().trim())
    } else {
      // Don't clear immediately - give time for re-selection
      setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) {
          setSelectedText('')
        }
      }, 100)
    }
  }, [])

  useEffect(() => {
    // selectionchange fires on any selection change
    document.addEventListener('selectionchange', updateSelection)
    return () => document.removeEventListener('selectionchange', updateSelection)
  }, [updateSelection])

  return selectedText
}

interface UseHighlightSelectionResult {
  selectedText: string
  clearSelection: () => void
}

export const useHighlightSelectionCallback = (
  _onSelectionChange?: (text: string) => void,
): UseHighlightSelectionResult => {
  const [selectedText, setSelectedText] = useState('')

  const updateSelection = useCallback(() => {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      const text = selection.toString().trim()
      setSelectedText(text)
      _onSelectionChange?.(text)
    }
  }, [_onSelectionChange])

  const clearSelection = useCallback(() => {
    setSelectedText('')
    window.getSelection()?.removeAllRanges()
  }, [])

  // Desktop mouse selection
  useEffect(() => {
    document.addEventListener('mouseup', updateSelection)
    return () => document.removeEventListener('mouseup', updateSelection)
  }, [updateSelection])

  // Mobile touch selection (with delay for browser menu)
  useEffect(() => {
    const handleTouchEnd = () => {
      setTimeout(updateSelection, 500)
    }
    document.addEventListener('touchend', handleTouchEnd)
    return () => document.removeEventListener('touchend', handleTouchEnd)
  }, [updateSelection])

  // Fallback: also listen to selectionchange which fires more reliably
  useEffect(() => {
    document.addEventListener('selectionchange', updateSelection)
    return () => document.removeEventListener('selectionchange', updateSelection)
  }, [updateSelection])

  return { selectedText, clearSelection }
}
