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

interface GuideDashboard {
  id: string
  title: string
  widgetTitle?: string
  markdown?: string
  checklistTitle?: string
  checklistItems?: string[]
}

const guideLessons: Array<GuideDashboard & Record<string, unknown>> = [
  {
    id: 'studymesh-guide-basics',
    title: '01 - StudyMesh Basics',
    widgetTitle: 'Key Concepts',
    markdown:
      '## What is StudyMesh?\nStudyMesh is a student knowledge wiki. It helps you turn a learning goal and the current workspace context into Study Guides, pages, markdown notes, flashcards, quizzes, and exercises.\n\n## Key concepts\n### Study Guide\nA Study Guide is a step-by-step learning workspace for a topic. It can contain lessons, practice, references, and AI-assisted notes.\n\n### Page\nA page is one focused part of a Study Guide. Pages can hold markdown, explanations, quizzes, flashcards, and practice material.\n\n### Markdown notes\nMarkdown notes are editable text pages for explanations, summaries, examples, and references.\n\n### Workspace\nThe workspace is the main StudyMesh area where you create, open, edit, and reuse Study Guides, pages, Quick Create results, and AI chat.\n\n---\n## Changing AI mode\nClick the AI mode pill in the top bar to choose Hosted AI, Google Local AI, Own Gemini API token, or Own Cerebras API key.\n\n---\n## What to do next?\nThis is a Study Guide designed for step-by-step learning. Use the page controls to move through the guide and add your own pages.',
  },
  {
    id: 'studymesh-guide-practice',
    title: '02 - First StudyMesh Practice',
    widgetTitle: 'Starter Checklist',
    checklistTitle: 'Try these actions',
    checklistItems: [
      'Create your first Study Guide.',
      'Create a quiz to practice with the Study Guide.',
      'Create flashcards to practice with the Study Guide.',
      'Open Pomodoro, Canva, or another useful tool from Misc.',
      'Add your profile picture and display name.',
      'Add your own markdown page.',
      'Use AI chat while studying a page.',
    ],
  },
  {
    id: 'studymesh-guide-ai-modes',
    title: '03 - StudyMesh AI Generation Modes',
    sourceMarkdown:
      '## StudyMesh AI Generation Modes\n### Hosted AI\nHosted AI is the default path for new users. It uses Study Credits stored in your StudyMesh account, so your balance follows you across devices. New users start with 20 Study Credits, and the free daily refill brings the balance back up to 5 credits when needed.\n\n### Google Local AI\nRuns on the local Chrome built-in AI model. It is free and can work offline. It is slower and weaker than hosted or own-key strong models, but it keeps generation on your device.\n\n### Own Gemini API token\nUses the user-provided Gemini API key for rich Study Guides and study dashboards.\n\n### Own Cerebras API key\nUses the user-provided Cerebras API key for fast hosted text generation.',
    summaryTitle: 'AI Mode Summary',
    summaryItems: [
      'Hosted AI uses Study Credits. Study Guides cost 2 credits, and quick creations or dashboard chat cost 1 credit.',
      'Google Local AI runs locally, but is slower and weaker than hosted or own-key strong models.',
      'Own Gemini API token is the preferred high-quality generation mode.',
      'Own Cerebras API key is useful for fast hosted text generation.',
    ],
    quizzes: [
      {
        question:
          'How do Hosted AI Study Credits work?',
        answer:
          'They are account-based credits for hosted AI generation.',
        explanation:
          'Hosted AI uses Study Credits for Study Guides, quick creations, and dashboard chat.',
      },
      {
        question:
          'Which mode should a user choose for the highest quality Study Guide if they have an API key?',
        options: [
          'Google Local AI',
          'Hosted AI Study Credits',
          'Own Gemini API token',
          'Own Cerebras API key',
        ],
        correctIndex: 2,
        answer: 'Own Gemini API token',
        explanation:
          'Gemini API mode uses a stronger hosted model and produces richer study material.',
      },
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
        front: 'How do Hosted AI Study Credits work?',
        back: 'They are account-based credits for hosted AI. New users start with 20, daily free balance refills to 5, Study Guides cost 2, and quick creations or chat cost 1.',
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
  studyPathDashboardCount: guideLessons.slice(0, 2).length,
  studyPathFolderName: STUDYMESH_GUIDE_FOLDER_NAME,
})

const createGuideLayout = (
  lesson: GuideDashboard,
  index: number,
): DashboardLayout => {
  const contentBlock: ComponentData = lesson.markdown
    ? {
        id: `${lesson.id}-markdown`,
        type: 'MarkdownBlock',
        props: withStudyPathProps(lesson, index, {
          __blockType: 'MarkdownBlock',
          title: lesson.widgetTitle || lesson.title,
          markdown: lesson.markdown,
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

export const createStudyMeshGuideDashboards = (): SavedDashboardRecord[] => {
  const now = '2026-05-19T23:47:47.841Z'

  return guideLessons.slice(0, 2).map((lesson, lessonIndex) => {
    const index = lessonIndex + 1
    return {
      id: `studymesh-guide-dashboard-${index}`,
      name: lesson.title,
      folder: STUDYMESH_GUIDE_FOLDER_NAME,
      folderColor: STUDYMESH_GUIDE_FOLDER_COLOR,
      layout: createGuideLayout(lesson, index),
      description: 'Built-in StudyMesh guide Study Guide.',
      tags: ['quick-create', 'study-path', 'starter', 'guide'],
      isPublic: false,
      createdAt: now,
      updatedAt: now,
      componentsCount: 2,
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

export const clearStudyMeshGuideSeedMarker = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(STUDYMESH_GUIDE_SEEDED_KEY)
}

export const ensureStarterDashboards = () => {
  const oldStartersRemoved = removeOldStarterDashboards()
  const guideSeeded = seedStudyMeshGuideStudyPath()

  if ((oldStartersRemoved || guideSeeded) && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dashboardStorageUpdated'))
  }
}
