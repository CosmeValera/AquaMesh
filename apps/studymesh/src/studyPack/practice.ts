import {
  createApplicationQuestion,
  createFlashcardPrompt,
  conceptExplanation,
  conceptRecapGroups,
  conceptSummaryItem,
  extractLearningConcepts,
  isLowQualityStudyObject,
  LearningConcept,
} from './concepts'
import { StudyObject, StudyObjectKind, StudyQuizObject } from './types'

export type StudyPackGenerationAmount = 'few' | 'medium' | 'many'

export interface StudyPackPracticeProfile {
  amount: StudyPackGenerationAmount
  targetTotal: number
  minTotal: number
  maxTotal: number
  targetQuizzes: number
  minQuizzes: number
  targetFlashcards: number
  minFlashcards: number
  targetSupport: number
  enforceQuizzes: boolean
  enforceFlashcards: boolean
}

export interface AugmentStudyPackPracticeOptions {
  packId: string
  title: string
  rawNotes: string
  generationTargets?: string[]
  generationAmount?: StudyPackGenerationAmount
  visiblePracticeTarget?: number
  visiblePracticeOnly?: boolean
}

export interface AugmentStudyPackPracticeResult {
  objects: StudyObject[]
  addedCount: number
  visiblePracticeCount: number
  visiblePracticeAddedCount: number
  warnings: string[]
  profile: StudyPackPracticeProfile
}

const DEFAULT_TARGETS = [
  'quizzes',
  'flashcards',
  'summaries',
  'definitions',
  'reviewPrompts',
  'lists',
  'tables',
  'comparisons',
  'code',
]

const amountProfiles: Record<
  StudyPackGenerationAmount,
  Pick<StudyPackPracticeProfile, 'targetTotal' | 'minTotal' | 'maxTotal'>
> = {
  few: { targetTotal: 6, minTotal: 4, maxTotal: 7 },
  medium: { targetTotal: 11, minTotal: 8, maxTotal: 14 },
  many: { targetTotal: 18, minTotal: 14, maxTotal: 24 },
}

const reviewableKinds = new Set<StudyObjectKind>([
  'term',
  'qa',
  'quiz',
  'reveal',
  'comparison',
  'sequence',
  'reviewPrompt',
  'code',
  'list',
  'table',
])

const supportKinds = new Set<StudyObjectKind>([
  'term',
  'comparison',
  'sequence',
  'reviewPrompt',
  'code',
  'list',
  'table',
])

const supportTargetOrder = [
  'summaries',
  'definitions',
  'reviewPrompts',
  'lists',
  'tables',
]

export const getEffectiveGenerationTargets = (
  generationTargets: string[] = [],
): string[] =>
  generationTargets.length > 0 ? generationTargets : DEFAULT_TARGETS

export const createStudyPackPracticeProfile = (
  generationAmount: StudyPackGenerationAmount = 'medium',
  generationTargets: string[] = [],
): StudyPackPracticeProfile => {
  const amount = generationAmount
  const base = amountProfiles[amount]
  const targets = getEffectiveGenerationTargets(generationTargets)
  const enforceQuizzes = targets.includes('quizzes')
  const enforceFlashcards = targets.includes('flashcards')
  const targetQuizzes = enforceQuizzes ? Math.round(base.targetTotal * 0.55) : 0
  const minQuizzes = enforceQuizzes ? Math.ceil(base.minTotal * 0.5) : 0
  const targetFlashcards = enforceFlashcards
    ? Math.max(1, Math.round(base.targetTotal * 0.25))
    : 0
  const minFlashcards = enforceFlashcards
    ? Math.max(1, Math.floor(base.minTotal * 0.2))
    : 0

  return {
    amount,
    ...base,
    targetQuizzes,
    minQuizzes,
    targetFlashcards,
    minFlashcards,
    targetSupport: Math.max(
      0,
      base.targetTotal - targetQuizzes - targetFlashcards,
    ),
    enforceQuizzes,
    enforceFlashcards,
  }
}

export const isReviewableStudyObject = (object: StudyObject): boolean =>
  reviewableKinds.has(object.kind)

export const isVisiblePracticeStudyObject = (object: StudyObject): boolean =>
  object.kind === 'quiz' || object.kind === 'qa' || object.kind === 'reveal'

const objectMatchesTargets = (
  object: StudyObject,
  targets: string[],
): boolean => {
  if (object.kind === 'quiz') {
    return targets.includes('quizzes')
  }

  if (object.kind === 'qa' || object.kind === 'reveal') {
    return targets.includes('flashcards')
  }

  if (object.kind === 'term') {
    return targets.includes('definitions')
  }

  if (object.kind === 'reviewPrompt') {
    return targets.includes('reviewPrompts')
  }

  if (object.kind === 'list' || object.kind === 'sequence') {
    return targets.includes('lists') || targets.includes('summaries')
  }

  if (object.kind === 'table') {
    return targets.includes('tables')
  }

  if (object.kind === 'comparison') {
    return targets.includes('comparisons')
  }

  if (object.kind === 'code') {
    return targets.includes('code')
  }

  if (object.kind === 'note' || object.kind === 'markdown') {
    return targets.includes('summaries')
  }

  return true
}

const hashValue = (value: string): number => {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

const reorderOptions = (
  options: string[],
  correctAnswer: string,
  targetIndex: number,
): string[] => {
  const wrongOptions = options.filter((option) => option !== correctAnswer)
  const nextOptions = [...wrongOptions]
  nextOptions.splice(targetIndex, 0, correctAnswer)

  return nextOptions
}

export const shuffleStudyQuizOptions = (
  quiz: StudyQuizObject,
): StudyQuizObject => {
  if (quiz.quizMode !== 'multipleChoice' || quiz.options.length < 2) {
    return quiz
  }

  const currentAnswer = quiz.answer || quiz.options[quiz.correctIndex] || ''
  if (!currentAnswer) {
    return quiz
  }

  const uniqueOptions = Array.from(new Set(quiz.options))
  if (uniqueOptions.length < 2 || !uniqueOptions.includes(currentAnswer)) {
    return quiz
  }

  const targetIndex =
    hashValue(`${quiz.id}:${quiz.question}`) % uniqueOptions.length
  const options = reorderOptions(uniqueOptions, currentAnswer, targetIndex)

  return {
    ...quiz,
    options,
    correctIndex: options.findIndex((option) => option === currentAnswer),
    answer: currentAnswer,
  }
}

export const shuffleStudyObjectQuizOptions = (
  object: StudyObject,
): StudyObject =>
  object.kind === 'quiz' ? shuffleStudyQuizOptions(object) : object

const sanitizeIdPart = (value: string): string => {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || 'study-pack'
}

const normalizeSpaces = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const normalizeForCompare = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const stripMarkdown = (value: string): string =>
  value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(
      /\b(?:Quiz|Flashcard|Definition|Reveal|Sequence|Comparison|Checklist|Formula|Example)::/gi,
      '',
    )
    .replace(/\s+\|\s+/g, '. ')
    .replace(/^[#>\-*+\d.)\s[\]xX]+/gm, '')
    .replace(/\|/g, ' ')

const splitIntoFacts = (rawNotes: string): string[] => {
  const cleaned = stripMarkdown(rawNotes)
  const chunks = cleaned
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((chunk) => normalizeSpaces(chunk))
    .map((chunk) => (chunk.length > 420 ? `${chunk.slice(0, 417)}...` : chunk))
    .filter((chunk) => {
      const words = chunk.split(/\s+/).filter(Boolean)
      return chunk.length >= 18 && words.length >= 4
    })

  const seen = new Set<string>()
  return chunks.filter((chunk) => {
    const key = chunk.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const conceptToFact = (concept: LearningConcept): string =>
  conceptSummaryItem(concept)

const extractConcept = (fact: string, title: string): string => {
  const quotedConcept = fact.match(/["'“‘]([^"'”’]{2,60})["'”’]/)?.[1]
  const definitionMatch = fact.match(
    /^(.{2,80}?)\s+(?:is|are|was|were|means|refers to|es|son|fue|era|significa|consiste en)\s+/i,
  )
  const rawConcept = quotedConcept || definitionMatch?.[1] || fact
  const concept = normalizeSpaces(
    rawConcept
      .replace(/^(?:the|a|an|el|la|los|las|un|una)\s+/i, '')
      .split(/[,:;()[\].]/)[0],
  )
  const words = concept.split(/\s+/).filter(Boolean)

  const shortened = words.slice(0, 8).join(' ')
  const normalizedConcept = normalizeForCompare(shortened)
  const normalizedTitle = normalizeForCompare(title)

  if (
    !shortened ||
    (normalizedTitle &&
      (normalizedConcept === normalizedTitle ||
        normalizedTitle.includes(normalizedConcept) ||
        normalizedConcept.includes(normalizedTitle)))
  ) {
    return 'this lesson point'
  }

  return shortened
}

const isUsefulPracticeFact = (fact: string, title: string): boolean => {
  const words = fact.split(/\s+/).filter(Boolean)
  const normalizedFact = normalizeForCompare(fact)
  const normalizedTitle = normalizeForCompare(title)

  if (words.length < 8) {
    return /[=:]|\b(?:is|are|means|refers to|es|son|significa)\b/i.test(fact)
  }

  if (normalizedTitle && normalizedFact === normalizedTitle) {
    return false
  }

  if (
    /^(introduction|theory|examples|practice|final review|next steps)\b/i.test(
      fact,
    )
  ) {
    return words.length >= 14
  }

  return true
}

const createQuiz = (
  packId: string,
  index: number,
  fact: string,
  _facts: string[],
  title: string,
): StudyObject => {
  const concept = extractConcept(fact, title)

  return {
    id: `${packId}-practice-quiz-${index + 1}`,
    kind: 'quiz',
    title: `${concept} practice`,
    sourceLine: index + 1,
    tags: ['study-pack', 'practice'],
    quizMode: 'multipleChoice',
    question:
      concept === 'this lesson point'
        ? 'How would you apply this lesson point in a new example?'
        : `How would you apply ${concept} in a new example?`,
    options: [
      fact,
      'Ignore the lesson and guess from the title only.',
      'Use the opposite of the lesson explanation.',
    ],
    correctIndex: 0,
    answer: fact,
    explanation: fact,
  }
}

const createConceptQuiz = (
  packId: string,
  index: number,
  concept: LearningConcept,
): StudyObject => {
  const question = createApplicationQuestion(concept, index)

  return {
    id: `${packId}-practice-quiz-${index + 1}`,
    kind: 'quiz',
    title: `${concept.concept} practice`,
    sourceLine: concept.sourceLine,
    tags: ['study-pack', 'practice', 'concept-first'],
    ...question,
  }
}

const createConceptFlashcard = (
  packId: string,
  index: number,
  concept: LearningConcept,
): StudyObject => ({
  id: `${packId}-practice-flashcard-${index + 1}`,
  kind: 'qa',
  title: `${concept.concept} flashcard`,
  sourceLine: concept.sourceLine,
  tags: ['study-pack', 'practice', 'concept-first'],
  question: createFlashcardPrompt(concept),
  answer: conceptExplanation(concept),
})

const createConceptDefinition = (
  packId: string,
  index: number,
  concept: LearningConcept,
): StudyObject => ({
  id: `${packId}-practice-definition-${index + 1}`,
  kind: 'term',
  title: `${concept.concept} definition`,
  sourceLine: concept.sourceLine,
  tags: ['study-pack', 'practice', 'concept-first'],
  term: concept.concept,
  definition: conceptExplanation(concept),
})

const createConceptSummaryList = (
  packId: string,
  index: number,
  concepts: LearningConcept[],
  title: string,
): StudyObject => {
  const groups = conceptRecapGroups(concepts)
  const items =
    groups.length > 0
      ? groups.flatMap((group) => [
          group.label,
          ...group.items.map((item) => `- ${item}`),
        ])
      : concepts.slice(index, index + 5).map(conceptSummaryItem)

  return {
    id: `${packId}-practice-summary-${index + 1}`,
    kind: 'list',
    title: `${title || 'Study Pack'} concept recap`,
    sourceLine: concepts[index]?.sourceLine || index + 1,
    tags: ['study-pack', 'practice', 'concept-first'],
    items,
    ordered: false,
    checklist: false,
  }
}

const createConceptReviewPrompt = (
  packId: string,
  index: number,
  concept: LearningConcept,
): StudyObject => ({
  id: `${packId}-practice-review-${index + 1}`,
  kind: 'reviewPrompt',
  title: `${concept.concept} review`,
  sourceLine: concept.sourceLine,
  tags: ['study-pack', 'practice', 'concept-first'],
  prompt: `Apply ${concept.concept} to a fresh example and explain the rule you used.`,
  reason: conceptExplanation(concept),
  status: 'needsReview',
})

const createFlashcard = (
  packId: string,
  index: number,
  fact: string,
  title: string,
): StudyObject => {
  const concept = extractConcept(fact, title)

  return {
    id: `${packId}-practice-flashcard-${index + 1}`,
    kind: 'qa',
    title: `${concept} flashcard`,
    sourceLine: index + 1,
    tags: ['study-pack', 'practice'],
    question:
      concept === 'this lesson point'
        ? 'What is the key idea in this note?'
        : `Explain the main use or idea of ${concept}.`,
    answer: fact,
  }
}

const createDefinition = (
  packId: string,
  index: number,
  fact: string,
  title: string,
): StudyObject => {
  const concept = extractConcept(fact, title)

  return {
    id: `${packId}-practice-definition-${index + 1}`,
    kind: 'term',
    title: `${concept} definition`,
    sourceLine: index + 1,
    tags: ['study-pack', 'practice'],
    term: concept,
    definition: fact,
  }
}

const createSummaryList = (
  packId: string,
  index: number,
  facts: string[],
  title: string,
): StudyObject => {
  const items =
    facts.length > 0 ? facts.slice(0, 5) : ['Review the source notes.']

  return {
    id: `${packId}-practice-summary-${index + 1}`,
    kind: 'list',
    title: `${title || 'Study Pack'} summary`,
    sourceLine: index + 1,
    tags: ['study-pack', 'practice'],
    items,
    ordered: false,
    checklist: false,
  }
}

const createFactTable = (
  packId: string,
  index: number,
  facts: string[],
  title: string,
): StudyObject => {
  const rows = (
    facts.length > 0 ? facts.slice(0, 5) : ['Review the source notes.']
  ).map((fact, factIndex) => [String(factIndex + 1), fact])

  return {
    id: `${packId}-practice-table-${index + 1}`,
    kind: 'table',
    title: `${title || 'Study Pack'} key facts`,
    sourceLine: index + 1,
    tags: ['study-pack', 'practice'],
    headers: ['#', 'Source fact'],
    rows,
  }
}

const createSupportPrompt = (
  packId: string,
  index: number,
  fact: string,
  title: string,
): StudyObject => {
  const concept = extractConcept(fact, title)

  return {
    id: `${packId}-practice-review-${index + 1}`,
    kind: 'reviewPrompt',
    title: `${concept} review`,
    sourceLine: index + 1,
    tags: ['study-pack', 'practice'],
    prompt: `Review this source point: ${fact}`,
    reason: 'Generated to keep the Study Pack practice-focused.',
    status: 'needsReview',
  }
}

const getSupportTargets = (targets: string[]): string[] =>
  supportTargetOrder.filter((target) => targets.includes(target))

const createSupportObject = (
  target: string,
  packId: string,
  index: number,
  fact: string,
  facts: string[],
  title: string,
): StudyObject => {
  if (target === 'definitions') {
    return createDefinition(packId, index, fact, title)
  }

  if (target === 'summaries' || target === 'lists') {
    return createSummaryList(packId, index, facts.slice(index), title)
  }

  if (target === 'tables') {
    return createFactTable(packId, index, facts.slice(index), title)
  }

  return createSupportPrompt(packId, index, fact, title)
}

const createConceptSupportObject = (
  target: string,
  packId: string,
  index: number,
  concept: LearningConcept,
  concepts: LearningConcept[],
  title: string,
): StudyObject => {
  if (target === 'definitions') {
    return createConceptDefinition(packId, index, concept)
  }

  if (target === 'summaries' || target === 'lists') {
    return createConceptSummaryList(packId, index, concepts, title)
  }

  return createConceptReviewPrompt(packId, index, concept)
}

const countReviewable = (objects: StudyObject[]) =>
  objects.filter(isReviewableStudyObject).length

const countKind = (objects: StudyObject[], kind: StudyObjectKind) =>
  objects.filter((object) => object.kind === kind).length

const countSupport = (objects: StudyObject[]) =>
  objects.filter((object) => supportKinds.has(object.kind)).length

const countVisiblePractice = (objects: StudyObject[]) =>
  objects.filter(isVisiblePracticeStudyObject).length

const hasObjectId = (objects: StudyObject[], id: string): boolean =>
  objects.some((object) => object.id === id)

const pushUnique = (objects: StudyObject[], object: StudyObject): void => {
  if (!hasObjectId(objects, object.id)) {
    objects.push(object)
  }
}

const pushNextQuiz = ({
  objects,
  concepts,
  packId,
  nextConcept,
  nextFact,
  facts,
  title,
}: {
  objects: StudyObject[]
  concepts: LearningConcept[]
  packId: string
  nextConcept: () => LearningConcept
  nextFact: () => string
  facts: string[]
  title: string
}): void => {
  pushUnique(
    objects,
    concepts.length > 0
      ? createConceptQuiz(packId, countKind(objects, 'quiz'), nextConcept())
      : createQuiz(
          packId,
          countKind(objects, 'quiz'),
          nextFact(),
          facts,
          title,
        ),
  )
}

const pushNextFlashcard = ({
  objects,
  concepts,
  packId,
  nextConcept,
  nextFact,
  title,
}: {
  objects: StudyObject[]
  concepts: LearningConcept[]
  packId: string
  nextConcept: () => LearningConcept
  nextFact: () => string
  title: string
}): void => {
  pushUnique(
    objects,
    concepts.length > 0
      ? createConceptFlashcard(packId, countKind(objects, 'qa'), nextConcept())
      : createFlashcard(packId, countKind(objects, 'qa'), nextFact(), title),
  )
}

export const augmentStudyPackPracticeObjects = (
  inputObjects: StudyObject[],
  options: AugmentStudyPackPracticeOptions,
): AugmentStudyPackPracticeResult => {
  const profile = createStudyPackPracticeProfile(
    options.generationAmount,
    options.generationTargets,
  )
  const packId = sanitizeIdPart(options.packId || options.title)
  const targets = getEffectiveGenerationTargets(options.generationTargets)
  const supportTargets = getSupportTargets(targets)
  const objects = inputObjects
    .filter((object) => objectMatchesTargets(object, targets))
    .filter((object) => !isLowQualityStudyObject(object, options.title))
    .map(shuffleStudyObjectQuizOptions)
  const concepts = extractLearningConcepts(options.rawNotes, options.title)
  const facts = (
    concepts.length > 0
      ? concepts.map(conceptToFact)
      : splitIntoFacts(options.rawNotes)
  ).filter((fact) => isUsefulPracticeFact(fact, options.title))
  const warnings: string[] = []

  if (facts.length === 0) {
    return {
      objects,
      addedCount: 0,
      visiblePracticeCount: countVisiblePractice(objects),
      visiblePracticeAddedCount: 0,
      warnings,
      profile,
    }
  }

  const startingCount = objects.length
  const startingVisiblePracticeCount = countVisiblePractice(objects)
  const visiblePracticeTarget =
    options.visiblePracticeTarget || Number.POSITIVE_INFINITY
  let cursor = 0
  const nextFact = () => {
    const fact = facts[cursor % facts.length]
    cursor += 1
    return fact
  }
  const nextConcept = () => {
    const concept = concepts[cursor % concepts.length]
    cursor += 1
    return concept
  }

  if (profile.enforceQuizzes) {
    while (
      countKind(objects, 'quiz') < profile.targetQuizzes &&
      countReviewable(objects) < profile.maxTotal &&
      countVisiblePractice(objects) < visiblePracticeTarget
    ) {
      pushNextQuiz({
        objects,
        concepts,
        packId,
        nextConcept,
        nextFact,
        facts,
        title: options.title,
      })
    }
  }

  if (profile.enforceFlashcards) {
    while (
      countKind(objects, 'qa') < profile.targetFlashcards &&
      countReviewable(objects) < profile.maxTotal &&
      countVisiblePractice(objects) < visiblePracticeTarget
    ) {
      pushNextFlashcard({
        objects,
        concepts,
        packId,
        nextConcept,
        nextFact,
        title: options.title,
      })
    }
  }

  while (
    countReviewable(objects) < profile.targetTotal &&
    countReviewable(objects) < profile.maxTotal &&
    countVisiblePractice(objects) < visiblePracticeTarget
  ) {
    if (
      profile.enforceQuizzes &&
      countKind(objects, 'quiz') < profile.minQuizzes
    ) {
      pushNextQuiz({
        objects,
        concepts,
        packId,
        nextConcept,
        nextFact,
        facts,
        title: options.title,
      })
      continue
    }

    if (
      profile.enforceFlashcards &&
      countKind(objects, 'qa') < profile.minFlashcards
    ) {
      pushNextFlashcard({
        objects,
        concepts,
        packId,
        nextConcept,
        nextFact,
        title: options.title,
      })
      continue
    }

    if (supportTargets.length === 0) {
      break
    }

    const supportIndex = countSupport(objects)
    const target = supportTargets[supportIndex % supportTargets.length]
    pushUnique(
      objects,
      concepts.length > 0
        ? createConceptSupportObject(
            target,
            packId,
            supportIndex,
            nextConcept(),
            concepts,
            options.title,
          )
        : createSupportObject(
            target,
            packId,
            supportIndex,
            nextFact(),
            facts,
            options.title,
          ),
    )
  }

  if (
    options.visiblePracticeTarget &&
    options.visiblePracticeTarget > countVisiblePractice(objects) &&
    (profile.enforceQuizzes || profile.enforceFlashcards)
  ) {
    while (countVisiblePractice(objects) < options.visiblePracticeTarget) {
      const quizCount = countKind(objects, 'quiz')
      const flashcardCount =
        countKind(objects, 'qa') + countKind(objects, 'reveal')
      const shouldAddQuiz =
        profile.enforceQuizzes &&
        (!profile.enforceFlashcards || quizCount <= flashcardCount)

      if (shouldAddQuiz) {
        pushNextQuiz({
          objects,
          concepts,
          packId,
          nextConcept,
          nextFact,
          facts,
          title: options.title,
        })
        continue
      }

      if (profile.enforceFlashcards) {
        pushNextFlashcard({
          objects,
          concepts,
          packId,
          nextConcept,
          nextFact,
          title: options.title,
        })
        continue
      }

      break
    }
  }

  const finalObjects = options.visiblePracticeOnly
    ? objects.filter(isVisiblePracticeStudyObject)
    : objects
  const addedCount = finalObjects.length - startingCount
  const visiblePracticeCount = countVisiblePractice(finalObjects)

  return {
    objects: finalObjects.map(shuffleStudyObjectQuizOptions),
    addedCount,
    visiblePracticeCount,
    visiblePracticeAddedCount:
      visiblePracticeCount - startingVisiblePracticeCount,
    warnings,
    profile,
  }
}
