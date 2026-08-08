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
  /**
   * Shown in the locked prompt field on /try. Deliberately says nothing about
   * the lens: the point of the demo is that the declared skill does that work,
   * so naming it in the request would undercut what the page is showing.
   */
  prompt: string
  /**
   * What the capture actually sent. It pins the lens explicitly because the
   * generator does not reliably pick a declared skill on its own yet, and the
   * record has to say what really produced the guide rather than what we would
   * like to have produced it.
   */
  capturePrompt?: string
  /**
   * Which of `DEMO_PROFILE_SKILLS` this guide's generation leaned on. The whole
   * profile is seeded at capture time and the generator chooses for itself;
   * this records the choice so /try can point at it.
   */
  lensSkill: string
  /**
   * Why that context explains this topic, in the reader's own terms. Shown on
   * /try next to the matched context so the bridge is visible before the guide
   * is even generated.
   */
  lensExplanation: string
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
export const DEMO_CHAT_ANSWER_DELAY_MS = 2000
