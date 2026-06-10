import {
  StudyObject,
  StudyPackSourceFormat,
  StudyPathPracticeType,
} from '../types'
import {
  applyStudyMaterialResourceTypeToDraft,
  AiStudyPackDraft,
  NormalizeAiStudyPackDraftOptions,
  StudyMaterialDetailLevel,
  StudyMaterialResourceType,
} from './normalizer'
import {
  callLocalLanguageModel,
  LocalAiProgressEvent,
} from './localLanguageModel'
import {
  AiStudyPathDashboardDraft,
  AiStudyPathDraft,
  GenerateStudyPackWithAiOptions,
  GenerateStudyPathWithAiOptions,
} from './strongGeneration'

type LocalObjectKind =
  | 'markdown'
  | 'term'
  | 'qa'
  | 'quiz'
  | 'list'
  | 'reviewPrompt'

interface LocalGenerationOptions {
  onProgress?: (event: LocalAiProgressEvent) => void
  dashboardConcurrency?: 1 | 2 | 3 | 5
  signal?: AbortSignal
}

export type LocalAiGenerationFailureCode =
  | 'timeout'
  | 'invalidJson'
  | 'mappingError'
  | 'noUsableObjects'
  | 'unsupported'
  | 'unavailable'
  | 'unknown'

export interface LocalAiGenerationFailureDebug {
  dashboardIndex?: number
  dashboardCount?: number
  attempt?: number
  attemptCount?: number
  promptLength?: number
  rawResponse?: string
  parsedJson?: unknown
  parseError?: string
  mappingError?: string
  droppedOrRepairedItems?: string[]
  attempts?: LocalAiGenerationFailureDebug[]
}

export class LocalAiGenerationError extends Error {
  code: LocalAiGenerationFailureCode
  debug?: LocalAiGenerationFailureDebug
  cause?: unknown

  constructor(
    code: LocalAiGenerationFailureCode,
    message: string,
    options: {
      debug?: LocalAiGenerationFailureDebug
      cause?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'LocalAiGenerationError'
    this.code = code
    this.debug = options.debug
    this.cause = options.cause
  }
}

export const isLocalAiGenerationError = (
  error: unknown,
): error is LocalAiGenerationError =>
  error instanceof LocalAiGenerationError ||
  (Boolean(error) &&
    typeof error === 'object' &&
    (error as { name?: unknown }).name === 'LocalAiGenerationError')

const LOCAL_STUDY_PACK_TIMEOUT_MS = 4 * 60 * 1000
const LOCAL_STUDY_PATH_PLANNER_TIMEOUT_MS = 180 * 1000
const LOCAL_STUDY_PATH_NOTES_TIMEOUT_MS = 300 * 1000
const LOCAL_STUDY_PATH_PRACTICE_TIMEOUT_MS = 240 * 1000
const LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS = 3
const LOCAL_STUDY_PACK_MAX_ATTEMPTS = 3
const LOCAL_AI_RETRY_COOLDOWN_MS = 8500
const LOCAL_STUDY_PATH_TIMEOUT_MESSAGE =
  'Local AI timed out. Try again, choose a smaller path, or use Own Gemini token.'
const LOCAL_STUDY_PATH_INVALID_JSON_MESSAGE =
  'Local AI returned malformed JSON. Try again, choose a smaller path, or use Own Gemini token.'
const LOCAL_STUDY_PATH_NO_USABLE_OBJECTS_MESSAGE =
  'Local AI returned JSON, but StudyMesh could not map it into widgets.'

interface LocalConceptContract {
  concept: string
  definition: string
  keyFact: string
  example: string
  commonConfusion: string
  sourcePhrase: string
}

interface LocalSectionContract {
  title: string
  items: string[]
}

interface LocalQuizContract {
  question: string
  options: string[]
  correctIndex: number
  answer: string
  explanation: string
}

interface LocalFlashcardContract {
  question: string
  answer: string
}

interface LocalStudyPathPlanSection {
  title: string
  goal: string
  focus?: string
}

interface LocalStudyPathPlanItem {
  title: string
  goal: string
  sections: LocalStudyPathPlanSection[]
  topics: string[]
  avoid: string[]
}

interface LocalStudyPathPlan {
  title: string
  folderName: string
  dashboards: LocalStudyPathPlanItem[]
}

interface LocalRepairedContract {
  title?: string
  summary: string
  rawNotes: string
  sourceSummary: string[]
  concepts: LocalConceptContract[]
  sections: LocalSectionContract[]
  quizzes: LocalQuizContract[]
  flashcards: LocalFlashcardContract[]
}

const localAllowedKinds = new Set<LocalObjectKind>([
  'markdown',
  'term',
  'qa',
  'quiz',
  'list',
  'reviewPrompt',
])

const normalizeSpaces = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const normalizeBlock = (value: string): string =>
  value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const normalizeKey = (value: string): string =>
  normalizeSpaces(
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, ' '),
  )

const stringValue = (value: unknown): string =>
  typeof value === 'string' ? normalizeSpaces(value) : ''

const blockValue = (value: unknown): string =>
  typeof value === 'string' ? normalizeBlock(value) : ''

const titleValue = (value: unknown, fallback: string): string =>
  stringValue(value) || fallback

const localBadTextPattern =
  /\btarget rule\b|\bformation rule\b|proposed that matter\s*:|what rule does|how do you form|what do the notes say|according to the notes|which statement matches|core idea behind/i

const genericFolderNames = new Set([
  'aquamesh',
  'lesson plan',
  'local ai study guide',
  'study guide',
  'study pack',
  'untitled',
])

const localBadConceptKeys = new Set([
  'active',
  'example',
  'goal',
  'grammar',
  'introduction',
  'it',
  'lesson',
  'concepts',
  'overview',
  'practice',
  'target rule',
  'formation rule',
  'target rule formation rule',
  'proposed that matter',
  'source summary',
  'summary',
])

const isBadLocalText = (value: string): boolean =>
  !value.trim() || localBadTextPattern.test(value)

const isBadConcept = (value: string): boolean => {
  const key = normalizeKey(value)
  const wordCount = key.split(/\s+/).filter(Boolean).length

  return (
    !key ||
    key.length < 3 ||
    localBadConceptKeys.has(key) ||
    localBadTextPattern.test(value) ||
    (wordCount <= 1 && key.length < 6)
  )
}

const uniqueByKey = <T>(
  values: T[],
  keyForValue: (value: T) => string,
): T[] => {
  const seen = new Set<string>()

  return values.filter((value) => {
    const key = normalizeKey(keyForValue(value))
    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

const stringArrayValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return uniqueByKey(value.map(stringValue).filter(Boolean), (item) => item)
  }

  if (typeof value === 'string') {
    return uniqueByKey(
      value
        .split(/\r?\n|;|,(?=\s+\S)/)
        .map(stringValue)
        .filter(Boolean),
      (item) => item,
    )
  }

  return []
}

const summaryString = (value: unknown): string => {
  if (typeof value === 'string') {
    return normalizeSpaces(value)
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return (
      blockValue(record.markdown) ||
      blockValue(record.body) ||
      blockValue(record.content) ||
      stringValue(record.title)
    )
  }

  return ''
}

export const parseLocalAiJson = (text: string): unknown => {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fenced || trimmed).replace(/\\(?!["\\/bfnrtu])/g, '')

  const parseCandidate = (value: string): unknown => JSON.parse(value)

  const balanceIncompleteJson = (value: string): string | null => {
    const stack: string[] = []
    let inString = false
    let escaping = false

    for (const char of value) {
      if (inString) {
        if (escaping) {
          escaping = false
          continue
        }

        if (char === '\\') {
          escaping = true
          continue
        }

        if (char === '"') {
          inString = false
        }

        continue
      }

      if (char === '"') {
        inString = true
        continue
      }

      if (char === '{') {
        stack.push('}')
        continue
      }

      if (char === '[') {
        stack.push(']')
        continue
      }

      if (char === '}' || char === ']') {
        if (stack.at(-1) !== char) {
          return null
        }

        stack.pop()
      }
    }

    if (inString || stack.length === 0) {
      return null
    }

    return `${value}${stack.reverse().join('')}`
  }

  try {
    return parseCandidate(candidate)
  } catch {
    const balanced = balanceIncompleteJson(candidate)
    if (balanced) {
      try {
        return parseCandidate(balanced)
      } catch {
        // Fall through to the bounded object extraction fallback.
      }
    }

    const firstObject = candidate.indexOf('{')
    const lastObject = candidate.lastIndexOf('}')
    if (firstObject >= 0 && lastObject > firstObject) {
      const objectCandidate = candidate.slice(firstObject, lastObject + 1)
      try {
        return parseCandidate(objectCandidate)
      } catch {
        const balancedObject = balanceIncompleteJson(objectCandidate)
        if (balancedObject) {
          return parseCandidate(balancedObject)
        }
      }
    }

    throw new Error('Google Local AI returned invalid JSON.')
  }
}

const localAiJsonLooksTruncated = (text: string): boolean => {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fenced || trimmed).trim()
  if (!candidate || !/[{\[]/.test(candidate) || /[}\]]\s*$/.test(candidate)) {
    return false
  }

  const stack: string[] = []
  let inString = false
  let escaping = false

  for (const char of candidate) {
    if (inString) {
      if (escaping) {
        escaping = false
        continue
      }

      if (char === '\\') {
        escaping = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      stack.push('}')
      continue
    }

    if (char === '[') {
      stack.push(']')
      continue
    }

    if (char === '}' || char === ']') {
      if (stack.at(-1) !== char) {
        return false
      }

      stack.pop()
    }
  }

  return stack.length > 0 || inString
}

const createBase = (
  packId: string,
  kind: string,
  index: number,
  title: string,
) => ({
  id: `${packId}-${kind}-${index + 1}`,
  title,
  sourceLine: index + 1,
  tags: ['study-pack', 'ai-generated', 'local-ai'],
})

const repairKind = (value: unknown): LocalObjectKind | '' => {
  const kind = stringValue(value).toLowerCase()
  if (kind === 'flashcard') {
    return 'qa'
  }

  if (kind === 'multiplechoice' || kind === 'multiple-choice') {
    return 'quiz'
  }

  if (kind === 'reviewprompt' || kind === 'review-prompt') {
    return 'reviewPrompt'
  }

  return localAllowedKinds.has(kind as LocalObjectKind)
    ? (kind as LocalObjectKind)
    : ''
}

const repairLocalQuiz = (
  input: Record<string, unknown>,
  index: number,
  events: string[],
  options: { rejectPlaceholderOptions?: boolean } = {},
): LocalQuizContract | null => {
  const question = stringValue(input.question)
  const rawOptions = Array.isArray(input.options)
    ? input.options.map(stringValue).filter(Boolean)
    : typeof input.options === 'string'
    ? input.options
        .split(/\r?\n|;|,(?=\s+\S)/)
        .map(stringValue)
        .filter(Boolean)
    : []
  const rawCorrectIndex =
    typeof input.correctIndex === 'number'
      ? input.correctIndex
      : typeof input.correctOptionIndex === 'number'
      ? input.correctOptionIndex
      : 0
  const originalAnswer =
    stringValue(input.answer) ||
    (rawCorrectIndex >= 0 && rawCorrectIndex < rawOptions.length
      ? rawOptions[rawCorrectIndex]
      : '')
  const quizOptions = uniqueByKey(rawOptions, (option) => option).slice(0, 4)
  const placeholderOptions = quizOptions.every((option) =>
    /^(?:[a-d]|option\s+[a-d]|choice\s+[a-d])$/i.test(option),
  )
  const correctIndex = quizOptions.findIndex(
    (option) => normalizeKey(option) === normalizeKey(originalAnswer),
  )
  const answer =
    originalAnswer ||
    (rawCorrectIndex >= 0 && rawCorrectIndex < quizOptions.length
      ? quizOptions[rawCorrectIndex]
      : quizOptions[0] || '')
  const finalCorrectIndex =
    correctIndex >= 0
      ? correctIndex
      : quizOptions.findIndex(
          (option) => normalizeKey(option) === normalizeKey(answer),
        )

  if (rawOptions.length !== quizOptions.length) {
    events.push(`Repaired quiz ${index + 1}: removed duplicate options.`)
  }

  if (
    options.rejectPlaceholderOptions &&
    quizOptions.length >= 3 &&
    placeholderOptions
  ) {
    events.push(`Dropped quiz ${index + 1}: placeholder options.`)
    return null
  }

  if (isBadLocalText(question)) {
    events.push(`Dropped quiz ${index + 1}: generic or weak question.`)
    return null
  }

  if (quizOptions.length > 0 && quizOptions.length < 3) {
    events.push(`Dropped quiz ${index + 1}: fewer than 3 unique options.`)
    return null
  }

  if (!question || !answer) {
    events.push(`Dropped quiz ${index + 1}: missing question or answer.`)
    return null
  }

  return {
    question,
    options: quizOptions,
    correctIndex: finalCorrectIndex >= 0 ? finalCorrectIndex : 0,
    answer,
    explanation: stringValue(input.explanation),
  }
}

const flashcardFromRecord = (
  value: unknown,
  index: number,
  events: string[],
): LocalFlashcardContract[] => {
  const input =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const rawQuestion =
    blockValue(input.question) ||
    blockValue(input.front) ||
    blockValue(input.prompt)
  const rawAnswer =
    blockValue(input.answer) ||
    blockValue(input.back) ||
    blockValue(input.definition)
  const question =
    stringValue(input.question) ||
    stringValue(input.front) ||
    stringValue(input.prompt)
  const answer =
    stringValue(input.answer) ||
    stringValue(input.back) ||
    stringValue(input.definition)

  if (!question || !answer || isBadLocalText(question)) {
    events.push(`Dropped flashcard ${index + 1}: weak prompt.`)
    return []
  }

  const combined = `${rawQuestion || question}\n${rawAnswer || answer}`
  const pairs = [
    ...combined.matchAll(
      /(?:^|\n)\s*(?:q(?:uestion)?\s*\d*[:.)-]\s*)([^\n]+)\n\s*(?:a(?:nswer)?\s*\d*[:.)-]\s*)([^\n]+)/gi,
    ),
  ]
    .map((match) => ({
      question: stringValue(match[1]),
      answer: stringValue(match[2]),
    }))
    .filter(
      (flashcard) =>
        flashcard.question &&
        flashcard.answer &&
        !isBadLocalText(flashcard.question),
    )

  if (pairs.length > 1) {
    events.push(
      `Repaired flashcard ${index + 1}: split merged question/answer pairs.`,
    )
    return pairs
  }

  return [{ question, answer }]
}

const localObjectToStudyObject = (
  input: Record<string, unknown>,
  packId: string,
  index: number,
  events: string[],
): StudyObject | null => {
  const kind = repairKind(input.kind)
  if (!kind) {
    events.push(`Dropped local object ${index + 1}: unknown kind.`)
    return null
  }

  const title = titleValue(input.title, `Study item ${index + 1}`)
  const base = createBase(packId, kind, index, title)

  if (kind === 'markdown') {
    const markdown =
      blockValue(input.markdown) ||
      blockValue(input.content) ||
      blockValue(input.body)
    if (!markdown) {
      events.push(`Dropped markdown ${index + 1}: missing markdown.`)
      return null
    }

    if (!input.markdown && (input.content || input.body)) {
      events.push(`Repaired markdown ${index + 1}: used content/body.`)
    }

    return { ...base, kind, markdown }
  }

  if (kind === 'term') {
    const term =
      stringValue(input.term) ||
      stringValue(input.title) ||
      stringValue(input.question)
    const definition =
      stringValue(input.definition) ||
      stringValue(input.answer) ||
      stringValue(input.explanation)
    if (!term || !definition || isBadConcept(term)) {
      events.push(`Dropped term ${index + 1}: weak term or missing definition.`)
      return null
    }

    return { ...base, kind, title: term, term, definition }
  }

  if (kind === 'qa') {
    const question = stringValue(input.question) || stringValue(input.front)
    const answer = stringValue(input.answer) || stringValue(input.back)
    if (!question || !answer || isBadLocalText(question)) {
      events.push(`Dropped qa ${index + 1}: weak question or missing answer.`)
      return null
    }

    return { ...base, kind, question, answer }
  }

  if (kind === 'quiz') {
    const quiz = repairLocalQuiz(input, index, events)
    if (!quiz) {
      return null
    }

    const quizOptions =
      quiz.options.length < 3
        ? [
            quiz.answer,
            'Not supported by the source notes',
            'The opposite of the source explanation',
          ].filter(Boolean)
        : quiz.options
    const quizCorrectIndex =
      quiz.options.length < 3
        ? 0
        : quiz.correctIndex

    return {
      ...base,
      kind,
      quizMode: 'multipleChoice',
      question: quiz.question,
      options: quizOptions,
      correctIndex: quizCorrectIndex,
      answer: quiz.answer,
      explanation: quiz.explanation,
    }
  }

  if (kind === 'list') {
    const items = stringArrayValue(input.items || input.content).filter(
      (item) => !isBadLocalText(item),
    )
    if (items.length === 0) {
      events.push(`Dropped list ${index + 1}: missing usable items.`)
      return null
    }

    if (!input.items && input.content) {
      events.push(`Repaired list ${index + 1}: split content into items.`)
    }

    return {
      ...base,
      kind,
      items: items.slice(0, 8),
      ordered: Boolean(input.ordered),
      checklist: Boolean(input.checklist),
    }
  }

  const prompt =
    stringValue(input.prompt) ||
    stringValue(input.content) ||
    stringValue(input.title)
  if (!prompt || isBadLocalText(prompt)) {
    events.push(`Dropped reviewPrompt ${index + 1}: weak or missing prompt.`)
    return null
  }

  if (!input.prompt && (input.content || input.title)) {
    events.push(`Repaired reviewPrompt ${index + 1}: used content/title.`)
  }

  return {
    ...base,
    kind,
    prompt,
    reason: stringValue(input.reason),
    status: 'needsReview',
  }
}

const conceptFromRecord = (
  value: unknown,
  index: number,
  events: string[],
): LocalConceptContract | null => {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const concept = stringValue(record.concept || record.title || record.term)
  const definition =
    stringValue(record.definition) ||
    stringValue(record.keyFact) ||
    stringValue(record.explanation) ||
    stringValue(record.answer)
  const keyFact =
    stringValue(record.keyFact) || stringValue(record.fact) || definition
  const example = stringValue(record.example)
  const commonConfusion =
    stringValue(record.commonConfusion) ||
    stringValue(record.commonMistake) ||
    stringValue(record.confusion)
  const sourcePhrase = stringValue(record.sourcePhrase || record.source)

  if (isBadConcept(concept) || !definition) {
    events.push(`Dropped concept ${index + 1}: weak label or definition.`)
    return null
  }

  return {
    concept,
    definition,
    keyFact,
    example,
    commonConfusion,
    sourcePhrase,
  }
}

const conceptFromText = (value: string): LocalConceptContract | null => {
  const cleaned = normalizeSpaces(value.replace(/^#{1,6}\s*/, ''))
  if (!cleaned || localBadTextPattern.test(cleaned)) {
    return null
  }

  const parts = cleaned.split(/\s*[:\-]\s+/)
  const concept =
    parts.length > 1 ? parts[0] : cleaned.split(/\s+/).slice(0, 5).join(' ')
  if (isBadConcept(concept)) {
    return null
  }

  return {
    concept,
    definition: parts.length > 1 ? parts.slice(1).join(': ') : cleaned,
    keyFact: cleaned,
    example: '',
    commonConfusion: '',
    sourcePhrase: cleaned,
  }
}

const conceptsFromRawNotes = (rawNotes: string): LocalConceptContract[] =>
  uniqueByKey(
    rawNotes
      .split(/\r?\n|(?<=[.!?])\s+/)
      .map((line) => conceptFromText(line))
      .filter((concept): concept is LocalConceptContract => Boolean(concept))
      .slice(0, 6),
    (concept) => concept.concept,
  )

const sectionsFromRecord = (
  value: unknown,
  events: string[],
): LocalSectionContract[] => {
  const records = Array.isArray(value) ? value : []

  return records
    .map((item, index): LocalSectionContract | null => {
      const record =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : {}
      const title = stringValue(record.title) || `Key ideas ${index + 1}`
      const items = stringArrayValue(
        record.items || record.bullets || record.content,
      )
        .filter((line) => !isBadLocalText(line))
        .slice(0, 6)

      if (items.length === 0) {
        events.push(`Dropped section ${index + 1}: no usable items.`)
        return null
      }

      return { title, items }
    })
    .filter((section): section is LocalSectionContract => Boolean(section))
}

const buildSummaryMarkdown = (
  title: string,
  summary: string,
  sourceSummary: string[],
  concepts: LocalConceptContract[],
): string => {
  const bullets =
    sourceSummary.length > 0
      ? sourceSummary
      : concepts.map((concept) => `${concept.concept}: ${concept.definition}`)

  return [
    `# ${title}`,
    summary,
    bullets.length > 0
      ? `## Key ideas\n${bullets
          .slice(0, 5)
          .map((item) => `- ${item}`)
          .join('\n')}`
      : '',
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n')
}

const buildRawNotesFromContract = (
  title: string,
  summary: string,
  sourceSummary: string[],
  concepts: LocalConceptContract[],
): string =>
  [
    `# ${title}`,
    summary ? `## Summary\n${summary}` : '',
    sourceSummary.length > 0
      ? `## Source summary\n${sourceSummary
          .map((item) => `- ${item}`)
          .join('\n')}`
      : '',
    concepts.length > 0
      ? `## Concepts\n${concepts
          .map((concept) => {
            const lines = [
              `### ${concept.concept}`,
              concept.definition,
              concept.keyFact ? `Key fact: ${concept.keyFact}` : '',
              concept.example ? `Example: ${concept.example}` : '',
              concept.commonConfusion
                ? `Watch for: ${concept.commonConfusion}`
                : '',
            ]
            return lines.filter(Boolean).join('\n')
          })
          .join('\n\n')}`
      : '',
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n')

const contractFromRecord = (
  record: Record<string, unknown>,
  titleFallback: string,
  rawNotesFallback: string,
  events: string[],
): LocalRepairedContract => {
  const title = stringValue(record.title) || titleFallback
  const sourceSummary = stringArrayValue(
    record.sourceSummary ||
      record.bullets ||
      (record.summary && typeof record.summary === 'object'
        ? (record.summary as Record<string, unknown>).bullets
        : undefined),
  ).filter((item) => !isBadLocalText(item))
  const concepts = uniqueByKey(
    (Array.isArray(record.concepts) ? record.concepts : [])
      .map((item, index) => conceptFromRecord(item, index, events))
      .filter((concept): concept is LocalConceptContract => Boolean(concept)),
    (concept) => concept.concept,
  )
  const summary =
    summaryString(record.summary) ||
    sourceSummary[0] ||
    concepts[0]?.definition ||
    ''
  const rawMarkdown = Array.isArray(record.objects)
    ? record.objects
        .map((item) =>
          item && typeof item === 'object'
            ? localObjectToStudyObject(
                item as Record<string, unknown>,
                'debug',
                0,
                [],
              )
            : null,
        )
        .find((object): object is Extract<StudyObject, { kind: 'markdown' }> =>
          Boolean(object && object.kind === 'markdown'),
        )?.markdown || ''
    : ''
  const rawNotes =
    blockValue(record.rawNotes) ||
    blockValue(record.notes) ||
    rawMarkdown ||
    rawNotesFallback ||
    buildRawNotesFromContract(title, summary, sourceSummary, concepts)
  const repairedConcepts =
    concepts.length > 0 ? concepts : conceptsFromRawNotes(rawNotes)

  if (typeof record.summary === 'object' && record.summary) {
    events.push('Repaired summary: converted object to text.')
  }

  if (!blockValue(record.rawNotes) && rawNotes) {
    events.push('Repaired rawNotes: derived from Local AI content.')
  }

  return {
    title,
    summary,
    rawNotes,
    sourceSummary,
    concepts: repairedConcepts,
    sections: sectionsFromRecord(record.sections || record.lists, events),
    quizzes: (Array.isArray(record.quizzes) ? record.quizzes : [])
      .map((item, index) =>
        item && typeof item === 'object'
          ? repairLocalQuiz(item as Record<string, unknown>, index, events)
          : null,
      )
      .filter((quiz): quiz is LocalQuizContract => Boolean(quiz)),
    flashcards: (Array.isArray(record.flashcards)
      ? record.flashcards
      : []
    ).flatMap((item, index) => flashcardFromRecord(item, index, events)),
  }
}

const conceptQuestion = (
  concept: LocalConceptContract,
  index: number,
): string => {
  if (
    /\b(dalton|democritus|thomson|rutherford|bohr|scientist|theory)\b/i.test(
      `${concept.concept} ${concept.definition}`,
    )
  ) {
    return `What did ${concept.concept} contribute or explain?`
  }

  if (
    /\b(spanish|french|b1|tense|conjugat|verb|subjunctive|preterite|imperfect)\b/i.test(
      `${concept.concept} ${concept.definition}`,
    )
  ) {
    return `When would you use ${concept.concept} in context?`
  }

  return index % 2 === 0
    ? `What is the key idea behind ${concept.concept}?`
    : `How would you explain ${concept.concept} in your own words?`
}

const rotateOptions = (
  options: string[],
  correctAnswer: string,
  index: number,
): { options: string[]; correctIndex: number } => {
  const uniqueOptions = uniqueByKey(options, (option) => option).slice(0, 4)
  const correctIndex = uniqueOptions.findIndex(
    (option) => normalizeKey(option) === normalizeKey(correctAnswer),
  )
  if (correctIndex < 0 || uniqueOptions.length < 3) {
    return { options: [], correctIndex: 0 }
  }

  const offset = index % uniqueOptions.length
  const rotated = [
    ...uniqueOptions.slice(offset),
    ...uniqueOptions.slice(0, offset),
  ]

  return {
    options: rotated,
    correctIndex: rotated.findIndex(
      (option) => normalizeKey(option) === normalizeKey(correctAnswer),
    ),
  }
}

const conceptQuiz = (
  packId: string,
  concept: LocalConceptContract,
  index: number,
  concepts: LocalConceptContract[] = [],
): StudyObject => {
  const optionSet = rotateOptions(
    [
      concept.definition,
      ...concepts
        .filter(
          (candidate) =>
            normalizeKey(candidate.concept) !== normalizeKey(concept.concept),
        )
        .map((candidate) => candidate.definition),
    ],
    concept.definition,
    index,
  )
  const fallbackOptions = [
    concept.definition,
    'Not supported by this material',
    'The opposite of the lesson explanation',
  ].filter(Boolean)
  const quizOptions =
    optionSet.options.length >= 3 ? optionSet.options : fallbackOptions

  return {
    ...createBase(packId, 'quiz', index, `${concept.concept} practice`),
    kind: 'quiz',
    quizMode: 'multipleChoice',
    question: `In this material, what does "${concept.concept}" mean or do?`,
    options: quizOptions,
    correctIndex: optionSet.options.length >= 3 ? optionSet.correctIndex : 0,
    answer: concept.keyFact || concept.definition,
    explanation: concept.definition,
  }
}

const conceptFlashcard = (
  packId: string,
  concept: LocalConceptContract,
  index: number,
): StudyObject => ({
  ...createBase(packId, 'flashcard', index, `${concept.concept} flashcard`),
  kind: 'qa',
  question: conceptQuestion(concept, index),
  answer: concept.definition,
})

const localResourceLimits: Record<
  Exclude<StudyMaterialResourceType, 'improvedNotes'>,
  Record<StudyMaterialDetailLevel, { min: number; max: number }>
> = {
  flashcards: {
    short: { min: 3, max: 5 },
    medium: { min: 6, max: 9 },
    long: { min: 12, max: 18 },
  },
  quiz: {
    short: { min: 3, max: 4 },
    medium: { min: 4, max: 6 },
    long: { min: 8, max: 13 },
  },
}

const getLocalResourceLimits = (
  options: NormalizeAiStudyPackDraftOptions,
): { min: number; max: number } | null => {
  if (
    options.resourceType !== 'flashcards' &&
    options.resourceType !== 'quiz'
  ) {
    return null
  }

  return localResourceLimits[options.resourceType][
    options.detailLevel || 'medium'
  ]
}

const objectsFromContract = (
  contract: LocalRepairedContract,
  packId: string,
  events: string[],
  options: NormalizeAiStudyPackDraftOptions = {},
): StudyObject[] => {
  const sourceSummary = Array.isArray(contract.sourceSummary)
    ? contract.sourceSummary
    : []
  const concepts = Array.isArray(contract.concepts) ? contract.concepts : []
  const sections = Array.isArray(contract.sections) ? contract.sections : []
  const quizzes = Array.isArray(contract.quizzes) ? contract.quizzes : []
  const flashcards = Array.isArray(contract.flashcards)
    ? contract.flashcards
    : []
  const limits = getLocalResourceLimits(options)
  const quizMax = options.resourceType === 'quiz' ? limits?.max || 6 : 6
  const flashcardMax =
    options.resourceType === 'flashcards' ? limits?.max || 5 : 5
  const quizMin = options.resourceType === 'quiz' ? limits?.min || 3 : 3
  const flashcardMin =
    options.resourceType === 'flashcards' ? limits?.min || 3 : 3
  const objects: StudyObject[] = [
    {
      ...createBase(packId, 'markdown', 0, 'Source summary'),
      kind: 'markdown',
      markdown: buildSummaryMarkdown(
        contract.title || 'Study Pack',
        contract.summary,
        sourceSummary,
        concepts,
      ),
    },
  ]

  sections.slice(0, 4).forEach((section, index) => {
    objects.push({
      ...createBase(packId, 'list', index, section.title),
      kind: 'list',
      items: section.items,
      ordered: false,
      checklist: false,
    })
  })

  if (sections.length === 0 && concepts.length > 0) {
    objects.push({
      ...createBase(packId, 'list', 0, 'Key concepts'),
      kind: 'list',
      items: concepts
        .slice(0, 6)
        .map((concept) => `${concept.concept}: ${concept.definition}`),
      ordered: false,
      checklist: false,
    })
    events.push('Repaired sections: created Key concepts list.')
  }

  quizzes.slice(0, quizMax).forEach((quiz, index) => {
    const quizOptions =
      quiz.options.length < 3
        ? [
            quiz.answer,
            'Not supported by the source notes',
            'The opposite of the source explanation',
          ].filter(Boolean)
        : quiz.options
    const quizCorrectIndex =
      quiz.options.length < 3
        ? 0
        : quiz.correctIndex

    objects.push({
      ...createBase(packId, 'quiz', index, `Quiz ${index + 1}`),
      kind: 'quiz',
      quizMode: 'multipleChoice',
      question: quiz.question,
      options: quizOptions,
      correctIndex: quizCorrectIndex,
      answer: quiz.answer,
      explanation: quiz.explanation,
    })
  })

  flashcards.slice(0, flashcardMax).forEach((flashcard, index) => {
    objects.push({
      ...createBase(packId, 'flashcard', index, `Flashcard ${index + 1}`),
      kind: 'qa',
      question: flashcard.question,
      answer: flashcard.answer,
    })
  })

  const usableConcepts = concepts.filter(
    (concept) => !isBadConcept(concept.concept),
  )
  while (
    objects.filter((object) => object.kind === 'quiz').length < quizMin &&
    usableConcepts.length > 0
  ) {
    const index = objects.filter((object) => object.kind === 'quiz').length
    const quiz = conceptQuiz(
      packId,
      usableConcepts[index % usableConcepts.length],
      index,
      usableConcepts,
    )
    objects.push(quiz)
    events.push('Augmented Local AI output: added concept quiz.')
  }

  while (
    objects.filter((object) => object.kind === 'qa').length < flashcardMin &&
    usableConcepts.length > 0
  ) {
    const index = objects.filter((object) => object.kind === 'qa').length
    objects.push(
      conceptFlashcard(
        packId,
        usableConcepts[index % usableConcepts.length],
        index,
      ),
    )
    events.push('Augmented Local AI output: added concept flashcard.')
  }

  return objects
}

export const normalizeLocalAiStudyPackDraft = (
  value: unknown,
  packId: string,
  options: NormalizeAiStudyPackDraftOptions = {},
): AiStudyPackDraft => {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const events: string[] = []
  const rawObjects = Array.isArray(record.objects)
    ? record.objects
    : Array.isArray(record.studyObjects)
    ? record.studyObjects
    : []
  const looseObjects = rawObjects
    .map((item, index) =>
      item && typeof item === 'object'
        ? localObjectToStudyObject(
            item as Record<string, unknown>,
            packId,
            index,
            events,
          )
        : null,
    )
    .filter((object): object is StudyObject => Boolean(object))

  if (rawObjects.length > 0) {
    if (looseObjects.length === 0) {
      events.push('Google Local AI did not return any usable study objects.')
    }

    return {
      title:
        typeof record.title === 'string' && record.title.trim()
          ? normalizeSpaces(record.title)
          : undefined,
      sourceFormat: 'text' as StudyPackSourceFormat,
      rawNotes:
        blockValue(record.rawNotes) ||
        blockValue(record.notes) ||
        blockValue(record.markdown) ||
        options.rawNotes ||
        '',
      dashboardRole: options.dashboardRole,
      objects: looseObjects,
      warnings:
        looseObjects.length === 0 ? ['No usable Local AI objects found.'] : [],
      debugTrace: {
        rawAiResponse: options.rawAiResponse || JSON.stringify(value, null, 2),
        validatedContract: record,
        roleFilteredContract: record,
        droppedOrRepairedItems: events,
        finalObjects: looseObjects,
      },
    }
  }

  const contract = contractFromRecord(
    record,
    'Study Pack',
    options.rawNotes || '',
    events,
  )
  const contractObjects = objectsFromContract(contract, packId, events, options)
  const objects = uniqueByKey(
    [...contractObjects, ...looseObjects],
    (object) =>
      object.kind === 'markdown'
        ? `${object.kind}:${object.title}`
        : JSON.stringify(object),
  )

  if (objects.length === 0) {
    events.push('Google Local AI did not return any usable study objects.')
  }

  return {
    title: contract.title,
    sourceFormat: 'text' as StudyPackSourceFormat,
    rawNotes: contract.rawNotes,
    dashboardRole: options.dashboardRole,
    objects,
    warnings: objects.length === 0 ? ['No usable Local AI objects found.'] : [],
    debugTrace: {
      rawAiResponse: options.rawAiResponse || JSON.stringify(value, null, 2),
      validatedContract: contract,
      roleFilteredContract: contract,
      droppedOrRepairedItems: events,
      finalObjects: objects,
    },
  }
}

const LOCAL_STUDY_PATH_DASHBOARD_COUNT = 3

const localStudyPackPrompt = ({
  title,
  rawNotes,
  resourceType,
  detailLevel = 'medium',
  quizQuestionStyle = 'mixed',
  promptMode = false,
}: GenerateStudyPackWithAiOptions): string => {
  const compactNotes = rawNotes.replace(/\s+/g, ' ').trim().slice(0, 1800)
  const flashcardCount =
    detailLevel === 'short' ? '3-4' : detailLevel === 'long' ? '12-18' : '6-9'
  const quizCount =
    detailLevel === 'short' ? '3-4' : detailLevel === 'long' ? '8-13' : '4-6'
  const localHardRule =
    'The selected detail level is a hard constraint. Match this count or length as closely as possible. Do not ignore it.'
  const quizStyleRule =
    quizQuestionStyle === 'conceptual'
      ? 'Style preference: Conceptual. Prioritize why/how, comparison, cause/effect, inference, and common-mistake questions.'
      : quizQuestionStyle === 'examLike'
      ? 'Style preference: Exam-like. Use realistic assessment-style questions with plausible distractors and applied scenarios.'
      : 'Style preference: Mixed. Balance recall with reasoning, conceptual understanding, applied scenarios, and common mistakes.'
  const resourceRules =
    resourceType === 'improvedNotes'
      ? `Create one "Expand on this" resource. Allowed kind only: markdown.
Use this shape:
{"title":"${title.replace(
          /"/g,
          '',
        )}","objects":[{"kind":"markdown","title":"Expand on this","markdown":"Clear organized Markdown with headings and bullets"}]}
Rules: one markdown object only. No quizzes. No flashcards. ${localHardRule} ${
          detailLevel === 'short'
            ? 'Keep it concise.'
            : detailLevel === 'long'
            ? 'Include deeper explanations and examples.'
            : 'Use balanced detail.'
        }`
      : resourceType === 'flashcards'
      ? `Create ${flashcardCount} flashcards. Allowed kind only: qa.
Use this shape:
{"title":"${title.replace(
          /"/g,
          '',
        )}","objects":[{"kind":"qa","question":"...","answer":"..."}]}
Rules: qa objects only. No markdown. No quizzes. Each flashcard must test exactly one term, rule, formula step, contrast, exception, or use case. Answers must be self-contained and teach the idea, not one-word fragments. ${localHardRule}`
      : resourceType === 'quiz'
      ? `Create ${quizCount} quiz questions. Allowed kind only: quiz.
Use this shape:
{"title":"${title.replace(
          /"/g,
          '',
        )}","objects":[{"kind":"quiz","question":"...","quizMode":"multipleChoice","options":["A","B","C"],"correctIndex":0,"answer":"A","explanation":"why"}]}
Rules: quiz objects only. Every quiz must be multipleChoice with 3-4 real options. No shortAnswer, typed-answer, quizSingle, free-response, markdown, or flashcards. Options must be real choices, not placeholders. Never use A/B/C, option A, all of the above, duplicate choices, or source-sentence copies. ${localHardRule} ${quizStyleRule} Preferably don't copy source sentences.`
      : `Create exactly 6 simple study objects from the source.
Allowed kinds only: markdown, qa, quiz, list.
Use this shape:
{"title":"${title.replace(
          /"/g,
          '',
        )}","objects":[{"kind":"markdown","title":"Explanation","markdown":"2-4 short sentences"},{"kind":"qa","question":"...","answer":"..."},{"kind":"qa","question":"...","answer":"..."},{"kind":"quiz","question":"...","quizMode":"multipleChoice","options":["A","B","C"],"correctIndex":0,"answer":"A","explanation":"why"},{"kind":"quiz","question":"...","quizMode":"multipleChoice","options":["A","B","C"],"correctIndex":0,"answer":"A","explanation":"why"},{"kind":"list","title":"Key points","items":["...","...","..."]}]}`

  return `Return JSON only. No prose. No markdown fences.
${resourceRules}
Quality rules:
- Extract real concepts first. Ignore headings like Goal, Example, Practice, Overview, Active, Target rule, Formation rule.
- No vague questions. No "What do the notes say?", "Which statement matches the notes?", or copied source sentences.
- Use concrete prompts grounded in the material. Prefer conceptual understanding, applied scenarios, comparison, cause/effect, inference, and common-mistake question styles where possible.
- If source is thin, still create useful material from the strongest grounded facts instead of returning generic filler.
Input: ${promptMode ? 'learning goal' : 'source notes'}
${compactNotes}`
}

const localStudyPathPlannerPrompt = (
  options: GenerateStudyPathWithAiOptions,
  count: number,
): string => {
  const { title, prompt } = options
  const compactPrompt = prompt.replace(/\s+/g, ' ').trim().slice(0, 800)

  return `Return JSON only. Start with { and end with }.

Plan a Study Guide with exactly ${count} lesson dashboards for "${title}".

Shape:
{"title":"...","folderName":"...","dashboards":[{"title":"01 - ...","goal":"...","sections":[{"title":"...","goal":"...","focus":"...; ...; ..."},{"title":"...","goal":"...","focus":"...; ...; ..."}],"avoid":"...; ..."}]}

Topic:
${compactPrompt}

Rules:
- Return exactly one JSON object.
- dashboards must contain exactly ${count} dashboards.
- Every dashboard title must start with 01 -, 02 -, etc.
- Each dashboard must have exactly 2 sections.
- Each section has only title, goal, and focus.
- focus is one string with exactly 3 short topics separated by semicolons.
- avoid is one string with exactly 2 short topics separated by semicolons.
- No lesson content.
- No quizzes.
- No flashcards.
- No markdown.
- No code fences.
- No explanations outside JSON.
- Use short strings.`
}

const localStudyPathMarkdownWordTarget = (attempt: number): string => {
  if (attempt === 1) {
    return '80-100 words'
  }

  if (attempt === 2) {
    return '60-80 words'
  }

  return '40-60 words'
}

const localStudyPathMarkdownSectionPrompt = (
  options: GenerateStudyPathWithAiOptions,
  outline: LocalStudyPathPlanItem[],
  item: LocalStudyPathPlanItem,
  section: LocalStudyPathPlanSection,
  sectionIndex: number,
  attempt: number,
): string => {
  const compactPrompt = options.prompt.replace(/\s+/g, ' ').trim().slice(0, 900)
  const outlineTitles = outline.map((entry) => entry.title).join(' | ')
  const wordTarget = localStudyPathMarkdownWordTarget(attempt)
  const role =
    sectionIndex === 0
      ? 'core explanation, rules, and meaning'
      : 'examples, usage, and common mistakes'
  const structure =
    sectionIndex === 0
      ? `Recommended structure:
## ${section.title}

### Core meanings
- ...
- ...
- ...

### When to use each one
- **Concept 1**: ...
- **Concept 2**: ...
- **Concept 3**: ...`
      : `Recommended structure:
## ${section.title}

### Mini examples
- **Example 1** = ...
- **Example 2** = ...
- **Example 3** = ...

### Common mistakes
- ...
- ...`
  const attemptRule =
    attempt === 1
      ? 'Use full structured Markdown with short bullets.'
      : attempt === 2
      ? 'Use simpler structured Markdown with fewer bullets.'
      : 'Survival mode: write the shortest usable structured Markdown.'

  return `Return Markdown only.
No JSON. No code fences.
Start exactly with this heading:
## ${section.title}

Write ${role} for "${item.title}" in "${options.title}".
Target length: around ${wordTarget}.
${attemptRule}

Rules:
- Return Markdown only.
- No JSON.
- No code fences.
- Do not mention dashboard, study guide, lesson, concepts, part 1, or part 2.
- Do not write Goal:.
- Do not add a generic intro.
- Do not add a conclusion.
- Prefer bullets, short sections, and small lists.
- Write only in the user's request language.
- Use the target language only for examples, vocabulary, and short phrases.
- Keep grammar explanations simple and safe.
- Do not teach beginner introductions if the requested level is B1/B2 or higher.

${structure}

Study path topic: ${compactPrompt}
Outline titles: ${outlineTitles}
Current page goal: ${item.goal}
Current section title: ${section.title}
Current section goal: ${section.goal}
Section focus: ${section.focus || ''}
Avoid: ${item.avoid.join(', ')}
Use the section focus topics as anchors. If there are 3 topics, cover each one once.`
}

const localStudyPathPracticePromptBase = (
  options: GenerateStudyPathWithAiOptions,
  outline: LocalStudyPathPlanItem[],
  item: LocalStudyPathPlanItem,
  notes: string,
): string => {
  const compactPrompt = options.prompt.replace(/\s+/g, ' ').trim().slice(0, 900)
  const outlineTitles = outline.map((entry) => entry.title).join(' | ')
  const compactNotes = notes.replace(/\s+/g, ' ').trim().slice(0, 1800)

  return `Topic: ${compactPrompt}
Outline titles: ${outlineTitles}
Goal: ${item.goal}
Topics: ${item.topics.join(', ')}
Avoid: ${item.avoid.join(', ')}
Lesson notes:
${compactNotes}`
}

const localStudyPathFlashcardsPrompt = (
  options: GenerateStudyPathWithAiOptions,
  outline: LocalStudyPathPlanItem[],
  item: LocalStudyPathPlanItem,
  notes: string,
  attempt: number,
): string => `Return minified JSON only. End with }.
Create flashcards from these exact lesson notes. Attempt ${attempt} of ${LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS} for "${
  item.title
}" in "${options.title}".
Shape:
{"flashcards":[{"question":"...","answer":"..."}]}
Rules: JSON only. No notes field. No prose outside JSON. Ask for ${
  attempt === 1 ? '2 flashcards' : '1 flashcard'
}; smaller valid output is better than broken JSON.
Practice must be answerable from the notes. Do not merge multiple flashcards into one object; each flashcard must have exactly one question and one answer.
${localStudyPathPracticePromptBase(options, outline, item, notes)}`

const localStudyPathQuizzesPrompt = (
  options: GenerateStudyPathWithAiOptions,
  outline: LocalStudyPathPlanItem[],
  item: LocalStudyPathPlanItem,
  notes: string,
  attempt: number,
): string => `Return minified JSON only. End with }.
Create quizzes from these exact lesson notes. Attempt ${attempt} of ${LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS} for "${
  item.title
}" in "${options.title}".
Shape:
{"quizzes":[{"question":"...","options":["...","...","..."],"correctIndex":0}]}
Rules: JSON only. No notes field. No prose outside JSON. Ask for ${
  attempt === 1 ? '1-2 quizzes' : '1 quiz'
}; smaller valid output is better than broken JSON.
Practice must be answerable from the notes.
Quiz options must be real answer choices, not A/B/C placeholders. Avoid duplicate options. correctIndex must point to the right option.
${localStudyPathPracticePromptBase(options, outline, item, notes)}`

export const generateStudyPackWithLocalAi = async (
  options: GenerateStudyPackWithAiOptions,
  localOptions: LocalGenerationOptions = {},
): Promise<AiStudyPackDraft> => {
  const prompt = localStudyPackPrompt(options)
  let lastError: unknown

  for (
    let attempt = 1;
    attempt <= LOCAL_STUDY_PACK_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const text = await callLocalLanguageModel(prompt, {
        timeoutMs: LOCAL_STUDY_PACK_TIMEOUT_MS,
        onProgress: localOptions.onProgress,
        progressLabel:
          attempt === 1
            ? 'Estimated Local AI generation time'
            : `Retrying Local AI generation (${attempt}/${LOCAL_STUDY_PACK_MAX_ATTEMPTS})`,
        signal: localOptions.signal,
        promptType: 'study-pack',
        stepLabel: options.title,
        attempt,
        attemptCount: LOCAL_STUDY_PACK_MAX_ATTEMPTS,
      })
      const parsed = parseLocalAiJson(text)
      const draft = applyStudyMaterialResourceTypeToDraft(
        normalizeLocalAiStudyPackDraft(parsed, options.packId, {
          rawNotes: options.rawNotes,
          rawAiResponse: text,
          resourceType: options.resourceType,
          detailLevel: options.detailLevel,
        }),
        options.packId,
        options.resourceType,
      )
      const limits = getLocalResourceLimits({
        resourceType: options.resourceType,
        detailLevel: options.detailLevel,
      })

      return {
        ...draft,
        objects: limits ? draft.objects.slice(0, limits.max) : draft.objects,
        title: draft.title || options.title,
        sourceFormat: draft.sourceFormat || 'text',
      }
    } catch (error) {
      lastError = error
      if (
        localOptions.signal?.aborted ||
        attempt === LOCAL_STUDY_PACK_MAX_ATTEMPTS ||
        !localAiStudyPackFailureIsRetryable(error)
      ) {
        break
      }

      await waitForLocalAiRetryCooldownIfNeeded(error)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Google Local AI failed before returning a response.')
}

const firstMarkdownObject = (objects: StudyObject[]): StudyObject | undefined =>
  objects.find((object) => object.kind === 'markdown')

const ensureFirstMarkdown = (
  objects: StudyObject[],
  packId: string,
  title: string,
  markdown: string,
  events: string[],
): StudyObject[] => {
  if (objects[0]?.kind === 'markdown') {
    return [
      {
        ...objects[0],
        title: 'Lesson notes',
        markdown: sanitizeLocalLessonNotesMarkdown(objects[0].markdown),
      },
      ...objects.slice(1),
    ]
  }

  const existingMarkdown = firstMarkdownObject(objects)
  const otherObjects = objects.filter((object) => object !== existingMarkdown)
  const markdownObject =
    existingMarkdown ||
    ({
      ...createBase(packId, 'markdown', 0, 'Lesson explanation'),
      kind: 'markdown',
      markdown: sanitizeLocalLessonNotesMarkdown(
        markdown || `# ${title}\n\nReview this lesson before practice.`,
      ),
    } as StudyObject)

  if (!existingMarkdown) {
    events.push('Repaired dashboard: added first markdown explanation.')
  }

  return [markdownObject, ...otherObjects]
}

const sanitizeLocalLessonNotesMarkdown = (markdown: string): string =>
  normalizeBlock(
    markdown
      .replace(/^```(?:json|markdown|md)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .replace(/^goal\s*:.*$/gim, '')
      .replace(
        /^#{1,6}\s*Validation and Cleanup\b[\s\S]*?(?=^#{1,6}\s|$(?![\s\S]))/gim,
        '',
      ),
  )
    .replace(/^(#{1,6}\s*)Summary\b/gim, '$1Lesson notes')
    .replace(/^(#{1,6}\s*)Source summary\b/gim, '$1Source notes')

const stripLocalPracticeSectionsFromNotes = (markdown: string): string => {
  const practiceStart = markdown.search(
    /^#{1,6}\s*(?:(?:practice\s+(?:questions?|exercises?|tasks?))|quiz|quizzes|flashcards?)\b|^\*{0,2}(?:quiz|flashcard)\s*\d*\*{0,2}\s*:/im,
  )

  return sanitizeLocalLessonNotesMarkdown(
    practiceStart >= 0 ? markdown.slice(0, practiceStart) : markdown,
  ).trim()
}

const cleanLocalStudyPathSectionMarkdown = (
  markdown: string,
  requiredHeading: string,
): string => {
  const cleaned = sanitizeLocalLessonNotesMarkdown(markdown)
  if (/^\s*[\[{]/.test(cleaned)) {
    throw new LocalAiGenerationError(
      'noUsableObjects',
      LOCAL_STUDY_PATH_NO_USABLE_OBJECTS_MESSAGE,
      {
        debug: {
          mappingError: 'Local AI returned JSON instead of Markdown notes.',
        },
      },
    )
  }

  if (!cleaned.startsWith(requiredHeading)) {
    throw new LocalAiGenerationError(
      'noUsableObjects',
      LOCAL_STUDY_PATH_NO_USABLE_OBJECTS_MESSAGE,
      {
        debug: {
          mappingError: `Local AI Markdown did not start with ${requiredHeading}.`,
        },
      },
    )
  }

  return cleaned
}

const wordCount = (value: string): number =>
  value.split(/\s+/).filter(Boolean).length

const previewSummaryFromNotes = (notes: string, fallback: string): string => {
  const cleaned = normalizeSpaces(notes.replace(/^#{1,6}\s*/gm, ''))
  const sentence = cleaned.match(/^[^.!?]+[.!?]/)?.[0]

  return normalizeSpaces(sentence || cleaned).slice(0, 180) || fallback
}

const isLocalRepairedContract = (
  value: unknown,
): value is LocalRepairedContract => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<Record<keyof LocalRepairedContract, unknown>>

  return (
    Array.isArray(record.sourceSummary) &&
    Array.isArray(record.concepts) &&
    Array.isArray(record.sections) &&
    Array.isArray(record.quizzes) &&
    Array.isArray(record.flashcards)
  )
}

const fallbackContractFromDashboard = (
  title: string,
  summary: string,
  rawNotes: string,
): LocalRepairedContract => ({
  title,
  summary,
  rawNotes,
  sourceSummary: [],
  concepts: conceptsFromRawNotes(rawNotes),
  sections: [],
  quizzes: [],
  flashcards: [],
})

const flatDashboardObjects = (
  record: Record<string, unknown>,
  packId: string,
  title: string,
  rawNotes: string,
  events: string[],
): StudyObject[] => {
  const objects: StudyObject[] = []
  const markdown =
    blockValue(record.notes) ||
    rawNotes ||
    blockValue(record.markdown) ||
    blockValue(record.explanation) ||
    blockValue(record.content)

  if (markdown || rawNotes) {
    objects.push({
      ...createBase(packId, 'markdown', 0, 'Lesson notes'),
      kind: 'markdown',
      markdown: sanitizeLocalLessonNotesMarkdown(
        markdown || rawNotes || `# ${title}`,
      ),
    })
  }

  const flashcards = Array.isArray(record.flashcards) ? record.flashcards : []
  flashcards
    .flatMap((item, index) => flashcardFromRecord(item, index, events))
    .slice(0, 4)
    .forEach((flashcard, index) => {
      objects.push({
        ...createBase(packId, 'qa', index, `Flashcard ${index + 1}`),
        kind: 'qa',
        question: flashcard.question,
        answer: flashcard.answer,
      })
    })

  const qaQuestion = stringValue(
    record.qaQ || record.qaQuestion || record.question,
  )
  const qaAnswer = stringValue(record.qaA || record.qaAnswer || record.answer)
  if (qaQuestion && qaAnswer && !isBadLocalText(qaQuestion)) {
    objects.push({
      ...createBase(packId, 'qa', flashcards.length, 'Check understanding'),
      kind: 'qa',
      question: qaQuestion,
      answer: qaAnswer,
    })
  }

  const quizzes = Array.isArray(record.quizzes) ? record.quizzes : []
  quizzes.slice(0, 4).forEach((item, index) => {
    const input =
      item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const quiz = repairLocalQuiz(input, index, events, {
      rejectPlaceholderOptions: true,
    })
    if (!quiz) {
      return
    }

    if (quiz.options.length < 3) {
      events.push(`Dropped quiz ${index + 1}: fewer than 3 unique options.`)
      return
    }

    objects.push({
      ...createBase(packId, 'quiz', index, `Quiz ${index + 1}`),
      kind: 'quiz',
      quizMode: 'multipleChoice',
      question: quiz.question,
      options: quiz.options,
      correctIndex: quiz.correctIndex,
      answer: quiz.answer,
      explanation: quiz.explanation,
    })
  })

  const quizQuestion = stringValue(record.quizQ || record.quizQuestion)
  const quizOptions = stringArrayValue(record.quizOptions || record.options)
  const quizCorrectIndex =
    typeof record.quizCorrectIndex === 'number'
      ? record.quizCorrectIndex
      : typeof record.correctIndex === 'number'
      ? record.correctIndex
      : 0
  const quizAnswer =
    quizCorrectIndex >= 0 && quizCorrectIndex < quizOptions.length
      ? quizOptions[quizCorrectIndex]
      : quizOptions[0] || ''
  const quiz = repairLocalQuiz(
    {
      question: quizQuestion,
      options: quizOptions,
      correctIndex: quizCorrectIndex,
      answer: quizAnswer || stringValue(record.quizAnswer),
      explanation:
        stringValue(record.quizExplanation) ||
        (quizAnswer ? `Correct answer: ${quizAnswer}` : ''),
    },
    0,
    events,
    { rejectPlaceholderOptions: true },
  )
  if (quiz && quiz.options.length >= 3) {
    objects.push({
      ...createBase(packId, 'quiz', quizzes.length, 'Practice question'),
      kind: 'quiz',
      quizMode: 'multipleChoice',
      question: quiz.question,
      options: quiz.options,
      correctIndex: quiz.correctIndex,
      answer: quiz.answer,
      explanation: quiz.explanation,
    })
  }

  if (objects.length > 0) {
    events.push(
      'Mapped Local AI notes and recall dashboard shape into study objects.',
    )
  }

  return objects
}

const hasMeaningfulDashboardInput = (
  record: Record<string, unknown>,
): boolean => {
  if (wordCount(blockValue(record.rawNotes)) >= 5) {
    return true
  }

  if (wordCount(blockValue(record.notes)) >= 5) {
    return true
  }

  if (wordCount(summaryString(record.summary)) >= 5) {
    return true
  }

  if (
    blockValue(record.markdown) ||
    (stringValue(record.qaQ) && stringValue(record.qaA)) ||
    (stringValue(record.qaQuestion) && stringValue(record.qaAnswer)) ||
    stringValue(record.quizQ) ||
    stringValue(record.quizQuestion) ||
    stringArrayValue(record.listItems).length > 0
  ) {
    return true
  }

  if (stringArrayValue(record.sourceSummary).length > 0) {
    return true
  }

  if (
    (Array.isArray(record.concepts) ? record.concepts : []).some((item) =>
      Boolean(conceptFromRecord(item, 0, [])),
    )
  ) {
    return true
  }

  if (
    (Array.isArray(record.quizzes) ? record.quizzes : []).some((item) =>
      item && typeof item === 'object'
        ? Boolean(repairLocalQuiz(item as Record<string, unknown>, 0, []))
        : false,
    )
  ) {
    return true
  }

  if (
    (Array.isArray(record.flashcards) ? record.flashcards : []).some((item) => {
      const input =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : {}
      const question =
        stringValue(input.question) ||
        stringValue(input.front) ||
        stringValue(input.prompt)
      const answer =
        stringValue(input.answer) ||
        stringValue(input.back) ||
        stringValue(input.definition)

      return Boolean(question && answer && !isBadLocalText(question))
    })
  ) {
    return true
  }

  return false
}

const mapLocalDashboard = (
  input: unknown,
  index: number,
  options: GenerateStudyPathWithAiOptions,
  rawAiResponse: string,
  role: StudyPathDashboardRole,
  targetCount: number,
  plannerItem?: LocalStudyPathPlanItem,
  mapOptions: { allowPracticeFallback?: boolean } = {},
): AiStudyPathDashboardDraft | null => {
  const record =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const title =
    plannerItem?.title ||
    stringValue(record.title) ||
    `${String(index + 1).padStart(2, '0')} - Lesson ${index + 1}`
  const packId = `${options.title}-${index + 1}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
  const draft = normalizeLocalAiStudyPackDraft(record, packId, {
    rawNotes: blockValue(record.rawNotes) || blockValue(record.notes),
    rawAiResponse,
    dashboardRole: role,
  })
  const events = [...(draft.debugTrace?.droppedOrRepairedItems || [])]
  if (draft.objects.length === 0 && !hasMeaningfulDashboardInput(record)) {
    return null
  }

  const rawNotes =
    blockValue(record.rawNotes) ||
    blockValue(record.notes) ||
    draft.rawNotes ||
    summaryString(record.summary) ||
    ''
  const summary =
    summaryString(record.summary) ||
    previewSummaryFromNotes(rawNotes, title || 'Generated local AI lesson.')
  const practiceType: StudyPathPracticeType = 'quiz'
  const contract = isLocalRepairedContract(draft.debugTrace?.validatedContract)
    ? draft.debugTrace.validatedContract
    : fallbackContractFromDashboard(title, summary, rawNotes)
  const flatObjects = flatDashboardObjects(
    record,
    packId,
    title,
    rawNotes,
    events,
  )
  const flatHasQa = flatObjects.some((object) => object.kind === 'qa')
  const flatHasQuiz = flatObjects.some((object) => object.kind === 'quiz')
  const draftRecallObjects = draft.objects.filter(
    (object) =>
      mapOptions.allowPracticeFallback !== false &&
      object.kind !== 'markdown' &&
      object.kind !== 'list' &&
      (object.kind === 'qa' || object.kind === 'quiz'),
  )
  let addedFallbackQa = flatHasQa
  let addedFallbackQuiz = flatHasQuiz
  const sourceObjects = [
    ...flatObjects,
    ...draftRecallObjects.filter((object) => {
      if (object.kind === 'qa') {
        if (addedFallbackQa) {
          return false
        }

        addedFallbackQa = true
        return true
      }

      if (object.kind === 'quiz') {
        if (addedFallbackQuiz) {
          return false
        }

        addedFallbackQuiz = true
        return true
      }

      return false
    }),
  ]
  const markdownObjects = ensureFirstMarkdown(
    sourceObjects.length > 0 ? sourceObjects : draft.objects,
    packId,
    title,
    buildRawNotesFromContract(
      title,
      summary,
      Array.isArray(contract.sourceSummary) ? contract.sourceSummary : [],
      Array.isArray(contract.concepts) ? contract.concepts : [],
    ) || rawNotes,
    events,
  )
  let keptMarkdown = false
  const finalObjects = markdownObjects
    .filter((object) => {
      if (object.kind === 'list') {
        return false
      }

      if (object.kind !== 'markdown') {
        return true
      }

      if (keptMarkdown) {
        events.push('Dropped extra Local AI markdown object.')
        return false
      }

      keptMarkdown = true
      return true
    })
    .slice(0, Math.max(targetCount, 6))

  if (finalObjects.length === 0 && !rawNotes) {
    return null
  }

  return {
    ...draft,
    title,
    summary,
    rawNotes,
    dashboardRole: role,
    dashboardPurpose: 'lesson',
    practiceType,
    layoutReason: 'Local AI generated a simple lesson with optional practice.',
    sourceFormat: 'text',
    objects: finalObjects,
    debugTrace: draft.debugTrace
      ? {
          ...draft.debugTrace,
          rawDashboardInput: record,
          roleSanitizedInput: contract,
          validatedContract: contract,
          droppedOrRepairedItems: events,
          finalObjects,
        }
      : draft.debugTrace,
  }
}

const specificFolderName = (
  value: string,
  fallback: string,
  prompt: string,
): string => {
  const candidate = normalizeSpaces(value)
  if (candidate && !genericFolderNames.has(normalizeKey(candidate))) {
    return candidate
  }

  const languageLevel = prompt.match(
    /\b(english|spanish|french|german|italian|portuguese|japanese|korean|chinese|arabic|dutch|swedish|norwegian|danish|polish|russian)\s+(?:level\s+)?(a1|a2|b1|b2|c1|c2)\b/i,
  )
  if (languageLevel) {
    return `${titleValue(
      languageLevel[1],
      'Language',
    )} ${languageLevel[2].toUpperCase()}`
  }

  const fallbackCandidate = normalizeSpaces(fallback)
  if (
    fallbackCandidate &&
    !genericFolderNames.has(normalizeKey(fallbackCandidate))
  ) {
    return fallbackCandidate
  }

  return 'Local AI Study Guide'
}

const fallbackPlannerItem = (
  options: GenerateStudyPathWithAiOptions,
  index: number,
): LocalStudyPathPlanItem => {
  const sections = [
    {
      title: `Key ideas ${index + 1}`,
      goal: `Explain the main ideas for ${options.title || 'this topic'}.`,
      focus: '',
    },
    {
      title: `Examples ${index + 1}`,
      goal: 'Show examples, usage, and common mistakes.',
      focus: '',
    },
  ]

  return {
    title: `${String(index + 1).padStart(2, '0')} - Lesson ${index + 1}`,
    goal: `Teach one useful part of ${options.title || 'this topic'}.`,
    sections,
    topics: sections.map((section) => section.title),
    avoid: [],
  }
}

const normalizePlannerSections = (
  value: unknown,
  fallback: LocalStudyPathPlanItem,
): LocalStudyPathPlanSection[] => {
  const rawSections = Array.isArray(value) ? value : []
  const sections = rawSections
    .map((item) => {
      const record =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : {}
      const title = stringValue(record.title)
      const goal = stringValue(record.goal)
      const focus =
        stringValue(record.focus) ||
        stringArrayValue(record.seeds).slice(0, 3).join('; ')
      return title || goal
        ? { title: title || goal, goal: goal || title, focus }
        : null
    })
    .filter(
      (section): section is { title: string; goal: string; focus: string } =>
        Boolean(section),
    )
    .slice(0, 2)

  const legacyTopics = fallback.topics.map((topic, index) => ({
    title: topic || fallback.sections[index]?.title || `Section ${index + 1}`,
    goal: topic || fallback.sections[index]?.goal || fallback.goal,
    focus: fallback.sections[index]?.focus || '',
  }))

  while (sections.length < 2) {
    sections.push(
      legacyTopics[sections.length] ||
        fallback.sections[sections.length] || {
          title: `Section ${sections.length + 1}`,
          goal: fallback.goal,
          focus: '',
        },
    )
  }

  return sections
}

const normalizePlannerItem = (
  value: unknown,
  options: GenerateStudyPathWithAiOptions,
  index: number,
): LocalStudyPathPlanItem => {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const fallback = fallbackPlannerItem(options, index)
  const sections = normalizePlannerSections(record.sections, fallback)

  return {
    title:
      stringValue(record.title) ||
      `${String(index + 1).padStart(2, '0')} - Lesson ${index + 1}`,
    goal: stringValue(record.goal) || fallback.goal,
    sections,
    topics:
      stringArrayValue(record.topics).length > 0
        ? stringArrayValue(record.topics).slice(0, 5)
        : sections.map((section) => section.title),
    avoid:
      stringArrayValue(record.avoid).length > 0
        ? stringArrayValue(record.avoid).slice(0, 5)
        : stringValue(record.avoid)
        ? stringValue(record.avoid)
            .split(';')
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 5)
        : fallback.avoid,
  }
}

const normalizeLocalStudyPathPlan = (
  value: unknown,
  options: GenerateStudyPathWithAiOptions,
  expectedCount: number,
): { plan: LocalStudyPathPlan; warnings: string[] } => {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const rawDashboards = Array.isArray(record.dashboards)
    ? record.dashboards
    : []
  const warnings: string[] = []
  const dashboards = rawDashboards
    .slice(0, expectedCount)
    .map((item, index) => normalizePlannerItem(item, options, index))

  if (rawDashboards.length > expectedCount) {
    warnings.push('Local AI planner returned extra dashboards; extras skipped.')
  }

  if (dashboards.length === 0) {
    throw new LocalAiGenerationError(
      'noUsableObjects',
      LOCAL_STUDY_PATH_NO_USABLE_OBJECTS_MESSAGE,
      {
        debug: {
          parsedJson: value,
          mappingError: 'Local AI planner returned no usable dashboards.',
        },
      },
    )
  }

  while (dashboards.length < expectedCount) {
    dashboards.push(fallbackPlannerItem(options, dashboards.length))
  }

  if (rawDashboards.length > 0 && rawDashboards.length < expectedCount) {
    warnings.push(
      'Local AI planner returned too few dashboards; StudyMesh filled the missing lesson outlines.',
    )
  }

  return {
    plan: {
      title: stringValue(record.title) || options.title || 'Study Guide',
      folderName: specificFolderName(
        stringValue(record.folderName),
        options.folderName || options.title,
        options.prompt,
      ),
      dashboards,
    },
    warnings,
  }
}

const parsePlannerJsonLeniently = (text: string): unknown => {
  const plannerString = (value: string): string =>
    value.replace(/\\"/g, '"').trim()
  const splitDashboardChunks = (candidate: string): string[] => {
    const matches = [
      ...candidate.matchAll(/\{\s*"title"\s*:\s*"\d{2}\s*-\s*[^"]+"/g),
    ]

    return matches.map((match, index) => {
      const start = match.index || 0
      const end =
        index + 1 < matches.length
          ? matches[index + 1].index || candidate.length
          : candidate.length
      return candidate.slice(start, end)
    })
  }
  const salvageDashboardChunks = (candidate: string): unknown[] => {
    const chunks = splitDashboardChunks(candidate)

    return chunks
      .map((chunk) => {
        const title = plannerString(
          chunk.match(/"title"\s*:\s*"([^"]+)"/)?.[1] || '',
        )
        const goal = plannerString(
          chunk.match(/"goal"\s*:\s*"([^"]+)"/)?.[1] || '',
        )
        const sectionMatches = [
          ...chunk.matchAll(
            /\{\s*"title"\s*:\s*"([^"]+)"\s*,\s*"goal"\s*:\s*"([^"]+)"\s*,\s*(?:"focus"\s*:\s*"([^"]*)"|"seeds"\s*:\s*\[([^\]]*)\])\s*\}/g,
          ),
        ]
        const sections = sectionMatches.slice(0, 2).map((sectionMatch) => {
          const focus =
            plannerString(sectionMatch[3] || '') ||
            [...(sectionMatch[4] || '').matchAll(/"([^"]+)"/g)]
              .map((seedMatch) => plannerString(seedMatch[1]))
              .slice(0, 3)
              .join('; ')

          return {
            title: plannerString(sectionMatch[1]),
            goal: plannerString(sectionMatch[2]),
            focus,
          }
        })
        const avoidString = plannerString(
          chunk.match(/"avoid"\s*:\s*"([^"]*)"/)?.[1] || '',
        )
        const avoidSource = chunk.match(/"avoid"\s*:\s*\[([^\]]*)\]/)?.[1] || ''
        const avoidFromString = avoidString
          .split(';')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 2)
        const avoid =
          avoidFromString.length > 0
            ? avoidFromString
            : [...avoidSource.matchAll(/"([^"]+)"/g)]
                .map((avoidMatch) => plannerString(avoidMatch[1]))
                .slice(0, 2)

        if (!title || !goal || sections.length === 0) {
          return null
        }

        return { title, goal, sections, avoid }
      })
      .filter(Boolean)
  }

  try {
    return parseLocalAiJson(text)
  } catch (error) {
    const trimmed = text.trim()
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    const candidate = fenced || trimmed
    const salvagedDashboards = salvageDashboardChunks(candidate)
    if (salvagedDashboards.length > 0) {
      return {
        title: candidate.match(/"title"\s*:\s*"([^"]+)"/)?.[1],
        folderName: candidate.match(/"folderName"\s*:\s*"([^"]+)"/)?.[1],
        dashboards: salvagedDashboards,
      }
    }

    const dashboardMatches = [
      ...candidate.matchAll(
        /\{[^{}]*"title"\s*:\s*"[^"]+"[^{}]*"goal"\s*:\s*"[^"]+"[^{}]*(?:"topics"\s*:\s*\[[^\]]*\]|"sections"\s*:\s*\[[\s\S]*?\])[^{}]*\}/g,
      ),
    ]
    const dashboards = dashboardMatches
      .map((match) => {
        try {
          return JSON.parse(match[0])
        } catch {
          return null
        }
      })
      .filter(Boolean)

    if (dashboards.length === 0) {
      throw error
    }

    return {
      title: candidate.match(/"title"\s*:\s*"([^"]+)"/)?.[1],
      folderName: candidate.match(/"folderName"\s*:\s*"([^"]+)"/)?.[1],
      dashboards,
    }
  }
}

const createLocalStudyPathPlan = async (
  options: GenerateStudyPathWithAiOptions,
  expectedCount: number,
  localOptions: LocalGenerationOptions,
): Promise<{ plan: LocalStudyPathPlan; warnings: string[] }> => {
  const failedAttempts: LocalAiGenerationFailureDebug[] = []
  let lastError: LocalAiGenerationError | null = null

  for (
    let attempt = 1;
    attempt <= LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS;
    attempt += 1
  ) {
    const promptText = localStudyPathPlannerPrompt(options, expectedCount)
    const debug: LocalAiGenerationFailureDebug = {
      dashboardCount: expectedCount,
      attempt,
      attemptCount: LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS,
      promptLength: promptText.length,
    }

    try {
      const text = await callLocalLanguageModel(promptText, {
        timeoutMs: LOCAL_STUDY_PATH_PLANNER_TIMEOUT_MS,
        onProgress: localOptions.onProgress,
        progressLabel: `Planning path, attempt ${attempt}/${LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS}...`,
        attempt,
        attemptCount: LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS,
        studyPathStep: 'planner',
        signal: localOptions.signal,
        promptType: 'planner',
        stepLabel: 'Study Guide planner',
      })
      debug.rawResponse = text

      const parsed = parsePlannerJsonLeniently(text)
      debug.parsedJson = parsed
      return normalizeLocalStudyPathPlan(parsed, options, expectedCount)
    } catch (error) {
      const localError = createLocalAiErrorFromUnknown(error, debug)
      lastError = localError
      failedAttempts.push(localError.debug || debug)

      if (
        !localAiStudyPathFailureIsRetryable(localError) ||
        attempt === LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS
      ) {
        throw new LocalAiGenerationError(localError.code, localError.message, {
          debug: withAttemptDebug(localError.debug || debug, failedAttempts),
          cause: localError.cause,
        })
      }

      await waitForLocalAiRetryCooldown(localError)
    }
  }

  throw new LocalAiGenerationError(
    lastError?.code || 'noUsableObjects',
    lastError?.message || LOCAL_STUDY_PATH_NO_USABLE_OBJECTS_MESSAGE,
    {
      debug: withAttemptDebug(lastError?.debug || {}, failedAttempts),
      cause: lastError?.cause,
    },
  )
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const localAiFailureCodeForError = (
  error: unknown,
): LocalAiGenerationFailureCode => {
  const message = errorMessage(error)
  if (/timed out|timeout|cooling down/i.test(message)) {
    return 'timeout'
  }

  if (/not supported/i.test(message)) {
    return 'unsupported'
  }

  if (/unavailable|busy or unstable/i.test(message)) {
    return 'unavailable'
  }

  return 'unknown'
}

const localAiFailureMessageForCode = (
  code: LocalAiGenerationFailureCode,
  fallback: string,
): string => {
  if (code === 'timeout') {
    return LOCAL_STUDY_PATH_TIMEOUT_MESSAGE
  }

  return fallback
}

const localAiStudyPathFailureIsRetryable = (
  error: LocalAiGenerationError,
): boolean =>
  error.code === 'invalidJson' ||
  error.code === 'mappingError' ||
  error.code === 'noUsableObjects' ||
  error.code === 'timeout'

const localAiStudyPackFailureIsRetryable = (error: unknown): boolean =>
  /invalid JSON|Unexpected|truncated JSON|timed out|timeout|cooling down/i.test(
    errorMessage(error),
  )

const waitForLocalAiRetryCooldown = async (
  error: LocalAiGenerationError,
): Promise<void> => {
  if (error.code !== 'timeout') {
    return
  }

  await new Promise((resolve) =>
    window.setTimeout(resolve, LOCAL_AI_RETRY_COOLDOWN_MS),
  )
}

const waitForLocalAiRetryCooldownIfNeeded = async (
  error: unknown,
): Promise<void> => {
  if (!/timed out|timeout|cooling down/i.test(errorMessage(error))) {
    return
  }

  await new Promise((resolve) =>
    window.setTimeout(resolve, LOCAL_AI_RETRY_COOLDOWN_MS),
  )
}

const hasUsableMappedWidgets = (
  dashboard: AiStudyPathDashboardDraft | null,
): dashboard is AiStudyPathDashboardDraft => {
  if (!dashboard || dashboard.objects.length === 0) {
    return false
  }

  if (
    !dashboard.objects.some(
      (object) => object.kind === 'qa' || object.kind === 'quiz',
    )
  ) {
    return false
  }

  return dashboard.objects.some((object) => {
    if (object.kind === 'markdown') {
      const content = normalizeSpaces(object.markdown.replace(/^#+\s*/gm, ''))
      return content.split(/\s+/).filter(Boolean).length >= 5
    }

    return true
  })
}

const hasUsableMarkdownNotes = (
  dashboard: AiStudyPathDashboardDraft | null,
): dashboard is AiStudyPathDashboardDraft =>
  Boolean(
    dashboard?.objects.some((object) => {
      if (object.kind !== 'markdown') {
        return false
      }

      const content = normalizeSpaces(object.markdown.replace(/^#+\s*/gm, ''))
      return content.split(/\s+/).filter(Boolean).length >= 10
    }),
  )

const logLocalDashboardError = (
  debug: LocalAiGenerationFailureDebug,
  error: unknown,
): void => {
  console.debug('[StudyMesh Local AI] dashboard:error', {
    dashboardIndex: debug.dashboardIndex,
    dashboardCount: debug.dashboardCount,
    attempt: debug.attempt,
    attemptCount: debug.attemptCount,
    promptLength: debug.promptLength,
    rawResponse: debug.rawResponse,
    parsedJson: debug.parsedJson,
    parseError: debug.parseError,
    mappingError: debug.mappingError,
    droppedOrRepairedItems: debug.droppedOrRepairedItems,
    message: errorMessage(error),
  })
}

const withAttemptDebug = (
  debug: LocalAiGenerationFailureDebug,
  attempts: LocalAiGenerationFailureDebug[],
): LocalAiGenerationFailureDebug => ({
  ...debug,
  attempts: attempts.map((attempt) => ({ ...attempt })),
})

const normalizeLocalStudyPathConcurrency = (
  value: LocalGenerationOptions['dashboardConcurrency'],
): 1 | 2 | 3 | 5 => (value === 1 || value === 3 || value === 5 ? value : 2)

interface LocalDashboardGenerationResult {
  index: number
  dashboard: AiStudyPathDashboardDraft | null
  warning?: string
  error?: LocalAiGenerationError
}

interface LocalStudyPathNotesResult {
  title: string
  notes: string
  rawResponse: string
  failedAttempts: LocalAiGenerationFailureDebug[]
  repairEvents: string[]
}

interface LocalStudyPathPracticeResult {
  record: Record<string, unknown> | null
  rawResponse?: string
  failedAttempts: LocalAiGenerationFailureDebug[]
  repairEvents: string[]
  error?: LocalAiGenerationError
  warnings: string[]
}

type LocalDashboardProgressState = {
  status: 'pending' | 'running' | 'complete' | 'failed'
  threadId?: number
  threadCount?: number
  attempt?: number
  attemptCount?: number
  percent?: number
  step?: LocalAiProgressEvent['studyPathStep']
}

const localDashboardProgressStepLabel = (
  step: LocalAiProgressEvent['studyPathStep'],
): string => {
  if (step === 'markdown1') {
    return 'Markdown part 1'
  }

  if (step === 'markdown2') {
    return 'Markdown part 2'
  }

  if (step === 'practice') {
    return 'Practice'
  }

  if (step === 'flashcards') {
    return 'Flashcards'
  }

  if (step === 'quizzes') {
    return 'Quizzes'
  }

  return 'Notes'
}

const renderLocalDashboardProgressLabel = (
  states: LocalDashboardProgressState[],
): string => {
  const completedCount = states.filter(
    (state) => state.status === 'complete',
  ).length
  if (completedCount === states.length) {
    return `Generated ${completedCount} of ${states.length} dashboards`
  }

  return `Generating ${completedCount} of ${states.length} dashboards`
}

const renderLocalDashboardThreadLabel = (
  state: LocalDashboardProgressState,
  index: number,
  dashboardCount: number,
): string => {
  const position = `${index + 1}/${dashboardCount}`
  if (state.status === 'running') {
    return `${localDashboardProgressStepLabel(
      state.step,
    )} for dashboard ${position}, attempt ${state.attempt || 1}/${
      state.attemptCount || LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS
    }`
  }

  if (state.status === 'complete') {
    return `Dashboard ${position} complete`
  }

  if (state.status === 'failed') {
    return `Dashboard ${position} failed`
  }

  return `Dashboard ${position} waiting`
}

type LocalStudyPathPipelineStep = {
  id: string
  label: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  percent: number
  budgetMs: number
  baseBudgetMs: number
  threadId?: number
  dashboardIndex?: number
  studyPathStep?: LocalAiProgressEvent['studyPathStep']
}

const createLocalStudyPathPipelineTracker = (
  dashboardCount: number,
  concurrency: number,
) => {
  const steps: LocalStudyPathPipelineStep[] = [
    {
      id: 'planner',
      label: 'Planning',
      status: 'pending',
      percent: 0,
      budgetMs: LOCAL_STUDY_PATH_PLANNER_TIMEOUT_MS,
      baseBudgetMs: LOCAL_STUDY_PATH_PLANNER_TIMEOUT_MS,
      studyPathStep: 'planner',
    },
  ]

  Array.from({ length: dashboardCount }, (_value, index) => {
    const position = index + 1
    steps.push(
      {
        id: `dashboard-${position}-markdown1`,
        label: `Dashboard ${position}: Markdown 1`,
        status: 'pending',
        percent: 0,
        budgetMs: LOCAL_STUDY_PATH_NOTES_TIMEOUT_MS,
        baseBudgetMs: LOCAL_STUDY_PATH_NOTES_TIMEOUT_MS,
        dashboardIndex: position,
        studyPathStep: 'markdown1',
      },
      {
        id: `dashboard-${position}-markdown2`,
        label: `Dashboard ${position}: Markdown 2`,
        status: 'pending',
        percent: 0,
        budgetMs: LOCAL_STUDY_PATH_NOTES_TIMEOUT_MS,
        baseBudgetMs: LOCAL_STUDY_PATH_NOTES_TIMEOUT_MS,
        dashboardIndex: position,
        studyPathStep: 'markdown2',
      },
      {
        id: `dashboard-${position}-flashcards`,
        label: `Dashboard ${position}: Flashcards`,
        status: 'pending',
        percent: 0,
        budgetMs: LOCAL_STUDY_PATH_PRACTICE_TIMEOUT_MS,
        baseBudgetMs: LOCAL_STUDY_PATH_PRACTICE_TIMEOUT_MS,
        dashboardIndex: position,
        studyPathStep: 'flashcards',
      },
      {
        id: `dashboard-${position}-quizzes`,
        label: `Dashboard ${position}: Quizzes`,
        status: 'pending',
        percent: 0,
        budgetMs: LOCAL_STUDY_PATH_PRACTICE_TIMEOUT_MS,
        baseBudgetMs: LOCAL_STUDY_PATH_PRACTICE_TIMEOUT_MS,
        dashboardIndex: position,
        studyPathStep: 'quizzes',
      },
    )
  })

  const stepForEvent = (
    event: LocalAiProgressEvent,
  ): LocalStudyPathPipelineStep | undefined => {
    if (event.studyPathStep === 'planner') {
      return steps[0]
    }

    if (!event.dashboardIndex || !event.studyPathStep) {
      return undefined
    }

    return steps.find(
      (step) =>
        step.dashboardIndex === event.dashboardIndex &&
        step.studyPathStep === event.studyPathStep,
    )
  }

  const remainingForStep = (step: LocalStudyPathPipelineStep): number =>
    step.status === 'complete'
      ? 0
      : step.budgetMs * (1 - Math.max(0, step.percent) / 100)

  const baseRemainingForStep = (step: LocalStudyPathPipelineStep): number =>
    step.status === 'complete' ? 0 : step.baseBudgetMs

  const estimateLaneRemainingMs = (useBaseBudget: boolean): number => {
    const planner = steps[0]
    const plannerRemaining =
      planner.status === 'complete'
        ? 0
        : useBaseBudget
        ? planner.baseBudgetMs
        : remainingForStep(planner)
    const lanes = Array.from({ length: Math.max(1, concurrency) }, () => 0)

    Array.from({ length: dashboardCount }, (_value, index) => {
      const dashboardIndex = index + 1
      const dashboardSteps = steps.filter(
        (step) => step.dashboardIndex === dashboardIndex,
      )
      const dashboardRemaining = dashboardSteps.reduce(
        (total, step) =>
          total +
          (useBaseBudget ? baseRemainingForStep(step) : remainingForStep(step)),
        0,
      )
      if (dashboardRemaining <= 0) {
        return
      }

      const assignedThread = dashboardSteps.find((step) => step.threadId)
        ?.threadId
      const laneIndex =
        assignedThread && assignedThread > 0
          ? Math.min(lanes.length - 1, assignedThread - 1)
          : lanes.indexOf(Math.min(...lanes))
      lanes[laneIndex] += dashboardRemaining
    })

    return Math.round(plannerRemaining + Math.max(...lanes))
  }

  const decorate = (event: LocalAiProgressEvent): LocalAiProgressEvent => {
    const initialLaneBudget = estimateLaneRemainingMs(true)
    const remainingBudget = estimateLaneRemainingMs(false)
    const percent =
      initialLaneBudget > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                ((initialLaneBudget - remainingBudget) / initialLaneBudget) *
                  100,
              ),
            ),
          )
        : 0

    return {
      ...event,
      studyPathPipeline: {
        percent,
        estimatedRemainingMs: remainingBudget,
        label: 'Study Guide pipeline',
        steps: steps.map((step) => ({
          id: step.id,
          label: step.label,
          status: step.status,
          percent: Math.max(0, Math.min(100, Math.round(step.percent))),
        })),
      },
    }
  }

  return {
    handleProgress: (event: LocalAiProgressEvent): LocalAiProgressEvent => {
      const step = stepForEvent(event)
      if (!step) {
        return decorate(event)
      }

      if (event.attempt && event.attempt > 1) {
        step.budgetMs =
          step.baseBudgetMs * event.attempt +
          LOCAL_AI_RETRY_COOLDOWN_MS * (event.attempt - 1)
      }

      if (event.phase === 'complete') {
        step.status = 'complete'
        step.percent = 100
      } else if (event.phase === 'timeout') {
        step.status = 'failed'
        step.percent = 100
      } else if (event.phase === 'generation') {
        step.status = 'running'
        step.percent = event.percent
      }
      if (event.threadId) {
        step.threadId = event.threadId
      }

      return decorate(event)
    },
  }
}

const createLocalDashboardProgressTracker = (
  expectedCount: number,
  onProgress?: (event: LocalAiProgressEvent) => void,
) => {
  const states: LocalDashboardProgressState[] = Array.from(
    { length: expectedCount },
    () => ({ status: 'pending' }),
  )

  const emit = (timeoutMs?: number) => {
    if (!onProgress) {
      return
    }

    const progressUnits = states.reduce((total, state) => {
      if (state.status === 'complete' || state.status === 'failed') {
        return total + 1
      }

      if (state.status === 'running') {
        return total + Math.min(0.99, Math.max(0, (state.percent || 0) / 100))
      }

      return total
    }, 0)

    onProgress({
      phase: 'generation',
      percent: Math.max(
        0,
        Math.min(99, Math.round((progressUnits / expectedCount) * 100)),
      ),
      label: renderLocalDashboardProgressLabel(states),
      dashboardCount: expectedCount,
      timeoutMs,
      dashboardProgress: states.map((state, index) => ({
        dashboardIndex: index + 1,
        dashboardCount: expectedCount,
        status: state.status,
        label: renderLocalDashboardThreadLabel(state, index, expectedCount),
        percent:
          state.status === 'complete' || state.status === 'failed'
            ? 100
            : Math.max(0, Math.min(99, Math.round(state.percent || 0))),
        attempt: state.attempt,
        attemptCount: state.attemptCount,
        studyPathStep: state.step,
        threadId: state.threadId,
        threadCount: state.threadCount,
      })),
    })
  }

  return {
    handleDashboardProgress: (
      index: number,
      threadId: number,
      threadCount: number,
      event: LocalAiProgressEvent,
    ): void => {
      const eventWithThread = { ...event, threadId, threadCount }
      if (event.phase !== 'generation') {
        onProgress?.(eventWithThread)
        return
      }

      states[index] = {
        status: 'running',
        threadId,
        threadCount,
        attempt: event.attempt,
        attemptCount: event.attemptCount,
        percent: event.percent,
        step: event.studyPathStep,
      }
      onProgress?.(eventWithThread)
      emit(event.timeoutMs)
    },
    markFinished: (
      index: number,
      threadId: number,
      threadCount: number,
      status: 'complete' | 'failed',
      timeoutMs?: number,
    ): void => {
      states[index] = {
        ...states[index],
        threadId,
        threadCount,
        status,
        percent: 100,
      }
      emit(timeoutMs)
    },
  }
}

const parseLocalStudyPathObject = (
  text: string,
  debug: LocalAiGenerationFailureDebug,
): Record<string, unknown> => {
  if (localAiJsonLooksTruncated(text)) {
    throw new Error(
      'Google Local AI returned truncated JSON before the final closing brace.',
    )
  }

  const parsed = parseLocalAiJson(text)
  debug.parsedJson = parsed
  return parsed && typeof parsed === 'object'
    ? (parsed as Record<string, unknown>)
    : {}
}

type LocalPracticeKind = 'flashcards' | 'quizzes'

const localPracticeKnownKeys = [
  'flashcards',
  'flashcard',
  'quizzes',
  'quiz',
  'question',
  'answer',
  'front',
  'back',
  'prompt',
  'options',
  'correctIndex',
  'correctOptionIndex',
  'explanation',
]

const localPracticeCandidateText = (text: string): string => {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]

  return (fenced || trimmed)
    .replace(/\\(?!["\\/bfnrtu])/g, '')
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
}

const quoteLocalPracticeKeys = (value: string): string =>
  localPracticeKnownKeys.reduce(
    (current, key) =>
      current.replace(
        new RegExp(`([\\{,]\\s*)${key}\\s*:`, 'g'),
        `$1"${key}":`,
      ),
    value,
  )

const localPracticeObjectLooksUsable = (
  value: Record<string, unknown>,
  kind: LocalPracticeKind,
): boolean => {
  const question =
    stringValue(value.question) ||
    stringValue(value.front) ||
    stringValue(value.prompt)
  if (!question) {
    return false
  }

  if (kind === 'flashcards') {
    return Boolean(
      stringValue(value.answer) ||
        stringValue(value.back) ||
        stringValue(value.definition),
    )
  }

  return Boolean(
    Array.isArray(value.options) ||
      typeof value.options === 'string' ||
      stringValue(value.answer) ||
      typeof value.correctIndex === 'number' ||
      typeof value.correctOptionIndex === 'number',
  )
}

const collectLocalPracticeItems = (
  parsed: unknown,
  kind: LocalPracticeKind,
): unknown[] => {
  if (Array.isArray(parsed)) {
    return parsed
  }

  if (!parsed || typeof parsed !== 'object') {
    return []
  }

  const record = parsed as Record<string, unknown>
  const fallbackKey = kind === 'flashcards' ? 'flashcard' : 'quiz'
  const explicitItems: unknown[] = Array.isArray(record[kind])
    ? record[kind]
    : Array.isArray(record[fallbackKey])
    ? record[fallbackKey]
    : []

  return localPracticeObjectLooksUsable(record, kind)
    ? [record, ...explicitItems]
    : explicitItems
}

const dedupeLocalPracticeItems = (
  items: unknown[],
  kind: LocalPracticeKind,
  events: string[],
): unknown[] => {
  const seen = new Set<string>()
  const uniqueItems: unknown[] = []

  items.forEach((item) => {
    const record =
      item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const question = normalizeKey(
      stringValue(record.question) ||
        stringValue(record.front) ||
        stringValue(record.prompt),
    )

    if (!question) {
      uniqueItems.push(item)
      return
    }

    if (seen.has(question)) {
      events.push(`Repaired ${kind}: dropped duplicate question.`)
      return
    }

    seen.add(question)
    uniqueItems.push(item)
  })

  return uniqueItems
}

const parseLocalPracticeCandidate = (value: string): unknown => {
  const candidate = quoteLocalPracticeKeys(value)

  try {
    return parseLocalAiJson(candidate)
  } catch {
    return JSON.parse(candidate)
  }
}

const localPracticeObjectCandidates = (value: string): string[] => {
  const candidates: string[] = []
  const seen = new Set<string>()

  for (let outerIndex = 0; outerIndex < value.length; outerIndex += 1) {
    if (value[outerIndex] !== '{') {
      continue
    }

    let inString = false
    let escaping = false
    let depth = 0

    for (
      let innerIndex = outerIndex;
      innerIndex < value.length;
      innerIndex += 1
    ) {
      const char = value[innerIndex]

      if (inString) {
        if (escaping) {
          escaping = false
          continue
        }

        if (char === '\\') {
          escaping = true
          continue
        }

        if (char === '"') {
          inString = false
        }

        continue
      }

      if (char === '"') {
        inString = true
        continue
      }

      if (char === '{') {
        depth += 1
        continue
      }

      if (char === '}') {
        depth -= 1
      }

      if (depth === 0) {
        const candidate = value.slice(outerIndex, innerIndex + 1)
        if (!seen.has(candidate)) {
          seen.add(candidate)
          candidates.push(candidate)
        }
        break
      }
    }
  }

  return candidates
}

const parseLocalStudyPathPracticeObject = (
  text: string,
  kind: LocalPracticeKind,
  debug: LocalAiGenerationFailureDebug,
): Record<string, unknown> => {
  const events: string[] = []
  const candidate = localPracticeCandidateText(text)
  const collectParsed = (parsed: unknown): unknown[] =>
    collectLocalPracticeItems(parsed, kind)

  try {
    const parsed = parseLocalPracticeCandidate(candidate)
    const items = collectParsed(parsed)

    if (items.length > 0) {
      if (candidate !== text.trim()) {
        events.push(`Repaired ${kind}: stripped code fence or invalid escapes.`)
      }

      const record = { [kind]: dedupeLocalPracticeItems(items, kind, events) }
      debug.parsedJson = record
      debug.droppedOrRepairedItems = [
        ...(debug.droppedOrRepairedItems || []),
        ...events,
      ]
      return record
    }
  } catch {
    // Fall through to standalone object recovery.
  }

  const items = localPracticeObjectCandidates(candidate)
    .flatMap((objectCandidate) => {
      try {
        return collectParsed(parseLocalPracticeCandidate(objectCandidate))
      } catch {
        return []
      }
    })
    .filter((item) =>
      item && typeof item === 'object'
        ? localPracticeObjectLooksUsable(item as Record<string, unknown>, kind)
        : false,
    )

  if (items.length > 0) {
    events.push(`Repaired ${kind}: recovered standalone practice objects.`)
    const record = { [kind]: dedupeLocalPracticeItems(items, kind, events) }
    debug.parsedJson = record
    debug.droppedOrRepairedItems = [
      ...(debug.droppedOrRepairedItems || []),
      ...events,
    ]
    return record
  }

  return parseLocalStudyPathObject(text, debug)
}

const localStudyPathMarkdownWordBounds = (attempt: number): { min: number } => {
  if (attempt === 1) {
    return { min: 40 }
  }

  if (attempt === 2) {
    return { min: 30 }
  }

  return { min: 20 }
}

const createLocalAiErrorFromUnknown = (
  error: unknown,
  debug: LocalAiGenerationFailureDebug,
): LocalAiGenerationError => {
  if (isLocalAiGenerationError(error)) {
    return new LocalAiGenerationError(error.code, error.message, {
      debug: { ...debug, ...error.debug },
      cause: error.cause,
    })
  }

  return new LocalAiGenerationError(
    /invalid JSON|Unexpected|truncated JSON/i.test(errorMessage(error))
      ? 'invalidJson'
      : localAiFailureCodeForError(error),
    /invalid JSON|Unexpected|truncated JSON/i.test(errorMessage(error))
      ? LOCAL_STUDY_PATH_INVALID_JSON_MESSAGE
      : localAiFailureMessageForCode(
          localAiFailureCodeForError(error),
          errorMessage(error),
        ),
    {
      debug: {
        ...debug,
        parseError: /invalid JSON|Unexpected|truncated JSON/i.test(
          errorMessage(error),
        )
          ? errorMessage(error)
          : undefined,
      },
      cause: error,
    },
  )
}

const generateLocalStudyPathMarkdownSection = async (
  index: number,
  sectionIndex: number,
  options: GenerateStudyPathWithAiOptions,
  plan: LocalStudyPathPlan,
  expectedCount: number,
  localOptions: LocalGenerationOptions,
): Promise<{
  markdown: string
  rawResponse: string
  failedAttempts: LocalAiGenerationFailureDebug[]
}> => {
  const plannerItem = plan.dashboards[index]
  const section = plannerItem.sections[sectionIndex]
  const requiredHeading = `## ${section.title}`
  const failedAttempts: LocalAiGenerationFailureDebug[] = []
  let lastError: LocalAiGenerationError | null = null

  for (
    let attempt = 1;
    attempt <= LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS;
    attempt += 1
  ) {
    const promptText = localStudyPathMarkdownSectionPrompt(
      options,
      plan.dashboards,
      plannerItem,
      section,
      sectionIndex,
      attempt,
    )
    const debug: LocalAiGenerationFailureDebug = {
      dashboardIndex: index + 1,
      dashboardCount: expectedCount,
      attempt,
      attemptCount: LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS,
      promptLength: promptText.length,
    }

    try {
      const text = await callLocalLanguageModel(promptText, {
        timeoutMs: LOCAL_STUDY_PATH_NOTES_TIMEOUT_MS,
        onProgress: localOptions.onProgress,
        progressLabel: `Generating Markdown part ${
          sectionIndex + 1
        } for dashboard ${
          index + 1
        }/${expectedCount}, attempt ${attempt}/${LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS}...`,
        dashboardIndex: index + 1,
        dashboardCount: expectedCount,
        attempt,
        attemptCount: LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS,
        studyPathStep: sectionIndex === 0 ? 'markdown1' : 'markdown2',
        signal: localOptions.signal,
        promptType: sectionIndex === 0 ? 'markdown1' : 'markdown2',
        stepLabel: plannerItem.title,
        dashboardTitle: plannerItem.title,
      })
      debug.rawResponse = text
      const markdown = cleanLocalStudyPathSectionMarkdown(text, requiredHeading)
      const count = wordCount(markdown.replace(/^#+\s*/gm, ''))
      const bounds = localStudyPathMarkdownWordBounds(attempt)
      // Only reject on bound min too many words is never a problem.
      if (count < bounds.min) {
        throw new LocalAiGenerationError(
          'noUsableObjects',
          LOCAL_STUDY_PATH_NO_USABLE_OBJECTS_MESSAGE,
          {
            debug: {
              ...debug,
              mappingError: `Local AI Markdown section word count ${count} was lower than ${bounds.min}.`,
            },
          },
        )
      }

      return { markdown, rawResponse: text, failedAttempts }
    } catch (error) {
      const localError = createLocalAiErrorFromUnknown(error, debug)
      lastError = localError
      failedAttempts.push(localError.debug || debug)

      if (
        !localAiStudyPathFailureIsRetryable(localError) ||
        attempt === LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS
      ) {
        logLocalDashboardError(localError.debug || debug, localError)
        break
      }

      await waitForLocalAiRetryCooldown(localError)
    }
  }

  const debug = withAttemptDebug(
    lastError?.debug || {
      dashboardIndex: index + 1,
      dashboardCount: expectedCount,
    },
    failedAttempts,
  )
  throw new LocalAiGenerationError(
    lastError?.code || 'noUsableObjects',
    lastError?.message || LOCAL_STUDY_PATH_NO_USABLE_OBJECTS_MESSAGE,
    { debug, cause: lastError?.cause },
  )
}

const generateLocalStudyPathNotes = async (
  index: number,
  options: GenerateStudyPathWithAiOptions,
  plan: LocalStudyPathPlan,
  expectedCount: number,
  localOptions: LocalGenerationOptions,
): Promise<LocalStudyPathNotesResult> => {
  const plannerItem = plan.dashboards[index]
  const sectionOne = await generateLocalStudyPathMarkdownSection(
    index,
    0,
    options,
    plan,
    expectedCount,
    localOptions,
  )
  const sectionTwo = await generateLocalStudyPathMarkdownSection(
    index,
    1,
    options,
    plan,
    expectedCount,
    localOptions,
  )
  const notes = [
    `# ${plannerItem.title}`,
    sectionOne.markdown.trim(),
    sectionTwo.markdown.trim(),
  ].join('\n\n')

  return {
    title: plannerItem.title,
    notes: stripLocalPracticeSectionsFromNotes(notes),
    rawResponse: JSON.stringify(
      {
        sectionOneResponse: sectionOne.rawResponse,
        sectionTwoResponse: sectionTwo.rawResponse,
      },
      null,
      2,
    ),
    failedAttempts: [
      ...sectionOne.failedAttempts,
      ...sectionTwo.failedAttempts,
    ],
    repairEvents: [],
  }
}

const generateLocalStudyPathPractice = async (
  index: number,
  options: GenerateStudyPathWithAiOptions,
  plan: LocalStudyPathPlan,
  notes: string,
  expectedCount: number,
  localOptions: LocalGenerationOptions,
): Promise<LocalStudyPathPracticeResult> => {
  const plannerItem = plan.dashboards[index]
  const repairEvents: string[] = []
  const runPracticeCall = async (
    kind: 'flashcards' | 'quizzes',
  ): Promise<{
    record: Record<string, unknown> | null
    rawResponse?: string
    failedAttempts: LocalAiGenerationFailureDebug[]
    error?: LocalAiGenerationError
  }> => {
    const failedAttempts: LocalAiGenerationFailureDebug[] = []
    let lastError: LocalAiGenerationError | null = null

    for (
      let attempt = 1;
      attempt <= LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const promptText =
        kind === 'flashcards'
          ? localStudyPathFlashcardsPrompt(
              options,
              plan.dashboards,
              plannerItem,
              notes,
              attempt,
            )
          : localStudyPathQuizzesPrompt(
              options,
              plan.dashboards,
              plannerItem,
              notes,
              attempt,
            )
      const debug: LocalAiGenerationFailureDebug = {
        dashboardIndex: index + 1,
        dashboardCount: expectedCount,
        attempt,
        attemptCount: LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS,
        promptLength: promptText.length,
      }

      try {
        const text = await callLocalLanguageModel(promptText, {
          timeoutMs: LOCAL_STUDY_PATH_PRACTICE_TIMEOUT_MS,
          onProgress: localOptions.onProgress,
          progressLabel: `Generating ${kind} for dashboard ${
            index + 1
          }/${expectedCount}, attempt ${attempt}/${LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS}...`,
          dashboardIndex: index + 1,
          dashboardCount: expectedCount,
          attempt,
          attemptCount: LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS,
          studyPathStep: kind,
          signal: localOptions.signal,
          promptType: kind,
          stepLabel: plannerItem.title,
          dashboardTitle: plannerItem.title,
        })
        debug.rawResponse = text
        const record = parseLocalStudyPathPracticeObject(text, kind, debug)
        repairEvents.push(...(debug.droppedOrRepairedItems || []))

        if (kind === 'flashcards') {
          const flashcards = Array.isArray(record.flashcards)
            ? record.flashcards.flatMap((item, itemIndex) =>
                flashcardFromRecord(item, itemIndex, []),
              )
            : []
          if (flashcards.length === 0) {
            throw new LocalAiGenerationError(
              'noUsableObjects',
              LOCAL_STUDY_PATH_NO_USABLE_OBJECTS_MESSAGE,
              {
                debug: {
                  ...debug,
                  mappingError:
                    'Local AI practice returned no usable flashcards.',
                },
              },
            )
          }
        } else {
          const quizzes = Array.isArray(record.quizzes) ? record.quizzes : []
          if (quizzes.length === 0) {
            throw new LocalAiGenerationError(
              'noUsableObjects',
              LOCAL_STUDY_PATH_NO_USABLE_OBJECTS_MESSAGE,
              {
                debug: {
                  ...debug,
                  mappingError: 'Local AI practice returned no usable quizzes.',
                },
              },
            )
          }
        }

        return {
          record,
          rawResponse: text,
          failedAttempts,
        }
      } catch (error) {
        const localError = isLocalAiGenerationError(error)
          ? error
          : new LocalAiGenerationError(
              /invalid JSON|Unexpected|truncated JSON/i.test(
                errorMessage(error),
              )
                ? 'invalidJson'
                : localAiFailureCodeForError(error),
              /invalid JSON|Unexpected|truncated JSON/i.test(
                errorMessage(error),
              )
                ? LOCAL_STUDY_PATH_INVALID_JSON_MESSAGE
                : localAiFailureMessageForCode(
                    localAiFailureCodeForError(error),
                    errorMessage(error),
                  ),
              {
                debug: {
                  ...debug,
                  parseError: /invalid JSON|Unexpected|truncated JSON/i.test(
                    errorMessage(error),
                  )
                    ? errorMessage(error)
                    : undefined,
                },
                cause: error,
              },
            )
        lastError = localError
        failedAttempts.push(localError.debug || debug)

        if (
          !localAiStudyPathFailureIsRetryable(localError) ||
          attempt === LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS
        ) {
          logLocalDashboardError(localError.debug || debug, localError)
          break
        }

        await waitForLocalAiRetryCooldown(localError)
      }
    }

    return {
      record: null,
      failedAttempts,
      error: lastError || undefined,
    }
  }

  const flashcardResult = await runPracticeCall('flashcards')
  const quizResult = await runPracticeCall('quizzes')
  const record =
    flashcardResult.record || quizResult.record
      ? {
          flashcards: Array.isArray(flashcardResult.record?.flashcards)
            ? flashcardResult.record.flashcards
            : [],
          quizzes: Array.isArray(quizResult.record?.quizzes)
            ? quizResult.record.quizzes
            : [],
        }
      : null
  const warnings = [
    flashcardResult.record
      ? ''
      : `Dashboard ${
          index + 1
        } kept lesson notes, but Local AI flashcards failed after ${LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS} attempts.`,
    quizResult.record
      ? ''
      : `Dashboard ${
          index + 1
        } kept lesson notes, but Local AI quizzes failed after ${LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS} attempts.`,
  ].filter(Boolean)

  return {
    record,
    rawResponse: JSON.stringify(
      {
        flashcardsResponse: flashcardResult.rawResponse || '',
        quizzesResponse: quizResult.rawResponse || '',
      },
      null,
      2,
    ),
    failedAttempts: [
      ...flashcardResult.failedAttempts,
      ...quizResult.failedAttempts,
    ],
    repairEvents,
    error: flashcardResult.error || quizResult.error,
    warnings,
  }
}

const generateLocalStudyPathDashboard = async (
  index: number,
  options: GenerateStudyPathWithAiOptions,
  plan: LocalStudyPathPlan,
  expectedCount: number,
  targetCount: number,
  localOptions: LocalGenerationOptions,
): Promise<LocalDashboardGenerationResult> => {
  const plannerItem = plan.dashboards[index]

  try {
    const notesResult = await generateLocalStudyPathNotes(
      index,
      options,
      plan,
      expectedCount,
      localOptions,
    )
    const practiceResult = await generateLocalStudyPathPractice(
      index,
      options,
      plan,
      notesResult.notes,
      expectedCount,
      localOptions,
    )
    const practiceRecord = practiceResult.record || {}
    const combinedRecord = {
      ...practiceRecord,
      title: notesResult.title || plannerItem.title,
      notes: notesResult.notes,
      rawNotes: notesResult.notes,
    }
    const rawAiResponse = JSON.stringify(
      {
        notesResponse: notesResult.rawResponse,
        practiceResponse: practiceResult.rawResponse || '',
      },
      null,
      2,
    )
    const mappedDashboard = mapLocalDashboard(
      combinedRecord,
      index,
      options,
      rawAiResponse,
      'normal',
      targetCount,
      plannerItem,
      { allowPracticeFallback: Boolean(practiceResult.record) },
    )

    const dashboardIsUsable = practiceResult.record
      ? hasUsableMappedWidgets(mappedDashboard)
      : hasUsableMarkdownNotes(mappedDashboard)

    if (!mappedDashboard || !dashboardIsUsable) {
      throw new LocalAiGenerationError(
        'noUsableObjects',
        LOCAL_STUDY_PATH_NO_USABLE_OBJECTS_MESSAGE,
        {
          debug: {
            dashboardIndex: index + 1,
            dashboardCount: expectedCount,
            rawResponse: rawAiResponse,
            parsedJson: combinedRecord,
            mappingError: 'No usable Study Guide widgets were produced.',
            droppedOrRepairedItems:
              mappedDashboard?.debugTrace?.droppedOrRepairedItems || [],
          },
        },
      )
    }

    if (notesResult.repairEvents.length > 0 && mappedDashboard.debugTrace) {
      mappedDashboard.debugTrace.droppedOrRepairedItems = [
        ...(mappedDashboard.debugTrace.droppedOrRepairedItems || []),
        ...notesResult.repairEvents,
      ]
    }

    if (practiceResult.repairEvents.length > 0 && mappedDashboard.debugTrace) {
      mappedDashboard.debugTrace.droppedOrRepairedItems = [
        ...(mappedDashboard.debugTrace.droppedOrRepairedItems || []),
        ...practiceResult.repairEvents,
      ]
    }

    const failedAttempts = [
      ...notesResult.failedAttempts,
      ...practiceResult.failedAttempts,
    ]
    if (failedAttempts.length > 0 && mappedDashboard.debugTrace) {
      mappedDashboard.debugTrace.localAiFailedAttempts = failedAttempts
    }

    const warning =
      practiceResult.warnings.length > 0
        ? practiceResult.warnings.join(' ')
        : undefined

    return { index, dashboard: mappedDashboard, warning }
  } catch (error) {
    const localError = isLocalAiGenerationError(error)
      ? error
      : new LocalAiGenerationError(
          localAiFailureCodeForError(error),
          localAiFailureMessageForCode(
            localAiFailureCodeForError(error),
            errorMessage(error),
          ),
          {
            debug: {
              dashboardIndex: index + 1,
              dashboardCount: expectedCount,
            },
            cause: error,
          },
        )
    const debug = withAttemptDebug(localError.debug || {}, [
      ...(localError.debug?.attempts || []),
    ])

    return {
      index,
      dashboard: null,
      error: new LocalAiGenerationError(localError.code, localError.message, {
        debug,
        cause: localError.cause,
      }),
      warning: `Dashboard ${
        index + 1
      } could not be generated after ${LOCAL_STUDY_PATH_DASHBOARD_MAX_ATTEMPTS} Local AI attempts and was skipped.`,
    }
  }
}

const runLocalDashboardJobs = async (
  expectedCount: number,
  concurrency: number,
  runJob: (
    index: number,
    onProgress: (event: LocalAiProgressEvent) => void,
  ) => Promise<LocalDashboardGenerationResult>,
  progressTracker: ReturnType<typeof createLocalDashboardProgressTracker>,
): Promise<LocalDashboardGenerationResult[]> => {
  const results: LocalDashboardGenerationResult[] = []
  let nextIndex = 0

  const worker = async (workerIndex: number) => {
    const threadId = workerIndex + 1
    const threadCount = Math.min(concurrency, expectedCount)
    while (nextIndex < expectedCount) {
      const index = nextIndex
      nextIndex += 1
      const result = await runJob(index, (event) =>
        progressTracker.handleDashboardProgress(
          index,
          threadId,
          threadCount,
          event,
        ),
      )
      results.push(result)
      progressTracker.markFinished(
        index,
        threadId,
        threadCount,
        result.dashboard ? 'complete' : 'failed',
        LOCAL_STUDY_PATH_PRACTICE_TIMEOUT_MS,
      )
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, expectedCount) },
      (_value, index) => worker(index),
    ),
  )

  return results.sort((a, b) => a.index - b.index)
}

export const generateStudyPathWithLocalAi = async (
  options: GenerateStudyPathWithAiOptions,
  localOptions: LocalGenerationOptions = {},
): Promise<AiStudyPathDraft> => {
  const expectedCount = LOCAL_STUDY_PATH_DASHBOARD_COUNT
  const concurrency = normalizeLocalStudyPathConcurrency(
    localOptions.dashboardConcurrency,
  )
  const pipelineTracker = createLocalStudyPathPipelineTracker(
    expectedCount,
    concurrency,
  )
  const trackedProgressOptions: LocalGenerationOptions = {
    ...localOptions,
    onProgress: localOptions.onProgress
      ? (event) =>
          localOptions.onProgress?.(pipelineTracker.handleProgress(event))
      : undefined,
  }
  const { plan, warnings: plannerWarnings } = await createLocalStudyPathPlan(
    options,
    expectedCount,
    trackedProgressOptions,
  )
  const targetCount = 4
  const warnings: string[] = [...plannerWarnings]
  const progressTracker = createLocalDashboardProgressTracker(
    expectedCount,
    trackedProgressOptions.onProgress,
  )
  const results = await runLocalDashboardJobs(
    expectedCount,
    concurrency,
    (index, onProgress) =>
      generateLocalStudyPathDashboard(
        index,
        options,
        plan,
        expectedCount,
        targetCount,
        {
          ...trackedProgressOptions,
          onProgress,
        },
      ),
    progressTracker,
  )
  const dashboards = results
    .map((result) => result.dashboard)
    .filter((dashboard): dashboard is AiStudyPathDashboardDraft =>
      Boolean(dashboard),
    )

  results.forEach((result) => {
    if (result.warning) {
      warnings.push(result.warning)
    }
  })

  if (dashboards.length === 0) {
    const error = results.find((result) => result.error)?.error
    if (error) {
      throw error
    }

    throw new Error(
      'Google Local AI did not return usable Study Guide dashboards.',
    )
  }

  return {
    title: plan.title || options.title,
    folderName: plan.folderName,
    dashboards,
    warnings: [
      ...warnings,
      `Google Local AI generated this path with up to ${concurrency} dashboards at a time.`,
    ],
  }
}

