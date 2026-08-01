import type {
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../state/store'
import type { QuickCreateActionId } from '../quickCreate/quickCreateActions'

/**
 * The demo guides at /try are captured from real generations and frozen. They
 * render through the real workspace components, so a visitor sees the actual
 * product rather than a mockup, with no API call and no account.
 */

/** Quick Create actions the demo can fulfil from prepared pages. */
export type DemoBonusActionId = Extract<
  QuickCreateActionId,
  'quiz' | 'flashcards' | 'podcast'
>

export interface DemoChatExchange {
  id: string
  /** Chip label offered in the empty chat panel. */
  chip: string
  /** Pushed as the user message so the transcript reads naturally. */
  question: string
  /** Markdown, rendered by the same renderer the real panel uses. */
  answer: string
  /** How long the pending bubble dwells before the answer lands. */
  answerDelayMs?: number
}

/** A page held back until the visitor creates it from Quick Create. */
export interface DemoBonusPage {
  actionId: DemoBonusActionId
  /** Fake generation time before the page appears, in ms. */
  durationMs: number
  /** Frozen exactly as the real append produced it. */
  page: StudyPathDashboardItem
}

export interface DemoGuideContent {
  /** The lesson pages, visible from the start. */
  studyPath: StudyPathContainerState
  bonusPages: DemoBonusPage[]
  chat: DemoChatExchange[]
}

/** Cheap metadata, safe to keep in the main bundle. */
export interface DemoGuideSummary {
  slug: string
  /** Chip label on /try. */
  chipLabel: string
  /** Written into the locked prompt field, and the prompt the capture used. */
  prompt: string
  title: string
  emoji: string
}

export interface DemoGuideDefinition extends DemoGuideSummary {
  load: () => Promise<DemoGuideContent>
}

/**
 * Bumped whenever the captured data changes. A stored demo session with a
 * different version is discarded rather than replayed against new content.
 */
export const DEMO_DATA_VERSION = 1

/** How long the fake generation runs on /try before the guide opens. */
export const DEMO_GENERATION_MS = 5000

/** Default dwell time for a canned chat answer. */
export const DEMO_CHAT_ANSWER_DELAY_MS = 1400
