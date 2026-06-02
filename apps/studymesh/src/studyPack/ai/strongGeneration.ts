import {
  StudyObject,
  StudyPackSourceFormat,
  StudyPathDashboardRole,
} from '../types'
import {
  getDefaultStudyPathLayoutMetadata,
  normalizeStudyPathLayoutMetadata,
} from '../studyPathArchetypes'
import {
  conceptExplanation,
  conceptRecapGroups,
  conceptSummaryItem,
  extractLearningConcepts,
} from '../concepts'
import {
  augmentStudyPackPracticeObjects,
  createStudyPackPracticeProfile,
  getEffectiveGenerationTargets,
  isVisiblePracticeStudyObject,
} from '../practice'
import {
  assertRoleObjectsAreClean,
  applyStudyMaterialResourceTypeToDraft,
  filterStudyObjectsForDashboardRole,
  normalizeAiStudyPackDraft,
  AiStudyPackDraft,
  StudyMaterialDetailLevel,
  StudyMaterialResourceType,
} from './normalizer'
import {
  callStrongAiModel,
  DEFAULT_STRONG_AI_PROVIDER,
  StrongAiProviderId,
} from './strongProviders'

interface GeminiPart {
  text?: string
  inline_data?: {
    mime_type: string
    data: string
  }
}

const GEMINI_REQUEST_TIMEOUT_MS = 5 * 60 * 1000
const GEMINI_TIMEOUT_MESSAGE =
  'Gemini took longer than 5 minutes, so StudyMesh stopped the request. Try again with shorter notes, fewer generated blocks, or Basic fallback.'
const GEMINI_RATE_LIMIT_MESSAGE =
  'Gemini rate limit reached for today. Try again later, use Basic fallback, or check your Gemini API quota.'
const GEMINI_OUTPUT_FORMAT_MESSAGE =
  'Gemini could not follow the requested output format. StudyMesh retried with a simpler JSON prompt, but the response was still unusable.'

const generationTargetLabels: Record<string, string> = {
  quizzes: 'multiple-choice quizzes',
  flashcards: 'flashcards',
  summaries: 'summaries or key-point lists',
  definitions: 'term definitions',
  reviewPrompts: 'review prompts',
  lists: 'lists or ordered steps',
  tables: 'tables',
  comparisons: 'comparisons',
  code: 'code notes',
}

const formatGenerationTargets = (targets: string[]): string =>
  targets.map((target) => generationTargetLabels[target] || target).join(', ')

const geminiDetailTargets: Record<
  StudyMaterialResourceType,
  Record<StudyMaterialDetailLevel, string>
> = {
  improvedNotes: {
    short: '400-700 words',
    medium: '900-1400 words',
    long: '1800-2600 words',
  },
  flashcards: {
    short: '20-30 flashcards',
    medium: '40-50 flashcards',
    long: '50-65 flashcards',
  },
  quiz: {
    short: '20-30 multiple-choice questions',
    medium: '40-50 multiple-choice questions',
    long: '50-65 multiple-choice questions',
  },
}

export type QuizQuestionStyle = 'mixed' | 'conceptual' | 'examLike'

export interface GenerateStudyPackWithAiOptions {
  apiToken: string
  model: string
  strongProvider?: StrongAiProviderId
  title: string
  rawNotes: string
  packId: string
  generationTargets?: string[]
  generationAmount?: 'few' | 'medium' | 'many'
  resourceType?: StudyMaterialResourceType
  detailLevel?: StudyMaterialDetailLevel
  quizQuestionStyle?: QuizQuestionStyle
  promptMode?: boolean
  studyPathMode?: boolean
}

export type StudyPathGenerationAmount =
  | 'superSmall'
  | 'compact'
  | 'average'
  | 'deep'
  | 'few'
  | 'medium'
  | 'many'

export interface AiStudyPathDashboardDraft extends AiStudyPackDraft {
  summary: string
  dashboardRole: StudyPathDashboardRole
}

export interface AiStudyPathDraft {
  title: string
  folderName: string
  dashboards: AiStudyPathDashboardDraft[]
  warnings: string[]
}

export interface GenerateStudyPathWithAiOptions {
  apiToken: string
  model: string
  strongProvider?: StrongAiProviderId
  title: string
  prompt: string
  folderName: string
  generationAmount?: StudyPathGenerationAmount
  localAiDashboardConcurrency?: 1 | 2 | 3 | 5
  mustInclude?: string
  avoidTopics?: string
}

export const normalizeStudyPathGenerationAmount = (
  generationAmount: StudyPathGenerationAmount = 'average',
): 'superSmall' | 'compact' | 'average' | 'deep' => {
  if (generationAmount === 'few') {
    return 'compact'
  }

  if (generationAmount === 'medium') {
    return 'average'
  }

  if (generationAmount === 'many') {
    return 'deep'
  }

  return generationAmount
}

const getStudyPathDashboardCount = (
  generationAmount: StudyPathGenerationAmount = 'average',
): number => {
  const normalized = normalizeStudyPathGenerationAmount(generationAmount)

  return normalized === 'superSmall'
    ? 2
    : normalized === 'compact'
      ? 3
      : normalized === 'deep'
        ? 7
        : 5
}

const getStudyPathStepNames = (
  generationAmount: StudyPathGenerationAmount = 'average',
): string[] =>
  Array.from({ length: getStudyPathDashboardCount(generationAmount) }).map(
    (_role, index) => `Lesson ${index + 1}`,
  )

const hasUsefulLessonNotes = (value: string): boolean =>
  value.trim().split(/\s+/).filter(Boolean).length >= 80

const hasReadableLessonStructure = (value: string): boolean =>
  /(^|\n)#{1,3}\s+\S/.test(value) ||
  /(^|\n)\s*[-*]\s+\S/.test(value) ||
  /(^|\n)\s*\d+[.)]\s+\S/.test(value)

const splitIntoSentences = (value: string): string[] =>
  value
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

const formatLessonNotesForReading = (
  title: string,
  summary: string,
  rawNotes: string,
): string => {
  const trimmed = rawNotes.trim()
  if (!trimmed || hasReadableLessonStructure(trimmed)) {
    return trimmed
  }

  const sentences = splitIntoSentences(trimmed)
  if (sentences.length < 5) {
    return [`# ${title}`, summary, trimmed]
      .map((part) => part.trim())
      .filter(Boolean)
      .join('\n\n')
  }

  const overview = sentences.slice(0, 2)
  const conceptCount = Math.max(3, Math.ceil((sentences.length - 2) * 0.45))
  const keyConcepts = sentences.slice(2, 2 + conceptCount)
  const remaining = sentences.slice(2 + conceptCount)
  const examples = remaining.slice(
    0,
    Math.max(2, Math.floor(remaining.length / 2)),
  )
  const tips = remaining.slice(examples.length)

  return [
    `# ${title}`,
    summary ? `## Goal\n${summary}` : '',
    overview.length > 0 ? `## Overview\n${overview.join(' ')}` : '',
    keyConcepts.length > 0
      ? `## Key points\n${keyConcepts
          .map((sentence) => `- ${sentence}`)
          .join('\n')}`
      : '',
    examples.length > 0
      ? `## Examples and usage\n${examples
          .map((sentence) => `- ${sentence}`)
          .join('\n')}`
      : '',
    tips.length > 0
      ? `## Remember\n${tips.map((sentence) => `- ${sentence}`).join('\n')}`
      : '',
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n')
}

const studyObjectToLessonNote = (
  object: AiStudyPackDraft['objects'][number],
): string => {
  switch (object.kind) {
    case 'markdown':
      return object.markdown
    case 'note':
      return object.body
    case 'term':
      return `Definition — ${object.term}: ${object.definition}`
    case 'qa':
      return `Flashcard — ${object.question}\nAnswer: ${object.answer}`
    case 'quiz':
      return `Quiz concept — ${object.question}\nAnswer: ${object.answer}. ${object.explanation}`
    case 'list':
      return `${object.title || 'Key list'}:\n${object.items
        .map((item) => `- ${item}`)
        .join('\n')}`
    case 'sequence':
      return `${object.title || 'Steps'}:\n${object.steps
        .map((step, index) => `${index + 1}. ${step}`)
        .join('\n')}`
    case 'comparison':
      return `${object.title || 'Comparison'}: ${object.columns.join(' vs ')}`
    case 'table':
      return `${object.title || 'Table'}: ${object.headers.join(', ')}`
    case 'reviewPrompt':
      return `Review prompt — ${object.prompt}${
        object.reason ? ` (${object.reason})` : ''
      }`
    case 'code':
      return `${object.caption || object.title || 'Code note'}\n${object.code}`
    case 'resource':
      return `${object.label}: ${object.url}`
    case 'reveal':
      return `${object.prompt}: ${object.hiddenText}`
    default:
      return ''
  }
}

const buildStudyPathLessonNotes = (
  title: string,
  summary: string,
  rawNotes: string,
  objects: AiStudyPackDraft['objects'],
): string => {
  if (hasUsefulLessonNotes(rawNotes)) {
    return formatLessonNotesForReading(title, summary, rawNotes)
  }

  const objectNotes = objects
    .map(studyObjectToLessonNote)
    .map((note) => note.trim())
    .filter(Boolean)
    .join('\n\n')

  return [`# ${title}`, objectNotes, summary, rawNotes]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n')
}

export interface ExtractRawNotesWithAiOptions {
  apiToken: string
  model: string
  image: File
}

const textArraySchema = { type: 'ARRAY', items: { type: 'STRING' } }

const dashboardContractProperties = {
  sourceSummary: {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      bullets: textArraySchema,
    },
    required: ['title', 'bullets'],
  },
  conceptRecap: {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      sections: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            bullets: textArraySchema,
            example: { type: 'STRING' },
          },
          required: ['title', 'bullets', 'example'],
        },
      },
    },
    required: ['title', 'sections'],
  },
  practice: {
    type: 'OBJECT',
    properties: {
      shortAnswer: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            question: { type: 'STRING' },
            expectedAnswer: { type: 'STRING' },
            explanation: { type: 'STRING' },
          },
          required: ['question', 'expectedAnswer', 'explanation'],
        },
      },
      multipleChoice: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            question: { type: 'STRING' },
            options: textArraySchema,
            correctOptionIndex: { type: 'NUMBER' },
            explanation: { type: 'STRING' },
          },
          required: [
            'question',
            'options',
            'correctOptionIndex',
            'explanation',
          ],
        },
      },
    },
    required: ['shortAnswer', 'multipleChoice'],
  },
  flashcards: {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        front: { type: 'STRING' },
        back: { type: 'STRING' },
      },
      required: ['front', 'back'],
    },
  },
}

const objectSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    sourceFormat: {
      type: 'STRING',
      enum: [
        'paste',
        'markdown',
        'text',
        'csv',
        'markdown-table',
        'quick-syntax',
      ],
    },
    ...dashboardContractProperties,
  },
  required: ['sourceSummary', 'conceptRecap', 'practice', 'flashcards'],
}

const studyPathSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    folderName: { type: 'STRING' },
    dashboards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          summary: { type: 'STRING' },
          rawNotes: { type: 'STRING' },
          layoutArchetype: {
            type: 'STRING',
            enum: [
              'focusLesson',
              'learnPracticeTabs',
              'splitReferenceExercise',
              'multiWidgetLab',
              'overviewReview',
            ],
          },
          dashboardPurpose: {
            type: 'STRING',
            enum: [
              'overview',
              'lesson',
              'practice',
              'review',
              'finalReview',
              'projectLab',
            ],
          },
          practiceType: {
            type: 'STRING',
            enum: ['none', 'quiz', 'flashcards', 'mixed'],
          },
          layoutReason: { type: 'STRING' },
          moduleTitle: { type: 'STRING' },
          lessonType: {
            type: 'STRING',
            enum: [
              'orientation',
              'concept',
              'workedExample',
              'comparison',
              'procedure',
              'lab',
              'checkpoint',
              'review',
              'remediation',
            ],
          },
          learnerQuestion: { type: 'STRING' },
          learningOutcome: { type: 'STRING' },
          suggestedPractice: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          sourceRefs: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'STRING' },
                label: { type: 'STRING' },
                source: { type: 'STRING' },
                chunkIndex: { type: 'NUMBER' },
              },
            },
          },
          ...dashboardContractProperties,
        },
        required: [
          'title',
          'summary',
          'rawNotes',
          'sourceSummary',
          'conceptRecap',
          'practice',
          'flashcards',
        ],
      },
    },
  },
  required: ['title', 'folderName', 'dashboards'],
}

const emptyPractice = () => ({
  shortAnswer: [],
  multipleChoice: [],
})

const emptyFlashcards: Array<{ front: string; back: string }> = []

const getSourceSummaryOrDefault = (
  input: Record<string, unknown>,
  dashboardTitle: string,
  dashboardRole: StudyPathDashboardRole,
) =>
  input.sourceSummary && typeof input.sourceSummary === 'object'
    ? input.sourceSummary
    : {
        title:
          dashboardRole === 'exercises'
            ? `${dashboardTitle} instructions`
            : `${dashboardTitle} source summary`,
        bullets: [
          dashboardRole === 'exercises'
            ? 'Use this dashboard for mixed practice.'
            : `Review the key ideas for ${dashboardTitle}.`,
        ],
      }

const getConceptRecapOrDefault = (
  input: Record<string, unknown>,
  dashboardTitle: string,
  dashboardRole: StudyPathDashboardRole,
) => {
  if (input.conceptRecap && typeof input.conceptRecap === 'object') {
    return input.conceptRecap
  }

  if (dashboardRole === 'summary') {
    return {
      title: `${dashboardTitle} synthesis`,
      sections: [
        {
          title: 'Path synthesis',
          bullets: ['Connect the main ideas from the previous dashboards.'],
          example: '',
        },
      ],
    }
  }

  return {
    title: `${dashboardTitle} concept recap`,
    sections: [],
  }
}

const getPracticeOrDefault = (input: Record<string, unknown>) =>
  input.practice && typeof input.practice === 'object'
    ? input.practice
    : emptyPractice()

const getFlashcardsOrDefault = (input: Record<string, unknown>) =>
  Array.isArray(input.flashcards) ? input.flashcards : emptyFlashcards

const sanitizeDashboardInputForRole = (
  input: Record<string, unknown>,
  dashboardRole: StudyPathDashboardRole,
  dashboardTitle: string,
) => {
  const base = {
    ...input,
    title: dashboardTitle,
    sourceFormat: 'text',
  }

  if (dashboardRole === 'summary') {
    return {
      ...base,
      sourceSummary: getSourceSummaryOrDefault(
        input,
        dashboardTitle,
        dashboardRole,
      ),
      conceptRecap: getConceptRecapOrDefault(
        input,
        dashboardTitle,
        dashboardRole,
      ),
      practice: emptyPractice(),
      flashcards: [],
    }
  }

  if (dashboardRole === 'exercises') {
    return {
      ...base,
      sourceSummary: getSourceSummaryOrDefault(
        {},
        dashboardTitle,
        dashboardRole,
      ),
      conceptRecap: {
        title: `${dashboardTitle} practice-only recap`,
        sections: [],
      },
      practice: getPracticeOrDefault(input),
      flashcards: getFlashcardsOrDefault(input),
    }
  }

  return {
    ...base,
    sourceSummary: getSourceSummaryOrDefault(
      input,
      dashboardTitle,
      dashboardRole,
    ),
    conceptRecap: getConceptRecapOrDefault(
      input,
      dashboardTitle,
      dashboardRole,
    ),
    practice: getPracticeOrDefault(input),
    flashcards: getFlashcardsOrDefault(input),
  }
}

const hasUsableStudyPathDashboardInput = (
  input: Record<string, unknown>,
): boolean => {
  if (typeof input.title === 'string' && input.title.trim()) {
    return true
  }

  if (typeof input.rawNotes === 'string' && input.rawNotes.trim()) {
    return true
  }

  return [
    input.sourceSummary,
    input.conceptRecap,
    input.practice,
    input.flashcards,
  ].some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0
    }

    return Boolean(value && typeof value === 'object')
  })
}

const getArrayLength = (value: unknown): number =>
  Array.isArray(value) ? value.length : 0

const getObjectRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const getConceptRecapSectionCount = (
  input: Record<string, unknown>,
): number => {
  const conceptRecap = getObjectRecord(input.conceptRecap)
  return getArrayLength(conceptRecap.sections)
}

const getPracticeQuestionCount = (input: Record<string, unknown>): number => {
  const practice = getObjectRecord(input.practice)
  return (
    getArrayLength(practice.shortAnswer) +
    getArrayLength(practice.multipleChoice)
  )
}

const getFlashcardCount = (input: Record<string, unknown>): number =>
  getArrayLength(input.flashcards)

const sourceSummaryOnlyForNormalDashboard = (
  input: Record<string, unknown>,
): boolean =>
  Boolean(input.sourceSummary) &&
  getConceptRecapSectionCount(input) === 0 &&
  getPracticeQuestionCount(input) === 0 &&
  getFlashcardCount(input) === 0

const normalDashboardNeedsRepair = (
  input: Record<string, unknown>,
  dashboardRole: StudyPathDashboardRole,
): boolean =>
  dashboardRole === 'normal' &&
  getConceptRecapSectionCount(input) === 0 &&
  getPracticeQuestionCount(input) === 0 &&
  getFlashcardCount(input) === 0

const textFromRawNotes = (rawNotes: unknown): string =>
  typeof rawNotes === 'string' ? rawNotes.replace(/\s+/g, ' ').trim() : ''

const sourceSummaryBullets = (
  sourceSummary: AiStudyPackDraft['sourceSummary'],
): string[] =>
  sourceSummary?.bullets
    .map((bullet) => bullet.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 5) || []

const normalizeSummaryText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const stripRepeatedSummaryPrefix = (value: string): string => {
  const normalized = normalizeSummaryText(value)
  const repeated = normalized.match(/^([^:]{3,60}):\s+\1\b\s*/i)

  if (!repeated) {
    return normalized
  }

  const prefix = `${repeated[1]}:`
  return normalizeSummaryText(normalized.slice(prefix.length))
}

const isLowQualitySummaryLine = (value: string): boolean => {
  const normalized = normalizeSummaryText(value)

  return (
    normalized.length < 18 ||
    /^([^:]{2,40}):\s+\1\b/i.test(normalized) ||
    /^(?:there|these|this|it|they|mastering these):/i.test(normalized) ||
    /^[A-Z][a-z]+:\s+(?:These|This|There|It)\b/.test(normalized)
  )
}

const formatSummaryHeading = (value: string): string => {
  const normalized = normalizeSummaryText(value.replace(/:.*$/, ''))
  const words = normalized.split(/\s+/).filter(Boolean).slice(0, 7)
  const heading = words.join(' ')

  return heading || 'Key concept'
}

const createFallbackBase = (packId: string, suffix: string, title: string) => ({
  id: `${packId}-fallback-${suffix}`,
  title,
  sourceLine: 1,
  tags: ['study-path', 'fallback'],
})

const buildFallbackObjectsForDashboardRole = ({
  packId,
  dashboardTitle,
  dashboardRole,
  rawNotes,
  sourceSummary,
  accumulatedContentNotes,
}: {
  packId: string
  dashboardTitle: string
  dashboardRole: StudyPathDashboardRole
  rawNotes: unknown
  sourceSummary: AiStudyPackDraft['sourceSummary']
  accumulatedContentNotes: string[]
}): StudyObject[] => {
  const bullets = sourceSummaryBullets(sourceSummary)
  const noteText = textFromRawNotes(rawNotes)
  const fallbackText =
    bullets.join('\n') ||
    noteText.slice(0, 700) ||
    accumulatedContentNotes
      .join('\n\n')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 700)

  if (dashboardRole === 'exercises') {
    const practiceSource =
      accumulatedContentNotes.join('\n\n').replace(/\s+/g, ' ').trim() ||
      noteText ||
      bullets.join(' ')
    const concepts = extractLearningConcepts(practiceSource, dashboardTitle)
      .map(conceptSummaryItem)
      .slice(0, 2)
    const prompts =
      concepts.length > 0
        ? concepts.map((concept) => `How would you apply ${concept}?`)
        : practiceSource
          ? ['What is one key idea from the previous Study Guide material?']
          : []

    return prompts.map((question, index) => ({
      ...createFallbackBase(
        packId,
        `exercise-${index + 1}`,
        `Practice ${index + 1}`,
      ),
      kind: 'quiz' as const,
      quizMode: 'shortAnswer' as const,
      question,
      options: [],
      correctIndex: 0,
      answer: 'Use the Study Guide notes to answer in your own words.',
      explanation:
        'Generated as a minimal fallback from the Study Guide source.',
    }))
  }

  if (!fallbackText) {
    return []
  }

  return [
    {
      ...createFallbackBase(packId, 'summary', `${dashboardTitle} summary`),
      kind: 'list' as const,
      items: bullets.length > 0 ? bullets : [fallbackText],
      ordered: false,
      checklist: false,
    },
  ]
}

const getStudyPathVisibleObjectsForRole = (
  objects: StudyObject[],
  dashboardRole: StudyPathDashboardRole,
  events: string[],
): StudyObject[] => {
  if (dashboardRole !== 'normal') {
    return objects
  }

  const visibleObjects = objects.filter(
    (object) =>
      object.kind === 'quiz' ||
      object.kind === 'qa' ||
      object.kind === 'reveal',
  )
  const suppressedCount = objects.length - visibleObjects.length

  if (suppressedCount > 0) {
    events.push(
      `Intentionally suppressed ${suppressedCount} conceptRecap/list-style normal-dashboard object${
        suppressedCount === 1 ? '' : 's'
      } from visible widgets; theory remains in source notes and source summary.`,
    )
  }

  return visibleObjects
}

const getStudyPathVisiblePracticeTarget = (
  dashboardRole: StudyPathDashboardRole,
  generationAmount: StudyPathGenerationAmount,
): number => {
  const normalized = normalizeStudyPathGenerationAmount(generationAmount)

  if (dashboardRole === 'normal') {
    return normalized === 'superSmall' ||
      (normalized === 'compact' && generationAmount !== 'few')
      ? 5
      : 7
  }

  if (dashboardRole === 'exercises') {
    return normalized === 'superSmall' || normalized === 'compact'
      ? 10
      : normalized === 'deep'
        ? 18
        : 14
  }

  return 0
}

const studyPathAmountToPracticeAmount = (
  generationAmount: StudyPathGenerationAmount,
): 'few' | 'medium' | 'many' => {
  const normalized = normalizeStudyPathGenerationAmount(generationAmount)
  if (normalized === 'superSmall' || normalized === 'compact') {
    return 'few'
  }

  if (normalized === 'deep') {
    return 'many'
  }

  return 'medium'
}

const parseGeminiJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    if (fenced) {
      return JSON.parse(fenced)
    }

    const firstObject = text.indexOf('{')
    const lastObject = text.lastIndexOf('}')
    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(text.slice(firstObject, lastObject + 1))
    }

    throw new Error('Gemini returned invalid JSON.')
  }
}

const isGeminiOutputFormatError = (error: unknown): boolean =>
  error instanceof Error &&
  /wrong output format|invalid json|output format|response format|malformed/i.test(
    error.message,
  )

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Could not read image file.'))
    reader.readAsDataURL(file)
  })

const callStrongModel = async (
  apiToken: string,
  model: string,
  parts: GeminiPart[],
  responseSchema?: Record<string, unknown>,
  provider: StrongAiProviderId = DEFAULT_STRONG_AI_PROVIDER,
): Promise<string> => {
  try {
    return await callStrongAiModel({
      provider,
      apiToken,
      model,
      parts,
      responseSchema,
      timeoutMs: GEMINI_REQUEST_TIMEOUT_MS,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      /strong model request took longer than 5 minutes/i.test(error.message)
    ) {
      throw new Error(GEMINI_TIMEOUT_MESSAGE)
    }

    throw error
  }
}

export const extractRawNotesWithAi = async ({
  apiToken,
  model,
  image,
}: ExtractRawNotesWithAiOptions): Promise<string> => {
  const data = await fileToBase64(image)
  const text = await callStrongModel(
    apiToken,
    model,
    [
      {
        text: 'Extract study notes from this image. Correct likely OCR mistakes, preserve headings, formulas, lists, and questions. Return only clean Markdown notes grounded in the image.',
      },
      {
        inline_data: {
          mime_type: image.type || 'image/png',
          data,
        },
      },
    ],
    undefined,
    'gemini',
  )

  return text.trim()
}

export const generateStudyPackWithAi = async ({
  apiToken,
  model,
  strongProvider = DEFAULT_STRONG_AI_PROVIDER,
  title,
  rawNotes,
  packId,
  generationTargets = [],
  generationAmount = 'medium',
  resourceType,
  detailLevel = 'medium',
  quizQuestionStyle = 'mixed',
  promptMode = false,
  studyPathMode = false,
}: GenerateStudyPackWithAiOptions): Promise<AiStudyPackDraft> => {
  const effectiveTargets = getEffectiveGenerationTargets(generationTargets)
  const practiceProfile = createStudyPackPracticeProfile(
    generationAmount,
    generationTargets,
  )
  const targetInstruction = `Create only these selected study material types when possible: ${formatGenerationTargets(
    effectiveTargets,
  )}. Treat selected targets as a hard UI contract.`
  const resourceTarget = resourceType
    ? geminiDetailTargets[resourceType][detailLevel]
    : null
  const amountInstruction =
    resourceType === 'flashcards'
      ? `Create ${resourceTarget} when possible. Never create fewer than 40 flashcards at Medium or Long detail if the notes contain enough usable facts.`
      : resourceType === 'quiz'
        ? `Create ${resourceTarget} when possible. Never create fewer than 40 multiple-choice questions at Medium or Long detail if the notes contain enough usable facts.`
        : `Create ${practiceProfile.targetTotal} reviewable study items when possible, never fewer than ${practiceProfile.minTotal} if the notes contain usable facts. Keep the total within ${practiceProfile.minTotal}-${practiceProfile.maxTotal} items.`
  const mixInstruction =
    resourceType === 'flashcards'
      ? 'All reviewable items must be flashcards. Do not create quizzes, short-answer practice, summaries, definitions, or support review objects.'
      : resourceType === 'quiz'
        ? 'All reviewable items must be multiple-choice quiz questions. Do not create short-answer questions, typed-answer questions, quizSingle items, flashcards, summaries, definitions, or support review objects.'
        : practiceProfile.enforceQuizzes || practiceProfile.enforceFlashcards
          ? `Use an active-practice mix: ${practiceProfile.targetQuizzes} quizzes, ${practiceProfile.targetFlashcards} flashcards, and about ${practiceProfile.targetSupport} summaries/definitions/review prompts. Quizzes should be 50-60% of the pack and flashcards 20-30%.`
          : 'Use the selected non-practice targets and still create the requested number of useful reviewable items.'
  const resourceInstruction =
    resourceType === 'improvedNotes'
      ? 'Selected resource type: Expand on this. Create one polished expanded note set from the source. Stay close to the provided content and preserve the same learner level, vocabulary difficulty, and topic depth as the original source. Do not introduce advanced terms, extra concepts, or deeper rabbit holes unless they are clearly needed to explain the source. Organize the notes into teachable sections such as: source summary, key concepts, examples, common mistakes or misconceptions, and compact takeaways. Use clear explanations, but keep the complexity appropriate to the source. Do not create a quiz, multiple choice questions, short answer practice, or flashcards. Leave practice.shortAnswer, practice.multipleChoice, and flashcards empty.'
      : resourceType === 'flashcards'
        ? 'Selected resource type: Flashcards. Create only atomic flashcards from the source. Each flashcard must test one term, rule, contrast, formula step, exception, process step, or use case. Match the source’s learner level, vocabulary difficulty, and topic depth. Do not introduce advanced terms, extra concepts, or deeper rabbit holes unless clearly needed. Use answer backs that teach briefly, not one-word fragments. Keep sourceSummary brief, leave conceptRecap sections empty, and leave practice.shortAnswer and practice.multipleChoice empty.'
        : resourceType === 'quiz'
          ? 'Selected resource type: Quiz. Create only multiple-choice quiz questions from the source. Fill practice.multipleChoice only. Leave practice.shortAnswer empty. Never create typed-answer, short-answer, quizSingle, or free-response questions. Match the source’s learner level, vocabulary difficulty, and topic depth. Do not introduce advanced terms, extra concepts, or deeper rabbit holes unless clearly needed. Prefer scenario, application, contrast, error-fixing, and why/how questions over simple recall. Keep sourceSummary brief, leave conceptRecap sections empty, and leave flashcards empty.'
          : 'Wrong Selected resource type.'
  const detailInstruction =
    detailLevel === 'short'
      ? 'Detail level: Short. Keep notes concise and generate a small focused set.'
      : detailLevel === 'long'
        ? 'Detail level: Long. Create deeper explanations or a larger practice set while staying grounded.'
        : 'Detail level: Medium. Use balanced depth and amount.'
  const hardDetailInstruction = resourceType
    ? `The selected detail level is a hard constraint. Target ${geminiDetailTargets[resourceType][detailLevel]}. Match the target length/count exactly or as close as possible. Do not ignore it.`
    : 'The selected detail level is a hard constraint. Match the requested amount as closely as possible. Do not ignore it.'
  const quizStyleInstruction =
    quizQuestionStyle === 'conceptual'
      ? 'Quiz style preference: Conceptual. Prioritize why/how questions, comparisons, cause/effect, inference, and common misconceptions. Include only enough recall to anchor the reasoning.'
      : quizQuestionStyle === 'examLike'
        ? 'Quiz style preference: Exam-like. Write assessment-style questions that require applying concepts under realistic test conditions. Mix multiple-choice and short-answer when appropriate, with clear plausible distractors.'
        : 'Quiz style preference: Mixed. Use a balanced mix of recall and reasoning questions, including conceptual understanding, applied scenarios, comparisons, and common mistakes.'
  const sourceInstruction = promptMode
    ? 'The raw input is a learning prompt, not notes. Teach the requested topic from scratch. Because the input is not source notes, you may use accurate general knowledge for this topic. First create concise source notes/explanations, then generate practice grounded in those generated explanations. Include explanation/theory objects before exercises.'
    : 'The raw input is source notes. Stay grounded in those notes.'
  const pathInstruction = studyPathMode
    ? 'Organize the material as a Study Guide progression. Use titles/tags that clearly fit: Introduction, Theory, Examples, Practice, Final Review.'
    : 'Organize the material as a single Study Pack.'

  const promptText = `Create a study pack JSON object ${
    promptMode ? 'from this learning prompt' : 'from these raw notes'
  }.

Return exactly one JSON object with this shape:
{
  "title": "Short study pack title",
  "sourceFormat": "text",
  "sourceSummary": { "title": "Source summary", "bullets": ["..."] },
  "conceptRecap": {
    "title": "Concept recap",
    "sections": [
      { "title": "Specific concept", "bullets": ["..."], "example": "..." }
    ]
  },
  "practice": {
    "shortAnswer": [
      { "question": "...", "expectedAnswer": "...", "explanation": "..." }
    ],
    "multipleChoice": [
      { "question": "...", "options": ["...", "...", "..."], "correctOptionIndex": 0, "explanation": "..." }
    ]
  },
  "flashcards": [
    { "front": "...", "back": "..." }
  ]
}

Do not wrap the JSON in markdown fences. Do not add commentary outside JSON.

Rules:
- Return strict valid JSON only: double-quoted property names and strings, comma-separated array/object entries, matching { } and [ ], no trailing commas, no comments, no Markdown fences, no prose before or after the JSON.
- Do not output "objects", "kind", "quizMode", internal block names, widget names, or any StudyMesh renderer fields. StudyMesh decides widget types.
- Fill only sourceSummary, conceptRecap, practice.shortAnswer, practice.multipleChoice, and flashcards.
- When selected resource type is Quiz, practice.shortAnswer must be [] and every question must be in practice.multipleChoice with 3-4 real answer options.
- Use concrete rule labels in conceptRecap sections, such as "Subjunctive trigger: il faut que", not headings or sentence fragments.
- Generate summaries, flashcards, and quizzes from learning concepts, not by copying first sentences, headings, examples, or dashboard instructions.
- Never use weak standalone concepts such as Goal, Example, Active, It, Avoir, Etre, Quantity, or De. Do not create title-like, instruction-like, or very short fragments as study objects.
- Expand on this must read like a useful student handout: headings, concise explanations, examples, contrasts, and common mistakes when grounded. Do not just summarize the input paragraph-by-paragraph.
- Flashcards must be atomic and rule-specific, such as "How do you form the present subjunctive for most verbs?" Back sides must be self-contained and include enough context to learn from the card alone.
- ${quizStyleInstruction}
- Quiz and flashcard prompts must paraphrase the source. Do not copy exact source sentences as questions, answers, or distractors.
- Quiz questions must test conceptual understanding and application, not only memorization. Mix recall and reasoning questions: definitions/facts, applied scenarios, comparisons, cause/effect, inference, identifying common mistakes, and fixing errors.
- Distractors must be plausible but clearly wrong. Avoid answers that are too short, vague, repeated, or obvious because they reuse exact source wording.
- Never use placeholder options like A, B, C, option A, choice B, "all of the above", or near-duplicate options.
- Avoid "According to the text..." style questions unless strictly necessary.
- Every quiz explanation must teach why the correct answer is correct.
- Quizzes must test application, usage, contrast, formation, exceptions, or common mistakes with a concrete expected answer. Do not ask "Which statement best explains X?", "Which statement matches the notes?", "What does X help you understand or do?", "What is the core idea behind X?", or questions about what the notes say.
- For language-learning Study Packs, generate grammar/application questions from accepted concepts only: complete a form, choose the trigger expression, choose indicative vs subjunctive, or fix a common mistake.
- ${
    promptMode
      ? 'Use accurate general knowledge to teach the requested topic; do not pretend the prompt is source notes.'
      : 'Use only facts answerable from the notes.'
  }
- ${sourceInstruction}
- ${pathInstruction}
- In AI Tutor mode, teach the topic through sourceSummary and conceptRecap before practice.
- Generate exercises even from short notes. A single wiki paragraph should still produce multiple grounded quizzes and flashcards.
- Prefer useful learning material from the selected target types, but never output widget kinds.
- For multiple-choice questions, include 3-4 meaningful options and correctOptionIndex. Vary the correct answer position across questions; do not always put the correct answer first.
- Prefer multiple-choice quizzes. Use short-answer quizzes only when a grounded multiple-choice question would be misleading.
- ${
    promptMode
      ? 'Do not fabricate facts. If unsure, keep explanations broad and safe.'
      : 'Do not invent outside facts or practice content requiring unstated knowledge.'
  }
- Do not create or reference heavy resources such as PDFs or images unless the user explicitly asks for PDFs, images, screenshots, diagrams, or visual resources.
- Keep objects concise and student-friendly.
- ${resourceInstruction}
- ${detailInstruction}
- ${hardDetailInstruction}
- ${targetInstruction}
- ${amountInstruction}
- ${mixInstruction}
- Do not return 0, 1, or 2 reviewable items when the notes contain enough text for more practice.

Pack title: ${title}

Raw notes:
${rawNotes}`

  const callPromptModeFallback = () =>
    callStrongModel(
      apiToken,
      model,
      [
        {
          text: `${promptText}

The previous response failed JSON formatting. Retry with a simpler response:
- Return plain JSON only.
- Return syntactically valid JSON with all commas and braces in place.
- Use only the strict Study Pack fields: sourceSummary, conceptRecap, practice, flashcards.
- Do not use markdown code fences.
- Do not include comments, trailing commas, undefined, NaN, or extra text.`,
        },
      ],
      undefined,
      strongProvider,
    )

  let text: string
  let usedPromptModeFallback = false
  try {
    text = await callStrongModel(
      apiToken,
      model,
      [{ text: promptText }],
      objectSchema,
      strongProvider,
    )
  } catch (error) {
    if (!promptMode || !isGeminiOutputFormatError(error)) {
      throw error
    }

    usedPromptModeFallback = true
    text = await callPromptModeFallback()
  }

  let parsed: unknown
  try {
    parsed = parseGeminiJson(text)
  } catch (error) {
    if (!promptMode) {
      throw error
    }

    if (!usedPromptModeFallback) {
      try {
        text = await callPromptModeFallback()
        parsed = parseGeminiJson(text)
      } catch {
        throw new Error(GEMINI_OUTPUT_FORMAT_MESSAGE)
      }
    } else {
      throw new Error(GEMINI_OUTPUT_FORMAT_MESSAGE)
    }
  }

  const draft = applyStudyMaterialResourceTypeToDraft(
    normalizeAiStudyPackDraft(parsed, packId, {
      rawNotes,
      rawAiResponse: text,
    }),
    packId,
    resourceType,
  )

  return {
    ...draft,
    title: draft.title || title,
    sourceFormat: draft.sourceFormat || ('text' as StudyPackSourceFormat),
  }
}

const studyPathAdvancedPromptGuidance = (
  mustInclude?: string,
  avoidTopics?: string,
): string => {
  const include = mustInclude?.trim()
  const avoid = avoidTopics?.trim()

  if (!include && !avoid) {
    return ''
  }

  return [
    include
      ? `User says these topics/details must be included or learned if relevant:\n${include}`
      : '',
    avoid
      ? `User says these topics/details should be avoided, skipped, or treated as already known:\n${avoid}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const generateStudyPathWithAi = async ({
  apiToken,
  model,
  strongProvider = DEFAULT_STRONG_AI_PROVIDER,
  title,
  prompt,
  folderName,
  generationAmount = 'medium',
  mustInclude,
  avoidTopics,
}: GenerateStudyPathWithAiOptions): Promise<AiStudyPathDraft> => {
  const stepNames = getStudyPathStepNames(generationAmount)
  const dashboardCount = stepNames.length
  const practiceAmount = studyPathAmountToPracticeAmount(generationAmount)
  const practiceProfile = createStudyPackPracticeProfile(practiceAmount, [
    'summaries',
    'definitions',
  ])
  const advancedGuidance = studyPathAdvancedPromptGuidance(
    mustInclude,
    avoidTopics,
  )
  const promptText = `Create a Study Guide JSON object. A Study Guide is NOT one dashboard. It is a folder containing multiple ordered dashboards/study packs.

Return exactly this structure:
{
  "title": "Path title",
  "folderName": "Folder name for all dashboards",
  "dashboards": [
    {
      "title": "01 - Content 1",
      "summary": "One sentence preview",
      "layoutArchetype": "learnPracticeTabs",
      "dashboardPurpose": "lesson",
      "practiceType": "none",
      "layoutReason": "Short reason for the selected learning layout",
      "sourceRefs": [{ "label": "optional source/chunk label" }],
      "moduleTitle": "Module title",
      "lessonType": "concept",
      "learnerQuestion": "Question this lesson answers",
      "learningOutcome": "Concrete outcome for the learner",
      "suggestedPractice": ["Generate quiz for this lesson", "Generate flashcards for this lesson"],
      "rawNotes": "Complete lesson notes for this dashboard",
      "sourceSummary": { "title": "Source summary", "bullets": ["..."] },
      "conceptRecap": { "title": "Concept recap", "sections": [{ "title": "Specific concept", "bullets": ["..."], "example": "..." }] },
      "practice": { "shortAnswer": [{ "question": "...", "expectedAnswer": "...", "explanation": "..." }], "multipleChoice": [{ "question": "...", "options": ["...", "...", "..."], "correctOptionIndex": 0, "explanation": "..." }] },
      "flashcards": [{ "front": "...", "back": "..." }]
    }
  ]
}

Rules:
- Return strict valid JSON only: double-quoted property names and strings, comma-separated array/object entries, matching { } and [ ], no trailing commas, no comments, no Markdown fences, no prose before or after the JSON.
- Choose a concise, topic-specific folderName for the Study Guide, such as "French B1 Subjunctive" or "Calculus Derivatives". Do not use a generic folderName like "Study Guide" unless the topic is truly unknown.
- Create exactly ${dashboardCount} ordered lesson dashboards, grouped mentally into 1-3 modules. Give each dashboard a useful topic-specific title.
- Treat this as a bounded learning sprint, not a complete course on everything. Include scope in lesson choices: what gets covered now, what waits for later.
- Do not follow a fixed role template by position. You are responsible for choosing each dashboard's purpose, layoutArchetype, practiceType, rawNotes, and practice mix from the lesson content itself.
- Every dashboard is a normal lesson dashboard in the product. Do not make the last dashboard an automatic exercise dump or the previous one an automatic summary. Choose content only from teaching need.
- Every dashboard must have one primary educational purpose: overview, lesson, practice, review, finalReview, or projectLab.
- Choose one layoutArchetype per dashboard: focusLesson, learnPracticeTabs, splitReferenceExercise, multiWidgetLab, or overviewReview.
- Use learnPracticeTabs for most normal lessons. Use focusLesson for intro/theory-heavy/recap dashboards. Use overviewReview for overview, summary, final review, or mixed review dashboards.
- Use splitReferenceExercise only when side-by-side reference clearly improves studying, such as programming, math, formulas, grammar, or comparison. Use multiWidgetLab only for project/lab steps.
- Do not choose the same layout for every normal dashboard unless the topic truly demands it. For paths with 3 or more dashboards, prefer at least two archetypes when educationally reasonable.
- Pick the layout from the lesson's teaching need, not from a fixed template: reading-heavy concepts can be focusLesson, explanation plus recall can be learnPracticeTabs, reference-heavy applied work can be splitReferenceExercise, and hands-on build steps can be multiWidgetLab.
- SourceSummary, conceptRecap, practice, and flashcards are internal support material. The visible lesson comes mainly from rawNotes, so rawNotes must carry the actual lesson.
- Do not make dashboards feel like random widget collections. Use the simplest layout that supports the learning goal.
- Do not generate full quizzes or flashcards inside every lesson by default. StudyMesh has on-demand Quick Create for quiz, flashcards, Expand on this, and exercises from each lesson.
- For most lessons, set practiceType to none and use suggestedPractice text to recommend useful follow-up actions. Add practice/flashcards only when the lesson is explicitly a checkpoint, review, remediation, or applied practice step.
- Each dashboard must be useful by itself as teaching content, not as a container for many practice widgets.
- Always return exactly ${stepNames.length} dashboards total.
- rawNotes must be real lesson notes for that dashboard, not a one-line summary. Write 250-600 words with explanations, examples, key points, and common mistakes when relevant.
- Format rawNotes as readable Markdown, not one long paragraph. Use short sections like "## Goal", "## Key points", "## Examples", "## Common mistakes", and bullet lists where helpful.
- sourceSummary and conceptRecap should match the selected layout. For normal teaching lessons, practice and flashcards should usually be empty. For checkpoint/review/remediation lessons, include one focused practice set if useful.
- conceptRecap is used internally to structure the lesson. StudyMesh renders quiz/flashcard materials on demand in the Creation side panel.
- Do not output "objects", "kind", "quizMode", internal block names, widget names, or any StudyMesh renderer fields. StudyMesh decides widget types.
- Use concrete rule labels in conceptRecap sections, such as "Subjunctive trigger: il faut que", not headings or sentence fragments.
- Generate summaries, flashcards, and quizzes from structured concepts, not from first sentences, headings, copied examples, or instructions.
- Practice questions must be specific to the lesson content. Never create generic questions like "What do the notes say about <dashboard title>?", "Which statement matches the notes about <dashboard title>?", "What does X help you understand or do?", or "What is the core idea behind X?".
- Practice questions must test concepts and uses, not copied headings or answer options made obvious by the dashboard title.
- Never use weak standalone concepts such as Goal, Example, Active, It, Avoir, Etre, Quantity, or De. Do not create title-like, instruction-like, or very short fragments as study objects.
- Flashcards should ask useful rule-specific prompts such as "How do you form the present subjunctive for most verbs?" instead of "What should you remember about <copied line>?".
- Include suggestedPractice for each lesson as short user-facing actions, such as "Generate quiz for this lesson" or "Generate flashcards for this lesson".
- Every dashboard needs a short "summary" sentence so the review screen can preview it.
- Do not wrap JSON in markdown. Do not add commentary outside JSON.
- Do not create PDFs/images/resources unless the user explicitly asks for heavy media.
- For multiple-choice questions, include 3-4 meaningful options, correctOptionIndex, and explanation.
- Keep content concise, beginner-friendly, and appropriate for the requested topic.
- Aim for about ${practiceProfile.minTotal}-${
    practiceProfile.maxTotal
  } support concepts across the whole path. Do not pad with quiz/flashcard items.
${
  advancedGuidance
    ? `- Respect the user's advanced guidance below when planning lessons, rawNotes, examples, and practice. Do not make avoided/already-known topics a focus unless needed for context.\n`
    : ''
}
${
  advancedGuidance ? `Advanced user guidance:\n${advancedGuidance}\n\n` : ''
}Path title fallback: ${title}
Folder name fallback if you cannot infer a better one: ${
    folderName || 'Study Guide'
  }
User request/topic:
${prompt}`
  const fallbackPrompt = `${promptText}

The previous response failed JSON formatting. Retry with a simpler response:
- Return plain JSON only.
- Return syntactically valid JSON with all commas and braces in place.
- Use only the Study Guide fields: title, summary, rawNotes, layoutArchetype, dashboardPurpose, practiceType, layoutReason, sourceRefs, sourceSummary, conceptRecap, practice, flashcards.
- Do not use markdown code fences.
- Do not include comments, trailing commas, undefined, NaN, or extra text.`
  const createRepairPrompt = (originalJson: string) => `${promptText}

The previous response was valid JSON, but one or more normal dashboards were incomplete.
Repair the JSON instead of simplifying it:
- Preserve the exact dashboard count, order, titles, summaries, and rawNotes.
- Every dashboard is a normal Study Guide dashboard.
- Fill missing conceptRecap/practice/flashcards from that dashboard's rawNotes when the selected layout and practiceType call for active recall.
- For focusLesson or practiceType none, practice and flashcards may stay empty if rawNotes contains a complete learning explanation.
- For learnPracticeTabs or splitReferenceExercise, include sourceSummary with 3-5 bullets, conceptRecap with 2-4 sections, practice.shortAnswer with 1-2 questions, practice.multipleChoice with 1-2 questions, and flashcards with 2-5 cards.
- Return plain JSON only.

Original JSON:
${originalJson}`

  let text: string
  try {
    text = await callStrongModel(
      apiToken,
      model,
      [{ text: promptText }],
      studyPathSchema,
      strongProvider,
    )
  } catch (error) {
    if (!isGeminiOutputFormatError(error)) {
      throw error
    }

    text = await callStrongModel(
      apiToken,
      model,
      [{ text: fallbackPrompt }],
      undefined,
      strongProvider,
    )
  }

  let parsed: unknown
  try {
    parsed = parseGeminiJson(text)
  } catch {
    try {
      text = await callStrongModel(
        apiToken,
        model,
        [{ text: fallbackPrompt }],
        undefined,
        strongProvider,
      )
      parsed = parseGeminiJson(text)
    } catch {
      throw new Error(GEMINI_OUTPUT_FORMAT_MESSAGE)
    }
  }
  let record =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  let rawDashboards = Array.isArray(record.dashboards) ? record.dashboards : []
  const incompleteNormalDashboardIndexes = new Set(
    rawDashboards
      .map((item, index) => {
        const input =
          item && typeof item === 'object'
            ? (item as Record<string, unknown>)
            : {}
        return normalDashboardNeedsRepair(input, 'normal') ? index : null
      })
      .filter((index): index is number => index !== null),
  )
  let repairRetryUsed = false
  if (incompleteNormalDashboardIndexes.size > 0) {
    try {
      const repairText = await callStrongModel(
        apiToken,
        model,
        [{ text: createRepairPrompt(text) }],
        studyPathSchema,
        strongProvider,
      )
      parsed = parseGeminiJson(repairText)
      record =
        parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : {}
      rawDashboards = Array.isArray(record.dashboards) ? record.dashboards : []
      text = repairText
      repairRetryUsed = true
    } catch {
      repairRetryUsed = false
    }
  }
  const normalizedRawDashboards =
    rawDashboards.length >= stepNames.length
      ? rawDashboards.slice(0, stepNames.length)
      : stepNames.map((stepName, index) => {
          const existing = rawDashboards[index]
          if (existing) {
            return existing
          }

          const titlePrefix = `${String(index + 1).padStart(
            2,
            '0',
          )} - ${stepName}`
          const rawNotes = `# ${titlePrefix}

## Goal
Study this section of ${title}.

## Key points
${prompt}`

          return {
            title: titlePrefix,
            summary: `Generated ${stepName.toLowerCase()} dashboard.`,
            rawNotes,
            sourceSummary: {
              title: `${titlePrefix} summary`,
              bullets: [`Study this section of ${title}.`],
            },
            conceptRecap: {
              title: `${titlePrefix} concept recap`,
              sections: [
                {
                  title: stepName,
                  bullets: [prompt],
                  example: '',
                },
              ],
            },
            practice: {
              shortAnswer: [],
              multipleChoice: [],
            },
            flashcards: [],
            layoutArchetype: 'learnPracticeTabs',
            dashboardPurpose: 'lesson',
            practiceType: 'mixed',
            layoutReason: 'Deterministic fallback layout.',
          }
        })
  const warnings: string[] = []
  const accumulatedContentNotes: string[] = []
  const buildGlobalNotes = (
    dashboardTitle: string,
    mode: 'summary' | 'exercises',
  ) => {
    const source = accumulatedContentNotes.join('\n\n')
    const concepts = extractLearningConcepts(source, title)
    const conceptGroups = conceptRecapGroups(concepts).slice(0, 5)

    if (mode === 'summary' && conceptGroups.length > 0) {
      return [
        `# ${dashboardTitle}`,
        'Use this recap to connect the major ideas from the Study Guide before moving into mixed practice.',
        ...conceptGroups.map((group) => {
          const items = group.items
            .map(stripRepeatedSummaryPrefix)
            .filter((item) => !isLowQualitySummaryLine(item))
            .slice(0, 4)

          if (items.length === 0) {
            return ''
          }

          return [
            `## ${formatSummaryHeading(group.label)}`,
            ...items.map((item) => `- ${item}`),
          ].join('\n')
        }),
      ]
        .map((part) => part.trim())
        .filter(Boolean)
        .join('\n\n')
    }

    const conceptList = concepts
      .map((concept) =>
        stripRepeatedSummaryPrefix(
          `${formatSummaryHeading(concept.concept)}: ${conceptExplanation(
            concept,
          )}`,
        ),
      )
      .filter((item) => !isLowQualitySummaryLine(item))
      .slice(0, 12)

    return [
      `# ${dashboardTitle}`,
      mode === 'summary' ? '## Global recap' : '## Mixed practice source',
      conceptList.length > 0
        ? conceptList.map((item) => `- ${item}`).join('\n')
        : source,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join('\n\n')
  }
  const dashboards = normalizedRawDashboards
    .map((item, index): AiStudyPathDashboardDraft | null => {
      const input =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : {}
      if (!hasUsableStudyPathDashboardInput(input)) {
        warnings.push(
          `Skipped Study Guide dashboard ${
            index + 1
          }: no usable generated content.`,
        )
        return null
      }

      const dashboardTitle =
        typeof input.title === 'string' && input.title.trim()
          ? input.title.trim()
          : `${index + 1}. ${stepNames[index] || 'Lesson'}`
      const dashboardSummary =
        typeof input.summary === 'string' && input.summary.trim()
          ? input.summary.trim()
          : 'Generated lesson dashboard.'
      const packId = `${title}-${index + 1}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
      const dashboardRole: StudyPathDashboardRole = 'normal'
      const layoutMetadata = normalizeStudyPathLayoutMetadata(
        input,
        getDefaultStudyPathLayoutMetadata(
          dashboardRole,
          index,
          normalizedRawDashboards.length,
        ),
      )
      const rawDashboardInput = {
        ...input,
        title: dashboardTitle,
        summary: dashboardSummary,
      }
      const roleSanitizedInput = sanitizeDashboardInputForRole(
        rawDashboardInput,
        dashboardRole,
        dashboardTitle,
      )
      const draft = normalizeAiStudyPackDraft(roleSanitizedInput, packId, {
        rawNotes: typeof input.rawNotes === 'string' ? input.rawNotes : '',
        rawAiResponse: text,
        dashboardRole,
      })
      const finalEvents = [...(draft.debugTrace?.droppedOrRepairedItems || [])]
      if (
        dashboardRole === 'normal' &&
        incompleteNormalDashboardIndexes.has(index)
      ) {
        finalEvents.push(
          'AI provided sourceSummary only before repair.',
          'AI missing normal-dashboard practice/flashcards before repair.',
        )
        if (repairRetryUsed) {
          finalEvents.push('Repair retry used for incomplete normal dashboard.')
        }
      }
      if (
        dashboardRole === 'normal' &&
        sourceSummaryOnlyForNormalDashboard(rawDashboardInput)
      ) {
        finalEvents.push('AI provided sourceSummary only after repair.')
      }
      if (normalDashboardNeedsRepair(rawDashboardInput, dashboardRole)) {
        finalEvents.push('AI missing normal-dashboard practice/flashcards.')
      }
      const roleFilteredObjects = filterStudyObjectsForDashboardRole(
        draft.objects,
        dashboardRole,
        finalEvents,
      )
      const visibleRoleObjects = getStudyPathVisibleObjectsForRole(
        roleFilteredObjects,
        dashboardRole,
        finalEvents,
      )
      const visiblePracticeTarget =
        layoutMetadata.layoutArchetype === 'focusLesson' ||
        layoutMetadata.practiceType === 'none'
          ? 0
          : getStudyPathVisiblePracticeTarget(dashboardRole, generationAmount)
      const filledVisibleObjects =
        visiblePracticeTarget > 0
          ? augmentStudyPackPracticeObjects(visibleRoleObjects, {
              packId,
              title: dashboardTitle,
              rawNotes: textFromRawNotes(input.rawNotes),
              generationTargets: ['quizzes', 'flashcards'],
              generationAmount: practiceAmount,
              visiblePracticeTarget,
              visiblePracticeOnly: true,
            })
          : null
      if (
        filledVisibleObjects &&
        filledVisibleObjects.visiblePracticeAddedCount > 0
      ) {
        finalEvents.push(
          `Visible practice fill added ${
            filledVisibleObjects.visiblePracticeAddedCount
          } quiz/flashcard object${
            filledVisibleObjects.visiblePracticeAddedCount === 1 ? '' : 's'
          } to reach ${
            filledVisibleObjects.visiblePracticeCount
          }/${visiblePracticeTarget} visible practice items.`,
        )
      }
      const finalObjects =
        filledVisibleObjects && filledVisibleObjects.objects.length > 0
          ? filledVisibleObjects.objects
          : visibleRoleObjects.length > 0
            ? visibleRoleObjects
            : buildFallbackObjectsForDashboardRole({
                packId,
                dashboardTitle,
                dashboardRole,
                rawNotes: input.rawNotes,
                sourceSummary: draft.sourceSummary,
                accumulatedContentNotes,
              })
      if (visibleRoleObjects.length === 0 && finalObjects.length > 0) {
        finalEvents.push(
          `Fallback used: created ${dashboardRole} object because role filtering left no visible study objects.`,
        )
      }
      assertRoleObjectsAreClean(finalObjects, dashboardRole, dashboardTitle)
      const debugTrace = draft.debugTrace
        ? {
            ...draft.debugTrace,
            rawDashboardInput,
            roleSanitizedInput,
            droppedOrRepairedItems: finalEvents,
            finalObjects,
          }
        : draft.debugTrace
      const lessonNotes = buildStudyPathLessonNotes(
        dashboardTitle,
        dashboardSummary,
        typeof input.rawNotes === 'string' ? input.rawNotes : '',
        finalObjects,
      )

      warnings.push(...draft.warnings)

      const dashboard = {
        ...draft,
        title: dashboardTitle,
        summary: dashboardSummary,
        rawNotes: lessonNotes,
        dashboardRole,
        ...layoutMetadata,
        objects: finalObjects,
        warnings: [],
        debugTrace,
        sourceFormat: 'text' as StudyPackSourceFormat,
      }

      accumulatedContentNotes.push(lessonNotes)

      return dashboard
    })
    .filter((dashboard): dashboard is AiStudyPathDashboardDraft =>
      Boolean(dashboard),
    )

  if (dashboards.length === 0) {
    throw new Error('Gemini did not return any usable Study Guide dashboards.')
  }

  return {
    title:
      typeof record.title === 'string' && record.title.trim()
        ? record.title.trim()
        : title,
    folderName:
      typeof record.folderName === 'string' && record.folderName.trim()
        ? record.folderName.trim()
        : folderName,
    dashboards,
    warnings,
  }
}
