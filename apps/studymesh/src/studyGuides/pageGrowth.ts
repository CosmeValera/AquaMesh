/**
 * Growing a guide past the pages it shipped with.
 *
 * One mechanism, three seeds: the reader either continues the syllabus the
 * plan already wrote down, digs into a fragment they selected, or asks for
 * something in their own words. Everything downstream is identical, so the
 * seed is the only thing the UI has to decide.
 *
 * Kept out of `quickStart.ts` on purpose: that module is imported by the
 * serverless function, and this one reaches the AI provider settings.
 */
import {
  callLocalLanguageModel,
  callStrongAiModel,
  isStrongAiProvider,
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
  STRONG_AI_PROVIDERS,
} from '../quickCreate/ai'
import { callHostedAiModel } from '../quickCreate/ai/hostedClient'
import {
  createAiOutputLanguageInstruction,
  isLocalAiContentLanguageSupported,
  resolveContentLanguage,
  type StudyMeshLanguageCode,
} from '../language/contentLanguage'
import type {
  StudyGuidePageIdea,
  StudyGuidePlannedLesson,
  StudyPathContainerState,
} from '../state/store'
import { STUDY_GUIDE_PAGE_IDEA_AXES } from './studyGuideTitles'
import {
  getStudyGuidePageText,
  isEditableMarkdownStudyGuidePage,
} from './pages'

const STUDY_PAGE_TIMEOUT_MS = 30000
const STUDY_PAGE_SOURCE_TEXT_LIMIT = 4000
const MIN_STUDY_PAGE_WORDS = 60

/** Where the question this page answers came from. */
export type StudyGuideGrowthSeed =
  | { kind: 'continue'; lesson: StudyGuidePlannedLesson }
  | { kind: 'fragment'; sourcePageKey: string; selection: string }
  | { kind: 'prompt'; prompt: string }

export interface StudyGuideGrowthPageDraft {
  title: string
  markdown: string
}

/** One page currently being written. Several can run at once. */
export interface StudyGuideGrowthTask {
  id: string
  label: string
  startedAt: number
  /** Set by a continuation, so its lesson is not offered again while it runs. */
  lessonTitle?: string
}

/**
 * Only a selected fragment belongs under the page it came from. A continuation
 * and a page the reader asked for by name are both new lessons of their own,
 * so they go last rather than into someone else's branch.
 */
export const readStudyGuideGrowthParentKey = (
  seed: StudyGuideGrowthSeed,
): string | undefined =>
  seed.kind === 'fragment' ? seed.sourcePageKey : undefined

/** Short label for the page being written, for progress in the pages panel. */
export const readStudyGuideGrowthLabel = (
  seed: StudyGuideGrowthSeed,
): string => {
  if (seed.kind === 'continue') {
    return seed.lesson.title
  }

  const text = (
    seed.kind === 'fragment' ? seed.selection : seed.prompt
  ).replace(/\s+/g, ' ')

  return text.length > 48 ? `${text.slice(0, 47).trim()}...` : text.trim()
}

const wordCount = (value: string): number =>
  value.split(/\s+/).filter(Boolean).length

const stripMarkdownFences = (value: string): string =>
  value
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim()

const extractJsonObject = (value: string): string => {
  const candidate = stripMarkdownFences(value)
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start < 0 || end <= start) {
    throw new Error('The new page did not come back as JSON.')
  }

  return candidate.slice(start, end + 1)
}

const stripLeadingHeading = (markdown: string): string =>
  markdown.replace(/^\s*#{1,6}\s+.*$/m, '').replace(/^\s+/, '')

export const parseStudyGuideGrowthPageResponse = (
  value: string,
  fallbackTitle: string,
): StudyGuideGrowthPageDraft => {
  const parsed = JSON.parse(extractJsonObject(value)) as {
    title?: unknown
    markdown?: unknown
  }
  const title = String(parsed.title || fallbackTitle).trim()
  const body = stripLeadingHeading(String(parsed.markdown || '').trim()).trim()

  if (!title || !body) {
    throw new Error('The new page came back empty.')
  }

  if (wordCount(body) < MIN_STUDY_PAGE_WORDS) {
    throw new Error('The new page came back too short to add.')
  }

  return { title, markdown: `# ${title}\n\n${body}` }
}

/** The page a seed digs into, when it digs into one. */
// Only a fragment quotes a page, so only a fragment sends that page's text.
const readSeedSourcePage = (
  studyPath: StudyPathContainerState,
  seed: StudyGuideGrowthSeed,
) =>
  seed.kind === 'fragment'
    ? studyPath.dashboards.find(
        (dashboard) => dashboard.dashboardKey === seed.sourcePageKey,
      )
    : undefined

const describeSeed = (seed: StudyGuideGrowthSeed): string => {
  if (seed.kind === 'continue') {
    return `Write the next lesson of this guide: "${seed.lesson.title}".
The lesson should leave the reader able to: ${
      seed.lesson.summary || 'use this part of the topic'
    }`
  }

  if (seed.kind === 'fragment') {
    return `The reader selected this from the page above and wants a page on it:
"${seed.selection.replace(/\s+/g, ' ').trim().slice(0, 600)}"`
  }

  return `The reader asked for this in their own words:
"${seed.prompt.replace(/\s+/g, ' ').trim().slice(0, 600)}"`
}

export const buildStudyGuidePagePrompt = (
  studyPath: StudyPathContainerState,
  seed: StudyGuideGrowthSeed,
  outputLanguage: StudyMeshLanguageCode,
): string => {
  const sourcePage = readSeedSourcePage(studyPath, seed)
  const existingTitles = studyPath.dashboards
    .filter((dashboard) => dashboard.createdBy !== 'quickCreate')
    .map((dashboard) => `- ${dashboard.name}`)
    .join('\n')
  const sourceText = sourcePage
    ? getStudyGuidePageText(sourcePage).slice(0, STUDY_PAGE_SOURCE_TEXT_LIMIT)
    : ''

  return `Write one new page for a RabbitHole Study Guide the reader is already partway through.

Return strict JSON only: { "title": "...", "markdown": "..." }

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- 220-320 words of real teaching in readable Markdown, with 2-3 short topic-specific section headings.
- Do not repeat what the pages listed below already teach. Add what they are missing.
- Do not open by describing the guide or the page. Teach the thing directly.
- Finish every paragraph as a complete sentence. Never stop mid-thought.
- For programming, config, or command-line topics, include one minimal fenced snippet with a language tag. Never write placeholder code.
- For other topics use a concrete example, comparison, or short scenario instead of code.
- Do not include quiz questions, flashcards, or images.
- title is 3-8 words naming this page. Do not number it.
- markdown must not start with a heading; the title is returned separately.

Study Guide: ${studyPath.title}

Pages the guide already has:
${existingTitles || '- (none yet)'}
${
  sourcePage
    ? `
The page this comes from is "${sourcePage.name}". Its content:
${sourceText}
`
    : ''
}
${describeSeed(seed)}`
}

const callStudyPageModel = async (
  prompt: string,
  outputLanguage: StudyMeshLanguageCode,
): Promise<string> => {
  const settings = readQuickCreateAiSettings()
  const provider = settings.provider || 'hosted'

  if (provider === 'hosted') {
    return callHostedAiModel({
      surface: 'study-page',
      model: STRONG_AI_PROVIDERS.cerebras.defaultModel,
      outputLanguage,
      parts: [{ text: prompt }],
      timeoutMs: STUDY_PAGE_TIMEOUT_MS,
    })
  }

  if (provider === 'local') {
    if (!isLocalAiContentLanguageSupported(outputLanguage)) {
      throw new Error(
        'Google Local AI only supports English, Spanish, and Japanese output in RabbitHole.',
      )
    }

    return callLocalLanguageModel(prompt, {
      outputLanguage,
      promptType: 'notes',
      stepLabel: 'Write the new page',
    })
  }

  if (isStrongAiProvider(provider)) {
    const credentials = resolveQuickCreateAiCredentials(provider)
    if (!credentials.apiToken) {
      throw new Error(
        `${STRONG_AI_PROVIDERS[provider].modeLabel} mode needs a configured API key.`,
      )
    }

    return callStrongAiModel({
      provider,
      apiToken: credentials.apiToken,
      model: credentials.model,
      parts: [{ text: prompt }],
      timeoutMs: STUDY_PAGE_TIMEOUT_MS,
    })
  }

  throw new Error('Choose a supported AI mode before adding a page.')
}

export const createStudyGuideGrowthPageDraft = async (
  studyPath: StudyPathContainerState,
  seed: StudyGuideGrowthSeed,
): Promise<StudyGuideGrowthPageDraft> => {
  // A page inherits the guide's language. The reader's own words only decide
  // it when the guide never recorded one.
  const outputLanguage =
    studyPath.contentLanguage ||
    resolveContentLanguage({
      text: seed.kind === 'prompt' ? seed.prompt : studyPath.title,
    }).language

  const text = await callStudyPageModel(
    buildStudyGuidePagePrompt(studyPath, seed, outputLanguage),
    outputLanguage,
  )

  return parseStudyGuideGrowthPageResponse(
    text,
    readStudyGuideGrowthLabel(seed),
  )
}

/**
 * Drops the lesson a continuation just used, so the same page is never
 * offered twice. Matched on title because that is what the reader saw.
 */
export const consumeStudyGuidePlannedLesson = (
  studyPath: StudyPathContainerState,
  lesson: StudyGuidePlannedLesson,
): StudyGuidePlannedLesson[] | undefined => {
  const remaining = (studyPath.plannedLessons || []).filter(
    (candidate) =>
      candidate.title.trim().toLowerCase() !==
      lesson.title.trim().toLowerCase(),
  )

  return remaining.length ? remaining : undefined
}

const HEADING_PATTERN = /^\s*#{2,6}\s+(.+)$/gm

/**
 * Page ideas for a page the model never wrote any for: manual pages, chat
 * pages and guides made before the offer existed. Derived from the page's own
 * headings, so it costs nothing and can only name things the page mentions.
 */
export const deriveStudyGuidePageIdeas = (
  studyPath: StudyPathContainerState,
  dashboardKey: string,
): StudyGuidePageIdea[] => {
  const page = studyPath.dashboards.find(
    (dashboard) => dashboard.dashboardKey === dashboardKey,
  )
  if (!page) {
    return []
  }

  if (page.pageIdeas?.length) {
    return page.pageIdeas
  }

  const text = getStudyGuidePageText(page)
  const headings = [...text.matchAll(HEADING_PATTERN)]
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
    .filter((heading) => heading.length > 2 && heading.length <= 48)
    .filter(
      (heading, index, all) =>
        all.findIndex(
          (candidate) => candidate.toLowerCase() === heading.toLowerCase(),
        ) === index,
    )
  const subjects = (headings.length ? headings : [page.name]).slice(
    0,
    STUDY_GUIDE_PAGE_IDEA_AXES.length,
  )

  const prompts: Record<
    (typeof STUDY_GUIDE_PAGE_IDEA_AXES)[number],
    (subject: string) => { label: string; prompt: string }
  > = {
    mechanism: (subject) => ({
      label: `How ${subject} works`,
      prompt: `Show me how ${subject} actually works underneath.`,
    }),
    example: (subject) => ({
      label: `${subject} worked through`,
      prompt: `Walk me through one concrete example of ${subject} from start to finish.`,
    }),
    limit: (subject) => ({
      label: `Where ${subject} breaks`,
      prompt: `Show me where ${subject} stops holding and what it gets confused with.`,
    }),
  }

  return STUDY_GUIDE_PAGE_IDEA_AXES.map((axis, index) => {
    const subject = subjects[index] || subjects[0]
    const { label, prompt } = prompts[axis](subject)
    return { axis, label, prompt }
  })
}

/** Whether this page can act as the source of a dug-out page. */
export const canGrowFromStudyGuidePage = (
  studyPath: StudyPathContainerState,
  dashboardKey: string,
): boolean => {
  const page = studyPath.dashboards.find(
    (dashboard) => dashboard.dashboardKey === dashboardKey,
  )

  // Quick Create practice pages are generated material, not a lesson to dig
  // into, and an empty manual page has nothing to dig into yet.
  return Boolean(
    page &&
      page.createdBy !== 'quickCreate' &&
      (!isEditableMarkdownStudyGuidePage(page) ||
        getStudyGuidePageText(page).trim().length > 0),
  )
}
