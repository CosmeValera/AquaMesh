import { DashboardLayout } from '../state/store'
import { ComponentData } from '../components/WidgetEditor/types/types'
import { createStudyPathContainerState } from '../components/Dasboard/studyPathContainer'
import { StudyGuideStorage } from '../studyGuides/storage'
import type { StudyGuideRecord } from '../cloud/types'

export const STUDYMESH_GUIDE_STUDY_PATH_ID =
  'studymesh-student-knowledge-wiki-a-beginner-s-guide'
export const STUDYMESH_GUIDE_TITLE = 'Welcome to StudyMesh'
export const STUDYMESH_GUIDE_FOLDER_NAME = 'StudyMesh Guide'
export const STUDYMESH_GUIDE_FOLDER_COLOR = '#007C66'

const DASHBOARD_STORAGE_KEY = 'customDashboards'
const WIDGET_STORAGE_KEY = 'studymesh_custom_widgets'
const LEGACY_WIDGET_STORAGE_KEY = 'aquamesh_custom_widgets'
const STUDYMESH_GUIDE_SEEDED_KEY = 'studymesh-guide-study-path-seeded-v1'
const OLD_STARTER_REMOVAL_KEY = 'studymesh-old-starter-dashboards-removed-v1'

const OLD_STARTER_DASHBOARD_NAMES = new Set([
  'AquaMesh Starter 1 - Learn the Workspace',
  'AquaMesh Starter 2 - Practice Interactivity',
  'AquaMesh Starter 3 - Build Your Own',
  'StudyMesh Starter 1 - Learn the Workspace',
  'StudyMesh Starter 2 - Practice Interactivity',
  'StudyMesh Starter 3 - Build Your Own',
  'Mathematics 1 - Derivatives',
  'AquaMesh Tutorial',
  'AquaMesh Interactivity',
  'StudyMesh Tutorial',
  'StudyMesh Interactivity',
  'Content Load Reference Pack',
  'Grouping Layout Tutorial',
])

const OLD_STARTER_WIDGET_NAMES = new Set([
  'Mathematics 1 - Chart',
  'Mathematics 1 - Derivatives Example',
  'Mathematics 1 - Theory Derivatives',
  'AquaMesh Tutorial',
  'AquaMesh Interactivity',
  'StudyMesh Tutorial',
  'StudyMesh Interactivity',
  'Content Load Reference Pack',
  'Grouping Layout Tutorial',
])

interface SavedDashboardRecord {
  id: string
  name: string
  folder?: string
  folderColor?: string
  layout: DashboardLayout
  description?: string
  tags?: string[]
  isPublic?: boolean
  createdAt: string
  updatedAt: string
  componentsCount?: number
}

interface SavedWidgetRecord {
  id: string
  name?: string
  [key: string]: unknown
}

interface GuideLesson {
  id: string
  title: string
  sourceMarkdown: string
  summaryTitle: string
  summaryItems: string[]
  quizzes: Array<{
    question: string
    options?: string[]
    correctIndex?: number
    answer: string
    explanation: string
  }>
  flashcards: Array<{
    front: string
    back: string
  }>
}

const guideLessons: GuideLesson[] = [
  {
    id: 'studymesh-guide-basics',
    title: '01 - StudyMesh Basics: What It Is & Core Concepts',
    sourceMarkdown:
      '## What StudyMesh Is\nStudyMesh helps students turn prompts, messy notes, files, camera pictures, references, and learning material into structured learning dashboards, tutorials, exercises, and reusable study views.\n\n## Core Concepts\n### Dashboard\nA dashboard is a workspace page or study surface where learning material is presented and used.\n\n### Widget\nA widget is a larger reusable piece inside a dashboard, such as notes, quizzes, flashcards, summaries, lists, tables, or interactive tools.\n\n### Block\nA block is the smallest content or interaction unit inside a widget, such as a paragraph, flashcard, quiz question, checklist item, button, chart element, or input.\n\n### Workspace\nThe Workspace is the main place where Study Guides, Study Packs, and custom dashboards are opened, studied, edited, and reused.',
    summaryTitle: 'StudyMesh Fundamentals',
    summaryItems: [
      'StudyMesh turns raw learning material into structured study dashboards.',
      'A dashboard is a study surface or workspace page.',
      'A widget is a larger reusable content or tool area inside a dashboard.',
      'A block is a granular content or interaction unit inside a widget.',
      'The Workspace is where saved study material is opened and reused.',
    ],
    quizzes: [
      {
        question: 'Explain the primary goal of StudyMesh for students.',
        answer:
          'StudyMesh helps students organize learning material into dashboards, tutorials, exercises, and reusable study views.',
        explanation:
          'The product is moving toward a student knowledge wiki, not only a manual dashboard builder.',
      },
      {
        question: 'Which option best describes a dashboard in StudyMesh?',
        options: [
          'A workspace page or study surface that contains learning material.',
          'A single paragraph or quiz answer.',
          'Only the top navigation menu.',
          'A provider setting for AI generation.',
        ],
        correctIndex: 0,
        answer:
          'A workspace page or study surface that contains learning material.',
        explanation:
          'Dashboards hold widgets and blocks for a topic, lesson, pack, or workspace view.',
      },
    ],
    flashcards: [
      {
        front: 'What is a dashboard in StudyMesh?',
        back: 'A workspace page or study surface that contains learning material.',
      },
      {
        front: 'What is a widget?',
        back: 'A larger reusable piece inside a dashboard, such as notes, quizzes, or flashcards.',
      },
      {
        front: 'What is a block?',
        back: 'A small content or interaction unit inside a widget, like a paragraph or quiz question.',
      },
      {
        front: 'What is the Workspace?',
        back: 'The place where Study Guides, Study Packs, and dashboards are opened, studied, edited, and reused.',
      },
    ],
  },
  {
    id: 'studymesh-guide-workflows',
    title: '02 - StudyMesh Main Workflows',
    sourceMarkdown:
      '## Main Workflows\n### Create Study Guide\nUse Create Study Guide when you want StudyMesh to teach a new topic step by step. You provide a learning prompt and StudyMesh creates a multi-dashboard tutorial with ordered lessons, quizzes, and flashcards.\n\n### Create From Notes\nUse Create From Notes when you already have material: messy notes, text files, screenshots, or camera pictures. StudyMesh turns that input into a clearer study dashboard with summaries and practice.\n\n### Workspace Path\nOpen an existing Study Guide, Study Pack, or custom dashboard in the main workspace for study, editing, and reuse.\n\n### Advanced Path\nManually create widgets or dashboards when you need direct control. This is useful for advanced users but should be less prominent for beginners.',
    summaryTitle: 'Workflow Overview',
    summaryItems: [
      'Create Study Guide generates a multi-dashboard tutorial from a prompt.',
      'Create From Notes organizes existing notes, files, screenshots, or images.',
      'Workspace Path opens saved Study Guides, Study Packs, and dashboards.',
      'Advanced Path allows manual widget and dashboard creation.',
    ],
    quizzes: [
      {
        question: "When should a student use 'Create Study Guide'?",
        answer:
          'When they want StudyMesh to teach a new topic step by step from a prompt.',
        explanation:
          'Create Study Guide is for guided learning across multiple ordered dashboards.',
      },
      {
        question:
          'Which workflow is best for a photo of class notes that should become a study dashboard?',
        options: [
          'Create From Notes',
          'Create Study Guide',
          'Advanced Path',
          'Workspace Path',
        ],
        correctIndex: 0,
        answer: 'Create From Notes',
        explanation:
          'Create From Notes starts from existing material, including images and messy notes.',
      },
    ],
    flashcards: [
      {
        front: 'What does Create Study Guide do?',
        back: 'It creates a multi-dashboard tutorial from a learning prompt.',
      },
      {
        front: 'What does Create From Notes do?',
        back: 'It turns existing notes, files, screenshots, or camera pictures into a study dashboard.',
      },
      {
        front: 'What is the Workspace path for?',
        back: 'Opening existing Study Guides, Study Packs, and dashboards for study and editing.',
      },
      {
        front: 'What is the Advanced path for?',
        back: 'Manual creation of widgets or dashboards when direct control is needed.',
      },
    ],
  },
  {
    id: 'studymesh-guide-ai-modes',
    title: '03 - StudyMesh AI Generation Modes',
    sourceMarkdown:
      '## StudyMesh AI Generation Modes\n### Basic fallback\nNo AI API. It parses notes locally from obvious structure and keywords. It is fast and free, but weaker, and it supports Create From Notes rather than Study Guide.\n\n### Google Local AI\nRuns on the local Chrome built-in AI model. It is free and can work offline. It is usually better than Basic fallback for messy notes and images, but weaker and slower than Gemini API.\n\n### Own Gemini API token\nUses the user-provided Gemini API key. This is the preferred high-quality path for rich Study Guides and study dashboards.\n\n### Hosted AI tokens\nNot implemented yet. The future idea is to provide a small hosted allowance before users switch to local AI, their own API token, or paid hosted usage.',
    summaryTitle: 'AI Mode Summary',
    summaryItems: [
      'Basic fallback is fast, free, weak, and limited to Create From Notes.',
      'Google Local AI runs locally and is better than Basic fallback, but slower and weaker than Gemini API.',
      'Own Gemini API token is the preferred high-quality generation mode.',
      'Hosted AI tokens are planned but not available yet.',
    ],
    quizzes: [
      {
        question:
          "What is the main tradeoff of the 'Basic fallback' generation mode?",
        answer:
          'It is fast, free, and local, but produces weaker output and does not support Study Guide generation.',
        explanation:
          'Basic fallback relies on programmatic parsing rather than a strong AI model.',
      },
      {
        question:
          'Which mode should a user choose for the highest quality Study Guide if they have an API key?',
        options: [
          'Basic fallback',
          'Google Local AI',
          'Hosted AI tokens',
          'Own Gemini API token',
        ],
        correctIndex: 3,
        answer: 'Own Gemini API token',
        explanation:
          'Gemini API mode uses a stronger hosted model and produces richer study material.',
      },
    ],
    flashcards: [
      {
        front: 'What is Basic fallback?',
        back: 'A non-AI local parser that is fast and free but weaker.',
      },
      {
        front: 'What is Google Local AI?',
        back: 'A local Chrome AI mode that can work offline and is better than Basic fallback.',
      },
      {
        front: 'What is Own Gemini API token mode?',
        back: 'The high-quality mode that uses the user’s Gemini API key.',
      },
      {
        front: 'Are Hosted AI tokens available?',
        back: 'No. They are planned but not implemented yet.',
      },
    ],
  },
]

const readArray = <T>(key: string): T[] => {
  try {
    const rawValue = window.localStorage.getItem(key)
    const parsedValue = rawValue ? JSON.parse(rawValue) : []
    return Array.isArray(parsedValue) ? parsedValue : []
  } catch (error) {
    console.error(`Failed to read ${key}`, error)
    return []
  }
}

const writeArray = <T>(key: string, values: T[]) => {
  window.localStorage.setItem(key, JSON.stringify(values))
}

const textList = (items: string[]) => items.join('\n')

const withStudyPathProps = (
  lesson: GuideLesson,
  index: number,
  extraProps: Record<string, unknown>,
) => ({
  ...extraProps,
  studyPathId: STUDYMESH_GUIDE_STUDY_PATH_ID,
  studyPathTitle: STUDYMESH_GUIDE_TITLE,
  studyPathDashboardKey: `${STUDYMESH_GUIDE_STUDY_PATH_ID}-${index}`,
  studyPathDashboardName: lesson.title,
  studyPathDashboardIndex: index,
  studyPathDashboardCount: guideLessons.length,
  studyPathFolderName: STUDYMESH_GUIDE_FOLDER_NAME,
})

const createGuideLayout = (
  lesson: GuideLesson,
  index: number,
): DashboardLayout => {
  const createTab = (
    name: string,
    widgetId: string,
    components: ComponentData[],
  ) => ({
    type: 'tab',
    name,
    component: 'CustomWidget',
    config: {
      customProps: {
        widgetId,
        components,
      },
    },
  })

  const sourceComponents: ComponentData[] = [
    {
      id: `${lesson.id}-source-title`,
      type: 'Label',
      props: {
        text: lesson.title,
        variant: 'h6',
        fontWeight: 700,
        gutterBottom: true,
      },
    },
    {
      id: `${lesson.id}-source-markdown`,
      type: 'MarkdownBlock',
      props: withStudyPathProps(lesson, index, {
        __blockType: 'MarkdownBlock',
        title: 'Source notes',
        markdown: lesson.sourceMarkdown,
      }),
    },
  ]

  const summaryComponents: ComponentData[] = [
    {
      id: `${lesson.id}-summary-title`,
      type: 'Label',
      props: {
        text: 'Summary',
        variant: 'h6',
        fontWeight: 700,
        gutterBottom: true,
      },
    },
    {
      id: `${lesson.id}-summary-list`,
      type: 'ListBlock',
      props: {
        __blockType: 'ListBlock',
        title: lesson.summaryTitle,
        items: textList(lesson.summaryItems),
        ordered: false,
        interactiveChecklist: false,
      },
    },
  ]

  const quizComponents: ComponentData[] = [
    {
      id: `${lesson.id}-quiz-title`,
      type: 'Label',
      props: {
        text: lesson.title,
        variant: 'h6',
        fontWeight: 700,
        gutterBottom: true,
      },
    },
    ...lesson.quizzes.map<ComponentData>((quiz, quizIndex) => {
      const isMultipleChoice = Boolean(quiz.options?.length)

      return {
        id: `${lesson.id}-quiz-${quizIndex + 1}`,
        type: isMultipleChoice ? 'QuizBlock' : 'QuizzSingle',
        props: withStudyPathProps(lesson, index, {
          __blockType: isMultipleChoice ? 'QuizBlock' : 'QuizzSingle',
          quizMode: isMultipleChoice ? 'multi' : 'single',
          question: quiz.question,
          options: isMultipleChoice ? quiz.options || [] : [],
          correctIndex: isMultipleChoice ? quiz.correctIndex || 0 : 0,
          answer: quiz.answer,
          explanation: quiz.explanation,
          shuffleOptions: false,
          studyPathItemId: `study-path-${index}-quiz-${quizIndex + 1}`,
        }),
      }
    }),
  ]

  const flashcardComponents: ComponentData[] = [
    {
      id: `${lesson.id}-flashcard-title`,
      type: 'Label',
      props: {
        text: lesson.title,
        variant: 'subtitle1',
        fontWeight: 700,
        gutterBottom: true,
      },
    },
    ...lesson.flashcards.map<ComponentData>((flashcard, flashcardIndex) => ({
      id: `${lesson.id}-flashcard-${flashcardIndex + 1}`,
      type: 'FlashcardBlock',
      props: withStudyPathProps(lesson, index, {
        __blockType: 'FlashcardBlock',
        front: flashcard.front,
        back: flashcard.back,
        hint: '',
        tag: `Flashcard ${flashcardIndex + 1}`,
        selfGrade: true,
        studyPathItemId: `study-path-${index}-flashcard-${flashcardIndex + 1}`,
      }),
    })),
  ]

  return {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 50,
        active: true,
        selected: 0,
        children: [
          createTab(
            `${lesson.title} Source`,
            `${lesson.id}-source`,
            sourceComponents,
          ),
          createTab(
            `${lesson.title} Summary`,
            `${lesson.id}-summary`,
            summaryComponents,
          ),
        ],
      },
      {
        type: 'row',
        weight: 50,
        children: [
          {
            type: 'tabset',
            weight: 50,
            active: true,
            selected: 0,
            children: [
              createTab(
                `${lesson.title} Quizzes`,
                `${lesson.id}-quizzes`,
                quizComponents,
              ),
            ],
          },
          {
            type: 'tabset',
            weight: 50,
            active: false,
            selected: 0,
            children: [
              createTab(
                `${lesson.title} Flashcards`,
                `${lesson.id}-flashcards`,
                flashcardComponents,
              ),
            ],
          },
        ],
      },
    ],
  }
}

export const createStudyMeshGuideDashboards = (): SavedDashboardRecord[] => {
  const now = '2026-05-19T23:47:47.841Z'

  return guideLessons.map((lesson, lessonIndex) => {
    const index = lessonIndex + 1
    return {
      id: `studymesh-guide-dashboard-${index}`,
      name: lesson.title,
      folder: STUDYMESH_GUIDE_FOLDER_NAME,
      folderColor: STUDYMESH_GUIDE_FOLDER_COLOR,
      layout: createGuideLayout(lesson, index),
      description: 'Built-in StudyMesh guide Study Guide.',
      tags: ['study-pack', 'study-path', 'starter', 'guide'],
      isPublic: false,
      createdAt: now,
      updatedAt: now,
      componentsCount:
        5 +
        lesson.summaryItems.length +
        lesson.quizzes.length +
        lesson.flashcards.length,
    }
  })
}

export const createStudyMeshGuideStudyGuide = (): StudyGuideRecord => {
  const now = '2026-05-19T23:47:47.841Z'
  const studyPath = createStudyPathContainerState(
    createStudyMeshGuideDashboards(),
  )

  if (!studyPath) {
    throw new Error('StudyMesh Guide Study Guide seed is invalid')
  }

  return {
    id: STUDYMESH_GUIDE_STUDY_PATH_ID,
    title: STUDYMESH_GUIDE_TITLE,
    folderName: STUDYMESH_GUIDE_FOLDER_NAME,
    description: 'Built-in StudyMesh guide Study Guide.',
    studyPath,
    createdAt: now,
    updatedAt: now,
  }
}

export const removeOldStarterDashboards = () => {
  if (
    typeof window === 'undefined' ||
    window.localStorage.getItem(OLD_STARTER_REMOVAL_KEY) === 'true'
  ) {
    return false
  }

  const dashboards = readArray<SavedDashboardRecord>(DASHBOARD_STORAGE_KEY)
  const nextDashboards = dashboards.filter(
    (dashboard) =>
      !OLD_STARTER_DASHBOARD_NAMES.has(dashboard.name) &&
      dashboard.folder !== 'StudyMesh Starter Study Guide',
  )
  const widgets = readArray<SavedWidgetRecord>(WIDGET_STORAGE_KEY)
  const legacyWidgets = readArray<SavedWidgetRecord>(LEGACY_WIDGET_STORAGE_KEY)
  const nextWidgets = widgets.filter(
    (widget) => !OLD_STARTER_WIDGET_NAMES.has(String(widget.name || '')),
  )
  const legacyNextWidgets = legacyWidgets.filter(
    (widget) => !OLD_STARTER_WIDGET_NAMES.has(String(widget.name || '')),
  )
  const changed =
    nextDashboards.length !== dashboards.length ||
    nextWidgets.length !== widgets.length ||
    legacyNextWidgets.length !== legacyWidgets.length

  if (nextDashboards.length !== dashboards.length) {
    writeArray(DASHBOARD_STORAGE_KEY, nextDashboards)
  }

  if (nextWidgets.length !== widgets.length) {
    writeArray(WIDGET_STORAGE_KEY, nextWidgets)
  }

  if (legacyNextWidgets.length !== legacyWidgets.length) {
    writeArray(LEGACY_WIDGET_STORAGE_KEY, legacyNextWidgets)
  }

  window.localStorage.setItem(OLD_STARTER_REMOVAL_KEY, 'true')
  return changed
}

export const seedStudyMeshGuideStudyPath = ({
  force = false,
}: {
  force?: boolean
} = {}) => {
  if (typeof window === 'undefined') {
    return false
  }

  const alreadySeeded =
    window.localStorage.getItem(STUDYMESH_GUIDE_SEEDED_KEY) === 'true'
  const dashboards = readArray<SavedDashboardRecord>(DASHBOARD_STORAGE_KEY)
  const guideDashboards = createStudyMeshGuideDashboards()
  const guideIds = new Set(guideDashboards.map((dashboard) => dashboard.id))
  const guideNames = new Set(guideDashboards.map((dashboard) => dashboard.name))
  const retainedDashboards = dashboards.filter(
    (dashboard) =>
      !guideIds.has(dashboard.id) &&
      !(
        dashboard.folder === STUDYMESH_GUIDE_FOLDER_NAME &&
        guideNames.has(dashboard.name)
      ),
  )
  const removedLegacyGuideDashboards =
    retainedDashboards.length !== dashboards.length
  const existingGuide = StudyGuideStorage.getAll().some(
    (studyGuide) => studyGuide.id === STUDYMESH_GUIDE_STUDY_PATH_ID,
  )

  if (removedLegacyGuideDashboards) {
    writeArray(DASHBOARD_STORAGE_KEY, retainedDashboards)
  }

  if (!force && alreadySeeded) {
    return removedLegacyGuideDashboards
  }

  if (!force && dashboards.length > 0) {
    window.localStorage.setItem(STUDYMESH_GUIDE_SEEDED_KEY, 'true')
    return removedLegacyGuideDashboards
  }

  if (existingGuide) {
    window.localStorage.setItem(STUDYMESH_GUIDE_SEEDED_KEY, 'true')
    return removedLegacyGuideDashboards
  }

  StudyGuideStorage.save(createStudyMeshGuideStudyGuide())
  window.localStorage.setItem(STUDYMESH_GUIDE_SEEDED_KEY, 'true')
  return true
}

export const ensureStarterDashboards = () => {
  const oldStartersRemoved = removeOldStarterDashboards()
  const guideSeeded = seedStudyMeshGuideStudyPath()

  if ((oldStartersRemoved || guideSeeded) && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dashboardStorageUpdated'))
  }
}
