import { DEMO_DATA_VERSION, type DemoBonusActionId } from './types'

/**
 * What a visitor has unlocked in the demo, kept in sessionStorage.
 *
 * Session scoped on purpose: the demo is a walkthrough, not a saved artefact,
 * so it expires with the tab and can never outlive a later real login in the
 * same browser. Only the action ids and the page index are stored, never the
 * guide itself, so refreshing always replays against the current content.
 */
interface DemoSessionState {
  version: number
  unlocked: DemoBonusActionId[]
  selectedIndex: number
}

const BONUS_ACTION_IDS: DemoBonusActionId[] = ['quiz', 'flashcards', 'podcast']

const emptySession = (): DemoSessionState => ({
  version: DEMO_DATA_VERSION,
  unlocked: [],
  selectedIndex: 0,
})

const storageKey = (slug: string): string => `rabbithole-demo-${slug}`

const readStorage = (): Storage | null => {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export const readDemoSession = (slug: string): DemoSessionState => {
  const storage = readStorage()

  if (!storage) {
    return emptySession()
  }

  try {
    const raw = storage.getItem(storageKey(slug))

    if (!raw) {
      return emptySession()
    }

    const parsed = JSON.parse(raw) as Partial<DemoSessionState>

    if (parsed.version !== DEMO_DATA_VERSION) {
      return emptySession()
    }

    const unlocked = Array.isArray(parsed.unlocked)
      ? BONUS_ACTION_IDS.filter((actionId) => parsed.unlocked?.includes(actionId))
      : []

    return {
      version: DEMO_DATA_VERSION,
      unlocked,
      selectedIndex:
        typeof parsed.selectedIndex === 'number' && parsed.selectedIndex >= 0
          ? parsed.selectedIndex
          : 0,
    }
  } catch {
    return emptySession()
  }
}

export const writeDemoSession = (
  slug: string,
  state: Omit<DemoSessionState, 'version'>,
): void => {
  const storage = readStorage()

  if (!storage) {
    return
  }

  try {
    storage.setItem(
      storageKey(slug),
      JSON.stringify({ version: DEMO_DATA_VERSION, ...state }),
    )
  } catch {
    // Private browsing modes reject writes. The demo still works, it just
    // forgets what was unlocked on refresh.
  }
}

export const clearDemoSession = (slug: string): void => {
  const storage = readStorage()

  if (!storage) {
    return
  }

  try {
    storage.removeItem(storageKey(slug))
  } catch {
    // Nothing to recover from: the session is best effort by design.
  }
}
