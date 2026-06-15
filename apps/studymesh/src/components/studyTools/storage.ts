import type { StudyToolsStateV2 } from './types'

export const STUDY_TOOLS_STORAGE_KEY = 'studymesh-study-tools-v2'
export const STUDY_TOOLS_CHANGED_EVENT = 'studymesh-study-tools-changed'

const now = () => new Date().toISOString()

export const createDefaultStudyToolsState = (): StudyToolsStateV2 => ({
  version: 2,
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
  quickCapture: { messages: [], updatedAt: now() },
})

export const normalizeStudyToolsState = (
  value: unknown,
): StudyToolsStateV2 => {
  const fallback = createDefaultStudyToolsState()
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const state = value as Partial<StudyToolsStateV2>
  if (state.version !== 2) {
    return fallback
  }

  return {
    version: 2,
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
    quickCapture: {
      ...fallback.quickCapture,
      ...(state.quickCapture || {}),
      messages: Array.isArray(state.quickCapture?.messages)
        ? state.quickCapture.messages
        : [],
    },
  }
}

export const readStudyToolsState = (): StudyToolsStateV2 => {
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
  state: StudyToolsStateV2,
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
