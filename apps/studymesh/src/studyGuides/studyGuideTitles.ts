/**
 * Pure string helpers plus the follow-up-idea contract, kept apart from
 * `quickStart.ts` so a widget renderer can use them without pulling in the
 * whole Quick Start / knowledge-bridge module. `quickStart.ts` re-exports
 * everything here, so the prompt-side call sites keep their import path.
 */
import type {
  StudyGuideNextIdea,
  StudyGuideNextIdeaAxis,
  StudyGuidePageIdea,
  StudyGuidePageIdeaAxis,
  StudyGuidePlannedLesson,
} from '../state/store'

export type {
  StudyGuideNextIdea,
  StudyGuideNextIdeaAxis,
  StudyGuidePageIdea,
  StudyGuidePageIdeaAxis,
  StudyGuidePlannedLesson,
}

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

/**
 * One follow-up page per axis. All three stay on material this page already
 * put in front of the reader: a page is a zoom, not a new subject. This is the
 * exact space `STUDY_GUIDE_NEXT_IDEA_AXES` refuses, so the two slates can
 * never offer the same thing.
 */
export const STUDY_GUIDE_PAGE_IDEA_AXES = [
  'mechanism',
  'example',
  'limit',
] as const

export const STUDY_GUIDE_PAGE_IDEA_MAX = STUDY_GUIDE_PAGE_IDEA_AXES.length
const STUDY_GUIDE_PAGE_IDEA_LABEL_MAX_CHARS = 48
const STUDY_GUIDE_PAGE_IDEA_PROMPT_MAX_CHARS = 240

export const STUDY_GUIDE_PAGE_IDEAS_SCHEMA = {
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

export const STUDY_GUIDE_PLANNED_LESSON_MAX = 4
const STUDY_GUIDE_PLANNED_LESSON_TITLE_MAX_CHARS = 64
const STUDY_GUIDE_PLANNED_LESSON_SUMMARY_MAX_CHARS = 160

export const STUDY_GUIDE_PLANNED_LESSONS_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      summary: { type: 'STRING' },
    },
    required: ['title', 'summary'],
  },
}

// One wording for all three providers so the offer reads the same everywhere.
export const STUDY_GUIDE_PAGE_IDEAS_INSTRUCTION = `pageIdeas: exactly ${STUDY_GUIDE_PAGE_IDEA_MAX} follow-up pages per dashboard, one per axis, in this order:
  1. axis "mechanism": how the thing this page states actually works underneath. The page names a rule or an effect; this digs into why it holds.
  2. axis "example": one concrete case worked end to end, using something this page already mentioned.
  3. axis "limit": where what this page teaches stops holding, which cases break it, or what it is commonly confused with.
  Every idea must stay on material that is already on this dashboard. Never introduce a new subject, a neighbouring field, or an application the dashboard does not mention.
  Each idea: "axis" is exactly one of mechanism, example, limit. "label" names the angle in 2-5 words. "prompt" is one first-person sentence, such as "Show me how X actually works".
  Never mention RabbitHole, guides, pages, or quizzes inside the prompt.`

export const STUDY_GUIDE_PLANNED_LESSONS_INSTRUCTION = `plannedLessons: ${STUDY_GUIDE_PLANNED_LESSON_MAX} lessons this topic needs that nothing else in this response covers, in the order they should be read.
  These are the lessons you would write next if the guide were longer. They continue the syllabus; they are not deeper passes over material this response already plans or writes.
  Each lesson: "title" is 3-8 words naming the lesson. "summary" is one sentence on what the reader would be able to do after it.
  Never repeat a lesson or dashboard title from this response, and never restate the claimable skill.`

// One claimable name per guide. The reader picks nothing; a picker made the
// same guide look like it taught different things on every visit.
const STUDY_GUIDE_LEARNED_SKILL_MAX = 1
const STUDY_GUIDE_LEARNED_SKILL_MAX_CHARS = 48

/**
 * The naming rules, without the field name, so the hosted single-string field
 * and the array field the other providers fill share one wording.
 *
 * The subject rule is the one that matters: the name lands in a list beside
 * topics from every other guide, and without it the model strips the subject
 * along with the framing. "Component state flow" for a React guide reads as
 * Vue or Angular just as easily.
 */
const STUDY_GUIDE_LEARNED_SKILL_RULES = `Name what the learner will KNOW after finishing, as a topic they can claim. Name the reusable concept or ability, never the guide: for a guide on caffeine and the brain, "Adenosine and sleep pressure", never "How caffeine affects your brain". The name must identify its subject on its own, because it joins a list next to topics from unrelated guides: when the concept also exists in other subjects, name the subject in it. For a guide on beginner React, "React component state", never "Component state flow". 2-5 words, sentence case, plain spaces, no hyphens, underscores, colons, or question marks.`

export const STUDY_GUIDE_LEARNED_SKILL_INSTRUCTION = `learnedSkillOptions: exactly ${STUDY_GUIDE_LEARNED_SKILL_MAX} entry. ${STUDY_GUIDE_LEARNED_SKILL_RULES}`

/** Hosted names the skill in the final-quiz call, once the guide is written. */
export const STUDY_GUIDE_LEARNED_SKILL_FIELD_INSTRUCTION = `learnedSkill: one string. ${STUDY_GUIDE_LEARNED_SKILL_RULES}`

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

const readStudyGuidePageIdeaAxis = (
  value: unknown,
): StudyGuidePageIdeaAxis | undefined => {
  const axis = (typeof value === 'string' ? value : '').trim().toLowerCase()

  return STUDY_GUIDE_PAGE_IDEA_AXES.find((candidate) => candidate === axis)
}

// Same shape as the next-idea sanitizer: hosted, BYO strong and Google local
// all emit pageIdeas inside a call they already make, so they all land here.
export const sanitizeStudyGuidePageIdeas = (
  value: unknown,
): StudyGuidePageIdea[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const seenLabels = new Set<string>()
  const seenAxes = new Set<StudyGuidePageIdeaAxis>()
  const ideas: StudyGuidePageIdea[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }

    const record = entry as Record<string, unknown>
    const label = trimTitleToWordBoundary(
      normalizeStudyGuideTitle(record.label),
      STUDY_GUIDE_PAGE_IDEA_LABEL_MAX_CHARS,
    )
    const prompt = trimTitleToWordBoundary(
      (typeof record.prompt === 'string' ? record.prompt : '')
        .replace(/\s+/g, ' ')
        .trim(),
      STUDY_GUIDE_PAGE_IDEA_PROMPT_MAX_CHARS,
    )
    const key = label.toLowerCase()
    if (!label || !prompt || seenLabels.has(key)) {
      continue
    }

    // Google local AI runs without a response schema and drops the axis often.
    // An idea without one keeps its place in the order the model returned.
    const axis = readStudyGuidePageIdeaAxis(record.axis)
    if (axis) {
      if (seenAxes.has(axis)) {
        continue
      }

      seenAxes.add(axis)
    }

    seenLabels.add(key)
    ideas.push(axis ? { axis, label, prompt } : { label, prompt })
    if (ideas.length >= STUDY_GUIDE_PAGE_IDEA_MAX) {
      break
    }
  }

  return ideas.every((idea) => idea.axis)
    ? [...ideas].sort(
        (left, right) =>
          STUDY_GUIDE_PAGE_IDEA_AXES.indexOf(
            left.axis as StudyGuidePageIdeaAxis,
          ) -
          STUDY_GUIDE_PAGE_IDEA_AXES.indexOf(
            right.axis as StudyGuidePageIdeaAxis,
          ),
      )
    : ideas
}

/**
 * Keeps the plan's unwritten lessons in the order the model returned them:
 * they continue a syllabus, so their order is the reading order and there is
 * no canonical sort to fall back on.
 */
export const sanitizeStudyGuidePlannedLessons = (
  value: unknown,
): StudyGuidePlannedLesson[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const seenTitles = new Set<string>()
  const lessons: StudyGuidePlannedLesson[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }

    const record = entry as Record<string, unknown>
    const title = trimTitleToWordBoundary(
      normalizeStudyGuideTitle(record.title),
      STUDY_GUIDE_PLANNED_LESSON_TITLE_MAX_CHARS,
    )
    const summary = trimTitleToWordBoundary(
      (typeof record.summary === 'string' ? record.summary : '')
        .replace(/\s+/g, ' ')
        .trim(),
      STUDY_GUIDE_PLANNED_LESSON_SUMMARY_MAX_CHARS,
    )
    const key = title.toLowerCase()
    if (!title || seenTitles.has(key)) {
      continue
    }

    seenTitles.add(key)
    lessons.push({ title, summary })
    if (lessons.length >= STUDY_GUIDE_PLANNED_LESSON_MAX) {
      break
    }
  }

  return lessons
}

/**
 * Names the skill the reader just claimed, so the relevance selector does not
 * have to guess it out of a known-topics list that can hold dozens of entries.
 *
 * Written in the guide's content language, never the interface language: this
 * sentence is appended to the model prompt, and an interface-language sentence
 * on an English prompt used to pull whole guides into the interface language.
 */
const KNOWN_SKILL_INSTRUCTIONS: Record<string, (skill: string) => string> = {
  en: (skill) =>
    `Explain it through ${skill}, which I already know. Do not re-explain ${skill} itself.`,
  es: (skill) =>
    `Explícamelo a través de ${skill}, que ya sé. No vuelvas a explicar ${skill}.`,
  fr: (skill) =>
    `Explique-le-moi à travers ${skill}, que je connais déjà. Ne réexplique pas ${skill}.`,
  de: (skill) =>
    `Erkläre es mir über ${skill}, das ich schon kenne. Erkläre ${skill} nicht noch einmal.`,
}

/**
 * Turns a page into a learner-shaped prompt for a whole guide on the same
 * topic. Written in the guide's content language for the same reason the
 * known-skill sentence is: this string is what picks the new guide's language.
 */
const TOPIC_PROMPTS: Record<
  string,
  (topic: string, subject: string) => string
> = {
  en: (topic, subject) =>
    subject
      ? `Teach me ${topic}, in the context of ${subject}.`
      : `Teach me ${topic}.`,
  es: (topic, subject) =>
    subject
      ? `Enséñame ${topic}, en el contexto de ${subject}.`
      : `Enséñame ${topic}.`,
  fr: (topic, subject) =>
    subject
      ? `Explique-moi ${topic}, dans le contexte de ${subject}.`
      : `Explique-moi ${topic}.`,
  de: (topic, subject) =>
    subject
      ? `Erkläre mir ${topic} im Zusammenhang mit ${subject}.`
      : `Bring mir ${topic} bei.`,
}

/**
 * `subjectName` is the guide the page belongs to. Without it a page title such
 * as "Confirmation delays" reads as a subject of its own, and the new guide
 * loses the thing it was actually about.
 */
export const buildStudyGuideTopicPrompt = (
  topicName: string,
  language?: string,
  subjectName?: string,
): string => {
  const topic = normalizeStudyGuideTitle(topicName)
  if (!topic) {
    return ''
  }

  const subject = normalizeStudyGuideTitle(subjectName || '')
  const build = TOPIC_PROMPTS[language || 'en'] || TOPIC_PROMPTS.en

  return build(
    topic,
    subject.toLowerCase() === topic.toLowerCase() ? '' : subject,
  )
}

export const buildStudyGuideKnownSkillInstruction = (
  skillName: string,
  language?: string,
): string => {
  const skill = skillName.trim()
  if (!skill) {
    return ''
  }

  const build = KNOWN_SKILL_INSTRUCTIONS[language || 'en']
  return (build || KNOWN_SKILL_INSTRUCTIONS.en)(skill)
}

/** Joins the learner prompt with a model-facing instruction, prompt first. */
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
