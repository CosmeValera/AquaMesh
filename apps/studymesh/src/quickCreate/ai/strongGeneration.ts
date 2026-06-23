import {
  StudyObject,
  QuickCreateSourceFormat,
  StudyPathDashboardPurpose,
  StudyPathDashboardRole,
  StudyPathPracticeType,
  StudyPathSourceRef,
} from '../types'
import { conceptSummaryItem, extractLearningConcepts } from '../concepts'
import {
  augmentQuickCreatePracticeObjects,
  createQuickCreatePracticeProfile,
  getEffectiveGenerationTargets,
} from '../practice'
import {
  assertRoleObjectsAreClean,
  applyStudyMaterialResourceTypeToDraft,
  filterStudyObjectsForDashboardRole,
  normalizeAiQuickCreateDraft,
  AiQuickCreateDraft,
  StudyMaterialDetailLevel,
  StudyMaterialResourceType,
} from './normalizer'
import {
  callStrongAiModel,
  DEFAULT_STRONG_AI_PROVIDER,
} from './strongProviders'
import type { StrongAiCallOptions, StrongAiProviderId } from './strongProviders'

interface GeminiPart {
  text?: string
  inline_data?: {
    mime_type: string
    data: string
  }
}

const GEMINI_REQUEST_TIMEOUT_MS = 5 * 60 * 1000
const GEMINI_TIMEOUT_MESSAGE =
  'Gemini took longer than 5 minutes, so StudyMesh stopped the request. Try again with shorter notes, fewer generated blocks, or another AI mode.'
const GEMINI_OUTPUT_FORMAT_MESSAGE =
  'Gemini could not follow the requested output format. StudyMesh retried with a simpler JSON prompt, but the response was still unusable.'

export type StrongAiModelTransport = (
  options: StrongAiCallOptions,
) => Promise<string>

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
    long: '40-50 flashcards',
  },
  quiz: {
    short: '20-30 multiple-choice questions',
    medium: '40-50 multiple-choice questions',
    long: '50-65 multiple-choice questions',
  },
}

export type QuizQuestionStyle = 'mixed' | 'conceptual' | 'examLike'

export interface GenerateQuickCreateWithAiOptions {
  apiToken: string
  model: string
  strongProvider?: StrongAiProviderId
  strongTransport?: StrongAiModelTransport
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

export type StudyPathContentMode =
  | 'orientationMap'
  | 'conceptLesson'
  | 'contrastLab'
  | 'workedExampleLab'
  | 'procedureGuide'
  | 'vocabularyReference'
  | 'practiceCheckpoint'
  | 'synthesisReview'

interface AiStudyPathSupportArtifacts {
  glossary?: Array<{ term: string; definition: string }>
  contrastTable?: {
    title?: string
    headers: string[]
    rows: string[][]
  }
  discussionPrompts?: string[]
  answerKey?: Array<{ question: string; answer: string }>
  checkpointRubric?: string[]
}

export interface AiStudyPathDashboardDraft extends AiQuickCreateDraft {
  summary: string
  dashboardRole: StudyPathDashboardRole
  contentMode?: StudyPathContentMode
  moduleTitle?: string
  lessonType?:
    | 'orientation'
    | 'concept'
    | 'workedExample'
    | 'comparison'
    | 'procedure'
    | 'lab'
    | 'checkpoint'
    | 'review'
    | 'remediation'
  learnerQuestion?: string
  learningOutcome?: string
  supportArtifacts?: AiStudyPathSupportArtifacts
  qualityScore?: number
  qualityIssues?: string[]
}

export interface AiStudyPathDraft {
  title: string
  folderName: string
  emoji?: string
  tldr?: string
  dashboards: AiStudyPathDashboardDraft[]
  warnings: string[]
  blueprint?: AiStudyPathBlueprint
  dashboardCountReason?: string
}

interface AiStudyPathBlueprintLesson {
  title: string
  moduleTitle: string
  lessonType: NonNullable<AiStudyPathDashboardDraft['lessonType']>
  learnerQuestion: string
  learningOutcome: string
  dashboardPurpose: string
  practiceType: string
  contentMode: StudyPathContentMode
  sectionPlan: string[]
  mustTeach: string[]
  workedExample: string
  misconceptionChecks: string[]
  retrievalPractice: string[]
}

interface AiStudyPathBlueprint {
  title: string
  folderName: string
  pathPromise: string
  entryLevel: string
  exitCapability: string
  dashboardCount: number
  dashboardCountReason: string
  learnerProfile: string
  scope: string
  prerequisites: string[]
  learningObjectives: string[]
  conceptGraph: string[]
  modules: Array<{
    title: string
    goal: string
    lessonIndexes: number[]
  }>
  lessons: AiStudyPathBlueprintLesson[]
  finalReviewPlan: string[]
}

export interface GenerateStudyPathWithAiOptions {
  apiToken: string
  model: string
  strongProvider?: StrongAiProviderId
  strongTransport?: StrongAiModelTransport
  singleRequest?: boolean
  title: string
  prompt: string
  folderName: string
  userKnownTopics?: string[]
}

const STUDY_PATH_FALLBACK_DASHBOARD_COUNT = 5

const getStudyPathStepNames = (): string[] =>
  Array.from({ length: STUDY_PATH_FALLBACK_DASHBOARD_COUNT }).map(
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
  object: AiQuickCreateDraft['objects'][number],
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
  objects: AiQuickCreateDraft['objects'],
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

const textArraySchema = { type: 'ARRAY', items: { type: 'STRING' } }

const contentModeValues: StudyPathContentMode[] = [
  'orientationMap',
  'conceptLesson',
  'contrastLab',
  'workedExampleLab',
  'procedureGuide',
  'vocabularyReference',
  'practiceCheckpoint',
  'synthesisReview',
]

const contentModeSchema = {
  type: 'STRING',
  enum: contentModeValues,
}

const studyPathSupportArtifactsSchema = {
  type: 'OBJECT',
  properties: {
    glossary: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          term: { type: 'STRING' },
          definition: { type: 'STRING' },
        },
        required: ['term', 'definition'],
      },
    },
    contrastTable: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        headers: textArraySchema,
        rows: {
          type: 'ARRAY',
          items: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
      },
      required: ['headers', 'rows'],
    },
    discussionPrompts: textArraySchema,
    answerKey: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          answer: { type: 'STRING' },
        },
        required: ['question', 'answer'],
      },
    },
    checkpointRubric: textArraySchema,
  },
}

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
    required: ['multipleChoice'],
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
    emoji: { type: 'STRING' },
    dashboards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          summary: { type: 'STRING' },
          rawNotes: { type: 'STRING' },
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
            enum: ['none', 'quiz', 'mixed'],
          },
          layoutReason: { type: 'STRING' },
          contentMode: contentModeSchema,
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
          supportArtifacts: studyPathSupportArtifactsSchema,
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
  required: ['title', 'folderName', 'emoji', 'dashboards'],
}

const studyPathBlueprintLessonSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
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
      enum: ['none', 'quiz', 'mixed'],
    },
    contentMode: contentModeSchema,
    sectionPlan: textArraySchema,
    mustTeach: textArraySchema,
    workedExample: { type: 'STRING' },
    misconceptionChecks: textArraySchema,
    retrievalPractice: textArraySchema,
  },
  required: [
    'title',
    'moduleTitle',
    'lessonType',
    'learnerQuestion',
    'learningOutcome',
    'dashboardPurpose',
    'practiceType',
    'contentMode',
    'sectionPlan',
    'mustTeach',
    'workedExample',
    'misconceptionChecks',
    'retrievalPractice',
  ],
}

const studyPathBlueprintSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    folderName: { type: 'STRING' },
    pathPromise: { type: 'STRING' },
    entryLevel: { type: 'STRING' },
    exitCapability: { type: 'STRING' },
    dashboardCount: { type: 'NUMBER' },
    dashboardCountReason: { type: 'STRING' },
    learnerProfile: { type: 'STRING' },
    scope: { type: 'STRING' },
    prerequisites: textArraySchema,
    learningObjectives: textArraySchema,
    conceptGraph: textArraySchema,
    modules: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          goal: { type: 'STRING' },
          lessonIndexes: { type: 'ARRAY', items: { type: 'NUMBER' } },
        },
        required: ['title', 'goal', 'lessonIndexes'],
      },
    },
    lessons: {
      type: 'ARRAY',
      items: studyPathBlueprintLessonSchema,
    },
    finalReviewPlan: textArraySchema,
  },
  required: [
    'title',
    'folderName',
    'pathPromise',
    'entryLevel',
    'exitCapability',
    'dashboardCount',
    'dashboardCountReason',
    'learnerProfile',
    'scope',
    'prerequisites',
    'learningObjectives',
    'conceptGraph',
    'modules',
    'lessons',
    'finalReviewPlan',
  ],
}

const studyPathDashboardSchema = {
  type: 'OBJECT',
  properties: studyPathSchema.properties.dashboards.items.properties,
  required: [
    'title',
    'summary',
    'rawNotes',
    'sourceSummary',
    'conceptRecap',
    'practice',
    'flashcards',
  ],
}

const studyPathQualitySchema = {
  type: 'OBJECT',
  properties: {
    score: { type: 'NUMBER' },
    issues: textArraySchema,
    repairInstructions: textArraySchema,
  },
  required: ['score', 'issues', 'repairInstructions'],
}

const emptyPractice = () => ({
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

const dashboardPurposeValues = new Set<StudyPathDashboardPurpose>([
  'overview',
  'lesson',
  'practice',
  'review',
  'finalReview',
  'projectLab',
])

const practiceTypeValues = new Set<StudyPathPracticeType>([
  'none',
  'quiz',
  'mixed',
])

const normalizeDashboardPurpose = (
  value: unknown,
  fallback: StudyPathDashboardPurpose = 'lesson',
): StudyPathDashboardPurpose => {
  const purpose = stringFromUnknown(value)

  return dashboardPurposeValues.has(purpose as StudyPathDashboardPurpose)
    ? (purpose as StudyPathDashboardPurpose)
    : fallback
}

const normalizePracticeType = (
  value: unknown,
  fallback: StudyPathPracticeType = 'none',
): StudyPathPracticeType => {
  const practiceType = stringFromUnknown(value)

  return practiceTypeValues.has(practiceType as StudyPathPracticeType)
    ? (practiceType as StudyPathPracticeType)
    : fallback
}

const normalizeSourceRefs = (
  value: unknown,
): StudyPathSourceRef[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const refs = value
    .map((item): StudyPathSourceRef | null => {
      const record = getObjectRecord(item)
      const chunkIndex =
        typeof record.chunkIndex === 'number' &&
        Number.isFinite(record.chunkIndex)
          ? record.chunkIndex
          : undefined
      const ref: StudyPathSourceRef = {
        id: stringFromUnknown(record.id) || undefined,
        label: stringFromUnknown(record.label) || undefined,
        source: stringFromUnknown(record.source) || undefined,
        chunkIndex,
      }

      return ref.id || ref.label || ref.source || ref.chunkIndex !== undefined
        ? ref
        : null
    })
    .filter((ref): ref is StudyPathSourceRef => Boolean(ref))

  return refs.length > 0 ? refs : undefined
}

const getConceptRecapSectionCount = (
  input: Record<string, unknown>,
): number => {
  const conceptRecap = getObjectRecord(input.conceptRecap)
  return getArrayLength(conceptRecap.sections)
}

const getPracticeQuestionCount = (input: Record<string, unknown>): number => {
  const practice = getObjectRecord(input.practice)
  return getArrayLength(practice.multipleChoice)
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
  sourceSummary: AiQuickCreateDraft['sourceSummary'],
): string[] =>
  sourceSummary?.bullets
    .map((bullet) => bullet.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 5) || []

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
  sourceSummary: AiQuickCreateDraft['sourceSummary']
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
      quizMode: 'multipleChoice' as const,
      question,
      options: [
        'Use the Study Guide notes to answer this idea accurately.',
        'Ignore the Study Guide notes and guess from the title only.',
        'Choose the opposite of the lesson explanation.',
      ],
      correctIndex: 0,
      answer: 'Use the Study Guide notes to answer this idea accurately.',
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

const createSupportArtifactObjects = (
  packId: string,
  artifacts?: AiStudyPathSupportArtifacts,
): StudyObject[] => {
  if (!artifacts) {
    return []
  }

  const objects: StudyObject[] = []
  ;(artifacts.glossary || []).slice(0, 12).forEach((item, index) => {
    objects.push({
      id: `${packId}-support-term-${index + 1}`,
      kind: 'term',
      title: item.term,
      sourceLine: index + 1,
      tags: ['quick-create', 'ai-generated', 'support-artifact'],
      term: item.term,
      definition: item.definition,
    })
  })

  if (artifacts.contrastTable) {
    objects.push({
      id: `${packId}-support-contrast-table-1`,
      kind: 'table',
      title: artifacts.contrastTable.title || 'Contrast table',
      sourceLine: 1,
      tags: ['quick-create', 'ai-generated', 'support-artifact'],
      headers: artifacts.contrastTable.headers,
      rows: artifacts.contrastTable.rows,
    })
  }

  ;(artifacts.discussionPrompts || []).slice(0, 5).forEach((prompt, index) => {
    objects.push({
      id: `${packId}-support-discussion-${index + 1}`,
      kind: 'reviewPrompt',
      title: `Discussion ${index + 1}`,
      sourceLine: index + 1,
      tags: ['quick-create', 'ai-generated', 'support-artifact'],
      prompt,
      reason: 'Use this prompt to connect and explain the lesson.',
      status: 'needsReview',
    })
  })
  ;(artifacts.answerKey || []).slice(0, 8).forEach((item, index) => {
    objects.push({
      id: `${packId}-support-answer-${index + 1}`,
      kind: 'qa',
      title: `Answer key ${index + 1}`,
      sourceLine: index + 1,
      tags: ['quick-create', 'ai-generated', 'support-artifact'],
      question: item.question,
      answer: item.answer,
    })
  })

  if (artifacts.checkpointRubric?.length) {
    objects.push({
      id: `${packId}-support-rubric-1`,
      kind: 'list',
      title: 'Checkpoint rubric',
      sourceLine: 1,
      tags: ['quick-create', 'ai-generated', 'support-artifact'],
      items: artifacts.checkpointRubric.slice(0, 8),
      ordered: false,
      checklist: true,
    })
  }

  return objects
}

const supportObjectAllowedForContentMode = (
  object: StudyObject,
  contentMode?: StudyPathContentMode,
): boolean => {
  if (!object.tags.includes('support-artifact')) {
    return false
  }

  if (
    contentMode === 'orientationMap' ||
    contentMode === 'vocabularyReference'
  ) {
    return (
      object.kind === 'term' ||
      object.kind === 'table' ||
      object.kind === 'reviewPrompt'
    )
  }

  if (contentMode === 'contrastLab') {
    return object.kind === 'table' || object.kind === 'qa'
  }

  if (
    contentMode === 'practiceCheckpoint' ||
    contentMode === 'synthesisReview'
  ) {
    return (
      object.kind === 'qa' ||
      object.kind === 'list' ||
      object.kind === 'reviewPrompt'
    )
  }

  return false
}

const getStudyPathVisibleObjectsForRole = (
  objects: StudyObject[],
  dashboardRole: StudyPathDashboardRole,
  events: string[],
  contentMode?: StudyPathContentMode,
): StudyObject[] => {
  if (dashboardRole !== 'normal') {
    return objects
  }

  const visibleObjects = objects.filter(
    (object) =>
      object.kind === 'quiz' ||
      object.kind === 'qa' ||
      object.kind === 'reveal' ||
      supportObjectAllowedForContentMode(object, contentMode),
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
): number => {
  if (dashboardRole === 'normal') {
    return 7
  }

  if (dashboardRole === 'exercises') {
    return 14
  }

  return 0
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

const callStrongModel = async (
  apiToken: string,
  model: string,
  parts: GeminiPart[],
  responseSchema?: Record<string, unknown>,
  provider: StrongAiProviderId = DEFAULT_STRONG_AI_PROVIDER,
  transport: StrongAiModelTransport = callStrongAiModel,
): Promise<string> => {
  try {
    return await transport({
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

export const generateQuickCreateWithAi = async ({
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
  strongTransport,
}: GenerateQuickCreateWithAiOptions): Promise<AiQuickCreateDraft> => {
  const effectiveTargets = getEffectiveGenerationTargets(generationTargets)
  const practiceProfile = createQuickCreatePracticeProfile(
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
      ? `Create ${resourceTarget} when possible. For Medium or Long detail, aim for around 40-50 flashcards and never create fewer than 40 if the notes contain enough usable facts.`
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
      ? 'Selected resource type: Expand on this. Create one polished expanded note set from the source. Stay close to the provided content and preserve the same learner level, vocabulary difficulty, and topic depth as the original source. Do not introduce advanced terms, extra concepts, or deeper rabbit holes unless they are clearly needed to explain the source. Organize the notes into teachable sections such as: source summary, key concepts, examples, common mistakes or misconceptions, and compact takeaways. Use clear explanations, but keep the complexity appropriate to the source. Do not create quiz questions or flashcards. Leave practice.multipleChoice and flashcards empty.'
      : resourceType === 'flashcards'
        ? 'Selected resource type: Flashcards. Create only active-recall flashcards from the source, with the same reasoning/application quality expected from quizzes. Each front should ask the learner to use, choose, compare, diagnose, predict, explain, or repair a concept, not repeat a source sentence or ask for a pasted definition. Match the source learner level, vocabulary difficulty, and topic depth. Do not introduce advanced terms, extra concepts, or deeper rabbit holes unless clearly needed. Use answer backs that teach briefly, not one-word fragments. Keep sourceSummary brief, leave conceptRecap sections empty, and leave practice.multipleChoice empty.'
        : resourceType === 'quiz'
          ? 'Selected resource type: Quiz. Create only multiple-choice quiz questions from the source. Fill practice.multipleChoice only. Never create typed-answer, short-answer, quizSingle, or free-response questions. Match the source learner level, vocabulary difficulty, and topic depth. Do not introduce advanced terms, extra concepts, or deeper rabbit holes unless clearly needed. Prefer scenario, application, contrast, error-fixing, and why/how questions over simple recall. Keep sourceSummary brief, leave conceptRecap sections empty, and leave flashcards empty.'
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
        ? 'Quiz style preference: Exam-like. Write assessment-style multiple-choice questions that require applying concepts under realistic test conditions, with clear plausible distractors.'
        : 'Quiz style preference: Mixed. Use a balanced mix of recall and reasoning questions, including conceptual understanding, applied scenarios, comparisons, and common mistakes.'
  const sourceInstruction = promptMode
    ? 'The raw input is a learning prompt, not notes. Teach the requested topic from scratch. Because the input is not source notes, you may use accurate general knowledge for this topic. First create concise source notes/explanations, then generate practice grounded in those generated explanations. Include explanation/theory objects before exercises.'
    : 'The raw input is source notes. Stay grounded in those notes.'
  const pathInstruction = studyPathMode
    ? 'Organize the material as a Study Guide progression. Use titles/tags that clearly fit: Introduction, Theory, Examples, Practice, Final Review.'
    : 'Organize the material as a single Quick Create.'

  const promptText = `Create a quick create JSON object ${
    promptMode ? 'from this learning prompt' : 'from these raw notes'
  }.

Return exactly one JSON object with this shape:
{
  "title": "Short quick create title",
  "sourceFormat": "text",
  "sourceSummary": { "title": "Source summary", "bullets": ["..."] },
  "conceptRecap": {
    "title": "Concept recap",
    "sections": [
      { "title": "Specific concept", "bullets": ["..."], "example": "..." }
    ]
  },
  "practice": {
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
- Fill only sourceSummary, conceptRecap, practice.multipleChoice, and flashcards.
- practice only supports multiple-choice questions. Never output typed-answer, single-input, quizSingle, or free-response quiz fields.
- When selected resource type is Quiz, every question must be in practice.multipleChoice with 3-4 real answer options.
- Use concrete rule labels in conceptRecap sections, such as "Subjunctive trigger: il faut que", not headings or sentence fragments.
- Generate summaries, flashcards, and quizzes from learning concepts, not by copying first sentences, headings, examples, or dashboard instructions.
- Never use weak standalone concepts such as Goal, Example, Active, It, Avoir, Etre, Quantity, or De. Do not create title-like, instruction-like, or very short fragments as study objects.
- Expand on this must read like a useful student handout: headings, concise explanations, examples, contrasts, and common mistakes when grounded. Do not just summarize the input paragraph-by-paragraph.
- Flashcards must behave like quiz-style retrieval prompts without answer options. Prefer scenario, application, contrast, error-fixing, why/how, exception, and common-mistake fronts over "What is X?" definition cards.
- Flashcards must be atomic and rule-specific, such as "A sentence uses il faut que before a new subject. What mood should the following verb use, and why?" Back sides must be self-contained and include enough context to learn from the card alone.
- Flashcard fronts must be original prompts. Do not copy headings, first sentences, examples, or glossary lines from the source. Avoid text-literal fronts like "Define X", "What does the text say about X?", or "What is the meaning of X?" unless the source is purely vocabulary.
- ${quizStyleInstruction}
- Quiz and flashcard prompts must paraphrase the source. Do not copy exact source sentences as questions, answers, or distractors.
- Quiz questions must test conceptual understanding and application, not only memorization. Mix recall and reasoning questions: definitions/facts, applied scenarios, comparisons, cause/effect, inference, identifying common mistakes, and fixing errors.
- Distractors must be plausible but clearly wrong. Avoid answers that are too short, vague, repeated, or obvious because they reuse exact source wording.
- Never use placeholder options like A, B, C, option A, choice B, "all of the above", or near-duplicate options.
- Avoid "According to the text..." style questions unless strictly necessary.
- Every quiz explanation must teach why the correct answer is correct.
- Quizzes must test application, usage, contrast, formation, exceptions, or common mistakes with a concrete expected answer. Do not ask "Which statement best explains X?", "Which statement matches the notes?", "What does X help you understand or do?", "What is the core idea behind X?", or questions about what the notes say.
- For language-learning Quick Creates, generate grammar/application questions from accepted concepts only: complete a form, choose the trigger expression, choose indicative vs subjunctive, or fix a common mistake.
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
- Generated quiz practice must be multiple-choice only.
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
- Use only the strict Quick Create fields: sourceSummary, conceptRecap, practice, flashcards.
- Do not use markdown code fences.
- Do not include comments, trailing commas, undefined, NaN, or extra text.`,
        },
      ],
      undefined,
      strongProvider,
      strongTransport,
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
      strongTransport,
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
    normalizeAiQuickCreateDraft(parsed, packId, {
      rawNotes,
      rawAiResponse: text,
    }),
    packId,
    resourceType,
  )

  return {
    ...draft,
    title: draft.title || title,
    sourceFormat: draft.sourceFormat || ('text' as QuickCreateSourceFormat),
  }
}

const stringArrayFromUnknown = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : []

const stringFromUnknown = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const numberArrayFromUnknown = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'number' ? item : Number(item)))
        .filter((item) => Number.isFinite(item))
    : []

const numberFromUnknown = (value: unknown): number | undefined => {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) ? numberValue : undefined
}

const isStudyPathContentMode = (
  value: unknown,
): value is StudyPathContentMode =>
  typeof value === 'string' &&
  contentModeValues.includes(value as StudyPathContentMode)

const normalizeContentMode = (
  value: unknown,
  fallback: StudyPathContentMode = 'conceptLesson',
): StudyPathContentMode => (isStudyPathContentMode(value) ? value : fallback)

const clampAutoDashboardCount = (value: unknown, fallback = 5): number => {
  const count = Math.round(numberFromUnknown(value) || fallback)

  return count >= 3 && count <= 7 ? count : fallback
}

const normalizeSupportArtifacts = (
  value: unknown,
): AiStudyPathSupportArtifacts | undefined => {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const glossary = Array.isArray(record.glossary)
    ? record.glossary
        .map((item) => {
          const itemRecord =
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : {}
          const term = stringFromUnknown(itemRecord.term)
          const definition = stringFromUnknown(itemRecord.definition)

          return term && definition ? { term, definition } : null
        })
        .filter((item): item is { term: string; definition: string } =>
          Boolean(item),
        )
    : undefined
  const contrastRecord =
    record.contrastTable && typeof record.contrastTable === 'object'
      ? (record.contrastTable as Record<string, unknown>)
      : {}
  const contrastHeaders = stringArrayFromUnknown(contrastRecord.headers)
  const contrastRows = Array.isArray(contrastRecord.rows)
    ? contrastRecord.rows
        .map((row) => stringArrayFromUnknown(row))
        .filter((row) => row.length === contrastHeaders.length)
    : []
  const contrastTable =
    contrastHeaders.length >= 2 && contrastRows.length > 0
      ? {
          title: stringFromUnknown(contrastRecord.title),
          headers: contrastHeaders,
          rows: contrastRows,
        }
      : undefined
  const answerKey = Array.isArray(record.answerKey)
    ? record.answerKey
        .map((item) => {
          const itemRecord =
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : {}
          const question = stringFromUnknown(itemRecord.question)
          const answer = stringFromUnknown(itemRecord.answer)

          return question && answer ? { question, answer } : null
        })
        .filter((item): item is { question: string; answer: string } =>
          Boolean(item),
        )
    : undefined
  const artifacts = {
    glossary,
    contrastTable,
    discussionPrompts: stringArrayFromUnknown(record.discussionPrompts),
    answerKey,
    checkpointRubric: stringArrayFromUnknown(record.checkpointRubric),
  }

  return Object.values(artifacts).some((item) =>
    Array.isArray(item) ? item.length > 0 : Boolean(item),
  )
    ? artifacts
    : undefined
}

const normalizeBlueprintLesson = (
  value: unknown,
  index: number,
): AiStudyPathBlueprintLesson => {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const fallbackTitle = `Lesson ${index + 1}`

  return {
    title: stringFromUnknown(record.title) || fallbackTitle,
    moduleTitle: stringFromUnknown(record.moduleTitle) || 'Core module',
    lessonType:
      (stringFromUnknown(
        record.lessonType,
      ) as AiStudyPathBlueprintLesson['lessonType']) || 'concept',
    learnerQuestion:
      stringFromUnknown(record.learnerQuestion) ||
      `What should I understand after ${fallbackTitle}?`,
    learningOutcome:
      stringFromUnknown(record.learningOutcome) ||
      `Explain and apply the main idea from ${fallbackTitle}.`,
    dashboardPurpose: stringFromUnknown(record.dashboardPurpose) || 'lesson',
    practiceType: stringFromUnknown(record.practiceType) || 'none',
    contentMode: normalizeContentMode(record.contentMode),
    sectionPlan: stringArrayFromUnknown(record.sectionPlan),
    mustTeach: stringArrayFromUnknown(record.mustTeach),
    workedExample: stringFromUnknown(record.workedExample),
    misconceptionChecks: stringArrayFromUnknown(record.misconceptionChecks),
    retrievalPractice: stringArrayFromUnknown(record.retrievalPractice),
  }
}

const normalizeStudyPathBlueprint = (
  parsed: unknown,
  fallbackTitle: string,
  fallbackFolderName: string,
  dashboardCount: number,
): AiStudyPathBlueprint => {
  const record =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  const rawModules = Array.isArray(record.modules) ? record.modules : []
  const requestedDashboardCount = Math.round(
    numberFromUnknown(record.dashboardCount) || dashboardCount,
  )
  const rawDashboardCount = clampAutoDashboardCount(
    record.dashboardCount,
    dashboardCount,
  )
  const rawLessons = Array.isArray(record.lessons) ? record.lessons : []
  const effectiveDashboardCount =
    rawLessons.length >= 3 && rawLessons.length <= 7
      ? rawDashboardCount
      : dashboardCount
  const lessons = Array.from({ length: effectiveDashboardCount }).map(
    (_item, index) => normalizeBlueprintLesson(rawLessons[index], index),
  )

  return {
    title: stringFromUnknown(record.title) || fallbackTitle,
    folderName: stringFromUnknown(record.folderName) || fallbackFolderName,
    pathPromise:
      stringFromUnknown(record.pathPromise) ||
      'Build a useful beginner mental map of the topic.',
    entryLevel: stringFromUnknown(record.entryLevel) || 'Beginner',
    exitCapability:
      stringFromUnknown(record.exitCapability) ||
      'Explain what the topic is and attempt first practice tasks.',
    dashboardCount: effectiveDashboardCount,
    dashboardCountReason:
      requestedDashboardCount !== rawDashboardCount
        ? `Planner requested ${requestedDashboardCount} dashboards, so StudyMesh normalized the path to ${effectiveDashboardCount}.`
        : stringFromUnknown(record.dashboardCountReason) ||
          `${effectiveDashboardCount} dashboards are enough for a focused learning sprint.`,
    learnerProfile:
      stringFromUnknown(record.learnerProfile) ||
      'Student learning from a short prompt with unknown prior knowledge.',
    scope:
      stringFromUnknown(record.scope) ||
      'Bounded learning sprint focused on useful fundamentals and practice.',
    prerequisites: stringArrayFromUnknown(record.prerequisites),
    learningObjectives: stringArrayFromUnknown(record.learningObjectives),
    conceptGraph: stringArrayFromUnknown(record.conceptGraph),
    modules: rawModules
      .map((module) => {
        const moduleRecord =
          module && typeof module === 'object'
            ? (module as Record<string, unknown>)
            : {}
        return {
          title: stringFromUnknown(moduleRecord.title) || 'Core module',
          goal: stringFromUnknown(moduleRecord.goal) || 'Build understanding.',
          lessonIndexes: numberArrayFromUnknown(moduleRecord.lessonIndexes),
        }
      })
      .filter((module) => module.title || module.goal),
    lessons,
    finalReviewPlan: stringArrayFromUnknown(record.finalReviewPlan),
  }
}

const createStudyPathBlueprintPrompt = ({
  title,
  folderName,
  prompt,
  dashboardCount,
  autoDashboardCount,
}: {
  title: string
  folderName: string
  prompt: string
  dashboardCount: number
  autoDashboardCount: boolean
}): string => `Plan a high-quality StudyMesh Study Guide before writing dashboards.

Return strict JSON only. ${
  autoDashboardCount
    ? 'Choose dashboardCount between 3 and 7 from topic complexity, then create exactly dashboardCount lessons.'
    : `Create exactly ${dashboardCount} lessons.`
}

Planning requirements:
- The default promise is zero-to-map: bring someone from zero to knowing what the topic is about, why it matters, what parts exist, and how to start using it.
- Do not pretend to take the learner from beginner to expert. Treat this as a bounded learning sprint, not a full course.
- Infer likely learner level, goal, prerequisites, and useful scope from the user request.
- Include pathPromise, entryLevel, exitCapability, dashboardCount, and dashboardCountReason.
- Use learning science: retrieval practice, worked examples, misconception checks, spaced review, and mixed practice.
- Pick a contentMode for each lesson from: orientationMap, conceptLesson, contrastLab, workedExampleLab, procedureGuide, vocabularyReference, practiceCheckpoint, synthesisReview.
- First dashboard should usually be orientationMap unless the prompt asks for a narrow drill.
- Paths with 4 or more dashboards should usually include one practiceCheckpoint or synthesisReview.
- No more than two dashboards may share the same contentMode unless the topic truly demands it.
- Use student-friendly language and concrete objectives.
- Avoid vague lesson titles such as "Introduction", "Practice", or "Review" unless they include topic-specific words.
- Include 1-3 modules. lessonIndexes are zero-based indexes into lessons.
- For each lesson, include contentMode, sectionPlan, mustTeach, workedExample, misconceptionChecks, and retrievalPractice.
- For normal teaching lessons, practice and flashcards should usually be empty unless the lesson is a checkpoint, review, remediation, or applied practice step. When practice is useful, plan multiple-choice retrieval questions.
- Do not write full dashboard notes yet.
Title fallback: ${title}
Folder fallback: ${folderName}

User request/topic:
${prompt}`

const createStudyPathDashboardPrompt = ({
  title,
  prompt,
  dashboardCount,
  lesson,
  lessonIndex,
  blueprint,
}: {
  title: string
  prompt: string
  dashboardCount: number
  lesson: AiStudyPathBlueprintLesson
  lessonIndex: number
  blueprint: AiStudyPathBlueprint
}): string => `Create one StudyMesh Study Guide dashboard as strict JSON.

Return exactly one dashboard object. No Markdown fences. No extra prose.

Study Guide context:
- Path title: ${blueprint.title || title}
- Learner profile: ${blueprint.learnerProfile}
- Scope: ${blueprint.scope}
- Objectives: ${
  blueprint.learningObjectives.join('; ') || 'Useful understanding and practice'
}
- Concept graph: ${
  blueprint.conceptGraph.join(' -> ') || 'Infer sensible progression'
}
- Dashboard ${lessonIndex + 1} of ${dashboardCount}

Lesson plan:
${JSON.stringify(lesson, null, 2)}

Required dashboard fields:
{
  "title": "01 - Topic-specific title",
  "summary": "One sentence preview",
  "dashboardPurpose": "overview | lesson | practice | review | finalReview | projectLab",
  "practiceType": "none | quiz | mixed",
  "layoutReason": "Why this layout helps learning",
  "contentMode": "orientationMap | conceptLesson | contrastLab | workedExampleLab | procedureGuide | vocabularyReference | practiceCheckpoint | synthesisReview",
  "moduleTitle": "...",
  "lessonType": "...",
  "learnerQuestion": "...",
  "learningOutcome": "...",
  "supportArtifacts": {
    "glossary": [{ "term": "...", "definition": "..." }],
    "contrastTable": { "title": "...", "headers": ["...", "..."], "rows": [["...", "..."]] },
    "discussionPrompts": ["..."],
    "answerKey": [{ "question": "...", "answer": "..." }],
    "checkpointRubric": ["..."]
  },
  "rawNotes": "Complete readable Markdown lesson",
  "sourceSummary": { "title": "...", "bullets": ["..."] },
  "conceptRecap": { "title": "...", "sections": [{ "title": "...", "bullets": ["..."], "example": "..." }] },
  "practice": { "multipleChoice": [{ "question": "...", "options": ["...", "...", "..."], "correctOptionIndex": 0, "explanation": "..." }] },
  "flashcards": [{ "front": "...", "back": "..." }]
}

Quality rules:
- rawNotes must be 350-800 words of real teaching, formatted as Markdown with short topic-specific sections.
- Never reuse a generic section scaffold across dashboards. Avoid generic headings like "Goal", "Content", "Common Mistakes/Misconceptions", and "Quick Recall".
- Use the lesson contentMode:
  - orientationMap: why this topic exists, mental map, core vocabulary, first useful example, where to go next.
  - conceptLesson: core idea, when it applies, examples, boundary cases, mini-check.
  - contrastLab: decision table, near-miss pairs, misleading examples, choose-the-right-case practice.
  - workedExampleLab: problem, step-by-step solution, why each step matters, transfer case.
  - procedureGuide: workflow, checklist, failure points, apply-it task.
  - vocabularyReference: term clusters, nuance table, usage examples, memory hooks.
  - practiceCheckpoint: skills checklist, multiple-choice quiz, answer key, transfer challenge.
  - synthesisReview: big picture, connections, mixed challenge, next learning path.
- Use NotebookLM-style material only where useful inside rawNotes. Do not claim the dashboard contains a separate glossary, contrast table, answer key, rubric, drag-and-drop board, or tabs unless that content is actually present in rawNotes.
- Avoid filler, generic questions, copied headings as questions, and obvious answer choices.
- Visible dashboard rule: one Markdown lesson widget by default. Sometimes StudyMesh may add one visible QuizCarouselBlock on the right when you set practiceType to "quiz" or "mixed" and provide useful practice.multipleChoice questions.
- Decide whether the dashboard deserves a QuizCarouselBlock. Use practiceType "none" when the lesson is best studied as one clear lesson. Use "quiz" or "mixed" only when active practice materially improves the dashboard.
- QuizCarouselBlock can only contain multiple-choice questions. Never output typed-answer, single-input, quizSingle, or free-response quiz data.
- Do not end rawNotes with quiz-like sections such as "Retrieval Practice", "Quick Recall", or a list of scored questions. Promote that material into practice.multipleChoice instead. Tiny reflective prompts are allowed only when they are not a scored question set.
- When adding practice.multipleChoice, create an adaptive number of questions: about one per important concept, plus at most one synthesis question when useful. Normal lessons should usually have 2-5 questions; checkpoint/review/synthesis dashboards may have 4-8.
- After dashboard 2, you may include 0-2 light spiral-review questions from previous dashboards, but only when they naturally connect to the current lesson.
- Practice questions must be answerable from rawNotes but should require recall, application, comparison, error diagnosis, prediction, explanation, or transfer. Do not copy lesson sentences as questions.
- Do not add visible flashcards by default. Flashcards are on-demand support, not a second dashboard widget.
- Use simple dashboard layout. Reduce cognitive load: clear hierarchy, signal key ideas, keep examples near rules.
- Keep prompt-only Study Guides useful without sources. Add accurate general teaching content, but do not invent fake citations or source claims.
- Do not output objects/kind/widget renderer fields.
Original user request/topic:
${prompt}`

const createStudyPathQualityPrompt = (
  dashboard: Record<string, unknown>,
  pathIssues: string[] = [],
): string => `Evaluate this StudyMesh Study Guide dashboard for student learning quality.

Return strict JSON only:
{
  "score": 1-5,
  "issues": ["..."],
  "repairInstructions": ["..."]
}

Rubric:
- 5: specific, clear, varied format, well-scaffolded, useful examples, strong retrieval practice, good layout fit, low cognitive load.
- 4: good, minor gaps.
- 3: usable but generic, thin, weak practice, or layout mismatch.
- 2: poor teaching, vague, too short, generic practice, likely confusing.
- 1: unusable or malformed.

Check for: progression, specificity, contentMode fit, non-repetitive headings, misconceptions, worked example, useful optional quiz practice, student-friendly explanation, layout fit, schema completeness, and no fake claims about dashboard widgets that are not actually rendered.
${
  pathIssues.length > 0
    ? `\nDeterministic path scan issues to consider:\n${pathIssues
        .map((issue) => `- ${issue}`)
        .join('\n')}\n`
    : ''
}

Dashboard JSON:
${JSON.stringify(dashboard)}`

const createStudyPathDashboardRepairPrompt = ({
  dashboard,
  repairInstructions,
}: {
  dashboard: Record<string, unknown>
  repairInstructions: string[]
}): string => `Repair this StudyMesh Study Guide dashboard. Return the same one-dashboard JSON shape only.

Repair instructions:
${repairInstructions.map((item) => `- ${item}`).join('\n')}

Preserve topic, title intent, module, and dashboard count position. Improve teaching quality, examples, misconceptions, retrieval practice, and layout fit.

Dashboard JSON:
${JSON.stringify(dashboard)}`

const markdownHeadingSignature = (rawNotes: unknown): string => {
  const text = stringFromUnknown(rawNotes)
  const headings = text
    .split(/\r?\n/)
    .map((line) => line.match(/^#{1,3}\s+(.+)$/)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading))
    .map((heading) =>
      heading
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 5)

  return headings.join('|')
}

const genericStudyPathHeadingPattern =
  /^(goal|content|key points|examples|common mistakes(?:\/misconceptions)?|common mistakes and misconceptions|quick recall)$/i

const scanStudyPathDashboards = (
  dashboards: Array<Record<string, unknown>>,
): string[] => {
  const issues: string[] = []
  const signatures = new Map<string, number>()
  const contentModes = new Map<string, number>()

  dashboards.forEach((dashboard, index) => {
    const signature = markdownHeadingSignature(dashboard.rawNotes)
    if (signature) {
      signatures.set(signature, (signatures.get(signature) || 0) + 1)
    }

    const contentMode = stringFromUnknown(dashboard.contentMode)
    if (contentMode) {
      contentModes.set(contentMode, (contentModes.get(contentMode) || 0) + 1)
    }

    const rawNotes = stringFromUnknown(dashboard.rawNotes)
    if (/Ã.|Â./.test(rawNotes)) {
      issues.push(`Dashboard ${index + 1} appears to contain mojibake.`)
    }

    const fakeWidgetClaims = [
      /drag[-\s]?and[-\s]?drop/i,
      /\bthe dashboard uses\b/i,
      /\btabs?\b/i,
      /\bsupport\s*artifacts?\b/i,
      /\banswer key widget\b/i,
      /\brubric widget\b/i,
    ].filter((pattern) => pattern.test(rawNotes))
    if (fakeWidgetClaims.length > 0) {
      issues.push(
        `Dashboard ${
          index + 1
        } appears to claim UI/widgets that may not exist.`,
      )
    }

    const genericHeadings = rawNotes
      .split(/\r?\n/)
      .map((line) => line.match(/^#{1,3}\s+(.+)$/)?.[1]?.trim() || '')
      .filter((heading) => genericStudyPathHeadingPattern.test(heading))
    if (genericHeadings.length >= 2) {
      issues.push(
        `Dashboard ${
          index + 1
        } uses generic repeated headings: ${genericHeadings.join(', ')}.`,
      )
    }
  })

  Array.from(signatures.entries()).forEach(([signature, count]) => {
    if (count > 1 && signature.split('|').length >= 3) {
      issues.push(
        `Repeated heading signature appears ${count} times: ${signature}.`,
      )
    }
  })

  Array.from(contentModes.entries()).forEach(([contentMode, count]) => {
    if (count > 2) {
      issues.push(`contentMode ${contentMode} appears ${count} times.`)
    }
  })

  const firstContentMode = stringFromUnknown(dashboards[0]?.contentMode)
  if (dashboards.length >= 3 && firstContentMode !== 'orientationMap') {
    issues.push('First dashboard should usually use orientationMap.')
  }

  if (
    dashboards.length >= 4 &&
    !dashboards.some((dashboard) =>
      ['practiceCheckpoint', 'synthesisReview'].includes(
        stringFromUnknown(dashboard.contentMode),
      ),
    )
  ) {
    issues.push(
      'Path with 4+ dashboards lacks practiceCheckpoint or synthesisReview.',
    )
  }

  return issues
}

const generateStudyPathJsonWithPipeline = async ({
  apiToken,
  model,
  strongProvider,
  strongTransport,
  title,
  prompt,
  folderName,
  dashboardCount,
  autoDashboardCount,
}: {
  apiToken: string
  model: string
  strongProvider: StrongAiProviderId
  strongTransport?: StrongAiModelTransport
  title: string
  prompt: string
  folderName: string
  dashboardCount: number
  autoDashboardCount: boolean
}): Promise<{
  text: string
  parsed: unknown
  blueprint?: AiStudyPathBlueprint
  qualityByIndex: Map<number, { score: number; issues: string[] }>
}> => {
  const blueprintText = await callStrongModel(
    apiToken,
    model,
    [
      {
        text: createStudyPathBlueprintPrompt({
          title,
          folderName,
          prompt,
          dashboardCount,
          autoDashboardCount,
        }),
      },
    ],
    studyPathBlueprintSchema,
    strongProvider,
    strongTransport,
  )
  const parsedBlueprint = parseGeminiJson(blueprintText)
  if (
    parsedBlueprint &&
    typeof parsedBlueprint === 'object' &&
    Array.isArray((parsedBlueprint as Record<string, unknown>).dashboards)
  ) {
    return {
      text: blueprintText,
      parsed: parsedBlueprint,
      blueprint: undefined,
      qualityByIndex: new Map(),
    }
  }

  const blueprint = normalizeStudyPathBlueprint(
    parsedBlueprint,
    title,
    folderName,
    dashboardCount,
  )
  const qualityByIndex = new Map<number, { score: number; issues: string[] }>()
  const dashboards: Record<string, unknown>[] = []
  const effectiveDashboardCount = blueprint.dashboardCount || dashboardCount

  for (let index = 0; index < effectiveDashboardCount; index += 1) {
    const lesson = blueprint.lessons[index]
    const dashboardText = await callStrongModel(
      apiToken,
      model,
      [
        {
          text: createStudyPathDashboardPrompt({
            title,
            prompt,
            dashboardCount: effectiveDashboardCount,
            lesson,
            lessonIndex: index,
            blueprint,
          }),
        },
      ],
      studyPathDashboardSchema,
      strongProvider,
      strongTransport,
    )
    const parsedDashboard = parseGeminiJson(dashboardText)
    let dashboard =
      parsedDashboard && typeof parsedDashboard === 'object'
        ? (parsedDashboard as Record<string, unknown>)
        : {}
    const deterministicIssues = scanStudyPathDashboards([
      ...dashboards,
      dashboard,
    ])

    try {
      const qualityText = await callStrongModel(
        apiToken,
        model,
        [
          {
            text: createStudyPathQualityPrompt(dashboard, deterministicIssues),
          },
        ],
        studyPathQualitySchema,
        strongProvider,
        strongTransport,
      )
      const qualityParsed = parseGeminiJson(qualityText)
      const qualityRecord =
        qualityParsed && typeof qualityParsed === 'object'
          ? (qualityParsed as Record<string, unknown>)
          : {}
      const score =
        typeof qualityRecord.score === 'number' ? qualityRecord.score : 3
      const issues = stringArrayFromUnknown(qualityRecord.issues)
      const repairInstructions = stringArrayFromUnknown(
        qualityRecord.repairInstructions,
      )
      const combinedIssues = [...issues, ...deterministicIssues]
      qualityByIndex.set(index, { score, issues: combinedIssues })

      if (
        (score < 4 || deterministicIssues.length > 0) &&
        (repairInstructions.length > 0 || deterministicIssues.length > 0)
      ) {
        const repairText = await callStrongModel(
          apiToken,
          model,
          [
            {
              text: createStudyPathDashboardRepairPrompt({
                dashboard,
                repairInstructions:
                  repairInstructions.length > 0
                    ? repairInstructions
                    : deterministicIssues,
              }),
            },
          ],
          studyPathDashboardSchema,
          strongProvider,
          strongTransport,
        )
        const repaired = parseGeminiJson(repairText)
        if (repaired && typeof repaired === 'object') {
          dashboard = repaired as Record<string, unknown>
        }
      }
    } catch {
      qualityByIndex.set(index, {
        score: 3,
        issues: [
          'Quality evaluator skipped because provider returned unusable output.',
        ],
      })
    }

    dashboards.push({
      ...dashboard,
      title:
        stringFromUnknown(dashboard.title) ||
        `${String(index + 1).padStart(2, '0')} - ${lesson.title}`,
      moduleTitle:
        stringFromUnknown(dashboard.moduleTitle) || lesson.moduleTitle,
      lessonType: stringFromUnknown(dashboard.lessonType) || lesson.lessonType,
      contentMode: normalizeContentMode(
        dashboard.contentMode,
        lesson.contentMode,
      ),
      learnerQuestion:
        stringFromUnknown(dashboard.learnerQuestion) || lesson.learnerQuestion,
      learningOutcome:
        stringFromUnknown(dashboard.learningOutcome) || lesson.learningOutcome,
      dashboardPurpose: normalizeDashboardPurpose(
        dashboard.dashboardPurpose,
        normalizeDashboardPurpose(lesson.dashboardPurpose),
      ),
      practiceType: normalizePracticeType(
        dashboard.practiceType,
        normalizePracticeType(lesson.practiceType),
      ),
      supportArtifacts: normalizeSupportArtifacts(dashboard.supportArtifacts),
    })
  }

  const pathJson = {
    title: blueprint.title || title,
    folderName: blueprint.folderName || folderName,
    dashboardCountReason: blueprint.dashboardCountReason,
    dashboards,
  }
  const text = JSON.stringify(pathJson)

  return {
    text,
    parsed: pathJson,
    blueprint,
    qualityByIndex,
  }
}

export const generateStudyPathWithAi = async ({
  apiToken,
  model,
  strongProvider = DEFAULT_STRONG_AI_PROVIDER,
  strongTransport,
  singleRequest = false,
  title,
  prompt,
  folderName,
}: GenerateStudyPathWithAiOptions): Promise<AiStudyPathDraft> => {
  const stepNames = getStudyPathStepNames()
  const dashboardCount = stepNames.length
  const practiceAmount = 'medium'
  const practiceProfile = createQuickCreatePracticeProfile(practiceAmount, [
    'summaries',
    'definitions',
  ])
  const promptText = `Create a Study Guide JSON object. A Study Guide is NOT one dashboard. It is a folder containing multiple ordered dashboards/quick creates.

Return exactly this structure:
{
  "title": "Path title",
  "folderName": "Folder name for all dashboards",
  "emoji": "One emoji that represents the Study Guide topic",
  "dashboards": [
    {
      "title": "01 - Content 1",
      "summary": "One sentence preview",
      "dashboardPurpose": "lesson",
      "practiceType": "none",
      "layoutReason": "Short reason for the selected learning layout",
      "contentMode": "conceptLesson",
      "sourceRefs": [{ "label": "optional source/chunk label" }],
      "moduleTitle": "Module title",
      "lessonType": "concept",
      "learnerQuestion": "Question this lesson answers",
      "learningOutcome": "Concrete outcome for the learner",
      "rawNotes": "Complete lesson notes for this dashboard",
      "sourceSummary": { "title": "Source summary", "bullets": ["..."] },
      "conceptRecap": { "title": "Concept recap", "sections": [{ "title": "Specific concept", "bullets": ["..."], "example": "..." }] },
      "practice": { "multipleChoice": [{ "question": "...", "options": ["...", "...", "..."], "correctOptionIndex": 0, "explanation": "..." }] },
      "flashcards": [{ "front": "...", "back": "..." }]
    }
  ]
}

Rules:
- Return strict valid JSON only: double-quoted property names and strings, comma-separated array/object entries, matching { } and [ ], no trailing commas, no comments, no Markdown fences, no prose before or after the JSON.
- Choose a concise, topic-specific folderName for the Study Guide, such as "French B1 Subjunctive" or "Calculus Derivatives". Do not use a generic folderName like "Study Guide" unless the topic is truly unknown.
- Choose exactly one topic-specific emoji for the Study Guide. It must be a single emoji character or emoji sequence, not text, and it should match the user's topic.
- Create exactly ${dashboardCount} ordered lesson dashboards, grouped mentally into 1-3 modules. Give each dashboard a useful topic-specific title.
- Treat this as a bounded learning sprint, not a complete course on everything. Include scope in lesson choices: what gets covered now, what waits for later.
- Do not follow a fixed role template by position. You are responsible for choosing each dashboard's purpose, practiceType, rawNotes, and practice mix from the lesson content itself.
- Every dashboard is a normal lesson dashboard in the product. Do not make the last dashboard an automatic exercise dump or the previous one an automatic summary. Choose content only from teaching need.
- Every dashboard must have one primary educational purpose: overview, lesson, practice, review, finalReview, or projectLab.
- SourceSummary, conceptRecap, practice, and flashcards are support material. The visible lesson comes mainly from rawNotes, so rawNotes must carry the actual lesson.
- Do not make dashboards feel like random widget collections. Use the simplest layout that supports the learning goal.
- Visible dashboard rule: one Markdown lesson widget by default. Sometimes StudyMesh may add one visible QuizCarouselBlock on the right when you set practiceType to "quiz" or "mixed" and provide useful practice.multipleChoice questions.
- You decide whether each dashboard deserves that QuizCarouselBlock. For most reading/theory dashboards, set practiceType to "none". Use "quiz" or "mixed" only when active recall materially improves the dashboard, such as concept-heavy lessons, checkpoints, review, remediation, or applied practice.
- QuizCarouselBlock can only contain multiple-choice questions. Never output typed-answer, single-input, quizSingle, or free-response quiz data.
- Do not end rawNotes with quiz-like sections such as "Retrieval Practice", "Quick Recall", or a list of scored questions. Promote that material into practice.multipleChoice instead. Tiny reflective prompts are allowed only when they are not a scored question set.
- When adding practice.multipleChoice, create an adaptive number of questions: about one per important concept, plus at most one synthesis question when useful. Normal lessons should usually have 2-5 questions; checkpoint/review/synthesis dashboards may have 4-8.
- After dashboard 2, you may include 0-2 light spiral-review questions from previous dashboards, but only when they naturally connect to the current lesson.
- Practice questions must be answerable from rawNotes but should require recall, application, comparison, error diagnosis, prediction, explanation, or transfer. Do not copy lesson sentences as questions.
- Do not add visible flashcards by default. Flashcards are on-demand support, not a second dashboard widget.
- Each dashboard must be useful by itself as teaching content, not as a container for many practice widgets.
- Usually return ${
    stepNames.length
  } dashboards, but choose 3-7 dashboards when the topic is clearly narrower or broader.
- rawNotes must be real lesson notes for that dashboard, not a one-line summary. Write 250-600 words with explanations, examples, key points, and common mistakes when relevant.
- Format rawNotes as readable Markdown, not one long paragraph. Use short topic-specific sections chosen from that dashboard's teaching purpose. Do not reuse the same heading scaffold across dashboards.
- sourceSummary and conceptRecap should match the selected layout. For normal teaching lessons, practice and flashcards should usually be empty. For checkpoint/review/remediation lessons, include one focused practice set if useful.
- conceptRecap is used internally to structure the lesson.
- Do not output "objects", "kind", "quizMode", internal block names, widget names, or any StudyMesh renderer fields. StudyMesh decides widget types.
- Use concrete rule labels in conceptRecap sections, such as "Subjunctive trigger: il faut que", not headings or sentence fragments.
- Generate summaries, flashcards, and quizzes from structured concepts, not from first sentences, headings, copied examples, or instructions.
- Practice questions must be specific to the lesson content. Never create generic questions like "What do the notes say about <dashboard title>?", "Which statement matches the notes about <dashboard title>?", "What does X help you understand or do?", or "What is the core idea behind X?".
- Practice questions must test concepts and uses, not copied headings or answer options made obvious by the dashboard title.
- Never use weak standalone concepts such as Goal, Example, Active, It, Avoir, Etre, Quantity, or De. Do not create title-like, instruction-like, or very short fragments as study objects.
- Flashcards should ask useful rule-specific prompts such as "How do you form the present subjunctive for most verbs?" instead of "What should you remember about <copied line>?".
- Every dashboard needs a short "summary" sentence so workspace previews can show it.
- Do not wrap JSON in markdown. Do not add commentary outside JSON.
- Do not create PDFs/images/resources unless the user explicitly asks for heavy media.
- For multiple-choice questions, include 3-4 meaningful options, correctOptionIndex, and explanation.
- Do not claim the dashboard contains separate tabs, an interactive drag-and-drop board, support artifacts, answer key widgets, or rubric widgets. If you want an answer key or rubric, include it as plain rawNotes text.
- Keep content concise, beginner-friendly, and appropriate for the requested topic.
- Aim for about ${practiceProfile.minTotal}-${
    practiceProfile.maxTotal
  } support concepts across the whole path. Do not pad with quiz/flashcard items.
Path title fallback: ${title}
Folder name fallback if you cannot infer a better one: ${
    folderName || 'Study Guide'
  }
User request/topic:
${prompt}`
  const fallbackPrompt = `${promptText}

The previous response failed JSON formatting. Retry with a simpler response:
- Return plain JSON only.
- Return syntactically valid JSON with all commas and braces in place.
- Use only the Study Guide fields: title, folderName, emoji, dashboards, summary, rawNotes, dashboardPurpose, practiceType, layoutReason, sourceRefs, sourceSummary, conceptRecap, practice, flashcards.
- Do not use markdown code fences.
- Do not include comments, trailing commas, undefined, NaN, or extra text.`
  const createRepairPrompt = (originalJson: string) => `${promptText}

The previous response was valid JSON, but one or more normal dashboards were incomplete.
Repair the JSON instead of simplifying it:
- Preserve the exact dashboard count, order, titles, summaries, and rawNotes.
- Every dashboard is a normal Study Guide dashboard.
- Fill missing conceptRecap/practice from that dashboard's rawNotes when practiceType calls for active recall.
- For practiceType none, practice and flashcards may stay empty if rawNotes contains a complete learning explanation.
- For practiceType quiz or mixed, include enough practice.multipleChoice questions to justify one visible QuizCarouselBlock: usually 2-5 for normal lessons and 4-8 for checkpoint/review/synthesis dashboards.
- Do not create flashcards unless they are clearly useful for on-demand follow-up; they are not rendered as the visible second widget.
- Return plain JSON only.

Original JSON:
${originalJson}`

  let text: string
  let parsed: unknown
  let blueprint: AiStudyPathBlueprint | undefined
  let qualityByIndex = new Map<number, { score: number; issues: string[] }>()
  try {
    if (singleRequest) {
      text = await callStrongModel(
        apiToken,
        model,
        [{ text: promptText }],
        studyPathSchema,
        strongProvider,
        strongTransport,
      )
    } else {
      const pipelineResult = await generateStudyPathJsonWithPipeline({
        apiToken,
        model,
        strongProvider,
        title,
        prompt,
        folderName: folderName || 'Study Guide',
        dashboardCount,
        autoDashboardCount: true,
        strongTransport,
      })
      text = pipelineResult.text
      parsed = pipelineResult.parsed
      blueprint = pipelineResult.blueprint
      qualityByIndex = pipelineResult.qualityByIndex
    }
  } catch (error) {
    if (singleRequest) {
      throw error
    }

    if (!isGeminiOutputFormatError(error)) {
      try {
        text = await callStrongModel(
          apiToken,
          model,
          [{ text: promptText }],
          studyPathSchema,
          strongProvider,
          strongTransport,
        )
      } catch {
        throw error
      }
    } else {
      text = await callStrongModel(
        apiToken,
        model,
        [{ text: fallbackPrompt }],
        undefined,
        strongProvider,
        strongTransport,
      )
    }
  }

  if (!parsed) {
    try {
      parsed = parseGeminiJson(text)
    } catch {
      if (singleRequest) {
        throw new Error(GEMINI_OUTPUT_FORMAT_MESSAGE)
      }

      try {
        text = await callStrongModel(
          apiToken,
          model,
          [{ text: fallbackPrompt }],
          undefined,
          strongProvider,
          strongTransport,
        )
        parsed = parseGeminiJson(text)
      } catch {
        throw new Error(GEMINI_OUTPUT_FORMAT_MESSAGE)
      }
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
  if (!singleRequest && incompleteNormalDashboardIndexes.size > 0) {
    try {
      const repairText = await callStrongModel(
        apiToken,
        model,
        [{ text: createRepairPrompt(text) }],
        studyPathSchema,
        strongProvider,
        strongTransport,
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
  const autoPlannedDashboardCount =
    rawDashboards.length >= 3
      ? Math.min(7, rawDashboards.length)
      : STUDY_PATH_FALLBACK_DASHBOARD_COUNT
  const normalizedRawDashboards =
    rawDashboards.length >= 3
      ? rawDashboards.slice(0, autoPlannedDashboardCount)
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
              multipleChoice: [],
            },
            flashcards: [],
            dashboardPurpose: 'lesson',
            practiceType: 'mixed',
            layoutReason: 'Deterministic fallback layout.',
          }
        })
  const warnings: string[] = []
  const accumulatedContentNotes: string[] = []
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
      const dashboardPurpose = normalizeDashboardPurpose(input.dashboardPurpose)
      const practiceType = normalizePracticeType(input.practiceType)
      const layoutReason = stringFromUnknown(input.layoutReason)
      const sourceRefs = normalizeSourceRefs(input.sourceRefs)
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
      const draft = normalizeAiQuickCreateDraft(roleSanitizedInput, packId, {
        rawNotes: typeof input.rawNotes === 'string' ? input.rawNotes : '',
        rawAiResponse: text,
        dashboardRole,
      })
      const contentMode = normalizeContentMode(input.contentMode)
      const supportArtifacts = normalizeSupportArtifacts(input.supportArtifacts)
      const supportObjects = createSupportArtifactObjects(
        packId,
        supportArtifacts,
      )
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
        [...draft.objects, ...supportObjects],
        dashboardRole,
        finalEvents,
      )
      const visibleRoleObjects = getStudyPathVisibleObjectsForRole(
        roleFilteredObjects,
        dashboardRole,
        finalEvents,
        contentMode,
      )
      const visiblePracticeTarget =
        practiceType === 'none'
          ? 0
          : getStudyPathVisiblePracticeTarget(dashboardRole)
      const filledVisibleObjects =
        visiblePracticeTarget > 0
          ? augmentQuickCreatePracticeObjects(visibleRoleObjects, {
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
      const quality = qualityByIndex.get(index)
      if (quality && quality.score < 4) {
        finalEvents.push(
          `Quality evaluator score ${quality.score}/5: ${quality.issues.join(
            '; ',
          )}`,
        )
      }

      warnings.push(...draft.warnings)

      const dashboard = {
        ...draft,
        title: dashboardTitle,
        summary: dashboardSummary,
        rawNotes: lessonNotes,
        dashboardRole,
        dashboardPurpose,
        practiceType,
        layoutReason,
        sourceRefs,
        moduleTitle: stringFromUnknown(input.moduleTitle),
        lessonType: stringFromUnknown(
          input.lessonType,
        ) as AiStudyPathDashboardDraft['lessonType'],
        contentMode,
        learnerQuestion: stringFromUnknown(input.learnerQuestion),
        learningOutcome: stringFromUnknown(input.learningOutcome),
        supportArtifacts,
        qualityScore: quality?.score,
        qualityIssues: quality?.issues,
        objects: finalObjects,
        warnings: [],
        debugTrace,
        sourceFormat: 'text' as QuickCreateSourceFormat,
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

  const finalPathIssues = scanStudyPathDashboards(
    dashboards.map((dashboard) => ({
      rawNotes: dashboard.rawNotes,
      contentMode: dashboard.contentMode,
    })),
  )
  warnings.push(
    ...finalPathIssues.map((issue) => `Study Guide quality scan: ${issue}`),
  )

  return {
    title:
      typeof record.title === 'string' && record.title.trim()
        ? record.title.trim()
        : title,
    folderName:
      typeof record.folderName === 'string' && record.folderName.trim()
        ? record.folderName.trim()
        : folderName,
    emoji:
      typeof record.emoji === 'string' && record.emoji.trim()
        ? record.emoji.trim()
        : undefined,
    dashboards,
    warnings,
    blueprint,
    dashboardCountReason:
      stringFromUnknown(record.dashboardCountReason) ||
      blueprint?.dashboardCountReason,
  }
}
