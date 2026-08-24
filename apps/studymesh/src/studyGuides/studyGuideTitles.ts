/**
 * Pure string helpers plus the follow-up-idea contract, kept apart from
 * `quickStart.ts` so a widget renderer can use them without pulling in the
 * whole Quick Start / knowledge-bridge module. `quickStart.ts` re-exports
 * everything here, so the prompt-side call sites keep their import path.
 */
import type {
  StudyGuideNextIdea,
  StudyGuideNextIdeaAxis,
} from '../state/store'

export type { StudyGuideNextIdea, StudyGuideNextIdeaAxis }

/**
 * A model title is only slug-shaped when every part looks like a slug part, so
 * ordinary hyphenated titles survive: "e-commerce" and "x-ray" keep their
 * one-letter part, and anything containing a space is already a written title.
 */
const isSlugShapedTitle = (value: string): boolean => {
  if (!value || /\s/.test(value) || !/[-_]/.test(value)) {
    return false
  }

  const segments = value.split(/[-_]/)

  return (
    segments.length > 1 &&
    segments.every(
      (segment) =>
        /^[a-z0-9]+$/.test(segment) &&
        (segment.length > 1 || /^[0-9]$/.test(segment)),
    )
  )
}

/**
 * Model titles arrive as prose, Title Case, or slugs. Slug separators become
 * spaces and only the first letter is forced, so whatever casing the model
 * chose for the remaining words survives.
 */
export const normalizeStudyGuideTitle = (value: unknown): string => {
  const raw = (typeof value === 'string' ? value : '')
    .replace(/\s+/g, ' ')
    .trim()
  const text = isSlugShapedTitle(raw) ? raw.split(/[-_]/).join(' ') : raw

  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : ''
}

export const trimTitleToWordBoundary = (
  value: string,
  maxChars: number,
): string => {
  if (value.length <= maxChars) {
    return value
  }

  return (
    value
      .slice(0, maxChars)
      .replace(/\s+\S*$/, '')
      .trim() || value
  )
}

/**
 * One follow-up guide per axis. Two stay inside the subject and one leaves it,
 * so a slate can never be three flavours of the same guide. `mechanism` was
 * deliberately left out: on a beginner guide it reads as the same material one
 * level deeper, which is the duplication these axes exist to prevent.
 */
export const STUDY_GUIDE_NEXT_IDEA_AXES = [
  'curiosity',
  'utility',
  'connection',
] as const

export const STUDY_GUIDE_NEXT_IDEA_MAX = STUDY_GUIDE_NEXT_IDEA_AXES.length
const STUDY_GUIDE_NEXT_IDEA_LABEL_MAX_CHARS = 48
const STUDY_GUIDE_NEXT_IDEA_PROMPT_MAX_CHARS = 240

export const STUDY_GUIDE_NEXT_IDEAS_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      axis: { type: 'STRING' },
      label: { type: 'STRING' },
      prompt: { type: 'STRING' },
    },
    required: ['axis', 'label', 'prompt'],
  },
}

// One claimable name per guide. The reader picks nothing; a picker made the
// same guide look like it taught different things on every visit.
const STUDY_GUIDE_LEARNED_SKILL_MAX = 1
const STUDY_GUIDE_LEARNED_SKILL_MAX_CHARS = 48

export const STUDY_GUIDE_LEARNED_SKILL_INSTRUCTION = `learnedSkillOptions: exactly ${STUDY_GUIDE_LEARNED_SKILL_MAX} entry, naming what the learner will KNOW after finishing, for a list of topics they can claim. Name the reusable concept or ability, never the guide. For a guide on caffeine and the brain: "Adenosine and sleep pressure", never "How caffeine affects your brain". 2-4 words, sentence case, plain spaces, no hyphens, underscores, colons, or question marks.`

export const sanitizeStudyGuideLearnedSkillOptions = (
  value: unknown,
): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((option) =>
      trimTitleToWordBoundary(
        normalizeStudyGuideTitle(option),
        STUDY_GUIDE_LEARNED_SKILL_MAX_CHARS,
      ),
    )
    .filter(Boolean)
    .filter((option, index, options) => options.indexOf(option) === index)
    .slice(0, STUDY_GUIDE_LEARNED_SKILL_MAX)
}

// One wording for all three providers so the offer reads the same everywhere.
export const STUDY_GUIDE_NEXT_IDEAS_INSTRUCTION = `nextGuideIdeas: exactly ${STUDY_GUIDE_NEXT_IDEA_MAX} follow-up guides, one per axis, in this order:
  1. axis "curiosity": the most counter-intuitive or surprising thing this guide only hinted at. It must be a question the reader has now and this guide does not answer.
  2. axis "utility": something the reader can do or apply with what they just learned. Practical, not another explanation.
  3. axis "connection": the general concept this subject is an instance of, or a different field where the same pattern shows up. Write it so it teaches that on its own, and never name this guide's subject in it.
  Each idea: "axis" is exactly one of curiosity, utility, connection. "label" names the topic in 2-5 words. "prompt" is one first-person sentence the learner could send straight to the guide creator, such as "Teach me how X works".
  Never suggest a level or a continuation of this guide: no "intermediate", "advanced", "deep dive", "part 2", "more about X".
  Never suggest a topic whose guide would mostly re-teach these pages, and never restate the claimable skill under a different name.
  Never mention RabbitHole, guides, pages, or quizzes inside the prompt.`

const readStudyGuideNextIdeaAxis = (
  value: unknown,
): StudyGuideNextIdeaAxis | undefined => {
  const axis = (typeof value === 'string' ? value : '').trim().toLowerCase()

  return STUDY_GUIDE_NEXT_IDEA_AXES.find((candidate) => candidate === axis)
}

// Shared by every provider: hosted, BYO strong and Google local AI all emit
// nextGuideIdeas inside a call they already make, so they all land here.
export const sanitizeStudyGuideNextIdeas = (
  value: unknown,
): StudyGuideNextIdea[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const seenLabels = new Set<string>()
  const seenAxes = new Set<StudyGuideNextIdeaAxis>()
  const ideas: StudyGuideNextIdea[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }

    const record = entry as Record<string, unknown>
    const label = trimTitleToWordBoundary(
      normalizeStudyGuideTitle(record.label),
      STUDY_GUIDE_NEXT_IDEA_LABEL_MAX_CHARS,
    )
    const prompt = trimTitleToWordBoundary(
      (typeof record.prompt === 'string' ? record.prompt : '')
        .replace(/\s+/g, ' ')
        .trim(),
      STUDY_GUIDE_NEXT_IDEA_PROMPT_MAX_CHARS,
    )
    const key = label.toLowerCase()
    if (!label || !prompt || seenLabels.has(key)) {
      continue
    }

    // Google local AI runs without a response schema, so it drops the axis
    // often. An idea without one is still a usable idea: it keeps its place in
    // the order the model returned instead of being thrown away.
    const axis = readStudyGuideNextIdeaAxis(record.axis)
    if (axis) {
      if (seenAxes.has(axis)) {
        continue
      }

      seenAxes.add(axis)
    }

    seenLabels.add(key)
    ideas.push(axis ? { axis, label, prompt } : { label, prompt })
    if (ideas.length >= STUDY_GUIDE_NEXT_IDEA_MAX) {
      break
    }
  }

  // Only reorder when the whole slate is labelled. A partly labelled slate has
  // no canonical order to fall back on, so the model's order is left alone.
  return ideas.every((idea) => idea.axis)
    ? [...ideas].sort(
        (left, right) =>
          STUDY_GUIDE_NEXT_IDEA_AXES.indexOf(
            left.axis as StudyGuideNextIdeaAxis,
          ) -
          STUDY_GUIDE_NEXT_IDEA_AXES.indexOf(
            right.axis as StudyGuideNextIdeaAxis,
          ),
      )
    : ideas
}

/**
 * The idea prompt names the topic; the bridge sentence names the skill the
 * reader just claimed, so the relevance selector does not have to guess it out
 * of a known-topics list that can hold dozens of entries.
 */
export const buildStudyGuideNextIdeaPrompt = (
  ideaPrompt: string,
  bridgeSentence: string,
): string => {
  const idea = ideaPrompt.trim()
  const bridge = bridgeSentence.trim()

  if (!idea) {
    return ''
  }

  return bridge ? `${idea}\n\n${bridge}` : idea
}
