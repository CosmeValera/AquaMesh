import type { StudyGuideNextIdea } from '../state/store'
import { StudyGuideCreationQueueStorage } from './creationQueue'
import { StudyGuideStorage } from './storage'

const normalizeForMatch = (value: string): string =>
  value.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Which follow-up ideas the reader already turned into a guide. Creation stores
 * the original prompt on the record (`description`) and on the queued job
 * (`prompt`), and matching stays prefix-based: a record's description can carry
 * trailing text the job prompt does not.
 *
 * Called from the guide view rather than from the quiz block. This module
 * reaches the creation queue, which reaches the whole AI generation graph, and
 * a widget renderer must not drag that in. It also stays out of
 * `quickStart.ts`, which the hosted API function imports.
 */
export const readCreatedNextIdeaPrompts = (
  ideas: StudyGuideNextIdea[],
): string[] => {
  const created: string[] = []
  if (!ideas.length) {
    return created
  }

  let existingPrompts: string[]
  try {
    existingPrompts = [
      ...StudyGuideStorage.getSummaries().map(
        (summary) => summary.description || '',
      ),
      ...StudyGuideCreationQueueStorage.getAll().map((job) => job.prompt || ''),
    ]
      .map(normalizeForMatch)
      .filter(Boolean)
  } catch {
    // Best-effort: an unreadable store only means nothing shows as created.
    return created
  }

  ideas.forEach((idea) => {
    const ideaPrompt = normalizeForMatch(idea.prompt)
    if (!ideaPrompt) {
      return
    }

    if (existingPrompts.some((prompt) => prompt.startsWith(ideaPrompt))) {
      created.push(idea.prompt)
    }
  })

  return created
}
