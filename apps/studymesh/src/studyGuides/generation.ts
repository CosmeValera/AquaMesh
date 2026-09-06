import {
  createQuickCreateDashboardLayout,
  createQuickCreateOrchestratorWidgets,
  type QuickCreateWidgetRecord,
  type QuickCreateDashboardLayoutMode,
} from '../quickCreate'
import {
  generateHostedAiPodcast,
  generateQuickCreateWithAi,
  generateStudyPathWithAi,
  isStrongAiProvider,
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
  type QuickCreateAiProvider,
  type AiStudyPathDraft,
  type StudyMaterialResourceType,
} from '../quickCreate/ai'
import type { HostedAiPodcast } from '../quickCreate/ai'
import {
  normalizeQuickCreateActionInput,
  type QuickCreateActionInput,
} from '../quickCreate/quickCreateActions'
import { getAllUserKnownTopics } from '../profileContext'
import type {
  StudyGuideQuickStart,
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../state/store'
import {
  detectContentLanguage,
  resolveContentLanguage,
  type StudyMeshLanguageCode,
} from '../language/contentLanguage'
import {
  appendStudyGuideMarkdownPage,
  appendStudyGuideWidgetPage,
} from './pages'
import { getStudyGuideEmoji } from './storage'
import {
  buildStudyGuideKnownSkillInstruction,
  buildStudyGuideNextIdeaPrompt,
} from './studyGuideTitles'

type CreatePathPayload = {
  folderName: string
  quickStart?: StudyGuideQuickStart
  dashboards: Array<{
    name: string
    widgets: ReturnType<typeof createQuickCreateOrchestratorWidgets>
    layoutMode?: QuickCreateDashboardLayoutMode
    folderName: string
  }>
}

const makeSlug = (value: string, fallback: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-') || fallback

const makePackId = (title: string, index = 0): string =>
  `${makeSlug(title, 'study-guide')}-${index + 1}`

export const emptyStudyPath = (id: string): StudyPathContainerState => ({
  pathId: id,
  title: 'Study Guide',
  folderName: 'Study Guide',
  emoji: getStudyGuideEmoji('Study Guide'),
  dashboards: [],
  selectedIndex: 0,
  pinnedDashboardKeys: [],
})

export const buildStudyPathFromPayload = (
  id: string,
  payload: CreatePathPayload,
): StudyPathContainerState => {
  const title =
    payload.folderName || payload.dashboards[0]?.name || 'Study Guide'
  const folderName = payload.folderName || title
  const count = payload.dashboards.length
  const dashboards: StudyPathDashboardItem[] = payload.dashboards.map(
    (dashboard, index) => ({
      id: `${id}-dashboard-${index + 1}`,
      name: dashboard.name,
      folderName: dashboard.folderName || folderName,
      layout: createQuickCreateDashboardLayout(dashboard.widgets, {
        mode: dashboard.layoutMode || 'smart',
      }),
      dashboardKey: `${id}-${index + 1}`,
      dashboardIndex: index + 1,
      dashboardCount: count,
      dashboardPurpose: 'lesson',
      createdBy: 'generator',
      deletable: false,
    }),
  )

  return {
    pathId: id,
    title,
    folderName,
    emoji: getStudyGuideEmoji(title),
    quickStart: payload.quickStart,
    dashboards,
    selectedIndex: 0,
    pinnedDashboardKeys: [],
  }
}

const sourceTextForDashboard = (
  dashboard: AiStudyPathDraft['dashboards'][number],
  fallbackPrompt: string,
): string => {
  const markdown = dashboard.objects.find(
    (object) => object.kind === 'markdown',
  )
  return (
    dashboard.rawNotes ||
    (markdown?.kind === 'markdown' ? markdown.markdown : '') ||
    fallbackPrompt
  )
}

/**
 * Flags a guide that came back in another language. Detection only: a repair
 * call would spend Carrots again, so regenerating stays the reader's choice.
 */
const detectStudyGuideLanguageMismatch = (
  draft: AiStudyPathDraft,
  expected: StudyMeshLanguageCode,
): StudyMeshLanguageCode | undefined => {
  const text = [
    draft.quickStart?.keyIdea,
    draft.quickStart?.quickSummary,
    draft.quickStart?.forcedBridge?.keyIdea,
    draft.quickStart?.forcedBridge?.quickSummary,
    draft.dashboards[0] && sourceTextForDashboard(draft.dashboards[0], ''),
  ]
    .filter(Boolean)
    .join('\n\n')
  const detected = text.trim() ? detectContentLanguage(text) : null
  return detected && detected !== expected ? detected : undefined
}

export const generateStudyPathStateFromPrompt = async ({
  id,
  prompt,
  knownSkill,
  signal,
  provider: providerOverride,
}: {
  id: string
  prompt: string
  knownSkill?: string | null
  signal?: AbortSignal
  provider?: QuickCreateAiProvider
}): Promise<StudyPathContainerState> => {
  const settings = readQuickCreateAiSettings()
  const provider = providerOverride || settings.provider || 'hosted'
  // Only the learner's own words pick the language; app-generated instructions
  // are appended afterwards, in that same language.
  const resolvedLanguage = resolveContentLanguage({ text: prompt })
  const modelPrompt = buildStudyGuideNextIdeaPrompt(
    prompt,
    buildStudyGuideKnownSkillInstruction(
      knownSkill || '',
      resolvedLanguage.language,
    ),
  )
  const credentials = isStrongAiProvider(provider)
    ? resolveQuickCreateAiCredentials(provider)
    : resolveQuickCreateAiCredentials()
  const draft = await generateStudyPathWithAi({
    provider,
    apiToken: credentials.apiToken,
    model: credentials.model,
    title: 'Study Guide',
    folderName: '',
    prompt: modelPrompt,
    outputLanguage: resolvedLanguage.language,
    signal,
    userKnownTopics: getAllUserKnownTopics(),
  })
  const title = draft.folderName || draft.title || 'Study Guide'
  const count = draft.dashboards.length
  const dashboards: StudyPathDashboardItem[] = draft.dashboards.map(
    (dashboard, index) => {
      const dashboardKey = `${id}-${index + 1}`
      const dashboardName = dashboard.title || `${title} ${index + 1}`
      const packId = makePackId(dashboardName, index)
      const widgets = createQuickCreateOrchestratorWidgets(
        {
          id: packId,
          title: dashboardName,
          sourceFormat: dashboard.sourceFormat || 'text',
          objects: dashboard.objects,
          warnings: dashboard.warnings || [],
          sourceSummary: dashboard.sourceSummary,
          dashboardRole: dashboard.dashboardRole,
        },
        {
          rawSource: sourceTextForDashboard(dashboard, prompt),
          includeSourceWidget: true,
          includeSourceSummaryWidget: provider !== 'local',
          includeSummaryChart: false,
          widgetIdPrefix: packId,
          studyPath: {
            pathId: id,
            title,
            dashboardKey,
            dashboardName,
            dashboardIndex: index + 1,
            dashboardCount: count,
            folderName: title,
            dashboardRole: dashboard.dashboardRole,
            dashboardPurpose: dashboard.dashboardPurpose,
            practiceType: dashboard.practiceType,
            layoutReason: dashboard.layoutReason,
            sourceRefs: dashboard.sourceRefs,
            contentLanguage: resolvedLanguage.language,
            contentLanguageSource: resolvedLanguage.source,
          },
        },
      )
      return {
        id: `${id}-dashboard-${index + 1}`,
        name: dashboardName,
        layout: createQuickCreateDashboardLayout(widgets, {
          mode: 'smart',
        }),
        dashboardKey,
        dashboardIndex: index + 1,
        dashboardCount: count,
        folderName: title,
        dashboardPurpose: dashboard.dashboardPurpose,
        practiceType: dashboard.practiceType,
        layoutReason: dashboard.layoutReason,
        sourceRefs: dashboard.sourceRefs,
        contentLanguage: resolvedLanguage.language,
        contentLanguageSource: resolvedLanguage.source,
        createdBy: 'generator',
        deletable: false,
        pageIdeas: dashboard.pageIdeas,
      }
    },
  )

  const languageMismatch = detectStudyGuideLanguageMismatch(
    draft,
    resolvedLanguage.language,
  )

  return {
    pathId: id,
    title,
    folderName: title,
    emoji: draft.emoji || getStudyGuideEmoji(title),
    contentLanguage: resolvedLanguage.language,
    contentLanguageSource: resolvedLanguage.source,
    ...(languageMismatch ? { contentLanguageMismatch: languageMismatch } : {}),
    quickStart: draft.quickStart,
    learnedSkillOptions: draft.learnedSkillOptions,
    nextGuideIdeas: draft.nextGuideIdeas,
    plannedLessons: draft.plannedLessons,
    dashboards,
    selectedIndex: 0,
    pinnedDashboardKeys: [],
  }
}

const createPodcastWidget = (
  podcast: HostedAiPodcast,
): QuickCreateWidgetRecord => ({
  id: `${podcast.id}-widget`,
  name: podcast.title,
  createdAt: podcast.createdAt,
  updatedAt: podcast.createdAt,
  category: 'Study',
  tags: ['quick-create', 'podcast'],
  description: podcast.description,
  components: [
    {
      id: `${podcast.id}-player`,
      type: 'PodcastBlock',
      props: {
        podcast,
      },
    },
  ],
})

export type AiGeneratedStudyGuidePage =
  | {
      kind: 'markdown'
      title: string
      markdown: string
      source: 'quickCreate'
    }
  | {
      kind: 'widgets'
      title: string
      widgets: QuickCreateWidgetRecord[]
      layoutMode: 'tabs'
      source: 'quickCreate'
    }

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException('The creation was cancelled.', 'AbortError')
  }
}

export const appendGeneratedStudyGuidePage = (
  studyPath: StudyPathContainerState,
  page: AiGeneratedStudyGuidePage,
): StudyPathContainerState => {
  if (page.kind === 'markdown') {
    return appendStudyGuideMarkdownPage(studyPath, {
      title: page.title,
      markdown: page.markdown,
      source: page.source,
    })
  }

  return appendStudyGuideWidgetPage(studyPath, {
    title: page.title,
    widgets: page.widgets,
    layoutMode: page.layoutMode,
    source: page.source,
  })
}

export const createAiPodcastPageDraft = async ({
  studyPath,
  sourceTitle,
  sourceText,
  sourceScope,
  signal,
}: {
  studyPath: StudyPathContainerState
  sourceTitle: string
  sourceText: string
  sourceScope: 'studyGuide' | 'currentPage'
  signal?: AbortSignal
}): Promise<AiGeneratedStudyGuidePage> => {
  const resolvedLanguage = studyPath.contentLanguage
    ? {
        language: studyPath.contentLanguage,
        source: studyPath.contentLanguageSource || ('inherited' as const),
      }
    : resolveContentLanguage({
        text: sourceText,
      })
  const podcast = await generateHostedAiPodcast({
    sourceText,
    studyGuideId: studyPath.pathId,
    sourceTitle,
    sourceScope,
    outputLanguage: resolvedLanguage.language,
    signal,
  })
  throwIfAborted(signal)

  return {
    kind: 'widgets',
    title: podcast.title || `Podcast: ${sourceTitle}`,
    widgets: [createPodcastWidget(podcast)],
    layoutMode: 'tabs',
    source: 'quickCreate',
  }
}

export const appendAiPodcastPage = async ({
  studyPath,
  sourceTitle,
  sourceText,
  sourceScope,
  signal,
}: {
  studyPath: StudyPathContainerState
  sourceTitle: string
  sourceText: string
  sourceScope: 'studyGuide' | 'currentPage'
  signal?: AbortSignal
}): Promise<StudyPathContainerState> =>
  appendGeneratedStudyGuidePage(
    studyPath,
    await createAiPodcastPageDraft({
      studyPath,
      sourceTitle,
      sourceText,
      sourceScope,
      signal,
    }),
  )

export const createAiQuickCreatePageDraft = async ({
  studyPath,
  resourceType: resourceTypeInput,
  sourceTitle,
  sourceText,
  signal,
}: {
  studyPath: StudyPathContainerState
  resourceType: QuickCreateActionInput
  sourceTitle: string
  sourceText: string
  signal?: AbortSignal
}): Promise<AiGeneratedStudyGuidePage> => {
  const { resourceType } = normalizeQuickCreateActionInput(resourceTypeInput)
  if (resourceType === 'podcast') {
    throw new Error('Podcast generation uses the hosted podcast flow.')
  }
  const settings = readQuickCreateAiSettings()
  const provider = settings.provider || 'hosted'
  const resolvedLanguage = studyPath.contentLanguage
    ? {
        language: studyPath.contentLanguage,
        source: studyPath.contentLanguageSource || ('inherited' as const),
      }
    : resolveContentLanguage({
        text: sourceText,
      })
  const credentials = isStrongAiProvider(provider)
    ? resolveQuickCreateAiCredentials(provider)
    : resolveQuickCreateAiCredentials()
  const labels: Record<StudyMaterialResourceType, string> = {
    quiz: 'Quiz',
    flashcards: 'Flashcards',
    podcast: 'Podcast',
  }
  const draft = await generateQuickCreateWithAi({
    provider,
    apiToken: credentials.apiToken,
    model: credentials.model,
    title: `${labels[resourceType]}: ${sourceTitle}`,
    rawNotes: sourceText,
    packId: makeSlug(`${resourceType}-${sourceTitle}`, 'quick-create'),
    generationTargets:
      resourceType === 'quiz'
        ? ['quizzes']
        : resourceType === 'flashcards'
          ? ['flashcards']
          : ['summaries', 'definitions', 'lists'],
    generationAmount: 'medium',
    resourceType,
    detailLevel: 'medium',
    quizQuestionStyle: 'mixed',
    outputLanguage: resolvedLanguage.language,
    signal,
  })
  throwIfAborted(signal)

  const widgets = createQuickCreateOrchestratorWidgets(
    {
      id: makeSlug(`${resourceType}-${sourceTitle}`, 'quick-create'),
      title: draft.title || labels[resourceType],
      sourceFormat: draft.sourceFormat || 'text',
      objects: draft.objects,
      warnings: draft.warnings || [],
      sourceSummary: draft.sourceSummary,
    },
    {
      forceQuizBlockComponent: resourceType === 'quiz',
      focusedResourceType: resourceType,
      includeSourceWidget: false,
      includeSummaryChart: false,
      rawSource: sourceText,
    },
  )

  return {
    kind: 'widgets',
    title: draft.title || labels[resourceType],
    widgets,
    layoutMode: 'tabs',
    source: 'quickCreate',
  }
}

export const appendAiQuickCreatePage = async ({
  studyPath,
  resourceType,
  sourceTitle,
  sourceText,
  signal,
}: {
  studyPath: StudyPathContainerState
  resourceType: QuickCreateActionInput
  sourceTitle: string
  sourceText: string
  signal?: AbortSignal
}): Promise<StudyPathContainerState> =>
  appendGeneratedStudyGuidePage(
    studyPath,
    await createAiQuickCreatePageDraft({
      studyPath,
      resourceType,
      sourceTitle,
      sourceText,
      signal,
    }),
  )
