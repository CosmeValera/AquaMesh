import { useEffect, useState } from 'react'

import type { DemoGuideContent, DemoGuideDefinition } from './types'

/**
 * One in-flight or settled import per guide, so opening the same guide twice in
 * a session costs nothing and /try can warm the chunk before the guide page
 * ever mounts.
 */
const pendingLoads = new Map<string, Promise<DemoGuideContent>>()

const loadDemoGuide = (
  definition: DemoGuideDefinition,
): Promise<DemoGuideContent> => {
  const cached = pendingLoads.get(definition.slug)

  if (cached) {
    return cached
  }

  const pending = definition.load().catch((error: unknown) => {
    // A rejected chunk request must not stay cached, or one dropped connection
    // would break that guide for the rest of the session.
    pendingLoads.delete(definition.slug)
    throw error
  })

  pendingLoads.set(definition.slug, pending)

  return pending
}

/**
 * Starts the chunk download during the fake generation on /try. Failures are
 * ignored here: the guide page loads the same content again and owns the
 * visible outcome.
 */
export const prefetchDemoGuide = (
  definition: DemoGuideDefinition | null,
): void => {
  if (!definition) {
    return
  }

  void loadDemoGuide(definition).catch(() => {})
}

export interface DemoGuideState {
  content: DemoGuideContent | null
  loading: boolean
  failed: boolean
}

export const useDemoGuide = (
  definition: DemoGuideDefinition | null,
): DemoGuideState => {
  const [state, setState] = useState<DemoGuideState>(() => ({
    content: null,
    loading: Boolean(definition),
    failed: false,
  }))

  useEffect(() => {
    if (!definition) {
      setState({ content: null, loading: false, failed: false })
      return undefined
    }

    let active = true
    setState({ content: null, loading: true, failed: false })

    loadDemoGuide(definition)
      .then((content) => {
        if (active) {
          setState({ content, loading: false, failed: false })
        }
      })
      .catch(() => {
        if (active) {
          setState({ content: null, loading: false, failed: true })
        }
      })

    return () => {
      active = false
    }
  }, [definition])

  return state
}
