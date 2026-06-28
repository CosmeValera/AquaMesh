import { CustomWidget } from '../components/WidgetEditor/WidgetStorage'
import { ComponentData } from '../components/WidgetEditor/types/types'
import { DashboardLayout } from '../state/store'
import {
  conceptSummaryItem,
  extractLearningConcepts,
  isLowQualityStudyObject,
} from './concepts'
import {
  GeneratedQuickCreate,
  StudyObject,
  QuickCreate,
  QuickCreateDashboardLayoutOptions,
  QuickCreateGeneratorOptions,
  QuickCreateSaveWidgetInput,
  StudyPathDashboardContext,
  QuickCreateWidgetGroupInput,
} from './types'

const DEFAULT_CREATED_AT = '1970-01-01T00:00:00.000Z'
const STUDY_PACK_CATEGORY = 'Quick Create'
const STUDY_PACK_AUTHOR = 'StudyMesh'

const createStudyPathProps = (
  studyPath?: StudyPathDashboardContext,
  itemId?: string,
) =>
  studyPath
    ? {
        studyPathId: studyPath.pathId,
        studyPathTitle: studyPath.title,
        studyPathDashboardKey: studyPath.dashboardKey,
        studyPathDashboardName: studyPath.dashboardName,
        studyPathDashboardIndex: studyPath.dashboardIndex,
        studyPathDashboardCount: studyPath.dashboardCount,
        studyPathFolderName: studyPath.folderName,
        studyPathDashboardPurpose: studyPath.dashboardPurpose,
        studyPathPracticeType: studyPath.practiceType,
        studyPathLayoutReason: studyPath.layoutReason,
        studyPathSourceRefs: studyPath.sourceRefs,
        ...(itemId ? { studyPathItemId: itemId } : {}),
      }
    : {}

const colorPalette = [
  'rgba(54, 162, 235, 0.8)',
  'rgba(75, 192, 192, 0.8)',
  'rgba(255, 206, 86, 0.8)',
  'rgba(153, 102, 255, 0.8)',
  'rgba(255, 99, 132, 0.8)',
  'rgba(255, 159, 64, 0.8)',
]

const sanitizeIdPart = (value: string): string => {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || 'quick-create'
}

const createComponentId = (
  widgetId: string,
  object: StudyObject,
  suffix: string,
): string => `${widgetId}-${object.id}-${suffix}`

const createLabel = (
  id: string,
  text: string,
  variant: 'h6' | 'subtitle1' | 'body1' | 'body2' = 'subtitle1',
): ComponentData => ({
  id,
  type: 'Label',
  props: {
    text,
    variant,
    fontWeight: variant === 'body2' ? 400 : 700,
    gutterBottom: true,
  },
})

const normalizeMultipleChoiceOptions = (
  object: Extract<StudyObject, { kind: 'quiz' }>,
) => {
  const answer = object.answer || object.options[object.correctIndex] || ''
  const options = object.options.filter(Boolean)
  const currentAnswerIndex = options.findIndex((option) => option === answer)
  const normalized = [...options]

  if (answer && currentAnswerIndex === -1) {
    normalized.unshift(answer)
  } else if (currentAnswerIndex > 3) {
    normalized.splice(currentAnswerIndex, 1)
    normalized.unshift(answer)
  }

  const fourOptions = normalized.slice(0, 4)
  const correctIndex = Math.max(
    0,
    fourOptions.findIndex((option) => option === answer),
  )

  return {
    options: fourOptions,
    correctIndex,
    answer: answer || fourOptions[correctIndex] || '',
  }
}

const objectToComponents = (
  object: StudyObject,
  widgetId: string,
  studyPath?: StudyPathDashboardContext,
  forceQuizBlockComponent = false,
): ComponentData[] => {
  const studyPathProps = createStudyPathProps(studyPath, object.id)

  switch (object.kind) {
    case 'markdown':
      return [
        {
          id: createComponentId(widgetId, object, 'markdown'),
          type: 'MarkdownBlock',
          props: {
            __blockType: 'MarkdownBlock',
            title: object.title || 'Markdown notes',
            markdown: object.markdown,
          },
        },
      ]
    case 'note':
      return [
        {
          id: createComponentId(widgetId, object, 'note'),
          type: 'StudyNoteBlock',
          props: {
            __blockType: 'StudyNoteBlock',
            title: object.title || 'Study note',
            text: object.body,
            suggestedTypes: ['definition', 'flashcard', 'review'],
          },
        },
      ]
    case 'term':
      return [
        {
          id: createComponentId(widgetId, object, 'term'),
          type: 'DefinitionBlock',
          props: {
            __blockType: 'DefinitionBlock',
            term: object.term,
            definition: object.definition,
            example: '',
            makeFlashcard: true,
          },
        },
      ]
    case 'qa':
      return [
        {
          id: createComponentId(widgetId, object, 'qa'),
          type: 'FlashcardBlock',
          props: {
            __blockType: 'FlashcardBlock',
            front: object.question,
            back: object.answer,
            hint: '',
            tag: object.title || '',
            selfGrade: true,
            ...studyPathProps,
          },
        },
      ]
    case 'quiz':
      if (object.quizMode === 'shortAnswer' && !forceQuizBlockComponent) {
        return [
          {
            id: createComponentId(widgetId, object, 'quiz-single'),
            type: 'QuizzSingle',
            props: {
              __blockType: 'QuizzSingle',
              quizMode: 'single',
              question: object.question,
              answer: object.answer,
              explanation: object.explanation,
              ...studyPathProps,
            },
          },
        ]
      }

      const quiz = normalizeMultipleChoiceOptions(object)

      return [
        {
          id: createComponentId(widgetId, object, 'quiz'),
          type: 'QuizBlock',
          props: {
            __blockType: 'QuizBlock',
            quizMode: 'multi',
            question: object.question,
            options: quiz.options,
            correctIndex: quiz.correctIndex,
            answer: quiz.answer,
            explanation: object.explanation,
            hint: object.hint || '',
            optionFeedback: object.optionFeedback || [],
            shuffleOptions: false,
            ...studyPathProps,
          },
        },
      ]
    case 'reveal':
      return [
        {
          id: createComponentId(widgetId, object, 'reveal'),
          type: 'FlashcardBlock',
          props: {
            __blockType: 'FlashcardBlock',
            front: object.prompt,
            back: object.hiddenText,
            hint: '',
            tag: object.title || 'Reveal answer',
            selfGrade: false,
            ...studyPathProps,
          },
        },
      ]
    case 'comparison':
      return [
        {
          id: createComponentId(widgetId, object, 'comparison'),
          type: 'ComparisonBlock',
          props: {
            __blockType: 'ComparisonBlock',
            title: object.title || 'Comparison',
            columns: object.columns,
            rows: object.rows,
          },
        },
      ]
    case 'sequence':
      return [
        {
          id: createComponentId(widgetId, object, 'sequence'),
          type: 'ListBlock',
          props: {
            __blockType: 'ListBlock',
            title: object.title || 'Sequence',
            items: object.steps.join('\n'),
            ordered: object.ordered,
            interactiveChecklist: object.interactiveChecklist,
          },
        },
      ]
    case 'code':
      return [
        {
          id: createComponentId(widgetId, object, 'code'),
          type: 'CodeBlock',
          props: {
            __blockType: 'CodeBlock',
            title: object.title || 'Code note',
            code: object.code,
            language: object.language,
            caption: object.caption,
          },
        },
      ]
    case 'reviewPrompt':
      return [
        {
          id: createComponentId(widgetId, object, 'review'),
          type: 'ReviewPromptBlock',
          props: {
            __blockType: 'ReviewPromptBlock',
            title: object.title || 'Review this',
            prompt: object.prompt,
            reason: object.reason,
            status: object.status,
          },
        },
      ]
    case 'list':
      return [
        {
          id: createComponentId(widgetId, object, 'list'),
          type: 'ListBlock',
          props: {
            __blockType: 'ListBlock',
            title: object.title || 'Study list',
            items: object.items.join('\n'),
            ordered: object.ordered,
            interactiveChecklist: object.checklist,
          },
        },
      ]
    case 'table': {
      return [
        {
          id: createComponentId(widgetId, object, 'table'),
          type: 'TableBlock',
          props: {
            __blockType: 'TableBlock',
            title: object.title || 'Study table',
            headers: object.headers,
            rows: object.rows,
          },
        },
      ]
    }
    case 'resource':
      if (object.resourceType === 'image') {
        return [
          {
            id: createComponentId(widgetId, object, 'image'),
            type: 'ImageBlock',
            props: {
              __blockType: 'ImageBlock',
              src: object.url,
              alt: object.label,
              caption: object.label,
              maxHeight: 260,
            },
          },
        ]
      }

      if (object.resourceType === 'pdf') {
        return [
          {
            id: createComponentId(widgetId, object, 'pdf'),
            type: 'PdfBlock',
            props: {
              __blockType: 'PdfBlock',
              src: object.url,
              title: object.label,
              height: 420,
            },
          },
        ]
      }

      return [
        createLabel(
          createComponentId(widgetId, object, 'link-label'),
          object.label,
        ),
        {
          id: createComponentId(widgetId, object, 'link'),
          type: 'Button',
          props: {
            text: 'Open reference',
            variant: 'outlined',
            clickAction: 'openUrl',
            url: object.url,
            showEndIcon: true,
            iconName: 'openNew',
          },
        },
      ]
  }
}

const createFocusedStudySessionWidget = (
  pack: QuickCreate,
  objects: StudyObject[],
  index: number,
  options: {
    author: string
    category: string
    createdAt: string
    focusedResourceType: 'flashcards' | 'quiz'
    widgetIdPrefix: string
  },
  widgetName?: string,
): CustomWidget => {
  const widgetId = `${options.widgetIdPrefix}-${index + 1}`

  return {
    id: widgetId,
    name:
      widgetName ||
      (options.focusedResourceType === 'flashcards'
        ? `${pack.title} Flashcards`
        : `${pack.title} Quiz`),
    components: [
      {
        id: `${widgetId}-focused-session`,
        type:
          options.focusedResourceType === 'flashcards'
            ? 'FlashcardCarouselBlock'
            : 'QuizCarouselBlock',
        props: {
          __blockType:
            options.focusedResourceType === 'flashcards'
              ? 'FlashcardCarouselBlock'
              : 'QuizCarouselBlock',
          title: pack.title,
          items: objects,
        },
      },
    ],
    category: options.category,
    tags: ['quick-create', 'focused-study', options.focusedResourceType],
    description:
      options.focusedResourceType === 'flashcards'
        ? 'Focused flashcard study session.'
        : 'Focused quiz study session.',
    version: '1.0',
    author: options.author,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  }
}

const getFocusedPracticeType = (
  objects: StudyObject[],
): 'flashcards' | 'quiz' | null => {
  if (objects.length === 0) {
    return null
  }

  if (
    objects.every((object) => object.kind === 'qa' || object.kind === 'reveal')
  ) {
    return 'flashcards'
  }

  if (objects.every((object) => object.kind === 'quiz')) {
    return 'quiz'
  }

  return null
}

const createSummaryChart = (
  pack: QuickCreate,
  widgetId: string,
  extraCounts: Record<string, number> = {},
): ComponentData => {
  const counts = pack.objects.reduce<Record<string, number>>(
    (currentCounts, object) => {
      currentCounts[object.kind] = (currentCounts[object.kind] || 0) + 1
      return currentCounts
    },
    { ...extraCounts },
  )
  const labels = Object.keys(counts)
  const totalObjects = labels.reduce((total, label) => total + counts[label], 0)

  return {
    id: `${widgetId}-summary-chart`,
    type: 'Chart',
    props: {
      title: `${pack.title} Mix`,
      chartType: 'pie',
      height: 400,
      description: `${totalObjects} study objects`,
      data: JSON.stringify(
        {
          labels,
          datasets: [
            {
              label: 'Objects',
              data: labels.map((label) => counts[label]),
              backgroundColor: labels.map(
                (_label, index) => colorPalette[index % colorPalette.length],
              ),
            },
          ],
        },
        null,
        2,
      ),
    },
  }
}

const objectToSummaryText = (object: StudyObject): string => {
  switch (object.kind) {
    case 'markdown':
      return object.markdown
    case 'note':
      return object.body
    case 'term':
      return `${object.term}: ${object.definition}`
    case 'qa':
      return `${object.question}: ${object.answer}`
    case 'quiz':
      return object.explanation || object.answer || object.question
    case 'list':
      return object.items.join(' ')
    case 'sequence':
      return object.steps.join(' ')
    case 'comparison':
      return `${object.columns.join(' vs ')} ${object.rows
        .map((row) => row.join(' '))
        .join(' ')}`
    case 'table':
      return `${object.headers.join(' ')} ${object.rows
        .map((row) => row.join(' '))
        .join(' ')}`
    case 'code':
      return object.caption || object.code
    case 'reviewPrompt':
      return object.prompt
    case 'reveal':
      return `${object.prompt}: ${object.hiddenText}`
    case 'resource':
      return object.label
    default:
      return ''
  }
}

const summarizeText = (value: string): string => {
  const normalized = value
    .replace(/[#*_`>|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized.length <= 140) {
    return normalized
  }

  return `${normalized.slice(0, 137).trim()}...`
}

const createSummaryItems = (pack: QuickCreate, rawSource = ''): string[] => {
  if (pack.sourceSummary?.bullets.length) {
    return pack.sourceSummary.bullets
  }

  const conceptItems = extractLearningConcepts(rawSource, pack.title).map(
    conceptSummaryItem,
  )

  if (conceptItems.length > 0) {
    return conceptItems.slice(0, 6)
  }

  const candidates = [
    ...pack.objects.map(objectToSummaryText),
    ...rawSource.split(/\r?\n/),
  ]
    .map(summarizeText)
    .filter((item) => item.split(/\s+/).length >= 5)

  return Array.from(new Set(candidates)).slice(0, 6)
}

const parseCsvSourceRow = (line: string): string[] => {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && nextCharacter === '"') {
      current += '"'
      index += 1
    } else if (character === '"') {
      inQuotes = !inQuotes
    } else if (character === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += character
    }
  }

  cells.push(current.trim())
  return cells
}

const sourceTextToCsvTable = (
  sourceText: string,
): { headers: string[]; rows: string[][] } => {
  const parsedRows = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvSourceRow)

  return {
    headers: parsedRows[0] || [],
    rows: parsedRows.slice(1),
  }
}

const chunkObjects = (
  objects: StudyObject[],
  maxObjectsPerWidget: number,
): StudyObject[][] => {
  const chunks: StudyObject[][] = []

  for (let index = 0; index < objects.length; index += maxObjectsPerWidget) {
    chunks.push(objects.slice(index, index + maxObjectsPerWidget))
  }

  return chunks.length > 0 ? chunks : [[]]
}

const createWidgetRecord = (
  pack: QuickCreate,
  objects: StudyObject[],
  widgetIndex: number,
  options: Required<
    Pick<
      QuickCreateGeneratorOptions,
      | 'author'
      | 'category'
      | 'createdAt'
      | 'forceQuizBlockComponent'
      | 'maxObjectsPerWidget'
      | 'widgetIdPrefix'
    >
  > & { studyPath?: StudyPathDashboardContext },
  name?: string,
  includeSummaryChart = true,
): CustomWidget => {
  const widgetId = `${options.widgetIdPrefix}-${sanitizeIdPart(pack.id)}-${
    widgetIndex + 1
  }`
  const bodyComponents = objects.flatMap((object) =>
    objectToComponents(
      object,
      widgetId,
      options.studyPath,
      options.forceQuizBlockComponent,
    ),
  )
  const components: ComponentData[] = [
    createLabel(
      `${widgetId}-title`,
      pack.title,
      widgetIndex === 0 ? 'h6' : 'subtitle1',
    ),
    ...(includeSummaryChart && widgetIndex === 0
      ? [createSummaryChart(pack, widgetId)]
      : []),
    ...bodyComponents,
  ]

  return {
    id: widgetId,
    name:
      name ||
      (widgetIndex === 0 ? pack.title : `${pack.title} ${widgetIndex + 1}`),
    components,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    category: options.category,
    tags: ['quick-create', pack.sourceFormat],
    description: `Generated from ${pack.sourceFormat} with ${objects.length} study objects.`,
    version: '1.0',
    author: options.author,
  }
}

const createRawSourceWidget = (
  pack: QuickCreate,
  sourceText: string,
  options: Required<
    Pick<
      QuickCreateGeneratorOptions,
      | 'author'
      | 'category'
      | 'createdAt'
      | 'includeSummaryChart'
      | 'widgetIdPrefix'
    >
  > & { studyPath?: StudyPathDashboardContext },
): CustomWidget => {
  const widgetId = `${options.widgetIdPrefix}-${sanitizeIdPart(pack.id)}-source`
  const csvTable =
    pack.sourceFormat === 'csv' ? sourceTextToCsvTable(sourceText) : null
  const sourceComponent: ComponentData = csvTable
    ? {
        id: `${widgetId}-table`,
        type: 'TableBlock',
        props: {
          __blockType: 'TableBlock',
          ...createStudyPathProps(options.studyPath),
          title: options.studyPath ? 'Lesson' : 'Source table',
          headers: csvTable.headers,
          rows: csvTable.rows,
        },
      }
    : {
        id: `${widgetId}-markdown`,
        type: 'MarkdownBlock',
        props: {
          __blockType: 'MarkdownBlock',
          ...createStudyPathProps(options.studyPath),
          title: options.studyPath ? 'Lesson' : 'Source notes',
          markdown: sourceText,
        },
      }

  return {
    id: widgetId,
    name: options.studyPath ? `${pack.title} Lesson` : `${pack.title} Source`,
    components: [
      createLabel(`${widgetId}-title`, pack.title, 'h6'),
      sourceComponent,
    ],
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    category: options.category,
    tags: ['quick-create', 'source', pack.sourceFormat],
    description: csvTable
      ? 'Original CSV source rendered as a table.'
      : 'Original study notes rendered as Markdown.',
    version: '1.0',
    author: options.author,
  }
}

const createSourceSummaryWidget = (
  pack: QuickCreate,
  sourceText: string,
  options: Required<
    Pick<
      QuickCreateGeneratorOptions,
      'author' | 'category' | 'createdAt' | 'widgetIdPrefix'
    >
  >,
): CustomWidget => {
  const widgetId = `${options.widgetIdPrefix}-${sanitizeIdPart(
    pack.id,
  )}-summary`
  const items = createSummaryItems(pack, sourceText)

  return {
    id: widgetId,
    name: `${pack.title} Summary`,
    components: [
      createLabel(`${widgetId}-title`, 'Summary', 'h6'),
      {
        id: `${widgetId}-summary-list`,
        type: 'ListBlock',
        props: {
          __blockType: 'ListBlock',
          title: pack.sourceSummary?.title || 'Key points',
          items:
            items.length > 0
              ? items.join('\n')
              : 'Review the source notes for the main ideas.',
          ordered: false,
          interactiveChecklist: false,
        },
      },
    ],
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    category: options.category,
    tags: ['quick-create', 'summary', pack.sourceFormat],
    description: 'Generated summary of the Quick Create source.',
    version: '1.0',
    author: options.author,
  }
}

const getGeneratedObjectBucket = (object: StudyObject): string => {
  if (object.kind === 'qa' || object.kind === 'reveal') {
    return 'flashcards'
  }

  if (object.kind === 'reviewPrompt') {
    return 'review'
  }

  return object.kind
}

const objectAllowedForDashboardRole = (
  object: StudyObject,
  role = 'normal',
): boolean => {
  if (role === 'summary') {
    return (
      object.kind !== 'quiz' &&
      object.kind !== 'qa' &&
      object.kind !== 'reveal' &&
      object.kind !== 'reviewPrompt'
    )
  }

  if (role === 'exercises') {
    return (
      object.kind === 'quiz' || object.kind === 'qa' || object.kind === 'reveal'
    )
  }

  return true
}

const orderObjectsForGeneratedWidget = (
  objects: StudyObject[],
): StudyObject[] =>
  [...objects].sort((left, right) => {
    if (left.kind === 'quiz' && right.kind === 'quiz') {
      if (left.quizMode === right.quizMode) {
        return left.sourceLine - right.sourceLine
      }

      return left.quizMode === 'shortAnswer' ? -1 : 1
    }

    return left.sourceLine - right.sourceLine
  })

const formatBucketName = (bucket: string): string => {
  const names: Record<string, string> = {
    code: 'Code',
    comparison: 'Comparisons',
    flashcards: 'Flashcards',
    list: 'Lists',
    quiz: 'Quizzes',
    resource: 'Resources',
    review: 'Review',
    sequence: 'Sequences',
    table: 'Tables',
    term: 'Definitions',
  }

  return names[bucket] || bucket
}

const shouldRenderStudyPathSourceSummary = (
  studyPath: StudyPathDashboardContext | undefined,
  includeSourceSummaryWidget: boolean,
  dashboardRole: string,
): boolean => {
  if (!includeSourceSummaryWidget) {
    return false
  }

  if (dashboardRole === 'exercises' || dashboardRole === 'summary') {
    return false
  }

  return !studyPath
}

const shouldRenderGeneratedWidgets = (
  studyPath: StudyPathDashboardContext | undefined,
  dashboardRole: string,
): boolean => {
  if (studyPath) {
    return false
  }

  if (dashboardRole === 'summary') {
    return false
  }

  return true
}

const createStudyPathVisibleQuizGroups = (
  pack: QuickCreate,
): QuickCreateWidgetGroupInput[] => {
  const quizObjects = orderObjectsForGeneratedWidget(
    pack.objects.filter(
      (object) =>
        object.kind === 'quiz' &&
        object.quizMode === 'multipleChoice' &&
        object.options.length >= 2 &&
        !isLowQualityStudyObject(object, pack.title),
    ),
  )

  if (quizObjects.length < 2) {
    return []
  }

  return [
    {
      name: `${pack.title} Quiz`,
      objects: quizObjects,
    },
  ]
}

const createVisibleStudyPathWidgetGroups = (
  pack: QuickCreate,
  studyPath: StudyPathDashboardContext | undefined,
): QuickCreateWidgetGroupInput[] | null => {
  if (!studyPath) {
    return null
  }

  const dashboardRole = studyPath.dashboardRole || pack.dashboardRole

  if (
    dashboardRole === 'summary' ||
    dashboardRole === 'exercises' ||
    studyPath.practiceType === 'none'
  ) {
    return []
  }

  if (studyPath.practiceType === 'quiz' || studyPath.practiceType === 'mixed') {
    return createStudyPathVisibleQuizGroups(pack)
  }

  return []
}

export const createQuickCreateSmartWidgetGroups = (
  pack: QuickCreate,
  groupingThreshold: number,
): QuickCreateWidgetGroupInput[] => {
  const seen = new Set<string>()
  const dashboardRole = pack.dashboardRole || 'normal'
  const interestingObjects = pack.objects.filter((object) => {
    if (
      object.kind === 'note' ||
      object.kind === 'markdown' ||
      !objectAllowedForDashboardRole(object, dashboardRole) ||
      isLowQualityStudyObject(object, pack.title)
    ) {
      return false
    }

    const key = `${object.kind}:${objectToSummaryText(object).toLowerCase()}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
  const buckets = interestingObjects.reduce<Record<string, StudyObject[]>>(
    (groups, object) => {
      const bucket = getGeneratedObjectBucket(object)
      groups[bucket] = [...(groups[bucket] || []), object]
      return groups
    },
    {},
  )
  const groups: QuickCreateWidgetGroupInput[] = []
  const miscObjects: StudyObject[] = []

  Object.entries(buckets).forEach(([bucket, objects]) => {
    if (bucket === 'quiz' || objects.length >= groupingThreshold) {
      groups.push({
        name: `${pack.title} ${formatBucketName(bucket)}`,
        objects: orderObjectsForGeneratedWidget(objects),
      })
      return
    }

    miscObjects.push(...orderObjectsForGeneratedWidget(objects))
  })

  if (miscObjects.length > 0) {
    groups.push({
      name:
        miscObjects.length >= 2 ? `${pack.title} Misc` : `${pack.title} Review`,
      objects: miscObjects,
    })
  }

  return groups
}

export const createQuickCreateOrchestratorWidgets = (
  pack: QuickCreate,
  options: QuickCreateGeneratorOptions = {},
): CustomWidget[] => {
  const normalizedOptions = {
    author: options.author || STUDY_PACK_AUTHOR,
    category: options.category || STUDY_PACK_CATEGORY,
    createdAt: options.createdAt || DEFAULT_CREATED_AT,
    focusedResourceType: options.focusedResourceType,
    forceQuizBlockComponent: options.forceQuizBlockComponent ?? false,
    groupingThreshold: Math.max(2, options.groupingThreshold || 3),
    includeSourceWidget: options.includeSourceWidget ?? true,
    includeSourceSummaryWidget: options.includeSourceSummaryWidget ?? true,
    maxObjectsPerWidget: Math.max(1, options.maxObjectsPerWidget || 1000),
    widgetIdPrefix: options.widgetIdPrefix || 'study-widget',
    includeSummaryChart: options.includeSummaryChart ?? true,
    studyPath: options.studyPath,
  }
  const dashboardRole =
    normalizedOptions.studyPath?.dashboardRole || pack.dashboardRole || 'normal'
  const includeSourceSummaryWidget = shouldRenderStudyPathSourceSummary(
    normalizedOptions.studyPath,
    normalizedOptions.includeSourceSummaryWidget,
    dashboardRole,
  )
  const sourceWidgets = normalizedOptions.includeSourceWidget
    ? [
        createRawSourceWidget(pack, options.rawSource || '', {
          author: normalizedOptions.author,
          category: normalizedOptions.category,
          createdAt: normalizedOptions.createdAt,
          includeSummaryChart: normalizedOptions.includeSummaryChart,
          widgetIdPrefix: normalizedOptions.widgetIdPrefix,
          studyPath: normalizedOptions.studyPath,
        }),
        ...(!includeSourceSummaryWidget
          ? []
          : [
              createSourceSummaryWidget(pack, options.rawSource || '', {
                author: normalizedOptions.author,
                category: normalizedOptions.category,
                createdAt: normalizedOptions.createdAt,
                widgetIdPrefix: normalizedOptions.widgetIdPrefix,
              }),
            ]),
      ]
    : []
  const studyPathGeneratedGroups = createVisibleStudyPathWidgetGroups(
    pack,
    normalizedOptions.studyPath,
  )
  const generatedGroups =
    studyPathGeneratedGroups !== null
      ? studyPathGeneratedGroups
      : !shouldRenderGeneratedWidgets(
            normalizedOptions.studyPath,
            dashboardRole,
          )
        ? []
        : options.widgetGroups ||
          createQuickCreateSmartWidgetGroups(
            pack,
            normalizedOptions.groupingThreshold,
          )

  if (generatedGroups.length === 0) {
    return sourceWidgets
  }

  const generatedWidgets = createQuickCreateWidgetsFromGroups(
    pack,
    generatedGroups,
    {
      ...normalizedOptions,
      includeSummaryChart: false,
    },
  )

  return [...sourceWidgets, ...generatedWidgets]
}

export const createQuickCreateWidgets = (
  pack: QuickCreate,
  options: QuickCreateGeneratorOptions = {},
): CustomWidget[] => {
  const normalizedOptions = {
    author: options.author || STUDY_PACK_AUTHOR,
    category: options.category || STUDY_PACK_CATEGORY,
    createdAt: options.createdAt || DEFAULT_CREATED_AT,
    forceQuizBlockComponent: options.forceQuizBlockComponent ?? false,
    maxObjectsPerWidget: Math.max(1, options.maxObjectsPerWidget || 6),
    widgetIdPrefix: options.widgetIdPrefix || 'study-widget',
  }
  const chunks = chunkObjects(
    pack.objects,
    normalizedOptions.maxObjectsPerWidget,
  )

  return chunks.map((objects, index) =>
    createWidgetRecord(pack, objects, index, normalizedOptions),
  )
}

export const createQuickCreateWidgetsFromGroups = (
  pack: QuickCreate,
  groups: QuickCreateWidgetGroupInput[],
  options: QuickCreateGeneratorOptions = {},
): CustomWidget[] => {
  const normalizedOptions = {
    author: options.author || STUDY_PACK_AUTHOR,
    category: options.category || STUDY_PACK_CATEGORY,
    createdAt: options.createdAt || DEFAULT_CREATED_AT,
    focusedResourceType: options.focusedResourceType,
    forceQuizBlockComponent: options.forceQuizBlockComponent ?? false,
    includeSummaryChart: options.includeSummaryChart ?? true,
    maxObjectsPerWidget: Math.max(1, options.maxObjectsPerWidget || 1000),
    widgetIdPrefix: options.widgetIdPrefix || 'study-widget',
    studyPath: options.studyPath,
  }
  const nonEmptyGroups = groups.filter((group) => group.objects.length > 0)
  const effectiveGroups =
    nonEmptyGroups.length > 0
      ? nonEmptyGroups
      : [{ name: pack.title, objects: [] }]

  return effectiveGroups.map((group, index) =>
    normalizedOptions.focusedResourceType ||
    (normalizedOptions.studyPath ? getFocusedPracticeType(group.objects) : null)
      ? createFocusedStudySessionWidget(
          pack,
          group.objects,
          index,
          {
            author: normalizedOptions.author,
            category: normalizedOptions.category,
            createdAt: normalizedOptions.createdAt,
            focusedResourceType:
              normalizedOptions.focusedResourceType ||
              getFocusedPracticeType(group.objects) ||
              'quiz',
            widgetIdPrefix: normalizedOptions.widgetIdPrefix,
          },
          group.name,
        )
      : createWidgetRecord(
          pack,
          group.objects,
          index,
          normalizedOptions,
          group.name,
          normalizedOptions.includeSummaryChart,
        ),
  )
}

const createWidgetTab = (widget: CustomWidget): DashboardLayout => ({
  type: 'tab',
  name: widget.name,
  component: 'CustomWidget',
  config: {
    customProps: {
      widgetId: widget.id,
      components: widget.components,
    },
  },
})

const createTabset = (
  widgets: CustomWidget[],
  weight: number,
  active = false,
): DashboardLayout => ({
  type: 'tabset',
  weight,
  active,
  selected: 0,
  children: widgets.map(createWidgetTab),
})

const splitWidgetsIntoPanes = (widgets: CustomWidget[]): CustomWidget[][] => {
  const paneCount = Math.min(Math.max(widgets.length, 1), 4)
  const panes = Array.from({ length: paneCount }, () => [] as CustomWidget[])

  widgets.forEach((widget, index) => {
    panes[index % paneCount].push(widget)
  })

  return panes
}

const createSmartDashboardLayout = (
  widgets: CustomWidget[],
): DashboardLayout => {
  const panes = splitWidgetsIntoPanes(widgets)

  if (panes.length === 1) {
    return {
      type: 'row',
      weight: 100,
      children: [createTabset(panes[0], 100, true)],
    }
  }

  if (panes.length === 2) {
    return {
      type: 'row',
      weight: 100,
      children: [createTabset(panes[0], 50, true), createTabset(panes[1], 50)],
    }
  }

  if (panes.length === 3) {
    return {
      type: 'row',
      weight: 100,
      children: [
        createTabset(panes[0], 50, true),
        {
          type: 'row',
          weight: 50,
          children: [createTabset(panes[1], 50), createTabset(panes[2], 50)],
        },
      ],
    }
  }

  return {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'row',
        weight: 50,
        children: [
          createTabset(panes[0], 50, true),
          createTabset(panes[1], 50),
        ],
      },
      {
        type: 'row',
        weight: 50,
        children: [createTabset(panes[2], 50), createTabset(panes[3], 50)],
      },
    ],
  }
}

const createTabbedDashboardLayout = (
  widgets: CustomWidget[],
): DashboardLayout => ({
  type: 'row',
  weight: 100,
  children: [createTabset(widgets, 100, true)],
})

const createOrchestratorDashboardLayout = (
  widgets: CustomWidget[],
): DashboardLayout => {
  const sourceWidgets = widgets.filter(
    (widget) =>
      widget.tags?.includes('source') || widget.tags?.includes('summary'),
  )
  const generatedWidgets = widgets.filter(
    (widget) =>
      !widget.tags?.includes('source') && !widget.tags?.includes('summary'),
  )

  if (sourceWidgets.length === 0 || generatedWidgets.length === 0) {
    return createTabbedDashboardLayout(widgets)
  }

  const panes = [[], []] as [CustomWidget[], CustomWidget[]]
  generatedWidgets.forEach((widget, index) => {
    panes[index % panes.length].push(widget)
  })
  const rightChildren = panes
    .filter((pane) => pane.length > 0)
    .map((pane, index) => createTabset(pane, 50, index === 0))

  return {
    type: 'row',
    weight: 100,
    children: [
      createTabset(sourceWidgets, 50, true),
      {
        type: 'row',
        weight: 50,
        children: rightChildren,
      },
    ],
  }
}

export const createQuickCreateDashboardLayout = (
  widgets: CustomWidget[],
  options: QuickCreateDashboardLayoutOptions = {},
): DashboardLayout =>
  options.mode === 'orchestrator'
    ? createOrchestratorDashboardLayout(widgets)
    : options.mode === 'tabs'
      ? createTabbedDashboardLayout(widgets)
      : createSmartDashboardLayout(widgets)

export const createQuickCreateSaveWidgetInputs = (
  widgets: CustomWidget[],
): QuickCreateSaveWidgetInput[] =>
  widgets.map((widget) => ({
    name: widget.name,
    components: widget.components,
    category: widget.category,
    tags: widget.tags,
    description: widget.description,
    version: widget.version,
    author: widget.author,
  }))

export const generateQuickCreate = (
  pack: QuickCreate,
  options: QuickCreateGeneratorOptions = {},
): GeneratedQuickCreate => {
  const widgets = createQuickCreateWidgets(pack, options)

  return {
    pack,
    widgets,
    dashboard: {
      name: options.dashboardName || pack.title,
      layout: createQuickCreateDashboardLayout(widgets),
    },
  }
}
