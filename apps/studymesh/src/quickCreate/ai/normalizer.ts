import { z } from 'zod'
import {
  StudyObject,
  QuickCreateSourceFormat,
  StudyPathDashboardPurpose,
  StudyPathDashboardRole,
  StudyPathPracticeType,
  StudyPathSourceRef,
} from '../types'
import {
  detectContentLanguage,
  type StudyMeshLanguageCode,
} from '../../language/contentLanguage'

const normalizeSpaces = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const asTitle = (value: string, fallback: string): string =>
  normalizeSpaces(value) || fallback

const normalizeKey = (value: string): string =>
  normalizeSpaces(
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, ' '),
  )

const sentenceFragments = (value: string): string[] =>
  normalizeSpaces(value)
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map(normalizeSpaces)
    .filter((fragment) => fragment.split(/\s+/).length >= 5)

const genericQuestionPattern =
  /what rule does|what does .+ help you understand|core idea behind|which statement best explains|what do the notes say|according to the notes|which statement matches/i
const malformedQuestionPattern =
  /(?:^|\s)#{1,6}\s|\bwhat does this describe\b|\bthis describe\b/i

const bannedQuizOptionPattern =
  /^(?:[a-d]|option\s+[a-d]|choice\s+[a-d]|all of the above|none of the above)$/i

const lazyQuizOptionPattern =
  /\b(?:not supported|opposite of|guess from the title|review the notes|not enough information)\b/i

const lazyQuizFeedbackPattern =
  /\b(?:this option misses|misses the (?:guide'?s|lesson'?s|notes'?|main) (?:main )?(?:distinction|point|idea)|does not address the main distinction|not the main distinction|review the (?:guide|lesson|notes)|too vague|not supported by the (?:guide|lesson|notes))\b/i

const isCopiedFromSource = (question: string, rawNotes = ''): boolean => {
  const key = normalizeKey(question)
  if (!key || !rawNotes.trim()) {
    return false
  }

  return sentenceFragments(rawNotes).some((fragment) => {
    const fragmentKey = normalizeKey(fragment)
    return (
      key.length >= 32 &&
      (fragmentKey.includes(key) || key.includes(fragmentKey))
    )
  })
}

const isUsefulQuestion = (question: string, rawNotes = ''): boolean =>
  question.split(/\s+/).filter(Boolean).length >= 4 &&
  !genericQuestionPattern.test(question) &&
  !malformedQuestionPattern.test(question) &&
  !isCopiedFromSource(question, rawNotes)

const compactQuizFeedback = (value: string): string => {
  const compact = normalizeSpaces(value).replace(
    /\bAnalyzed answer distinctions[^.?!]*(?:[.?!]\s*)?/gi,
    '',
  )
  const firstSentence = compact.match(/^.{24,180}?[.!?](?=\s|$)/)?.[0]
  const candidate = firstSentence || compact

  return candidate.length > 180
    ? `${candidate.slice(0, 177).trim()}...`
    : candidate
}

const isUsefulQuizFeedback = (value: string): boolean =>
  value.split(/\s+/).filter(Boolean).length >= 5 &&
  !lazyQuizFeedbackPattern.test(value)

const shortenFeedbackFragment = (value: string): string => {
  const compact = compactQuizFeedback(value).replace(/[.!?]+$/, '')

  return compact.length > 70 ? `${compact.slice(0, 67).trim()}...` : compact
}

const fallbackQuizFeedbackTemplates: Record<
  StudyMeshLanguageCode,
  {
    correct: (main: string) => string
    wrong: (option: string, correct: string) => string
  }
> = {
  en: {
    correct: (main) => `This matches the key idea: ${main}.`,
    wrong: (option, correct) =>
      `This says "${option}", but the answer should focus on "${correct}".`,
  },
  es: {
    correct: (main) => `Coincide con la idea clave: ${main}.`,
    wrong: (option, correct) =>
      `Esta opcion habla de "${option}", pero la respuesta debe centrarse en "${correct}".`,
  },
  fr: {
    correct: (main) => `Cela reprend l'idee cle: ${main}.`,
    wrong: (option, correct) =>
      `Ce choix parle de "${option}", mais la reponse attendue vise "${correct}".`,
  },
  de: {
    correct: (main) => `Das passt zur Kernidee: ${main}.`,
    wrong: (option, correct) =>
      `Diese Option spricht von "${option}", aber die Antwort zielt auf "${correct}".`,
  },
  it: {
    correct: (main) => `Riprende l'idea chiave: ${main}.`,
    wrong: (option, correct) =>
      `Questa opzione parla di "${option}", ma la risposta mira a "${correct}".`,
  },
  pt: {
    correct: (main) => `Isto corresponde a ideia central: ${main}.`,
    wrong: (option, correct) =>
      `Esta opcao fala de "${option}", mas a resposta deve focar "${correct}".`,
  },
  nl: {
    correct: (main) => `Dit past bij de kern: ${main}.`,
    wrong: (option, correct) =>
      `Deze optie gaat over "${option}", maar het antwoord moet richten op "${correct}".`,
  },
  pl: {
    correct: (main) => `To pasuje do glownej idei: ${main}.`,
    wrong: (option, correct) =>
      `Ta opcja dotyczy "${option}", ale odpowiedz powinna wskazywac "${correct}".`,
  },
  ru: {
    correct: (main) => `Это соответствует главной идее: ${main}.`,
    wrong: (option, correct) =>
      `Этот вариант про "${option}", но ответ должен быть про "${correct}".`,
  },
  ar: {
    correct: (main) => `هذا يطابق الفكرة الأساسية: ${main}.`,
    wrong: (option, correct) =>
      `هذا الخيار يركز على "${option}"، لكن الإجابة يجب أن تركز على "${correct}".`,
  },
  hi: {
    correct: (main) => `यह मुख्य विचार से मेल खाता है: ${main}.`,
    wrong: (option, correct) =>
      `यह विकल्प "${option}" पर है, लेकिन उत्तर "${correct}" पर होना चाहिए.`,
  },
  zh: {
    correct: (main) => `这符合核心思路：${main}。`,
    wrong: (option, correct) =>
      `这个选项关注“${option}”，但答案应关注“${correct}”。`,
  },
  ja: {
    correct: (main) => `これは要点に合っています: ${main}。`,
    wrong: (option, correct) =>
      `この選択肢は「${option}」に寄りますが、答えは「${correct}」です。`,
  },
  ko: {
    correct: (main) => `핵심 생각과 맞습니다: ${main}.`,
    wrong: (option, correct) =>
      `이 선택지는 "${option}"에 초점이 있지만 답은 "${correct}"입니다.`,
  },
}

const inferQuizFeedbackLanguage = (
  item: { question: string; explanation: string },
  options: string[],
  rawNotes: string,
): StudyMeshLanguageCode => {
  const generatedText = [item.question, ...options, item.explanation].join(' ')

  return (
    detectContentLanguage(generatedText) ||
    detectContentLanguage(rawNotes) ||
    'en'
  )
}

const fallbackQuizFeedback = ({
  option,
  correctOption,
  explanation,
  language,
  isCorrect,
}: {
  option: string
  correctOption: string
  explanation: string
  language: StudyMeshLanguageCode
  isCorrect: boolean
}): string => {
  const template = fallbackQuizFeedbackTemplates[language]
  const main = shortenFeedbackFragment(explanation || correctOption)
  const optionFragment = shortenFeedbackFragment(option)
  const correctFragment = shortenFeedbackFragment(correctOption)

  return isCorrect
    ? compactQuizFeedback(template.correct(main))
    : compactQuizFeedback(template.wrong(optionFragment, correctFragment))
}

const stringValue = z
  .string()
  .transform((value) => normalizeSpaces(value))
  .pipe(z.string().min(1))

const sourceSummarySchema = z.object({
  title: stringValue,
  bullets: z.array(stringValue).default([]),
})

const conceptSectionSchema = z.object({
  title: stringValue,
  bullets: z.array(stringValue).default([]),
  example: z
    .string()
    .transform((value) => normalizeSpaces(value))
    .default(''),
})

const conceptRecapSchema = z.object({
  title: stringValue,
  sections: z.array(conceptSectionSchema).default([]),
})

const multipleChoiceSchema = z.object({
  question: stringValue,
  options: z.array(stringValue),
  correctOptionIndex: z.number().int(),
  explanation: stringValue,
  hint: z
    .string()
    .transform((value) => normalizeSpaces(value))
    .default(''),
  optionFeedback: z
    .array(
      z.object({
        option: stringValue,
        explanation: stringValue,
      }),
    )
    .default([]),
})

const flashcardSchema = z.object({
  front: stringValue,
  back: stringValue,
})

const strictDashboardSchema = z.object({
  sourceSummary: sourceSummarySchema,
  conceptRecap: conceptRecapSchema,
  practice: z.object({
    multipleChoice: z.array(multipleChoiceSchema).default([]),
  }),
  flashcards: z.array(flashcardSchema).default([]),
})

export type StrictAiDashboardContract = z.infer<typeof strictDashboardSchema>

export interface AiSourceSummary {
  title: string
  bullets: string[]
}

export interface AiGenerationDebugTrace {
  rawAiResponse: string
  rawDashboardInput?: unknown
  roleSanitizedInput?: unknown
  validatedContract: unknown
  roleFilteredContract: unknown
  droppedOrRepairedItems: string[]
  finalObjects: StudyObject[]
  localAiFailedAttempts?: unknown[]
}

export interface AiQuickCreateDraft {
  title?: string
  sourceFormat?: QuickCreateSourceFormat
  rawNotes?: string
  dashboardRole?: StudyPathDashboardRole
  dashboardPurpose?: StudyPathDashboardPurpose
  practiceType?: StudyPathPracticeType
  layoutReason?: string
  sourceRefs?: StudyPathSourceRef[]
  sourceSummary?: AiSourceSummary
  strictContract?: StrictAiDashboardContract
  objects: StudyObject[]
  warnings: string[]
  debugTrace?: AiGenerationDebugTrace
}

export type StudyMaterialResourceType = 'flashcards' | 'quiz' | 'podcast'
export type StudyMaterialDetailLevel = 'short' | 'medium' | 'long'

export interface NormalizeAiQuickCreateDraftOptions {
  rawNotes?: string
  rawAiResponse?: string
  dashboardRole?: StudyPathDashboardRole
  resourceType?: StudyMaterialResourceType
  detailLevel?: StudyMaterialDetailLevel
}

export const applyStudyMaterialResourceTypeToDraft = (
  draft: AiQuickCreateDraft,
  resourceType?: StudyMaterialResourceType,
): AiQuickCreateDraft => {
  if (!resourceType) {
    return draft
  }

  const warnings = [...draft.warnings]
  let objects: StudyObject[] = []

  if (resourceType === 'flashcards') {
    objects = draft.objects.filter(
      (object) => object.kind === 'qa' || object.kind === 'reveal',
    )
  } else if (resourceType === 'quiz') {
    objects = draft.objects.filter(
      (object): object is Extract<StudyObject, { kind: 'quiz' }> =>
        object.kind === 'quiz' && object.quizMode === 'multipleChoice',
    )
  } else {
    return draft
  }

  if (draft.objects.length !== objects.length) {
    warnings.push('Filtered generated content to the selected resource type.')
  }

  if (objects.length === 0) {
    warnings.push('No usable content matched the selected resource type.')
  }

  return {
    ...draft,
    objects,
    warnings,
  }
}

const createBase = (
  packId: string,
  suffix: string,
  index: number,
  title: string,
) => ({
  id: `${packId}-${suffix}-${index + 1}`,
  title,
  sourceLine: index + 1,
  tags: ['quick-create', 'ai-generated'],
})

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>()

  return values.filter((value) => {
    const key = normalizeKey(value)
    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

const normalizeMultipleChoice = (
  item: z.infer<typeof multipleChoiceSchema>,
  index: number,
  rawNotes: string,
  events: string[],
): z.infer<typeof multipleChoiceSchema> | null => {
  if (!isUsefulQuestion(item.question, rawNotes)) {
    events.push(`Dropped multipleChoice ${index + 1}: weak or copied question.`)
    return null
  }

  const options = dedupe(item.options)
  if (options.length !== item.options.length) {
    events.push(
      `Repaired multipleChoice ${index + 1}: removed duplicate options.`,
    )
  }

  if (options.length < 3 || options.length > 4) {
    events.push(
      `Dropped multipleChoice ${index + 1}: expected 3-4 unique options.`,
    )
    return null
  }

  const originalCorrect = item.options[item.correctOptionIndex]
  const correctOptionIndex = options.findIndex(
    (option) => normalizeKey(option) === normalizeKey(originalCorrect || ''),
  )
  if (correctOptionIndex < 0) {
    events.push(
      `Dropped multipleChoice ${
        index + 1
      }: correct option was missing after repair.`,
    )
    return null
  }

  if (
    options.some(
      (option) =>
        bannedQuizOptionPattern.test(option) ||
        lazyQuizOptionPattern.test(option),
    )
  ) {
    events.push(`Dropped multipleChoice ${index + 1}: placeholder options.`)
    return null
  }

  const feedbackByOption = new Map(
    item.optionFeedback.map((feedback) => [
      normalizeKey(feedback.option),
      feedback.explanation,
    ]),
  )
  const feedbackLanguage = inferQuizFeedbackLanguage(item, options, rawNotes)
  const correctOption = options[correctOptionIndex]
  const optionFeedbackDrafts = options.map((option) => {
    const explanation = compactQuizFeedback(
      feedbackByOption.get(normalizeKey(option)) || '',
    )

    return {
      option,
      explanation: isUsefulQuizFeedback(explanation) ? explanation : '',
      feedbackKey: normalizeKey(explanation),
    }
  })
  const feedbackCounts = optionFeedbackDrafts.reduce((counts, feedback) => {
    if (feedback.explanation && feedback.feedbackKey) {
      counts.set(
        feedback.feedbackKey,
        (counts.get(feedback.feedbackKey) || 0) + 1,
      )
    }

    return counts
  }, new Map<string, number>())
  const optionFeedback = optionFeedbackDrafts
    .map((feedback) => {
      const hasUniqueGeneratedFeedback =
        feedback.explanation &&
        feedback.feedbackKey &&
        feedbackCounts.get(feedback.feedbackKey) === 1
      const isCorrect =
        normalizeKey(feedback.option) === normalizeKey(correctOption)

      return {
        option: feedback.option,
        explanation: hasUniqueGeneratedFeedback
          ? feedback.explanation
          : fallbackQuizFeedback({
              option: feedback.option,
              correctOption,
              explanation: item.explanation,
              language: feedbackLanguage,
              isCorrect,
            }),
      }
    })
    .filter((feedback) => feedback.explanation)

  return { ...item, options, correctOptionIndex, optionFeedback }
}

const normalizeStrictContract = (
  contract: StrictAiDashboardContract,
  rawNotes: string,
): { contract: StrictAiDashboardContract; events: string[] } => {
  const events: string[] = []
  const sourceSummary = {
    ...contract.sourceSummary,
    bullets: dedupe(contract.sourceSummary.bullets).slice(0, 8),
  }
  if (sourceSummary.bullets.length !== contract.sourceSummary.bullets.length) {
    events.push('Repaired sourceSummary: removed empty or duplicate bullets.')
  }

  const conceptSections = contract.conceptRecap.sections
    .map((section, index) => {
      const bullets = dedupe(section.bullets).slice(0, 8)
      if (bullets.length === 0 && !section.example) {
        events.push(
          `Dropped conceptRecap section ${index + 1}: no usable content.`,
        )
        return null
      }

      if (bullets.length !== section.bullets.length) {
        events.push(
          `Repaired conceptRecap section ${
            index + 1
          }: removed duplicate bullets.`,
        )
      }

      return { ...section, bullets }
    })
    .filter((section): section is z.infer<typeof conceptSectionSchema> =>
      Boolean(section),
    )

  const multipleChoice = contract.practice.multipleChoice
    .map((item, index) =>
      normalizeMultipleChoice(item, index, rawNotes, events),
    )
    .filter((item): item is z.infer<typeof multipleChoiceSchema> =>
      Boolean(item),
    )
  const flashcards = contract.flashcards.filter((item, index) => {
    if (
      genericQuestionPattern.test(item.front) ||
      normalizeKey(item.front) === normalizeKey(item.back)
    ) {
      events.push(`Dropped flashcard ${index + 1}: weak prompt.`)
      return false
    }

    return true
  })

  return {
    contract: {
      sourceSummary,
      conceptRecap: {
        ...contract.conceptRecap,
        sections: conceptSections,
      },
      practice: { multipleChoice },
      flashcards,
    },
    events,
  }
}

const applyDashboardRoleFilter = (
  contract: StrictAiDashboardContract,
  dashboardRole: StudyPathDashboardRole = 'normal',
): { contract: StrictAiDashboardContract; events: string[] } => {
  const events: string[] = []

  if (dashboardRole === 'summary') {
    if (contract.practice.multipleChoice.length > 0) {
      events.push('Dropped practice: summary dashboards are recap-only.')
    }

    if (contract.flashcards.length > 0) {
      events.push('Dropped flashcards: summary dashboards are recap-only.')
    }

    return {
      contract: {
        ...contract,
        practice: { multipleChoice: [] },
        flashcards: [],
      },
      events,
    }
  }

  if (dashboardRole === 'exercises') {
    if (contract.conceptRecap.sections.length > 0) {
      events.push(
        'Dropped conceptRecap: exercises dashboards are practice-only.',
      )
    }

    return {
      contract: {
        ...contract,
        conceptRecap: { ...contract.conceptRecap, sections: [] },
      },
      events,
    }
  }

  return { contract, events }
}

export const studyObjectAllowedForDashboardRole = (
  object: StudyObject,
  dashboardRole: StudyPathDashboardRole = 'normal',
): boolean => {
  if (dashboardRole === 'summary') {
    return object.kind === 'list' || object.kind === 'markdown'
  }

  if (dashboardRole === 'exercises') {
    return (
      object.kind === 'quiz' || object.kind === 'qa' || object.kind === 'reveal'
    )
  }

  return true
}

export const filterStudyObjectsForDashboardRole = (
  objects: StudyObject[],
  dashboardRole: StudyPathDashboardRole = 'normal',
  events: string[],
): StudyObject[] =>
  objects.filter((object) => {
    if (studyObjectAllowedForDashboardRole(object, dashboardRole)) {
      return true
    }

    events.push(
      `Dropped ${object.kind} object "${
        object.title || object.id
      }" at final mapping: forbidden for ${dashboardRole} dashboard.`,
    )
    return false
  })

export const assertRoleObjectsAreClean = (
  objects: StudyObject[],
  dashboardRole: StudyPathDashboardRole = 'normal',
  dashboardTitle: string,
): void => {
  const forbidden = objects.filter(
    (object) => !studyObjectAllowedForDashboardRole(object, dashboardRole),
  )

  if (forbidden.length > 0) {
    console.error('Role leakage detected', {
      dashboardTitle,
      role: dashboardRole,
      forbidden,
      objects,
    })
    throw new Error(
      `Role leakage detected in ${dashboardTitle}: ${dashboardRole} dashboard has forbidden objects`,
    )
  }
}

export const mapStrictContractToStudyObjects = (
  contract: StrictAiDashboardContract,
  packId: string,
): StudyObject[] => {
  const recapObjects: StudyObject[] = contract.conceptRecap.sections.map(
    (section, index) => ({
      ...createBase(packId, 'concept-recap', index, section.title),
      kind: 'list' as const,
      items: [
        ...section.bullets,
        ...(section.example ? [`Example: ${section.example}`] : []),
      ],
      ordered: false,
      checklist: false,
    }),
  )
  const multipleChoiceObjects: StudyObject[] =
    contract.practice.multipleChoice.map((item, index) => ({
      ...createBase(
        packId,
        'multiple-choice',
        index,
        `Multiple choice ${index + 1}`,
      ),
      kind: 'quiz' as const,
      quizMode: 'multipleChoice' as const,
      question: item.question,
      options: item.options,
      correctIndex: item.correctOptionIndex,
      answer: item.options[item.correctOptionIndex],
      explanation: item.explanation,
      hint: item.hint,
      optionFeedback: item.optionFeedback,
    }))
  const flashcardObjects: StudyObject[] = contract.flashcards.map(
    (item, index) => ({
      ...createBase(packId, 'flashcard', index, `Flashcard ${index + 1}`),
      kind: 'qa' as const,
      question: item.front,
      answer: item.back,
    }),
  )

  return [...recapObjects, ...multipleChoiceObjects, ...flashcardObjects]
}

export const normalizeAiQuickCreateDraft = (
  value: unknown,
  packId: string,
  options: NormalizeAiQuickCreateDraftOptions = {},
): AiQuickCreateDraft => {
  const warnings: string[] = []
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const title =
    typeof record.title === 'string' ? normalizeSpaces(record.title) : undefined
  const sourceFormat =
    typeof record.sourceFormat === 'string'
      ? (record.sourceFormat as QuickCreateSourceFormat)
      : undefined
  const rawNotes =
    typeof record.rawNotes === 'string' ? normalizeSpaces(record.rawNotes) : ''
  const rawAiResponse = options.rawAiResponse || JSON.stringify(value, null, 2)
  const parsed = strictDashboardSchema.safeParse(record)

  if (!parsed.success) {
    const events = parsed.error.issues.map(
      (issue) =>
        `Invalid strict contract at ${issue.path.join('.') || 'root'}: ${
          issue.message
        }`,
    )
    warnings.push('AI response did not match the strict Quick Create schema.')

    return {
      title,
      sourceFormat,
      rawNotes,
      dashboardRole: options.dashboardRole,
      objects: [],
      warnings,
      debugTrace: {
        rawAiResponse,
        validatedContract: null,
        roleFilteredContract: null,
        droppedOrRepairedItems: events,
        finalObjects: [],
      },
    }
  }

  const normalized = normalizeStrictContract(
    parsed.data,
    options.rawNotes || rawNotes,
  )
  const roleFiltered = applyDashboardRoleFilter(
    normalized.contract,
    options.dashboardRole,
  )
  const events = [...normalized.events, ...roleFiltered.events]
  const mappedObjects = mapStrictContractToStudyObjects(
    roleFiltered.contract,
    packId,
  )
  const objects = filterStudyObjectsForDashboardRole(
    mappedObjects,
    options.dashboardRole,
    events,
  )

  return {
    title,
    sourceFormat,
    rawNotes,
    dashboardRole: options.dashboardRole,
    sourceSummary: {
      title: asTitle(
        roleFiltered.contract.sourceSummary.title,
        'Source summary',
      ),
      bullets: roleFiltered.contract.sourceSummary.bullets,
    },
    strictContract: roleFiltered.contract,
    objects,
    warnings,
    debugTrace: {
      rawAiResponse,
      validatedContract: normalized.contract,
      roleFilteredContract: roleFiltered.contract,
      droppedOrRepairedItems: events,
      finalObjects: objects,
    },
  }
}
