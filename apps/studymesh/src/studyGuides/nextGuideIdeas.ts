import type { StudyGuideRecord } from '../cloud/types'

/**
 * What to read next, offered the moment a topic becomes declared knowledge.
 * Built from the guide itself rather than from a model call: the learner has
 * just earned something, and the reward should be instant and cost nothing.
 */
export type NextGuideIdeaKind = 'deeper' | 'apply' | 'next'

export interface NextGuideIdea {
  id: NextGuideIdeaKind
  kind: NextGuideIdeaKind
  /** The part of the guide the idea points at. Empty means the topic itself. */
  focus: string
}

const getLessonTitles = (record: StudyGuideRecord): string[] => {
  const titles = (record.studyPath?.dashboards || [])
    .filter((dashboard) => dashboard.createdBy !== 'quickCreate')
    .map((dashboard) => (dashboard.name || '').trim())
    .filter(Boolean)

  return Array.from(new Set(titles))
}

export const buildNextGuideIdeas = (
  record: StudyGuideRecord,
): NextGuideIdea[] => {
  const titles = getLessonTitles(record)
  // A single-lesson guide has nothing to point at that is not the topic, so
  // both ideas fall back to the topic itself.
  const deepest = titles.length > 1 ? titles[titles.length - 1] : ''
  const afterThat = deepest
    ? titles.find((title) => title !== deepest) || ''
    : ''

  return [
    { id: 'deeper', kind: 'deeper', focus: deepest },
    { id: 'apply', kind: 'apply', focus: '' },
    { id: 'next', kind: 'next', focus: afterThat },
  ]
}

export const PENDING_CREATION_PROMPT_KEY =
  'studymesh-pending-creation-prompt-v1'

/**
 * Carries a prompt from the guide workspace to the creation panel, which lives
 * on another route. Session storage, not local: an idea the learner never acted
 * on should not resurface in a new session.
 */
export const setPendingCreationPrompt = (prompt: string): void => {
  if (typeof window === 'undefined' || !prompt.trim()) {
    return
  }

  try {
    window.sessionStorage.setItem(PENDING_CREATION_PROMPT_KEY, prompt.trim())
  } catch {
    // Best-effort: the learner can always retype the prompt.
  }
}

/** Reads and clears the pending prompt, so it prefills exactly once. */
export const takePendingCreationPrompt = (): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const prompt = window.sessionStorage.getItem(PENDING_CREATION_PROMPT_KEY)
    window.sessionStorage.removeItem(PENDING_CREATION_PROMPT_KEY)
    return prompt || ''
  } catch {
    return ''
  }
}
