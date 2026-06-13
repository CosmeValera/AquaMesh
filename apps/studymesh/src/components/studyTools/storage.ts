import type { StudyToolsStateV1 } from './types'

export const STUDY_TOOLS_STORAGE_KEY = 'studymesh-study-tools-v1'
export const STUDY_TOOLS_CHANGED_EVENT = 'studymesh-study-tools-changed'

const now = () => new Date().toISOString()

export const createDefaultStudyToolsState = (): StudyToolsStateV1 => ({
  version: 1,
  canvas: {
    items: [],
    connections: [],
    viewportX: 0,
    viewportY: 0,
    zoom: 1,
    gridSize: 20,
    showGrid: true,
    snapToGrid: true,
    updatedAt: now(),
  },
  todo: { items: [], updatedAt: now() },
  scratchpad: { content: '', updatedAt: now() },
  privateChat: { enabled: false, messages: [], updatedAt: now() },
})

export const normalizeStudyToolsState = (
  value: unknown,
): StudyToolsStateV1 => {
  const fallback = createDefaultStudyToolsState()
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const state = value as Partial<StudyToolsStateV1>
  if (state.version !== 1) {
    return fallback
  }

  return {
    version: 1,
    canvas: {
      ...fallback.canvas,
      ...(state.canvas || {}),
      items: Array.isArray(state.canvas?.items) ? state.canvas.items : [],
      connections: Array.isArray(state.canvas?.connections)
        ? state.canvas.connections
        : [],
    },
    todo: {
      ...fallback.todo,
      ...(state.todo || {}),
      items: Array.isArray(state.todo?.items) ? state.todo.items : [],
    },
    scratchpad: { ...fallback.scratchpad, ...(state.scratchpad || {}) },
    privateChat: {
      ...fallback.privateChat,
      ...(state.privateChat || {}),
      messages: Array.isArray(state.privateChat?.messages)
        ? state.privateChat.messages
        : [],
    },
  }
}

export const readStudyToolsState = (): StudyToolsStateV1 => {
  try {
    return normalizeStudyToolsState(
      JSON.parse(window.localStorage.getItem(STUDY_TOOLS_STORAGE_KEY) || 'null'),
    )
  } catch {
    return createDefaultStudyToolsState()
  }
}

export const hasStoredStudyToolsState = (): boolean =>
  typeof window !== 'undefined' &&
  window.localStorage.getItem(STUDY_TOOLS_STORAGE_KEY) !== null

export const writeStudyToolsState = (
  state: StudyToolsStateV1,
  dispatch = true,
  source = 'external',
): boolean => {
  try {
    window.localStorage.setItem(STUDY_TOOLS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    return false
  }
  if (dispatch) {
    window.dispatchEvent(
      new CustomEvent(STUDY_TOOLS_CHANGED_EVENT, { detail: { source } }),
    )
  }
  return true
}
