import { StudyObject, StudyQuizObject } from './types'

export type LearningConceptType =
  | 'formation'
  | 'usage'
  | 'contrast'
  | 'common_mistake'
  | 'exception'
  | 'definition'

export interface LearningConcept {
  concept: string
  type: LearningConceptType
  explanation: string
  example: string
  correctAnswer: string
  expectedLearning: string
  distractors?: string[]
  sourceLine: number
  definition: string
  formationRule: string
  usageRule: string
  commonMistake: string
  contrast: string
}

const blockedConcepts = new Set([
  'active',
  'au niveau b1',
  'avoir',
  'but',
  'cause',
  'conjonctions de but',
  'de',
  'etre',
  'être',
  'example',
  'goal',
  'it',
  'quantity',
])

const genericPromptPattern =
  /what does .+ help you understand or do|core idea behind|which statement best explains|what do the notes say|which statement matches the notes|according to the notes/i

const normalizeSpaces = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

export const normalizeConceptKey = (value: string): string =>
  normalizeSpaces(
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, ' '),
  )

const words = (value: string): string[] => value.split(/\s+/).filter(Boolean)

const stripMarkdown = (value: string): string =>
  value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(
      /\b(?:Quiz|Flashcard|Definition|Reveal|Sequence|Comparison|Checklist|Formula|Example)::/gi,
      '',
    )
    .replace(/\|/g, '. ')

const stripListMarker = (value: string): string =>
  normalizeSpaces(value.replace(/^[#>\-*+\d.)\s[\]xX]+/, ''))

const splitSentences = (value: string): string[] =>
  stripMarkdown(value)
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map(stripListMarker)
    .filter(Boolean)

const looksInstructional = (value: string): boolean =>
  /\b(?:return|create|generate|write|use this dashboard|answer mixed exercises|review the previous|do not|must|should|json|objects|dashboard|study guide)\b/i.test(
    value,
  )

const looksTitleLike = (value: string): boolean => {
  const tokens = words(value)
  if (tokens.length === 0 || tokens.length > 6) {
    return false
  }

  return (
    tokens.length >= 2 &&
    !/[.!?;:]/.test(value) &&
    tokens.every((token) => /^[A-Z0-9À-ÖØ-Þ]/.test(token))
  )
}

const looksSentenceFragment = (value: string): boolean => {
  const candidate = normalizeSpaces(value)

  return (
    /^(?:du|de la|des|pour la|que|qui|dont|et|ou|mais|because|when|while|to|for)\b/i.test(
      candidate,
    ) ||
    /\b(?:pour la|for the|because the)$\b/i.test(candidate) ||
    /^[a-zà-öø-ÿ]/.test(candidate)
  )
}

const isIntroMetaPhrase = (value: string): boolean =>
  /^(?:au niveau|introduction|overview|goal|example|examples|practice|final review|key points?|remember|definition)\b/i.test(
    value,
  ) ||
  /\b(?:est souvent introduit|is often introduced|this lesson|this dashboard)\b/i.test(
    value,
  )

const isExpandedRuleLabel = (value: string): boolean =>
  /\b(?:trigger|formation|ending|mistake|contrast|exception|rule|irregular|conjugation|conjugaison|indicative|indicatif|vs)\b/i.test(
    value,
  )

export const isBadConceptCandidate = (value: string, title = ''): boolean => {
  const candidate = normalizeSpaces(value.replace(/^#+\s*/, ''))
  const key = normalizeConceptKey(candidate)
  const titleKey = normalizeConceptKey(title)
  const tokenCount = words(candidate).length

  if (!candidate || candidate.length < 4) {
    return true
  }

  if (blockedConcepts.has(key)) {
    return true
  }

  if (titleKey && key === titleKey) {
    return true
  }

  if (genericPromptPattern.test(candidate)) {
    return true
  }

  if (looksInstructional(candidate) || isIntroMetaPhrase(candidate)) {
    return true
  }

  if (looksSentenceFragment(candidate) && !isExpandedRuleLabel(candidate)) {
    return true
  }

  if (
    tokenCount <= 2 &&
    !isExpandedRuleLabel(candidate) &&
    candidate === candidate.toLowerCase()
  ) {
    return true
  }

  if (looksTitleLike(candidate) && !isExpandedRuleLabel(candidate)) {
    return true
  }

  return false
}

const asString = (value: unknown): string =>
  typeof value === 'string' ? normalizeSpaces(value) : ''

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean)
    : []

const conceptTypeFromRecord = (
  input: Record<string, unknown>,
): LearningConceptType => {
  const explicit = asString(input.type)
  if (
    explicit === 'formation' ||
    explicit === 'usage' ||
    explicit === 'contrast' ||
    explicit === 'common_mistake' ||
    explicit === 'exception' ||
    explicit === 'definition'
  ) {
    return explicit
  }

  if (asString(input.formationRule)) {
    return 'formation'
  }

  if (asString(input.commonMistake)) {
    return 'common_mistake'
  }

  if (asString(input.contrast)) {
    return 'contrast'
  }

  if (/\b(?:exception|except|sauf)\b/i.test(asString(input.definition))) {
    return 'exception'
  }

  if (asString(input.usageRule)) {
    return 'usage'
  }

  return 'definition'
}

const firstNonEmpty = (...values: string[]): string =>
  values.find((value) => value.trim()) || ''

const createConcept = (
  concept: string,
  type: LearningConceptType,
  explanation: string,
  sourceLine: number,
  overrides: Partial<LearningConcept> = {},
): LearningConcept => {
  const correctAnswer = normalizeSpaces(
    overrides.correctAnswer || explanation || concept,
  )
  const expectedLearning = normalizeSpaces(
    overrides.expectedLearning || explanation || correctAnswer,
  )

  return {
    concept: normalizeSpaces(concept),
    type,
    explanation: normalizeSpaces(explanation),
    example: normalizeSpaces(overrides.example || ''),
    correctAnswer,
    expectedLearning,
    distractors: overrides.distractors?.filter(Boolean),
    sourceLine,
    definition: normalizeSpaces(overrides.definition || ''),
    formationRule: normalizeSpaces(overrides.formationRule || ''),
    usageRule: normalizeSpaces(overrides.usageRule || ''),
    commonMistake: normalizeSpaces(overrides.commonMistake || ''),
    contrast: normalizeSpaces(overrides.contrast || ''),
  }
}

const hasConceptSubstance = (concept: LearningConcept): boolean => {
  if (isBadConceptCandidate(concept.concept)) {
    return false
  }

  if (words(concept.explanation).length < 6) {
    return false
  }

  if (!concept.correctAnswer || !concept.expectedLearning) {
    return false
  }

  if (
    normalizeConceptKey(concept.correctAnswer) ===
      normalizeConceptKey(concept.concept) &&
    words(concept.correctAnswer).length <= 3
  ) {
    return false
  }

  return true
}

export const normalizeLearningConcepts = (
  value: unknown,
  title = '',
): LearningConcept[] => {
  const records = Array.isArray(value) ? value : []
  const seen = new Set<string>()

  return records
    .map((record, index): LearningConcept | null => {
      if (!record || typeof record !== 'object') {
        return null
      }

      const input = record as Record<string, unknown>
      const concept = asString(input.concept)
      if (isBadConceptCandidate(concept, title)) {
        return null
      }

      const type = conceptTypeFromRecord(input)
      const definition = asString(input.definition)
      const formationRule = asString(input.formationRule)
      const usageRule = asString(input.usageRule)
      const commonMistake = asString(input.commonMistake)
      const contrast = asString(input.contrast)
      const explanation = firstNonEmpty(
        asString(input.explanation),
        formationRule,
        usageRule,
        commonMistake,
        contrast,
        definition,
      )
      const next = createConcept(concept, type, explanation, index + 1, {
        definition,
        formationRule,
        usageRule,
        commonMistake,
        contrast,
        example: asString(input.example),
        correctAnswer: firstNonEmpty(asString(input.correctAnswer), explanation),
        expectedLearning: firstNonEmpty(
          asString(input.expectedLearning),
          explanation,
        ),
        distractors: asStringArray(input.distractors),
        sourceLine: Number(input.sourceLine) || index + 1,
      })
      const key = normalizeConceptKey(next.concept)
      if (seen.has(key) || !hasConceptSubstance(next)) {
        return null
      }

      seen.add(key)
      return { ...next, sourceLine: Number(input.sourceLine) || index + 1 }
    })
    .filter((concept): concept is LearningConcept => Boolean(concept))
}

const subjunctiveName = (sentence: string): string =>
  /\bsubjonctif\b/i.test(sentence)
    ? 'subjonctif'
    : /\bsubjunctive\b/i.test(sentence)
    ? 'subjunctive'
    : 'target rule'

const createConceptFromSentence = (
  sentence: string,
  sourceLine: number,
): LearningConcept | null => {
  if (
    looksInstructional(sentence) ||
    isIntroMetaPhrase(sentence) ||
    looksSentenceFragment(sentence)
  ) {
    return null
  }

  const target = subjunctiveName(sentence)
  if (
    /\b(?:mistake|erreur|avoid|confuse|incorrect|wrong|instead of|au lieu de|ne pas|not)\b/i.test(
      sentence,
    )
  ) {
    return createConcept(`${target} common mistake`, 'common_mistake', sentence, sourceLine, {
      commonMistake: sentence,
      correctAnswer: sentence,
    })
  }

  const trigger = sentence.match(
    /\b(il faut que|bien que|pour que|afin que|avant que|quoique|jusqu['’]a ce que|jusqu['’]à ce que|although|so that|provided that)\b/i,
  )?.[1]
  if (trigger) {
    return createConcept(
      `${target[0].toUpperCase()}${target.slice(1)} trigger: ${trigger}`,
      'usage',
      sentence,
      sourceLine,
      {
        usageRule: sentence,
        correctAnswer: trigger,
        expectedLearning: `${trigger} introduces or requires the ${target}.`,
        distractors: ['parce que', 'quand', 'apres que'],
      },
    )
  }

  if (
    /\b(?:formation|formed|form|conjugat|conjugaison|endings?|terminaisons?|radical|stem)\b/i.test(
      sentence,
    )
  ) {
    return createConcept(`${target} formation rule`, 'formation', sentence, sourceLine, {
      formationRule: sentence,
      correctAnswer: sentence,
    })
  }

  if (/\b(?:exception|except|sauf|irregular|irregulier|irrégulier)\b/i.test(sentence)) {
    return createConcept(`${target} exception`, 'exception', sentence, sourceLine, {
      definition: sentence,
      correctAnswer: sentence,
    })
  }

  const definitionMatch = sentence.match(
    /^(.{3,70}?)\s+(?:is|are|means|refers to|consists of|se define como|consiste en|es|son|significa)\s+(.{12,})/iu,
  )
  if (definitionMatch) {
    return createConcept(
      normalizeSpaces(definitionMatch[1]),
      'definition',
      sentence,
      sourceLine,
      {
        definition: sentence,
        correctAnswer: normalizeSpaces(definitionMatch[2]),
      },
    )
  }

  if (
    /\b(?:indicatif|indicative)\b/i.test(sentence) &&
    /\b(?:subjonctif|subjunctive)\b/i.test(sentence)
  ) {
    return createConcept(
      `${target} vs indicative`,
      'contrast',
      sentence,
      sourceLine,
      {
        contrast: sentence,
        correctAnswer: sentence,
      },
    )
  }

  return null
}

export const extractLearningConcepts = (
  rawNotes: string,
  title = '',
): LearningConcept[] => {
  const concepts = splitSentences(rawNotes)
    .map(createConceptFromSentence)
    .filter((concept): concept is LearningConcept => Boolean(concept))

  return normalizeLearningConcepts(concepts, title)
}

export const conceptExplanation = (concept: LearningConcept): string =>
  [
    concept.explanation,
    concept.example ? `Example: ${concept.example}` : '',
  ]
    .map(normalizeSpaces)
    .filter(Boolean)
    .join(' ')

export const conceptSummaryItem = (concept: LearningConcept): string =>
  `${concept.concept}: ${conceptExplanation(concept)}`

export const conceptRecapGroups = (
  concepts: LearningConcept[],
): { label: string; items: string[] }[] => {
  const labels: Record<LearningConceptType, string> = {
    formation: 'Formation rules',
    usage: 'Triggers and uses',
    contrast: 'Contrasts',
    common_mistake: 'Common mistakes',
    exception: 'Exceptions',
    definition: 'Key ideas',
  }

  return (
    [
      'formation',
      'usage',
      'exception',
      'contrast',
      'common_mistake',
      'definition',
    ] as LearningConceptType[]
  )
    .map((type) => ({
      label: labels[type],
      items: concepts
        .filter((concept) => concept.type === type)
        .map(conceptSummaryItem),
    }))
    .filter((group) => group.items.length > 0)
}

export const isLowQualityStudyObject = (
  object: StudyObject,
  title = '',
): boolean => {
  if (object.kind === 'term') {
    return isBadConceptCandidate(object.term, title)
  }

  if (object.kind === 'qa') {
    return (
      genericPromptPattern.test(object.question) ||
      object.answer.trim().length < 2 ||
      normalizeConceptKey(object.question) === normalizeConceptKey(object.answer)
    )
  }

  if (object.kind === 'quiz') {
    return (
      genericPromptPattern.test(object.question) ||
      words(object.question).length < 4 ||
      (object.answer || object.explanation).trim().length < 1
    )
  }

  if (object.kind === 'list') {
    return object.items.every((item) => isBadConceptCandidate(item, title))
  }

  return false
}

const createQuestionStem = (concept: LearningConcept): string => {
  if (concept.type === 'formation') {
    return `How do you form ${concept.concept.replace(/\s+rule$/i, '')}?`
  }

  if (concept.type === 'usage') {
    return `Which expression or context requires ${concept.concept.replace(
      /^.+trigger:\s*/i,
      '',
    )}?`
  }

  if (concept.type === 'contrast') {
    return `How do you choose between the forms in ${concept.concept}?`
  }

  if (concept.type === 'common_mistake') {
    return `What mistake should you fix for ${concept.concept}?`
  }

  if (concept.type === 'exception') {
    return `What exception behavior applies to ${concept.concept}?`
  }

  return `What rule does ${concept.concept} describe?`
}

export const createApplicationQuestion = (
  concept: LearningConcept,
  _index: number,
): Pick<
  StudyQuizObject,
  | 'quizMode'
  | 'question'
  | 'options'
  | 'correctIndex'
  | 'answer'
  | 'explanation'
> => {
  const answer = concept.correctAnswer || conceptExplanation(concept)
  const distractors = (concept.distractors || []).filter(
    (option) => normalizeConceptKey(option) !== normalizeConceptKey(answer),
  )
  const options =
    distractors.length > 0
      ? [answer, ...distractors].slice(0, 4)
      : []

  return {
    quizMode: options.length >= 2 ? 'multipleChoice' : 'shortAnswer',
    question: createQuestionStem(concept),
    options,
    correctIndex: 0,
    answer,
    explanation: conceptExplanation(concept),
  }
}

export const createFlashcardPrompt = (concept: LearningConcept): string => {
  if (concept.type === 'formation') {
    return `How do you form ${concept.concept.replace(/\s+rule$/i, '')}?`
  }

  if (concept.type === 'usage') {
    return `When do you use ${concept.concept}?`
  }

  if (concept.type === 'contrast') {
    return `How do you decide the contrast in ${concept.concept}?`
  }

  if (concept.type === 'common_mistake') {
    return `What common mistake should you avoid with ${concept.concept}?`
  }

  if (concept.type === 'exception') {
    return `What is the exception for ${concept.concept}?`
  }

  return `What should you know about ${concept.concept}?`
}
