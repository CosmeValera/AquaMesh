import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  readStudyToolsState,
  STUDY_TOOLS_CHANGED_EVENT,
  writeStudyToolsState,
} from './storage'
import {
  POMODORO_RUNTIME_EVENT,
  type CompanionMode,
  type StudyToolId,
  type StudyToolsStateV2,
} from './types'
import { Snackbar } from '@mui/material'

interface StudyToolsContextValue {
  activeMode: CompanionMode
  openTool: (tool: StudyToolId) => void
  setActiveMode: (mode: CompanionMode) => void
  pomodoroStatus: string
  state: StudyToolsStateV2
  updateState: (updater: (state: StudyToolsStateV2) => StudyToolsStateV2) => void
  storageError: string
  clearStorageError: () => void
}

const StudyToolsContext = createContext<StudyToolsContextValue | null>(null)

export const StudyToolsProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [activeMode, setActiveMode] = useState<CompanionMode>('ai-chat')
  const [state, setState] = useState(readStudyToolsState)
  const [storageError, setStorageError] = useState('')
  const [pomodoroStatus, setPomodoroStatus] = useState('')

  useEffect(() => {
    const refresh = (event?: Event) => {
      const source = (event as CustomEvent<{ source?: string }> | undefined)
        ?.detail?.source
      if (source !== 'provider') {
        setState(readStudyToolsState())
      }
    }
    window.addEventListener('storage', refresh)
    window.addEventListener(STUDY_TOOLS_CHANGED_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(STUDY_TOOLS_CHANGED_EVENT, refresh)
    }
  }, [])

  useEffect(() => {
    const updatePomodoroStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ running?: boolean; time?: string }>).detail
      setPomodoroStatus(detail?.running && detail.time ? detail.time : '')
    }
    window.addEventListener(POMODORO_RUNTIME_EVENT, updatePomodoroStatus)
    return () => window.removeEventListener(POMODORO_RUNTIME_EVENT, updatePomodoroStatus)
  }, [])

  const updateState = useCallback(
    (updater: (current: StudyToolsStateV2) => StudyToolsStateV2) => {
      setState((current) => {
        const next = updater(current)
        if (!writeStudyToolsState(next, true, 'provider')) {
          setStorageError('Could not save Tools data. Remove large attachments or free browser storage.')
          return current
        }
        setStorageError('')
        return next
      })
    },
    [],
  )

  const value = useMemo(
    () => ({
      activeMode,
      openTool: (tool: StudyToolId) => setActiveMode(tool),
      setActiveMode,
      pomodoroStatus,
      state,
      updateState,
      storageError,
      clearStorageError: () => setStorageError(''),
    }),
    [activeMode, pomodoroStatus, state, storageError, updateState],
  )

  return (
    <StudyToolsContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(storageError)}
        autoHideDuration={6000}
        message={storageError}
        onClose={() => setStorageError('')}
      />
    </StudyToolsContext.Provider>
  )
}

export const useStudyTools = () => {
  const context = useContext(StudyToolsContext)
  if (!context) {
    throw new Error('useStudyTools must be used within StudyToolsProvider')
  }
  return context
}

export const useOptionalStudyTools = () => useContext(StudyToolsContext)
