import { DashboardLayout } from '../state/store'
import { ComponentData } from '../components/WidgetEditor/types/types'
import { createStudyPathContainerState } from '../components/Dasboard/studyPathContainer'
import { StudyGuideStorage } from '../studyGuides/storage'
import type { StudyGuideRecord } from '../cloud/types'

export const STUDYMESH_GUIDE_STUDY_PATH_ID =
  'studymesh-student-knowledge-wiki-a-beginner-s-guide'
export const STUDYMESH_GUIDE_TITLE = 'Welcome to RabbitHole'
export const STUDYMESH_GUIDE_FOLDER_NAME = 'RabbitHole Guide'
export const STUDYMESH_GUIDE_FOLDER_COLOR = '#007C66'

const DASHBOARD_STORAGE_KEY = 'customDashboards'
const WIDGET_STORAGE_KEY = 'studymesh_custom_widgets'
const LEGACY_WIDGET_STORAGE_KEY = 'aquamesh_custom_widgets'
const STUDYMESH_GUIDE_SEEDED_KEY = 'studymesh-guide-study-path-seeded-v1'
const OLD_STARTER_REMOVAL_KEY = 'studymesh-old-starter-dashboards-removed-v1'

// These two sets match names already sitting in existing users' localStorage, so the
// AquaMesh and StudyMesh entries must stay verbatim through any rebrand.
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

interface GuideDashboard {
  id: string
  title: string
  widgetTitle?: string
  markdown?: string
  checklistTitle?: string
  checklistItems?: string[]
  quizzes?: Array<{
    question: string
    options: string[]
    correctIndex: number
    answer: string
    explanation: string
    hint?: string
  }>
  sourceMarkdown?: string
  summaryTitle?: string
  summaryItems?: string[]
  flashcards?: Array<{
    front: string
    back: string
  }>
}

const guideLessons: GuideDashboard[] = [
  {
    id: 'studymesh-guide-basics',
    title: '01 - RabbitHole Basics',
    widgetTitle: 'Key Concepts',
    markdown:
      '## What is RabbitHole?\nRabbitHole explains new ideas through what you already know. Start from something you are curious about and it builds Quick Guides, pages, markdown notes, quizzes, flashcards, podcasts, and AI chat support around it.\n\n## Key concepts\n### Quick Guide\nA Quick Guide is a step-by-step learning workspace for a topic. It can contain lessons, practice widgets, references, and AI-assisted notes.\n\n### Page\nA page is one focused part of a Quick Guide. Pages can hold markdown, explanations, quizzes, flashcards, podcasts, and practice material.\n\n### Quick Create\nQuick Create uses the active Quick Guide or page context to generate focused practice, such as a quiz, flashcards or podcasts.\n\n### AI Chat\nAI Chat helps you ask follow-up questions while you read. It can use the current page context and, when needed, web sources from the chat source tools.\n\n### Markdown notes\nMarkdown notes are editable pages for explanations, summaries, examples, references, and checklists.\n\n### Going further\nEvery Quick Guide starts short. Use Add Page to write a new page yourself, or Quick Create to generate more material from what is already there.\n\n---\n## What to do next?\nMove through this guide, try the mini quiz below, then use the practice checklist on the next page.',
    quizzes: [
      {
        question: 'What is the main purpose of RabbitHole?',
        options: [
          'To explain new ideas through what you already know and turn them into study material',
          'To replace every external productivity app',
          'To store only plain text notes',
          'To generate content without any workspace context',
        ],
        correctIndex: 0,
        answer:
          'To explain new ideas through what you already know and turn them into study material',
        explanation:
          'RabbitHole centers Quick Guides, pages, practice widgets, markdown notes, and AI chat around whatever you are curious about.',
        hint: 'Think about the phrase used at the start of this page.',
      },
      {
        question: 'What does Quick Create use by default?',
        options: [
          'The active Quick Guide or page context',
          'A mandatory file upload',
          'Only a pasted PDF',
          'A blank workspace with no context',
        ],
        correctIndex: 0,
        answer: 'The active Quick Guide or page context',
        explanation:
          'Quick Create is meant for fast generation from the context the user is already studying.',
        hint: 'Look at the Quick Create section.',
      },
      {
        question: 'What can markdown notes include?',
        options: [
          'Explanations, summaries, examples, references, and checklists',
          'Only headings',
          'Only multiple-choice questions',
          'Only account settings',
        ],
        correctIndex: 0,
        answer: 'Explanations, summaries, examples, references, and checklists',
        explanation:
          'Markdown notes are editable pages for structured study material, including checklists.',
        hint: 'This was listed under Markdown notes.',
      },
    ],
  },
  {
    id: 'studymesh-guide-practice',
    title: '02 - First RabbitHole Practice',
    widgetTitle: 'Starter Checklist',
    checklistTitle: 'Try these actions',
    checklistItems: [
      'Create your first Quick Guide.',
      'Use Quick Create to make a quiz from the current Quick Guide.',
      'Use Quick Create to make flashcards from the current Quick Guide.',
      'Generate a podcast for a topic you want to review while listening.',
      'Add your own markdown page.',
      'Use AI chat while studying a page.',
      'Mark a checklist item as done and come back to confirm it stays checked.',
    ],
  },
  {
    id: 'studymesh-guide-ai-modes',
    title: '03 - RabbitHole AI Generation Modes',
    sourceMarkdown:
      '## RabbitHole AI Generation Modes\n### Hosted AI\nHosted AI uses Carrots stored in your RabbitHole account, so your balance follows you across devices.\n\n### Google Local AI\nGoogle Local AI runs on the local Chrome built-in AI model. It is free and can work offline, but it is usually slower and weaker than hosted or own-key strong models.\n\n### Own Gemini API token\nOwn Gemini API token mode uses your Gemini API key for rich Quick Guides and study dashboards.\n\n### Own Cerebras API key\nOwn Cerebras API key mode uses your Cerebras API key for fast hosted text generation.',
    summaryTitle: 'AI Mode Summary',
    summaryItems: [
      'Hosted AI uses Carrots. Quick Guides cost 3 Carrots, and quick creations, podcasts, or dashboard chat cost 1 Carrot.',
      'Google Local AI runs locally, but is slower and weaker than hosted or own-key strong models.',
      'Own Gemini API token is the preferred high-quality generation mode.',
      'Own Cerebras API key is useful for fast hosted text generation.',
    ],
    flashcards: [
      {
        front: 'What is Google Local AI?',
        back: 'A local Chrome AI mode that can work offline.',
      },
      {
        front: 'What is Own Gemini API token mode?',
        back: 'The high-quality mode that uses the user’s Gemini API key.',
      },
      {
        front: 'How do Hosted AI Carrots work?',
        back: 'They are account-based Carrots for hosted AI generation.',
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

const withStudyPathProps = (
  lesson: GuideDashboard,
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

const countGuideComponents = (lesson: GuideDashboard): number =>
  2 + (lesson.quizzes?.length ? 1 : 0)

const createGuideLayout = (
  lesson: GuideDashboard,
  index: number,
): DashboardLayout => {
  const markdown = lesson.markdown || lesson.sourceMarkdown
  const contentBlock: ComponentData = markdown
    ? {
        id: `${lesson.id}-markdown`,
        type: 'MarkdownBlock',
        props: withStudyPathProps(lesson, index, {
          __blockType: 'MarkdownBlock',
          title: lesson.widgetTitle || lesson.title,
          markdown,
        }),
      }
    : {
        id: `${lesson.id}-checklist`,
        type: 'ListBlock',
        props: withStudyPathProps(lesson, index, {
          __blockType: 'ListBlock',
          title: lesson.checklistTitle || lesson.widgetTitle || lesson.title,
          items: (lesson.checklistItems || []).join('\n'),
          ordered: false,
          interactiveChecklist: true,
        }),
      }

  const quizBlock: ComponentData | null = lesson.quizzes?.length
    ? {
        id: `${lesson.id}-mini-quiz`,
        type: 'QuizCarouselBlock',
        props: withStudyPathProps(lesson, index, {
          __blockType: 'QuizCarouselBlock',
          title: 'Mini quiz',
          items: lesson.quizzes,
        }),
      }
    : null

  const components: ComponentData[] = [
    {
      id: `${lesson.id}-title`,
      type: 'Label',
      props: {
        text: lesson.widgetTitle || lesson.title,
        variant: 'h6',
        fontWeight: 700,
        gutterBottom: true,
      },
    },
    contentBlock,
    ...(quizBlock ? [quizBlock] : []),
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
          {
            type: 'tab',
            name: lesson.widgetTitle || lesson.title,
            component: 'CustomWidget',
            config: {
              customProps: {
                widgetId: `${lesson.id}-source`,
                components,
              },
            },
          },
        ],
      },
    ],
  }
}

export const createStudyMeshGuideDashboards = (
  now = new Date().toISOString(),
): SavedDashboardRecord[] =>
  guideLessons.map((lesson, lessonIndex) => {
    const index = lessonIndex + 1
    return {
      id: `studymesh-guide-dashboard-${index}`,
      name: lesson.title,
      folder: STUDYMESH_GUIDE_FOLDER_NAME,
      folderColor: STUDYMESH_GUIDE_FOLDER_COLOR,
      layout: createGuideLayout(lesson, index),
      description: 'Quick RabbitHole tutorial.',
      tags: ['quick-create', 'study-path', 'starter', 'guide'],
      isPublic: false,
      createdAt: now,
      updatedAt: now,
      componentsCount: countGuideComponents(lesson),
    }
  })

export const createStudyMeshGuideStudyGuide = (
  now = new Date().toISOString(),
): StudyGuideRecord => {
  const studyPath = createStudyPathContainerState(
    createStudyMeshGuideDashboards(now),
  )

  if (!studyPath) {
    throw new Error('RabbitHole starter guide seed is invalid')
  }

  return {
    id: STUDYMESH_GUIDE_STUDY_PATH_ID,
    title: STUDYMESH_GUIDE_TITLE,
    folderName: STUDYMESH_GUIDE_FOLDER_NAME,
    description: 'Quick RabbitHole tutorial.',
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

  if (!force && existingGuide) {
    window.localStorage.setItem(STUDYMESH_GUIDE_SEEDED_KEY, 'true')
    return removedLegacyGuideDashboards
  }

  StudyGuideStorage.save(createStudyMeshGuideStudyGuide())
  window.localStorage.setItem(STUDYMESH_GUIDE_SEEDED_KEY, 'true')
  return true
}

export const ensureStarterDashboards = () => {
  const oldStartersRemoved = removeOldStarterDashboards()

  if (oldStartersRemoved && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dashboardStorageUpdated'))
  }
}
