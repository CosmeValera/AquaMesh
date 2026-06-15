import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createDefaultStudyToolsState,
  hasStoredStudyToolsState,
  normalizeStudyToolsState,
  readStudyToolsState,
  STUDY_TOOLS_CHANGED_EVENT,
  STUDY_TOOLS_STORAGE_KEY,
  writeStudyToolsState,
} from '../../../../src/components/studyTools/storage'

describe('study tools storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to empty versioned state for malformed data', () => {
    localStorage.getItem.mockReturnValue('{bad')

    const state = readStudyToolsState()

    expect(state.version).toBe(2)
    expect(state.canvas.items).toEqual([])
    expect(state.todo.items).toEqual([])
  })

  it('normalizes missing tool sections', () => {
    const state = normalizeStudyToolsState({
      version: 2,
      scratchpad: { content: 'Remember this' },
    })

    expect(state.scratchpad.content).toBe('Remember this')
    expect(state.canvas.connections).toEqual([])
    expect(state.quickCapture.messages).toEqual([])
  })

  it('persists state and announces changes', () => {
    const listener = vi.fn()
    window.addEventListener(STUDY_TOOLS_CHANGED_EVENT, listener)
    const state = createDefaultStudyToolsState()

    writeStudyToolsState(state)

    expect(localStorage.setItem).toHaveBeenCalledWith(
      STUDY_TOOLS_STORAGE_KEY,
      JSON.stringify(state),
    )
    expect(listener).toHaveBeenCalled()
    window.removeEventListener(STUDY_TOOLS_CHANGED_EVENT, listener)
  })

  it('does not announce a change when browser storage is full', () => {
    const listener = vi.fn()
    window.addEventListener(STUDY_TOOLS_CHANGED_EVENT, listener)
    localStorage.setItem.mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    expect(() => writeStudyToolsState(createDefaultStudyToolsState())).not.toThrow()
    expect(listener).not.toHaveBeenCalled()
    window.removeEventListener(STUDY_TOOLS_CHANGED_EVENT, listener)
  })

  it('detects an existing standalone tools cache', () => {
    localStorage.getItem.mockReturnValueOnce('{}')

    expect(hasStoredStudyToolsState()).toBe(true)
  })
})
