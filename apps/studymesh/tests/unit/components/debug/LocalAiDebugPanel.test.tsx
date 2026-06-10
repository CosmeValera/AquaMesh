import { afterEach, describe, expect, it } from 'vitest'
import { showLocalAiDebugPanel } from '../../../../src/components/debug/LocalAiDebugPanel'

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  VITE_SHOW_LOCAL_AI_DEBUG_PANEL:
    process.env.VITE_SHOW_LOCAL_AI_DEBUG_PANEL,
}

afterEach(() => {
  process.env.NODE_ENV = originalEnv.NODE_ENV
  if (originalEnv.VITE_SHOW_LOCAL_AI_DEBUG_PANEL === undefined) {
    delete process.env.VITE_SHOW_LOCAL_AI_DEBUG_PANEL
  } else {
    process.env.VITE_SHOW_LOCAL_AI_DEBUG_PANEL =
      originalEnv.VITE_SHOW_LOCAL_AI_DEBUG_PANEL
  }
})

describe('showLocalAiDebugPanel', () => {
  it('hides the panel when the env flag is explicitly false', () => {
    process.env.NODE_ENV = 'development'
    process.env.VITE_SHOW_LOCAL_AI_DEBUG_PANEL = 'false'

    expect(showLocalAiDebugPanel()).toBe(false)
  })

  it('accepts quoted false from env files', () => {
    process.env.NODE_ENV = 'development'
    process.env.VITE_SHOW_LOCAL_AI_DEBUG_PANEL = '"false"'

    expect(showLocalAiDebugPanel()).toBe(false)
  })

  it('keeps the dev-only default when the env flag is absent', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.VITE_SHOW_LOCAL_AI_DEBUG_PANEL

    expect(showLocalAiDebugPanel()).toBe(true)
  })

  it('allows explicit true in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.VITE_SHOW_LOCAL_AI_DEBUG_PANEL = 'true'

    expect(showLocalAiDebugPanel()).toBe(true)
  })
})

