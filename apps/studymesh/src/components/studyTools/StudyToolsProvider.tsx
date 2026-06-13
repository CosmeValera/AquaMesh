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
import type { StudyToolId, StudyToolsStateV1 } from './types'
import StudyToolsShell from './StudyToolsShell'

interface StudyToolsContextValue {
  activeTool: StudyToolId | null
  openTool: (tool: StudyToolId) => void
  closeTool: () => void
  state: StudyToolsStateV1
  updateState: (updater: (state: StudyToolsStateV1) => StudyToolsStateV1) => void
  storageError: string
  clearStorageError: () => void
}

const StudyToolsContext = createContext<StudyToolsContextValue | null>(null)

export const StudyToolsProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [activeTool, setActiveTool] = useState<StudyToolId | null>(null)
  const [state, setState] = useState(readStudyToolsState)
  const [storageError, setStorageError] = useState('')

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

  const updateState = useCallback(
    (updater: (current: StudyToolsStateV1) => StudyToolsStateV1) => {
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
      activeTool,
      openTool: (tool: StudyToolId) => {
        if (tool === 'private-chat') {
          updateState((current) => ({
            ...current,
            privateChat: {
              ...current.privateChat,
              enabled: !current.privateChat.enabled,
              updatedAt: new Date().toISOString(),
            },
          }))
          setActiveTool(null)
          return
        }
        setActiveTool(tool)
      },
      closeTool: () => setActiveTool(null),
      state,
      updateState,
      storageError,
      clearStorageError: () => setStorageError(''),
    }),
    [activeTool, state, storageError, updateState],
  )

  return (
    <StudyToolsContext.Provider value={value}>
      {children}
      <StudyToolsShell />
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
