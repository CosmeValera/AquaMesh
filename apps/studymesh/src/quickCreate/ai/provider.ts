import { AiQuickCreateDraft } from './normalizer'
import {
  generateQuickCreateWithAi as generateQuickCreateWithGemini,
  generateStudyPathWithAi as generateStudyPathWithGemini,
  GenerateQuickCreateWithAiOptions,
  GenerateStudyPathWithAiOptions,
  AiStudyPathDraft,
} from './strongGeneration'
import {
  generateQuickCreateWithLocalAi,
  generateStudyPathWithLocalAi,
} from './localGeneration'
import {
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
  QuickCreateAiProvider,
} from './settings'
import {
  callStrongAiModel,
  isStrongAiProvider,
  STRONG_AI_PROVIDERS,
} from './strongProviders'
import { LocalAiProgressEvent } from './localLanguageModel'
import {
  createHostedAiTransport,
  createHostedStudyGuideTransportWithQuickStart,
} from './hostedClient'
import {
  buildStudyGuideKnowledgeBridgeBlocksPrompt,
  buildStudyGuideQuickStartPrompt,
  buildStudyGuideQuickStartRelevancePrompt,
  ensureForcedStudyGuideQuickStartRelevanceDecision,
  parseStudyGuideKnowledgeBridgeBlocks,
  parseStudyGuideQuickStart,
  parseStudyGuideQuickStartRelevanceDecision,
  sanitizeStudyGuideQuickStart,
  STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA,
  STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
  STUDY_GUIDE_QUICK_START_SCHEMA,
} from '../../studyGuides/quickStart'
import type {
  StudyGuideBridgeMode,
  StudyGuideKnowledgeBridgeBlock,
  StudyGuideQuickStartRelevanceDecision,
} from '../../studyGuides/quickStart'
import type { StudyGuideQuickStart } from '../../state/store'
import { sanitizeUserKnownTopics } from '../../profileContext'
import type { StudyMeshLanguageCode } from '../../language/contentLanguage'
import type { StudyObject } from '../types'

type ProviderOptions = {
  provider?: QuickCreateAiProvider
  onProgress?: (event: LocalAiProgressEvent) => void
  signal?: AbortSignal
}

const studyPathDraftToQuickStartSource = (
  draft: AiStudyPathDraft,
  prompt: string,
): string =>
  [
    `Learner request: ${prompt}`,
    `Guide topic: ${draft.folderName || draft.title}`,
    ...draft.dashboards.map((dashboard, index) =>
      [
        `Section ${index + 1} concept: ${dashboard.title}`,
        dashboard.rawNotes || '',
        dashboard.summary ? `Concept summary: ${dashboard.summary}` : '',
        dashboard.sourceSummary?.bullets?.length
          ? `Important ideas: ${dashboard.sourceSummary.bullets.join('; ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')

const makeKnowledgeBridgeNote = (
  block: StudyGuideKnowledgeBridgeBlock,
  dashboardTitle: string,
): StudyObject => ({
  id: `knowledge-bridge-${block.dashboardIndex + 1}-${
    block.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'note'
  }`,
  kind: 'note',
  title: block.title || `Bridge to ${dashboardTitle}`,
  body: block.body,
  sourceLine: 0,
  tags: ['knowledge-context-bridge'],
})

const normalizeComparableTitle = (value: string): string =>
  value
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/^\d+\s*[-.)]\s+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()

const stripTrailingDuplicateMarkdownTitle = (
  markdown: string,
  title: string,
): string => {
  const normalizedTitle = normalizeComparableTitle(title)
  if (!normalizedTitle) {
    return markdown
  }

  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let lastContentIndex = lines.length - 1
  while (lastContentIndex >= 0 && !lines[lastContentIndex].trim()) {
    lastContentIndex -= 1
  }

  if (lastContentIndex < 0) {
    return ''
  }

  const lastLine = lines[lastContentIndex].trim()
  const headingMatch = lastLine.match(/^#{1,6}\s+(.+)$/)
  const lastLineTitle = headingMatch?.[1] || lastLine
  if (normalizeComparableTitle(lastLineTitle) !== normalizedTitle) {
    return markdown
  }

  return lines.slice(0, lastContentIndex).join('\n').replace(/\n+$/g, '')
}

const stripDashboardTitleEchoBeforeBridge = (
  dashboard: AiStudyPathDraft['dashboards'][number],
): AiStudyPathDraft['dashboards'][number] => ({
  ...dashboard,
  rawNotes: stripTrailingDuplicateMarkdownTitle(
    dashboard.rawNotes,
    dashboard.title,
  ),
  objects: dashboard.objects.map((object) =>
    object.kind === 'markdown'
      ? {
          ...object,
          markdown: stripTrailingDuplicateMarkdownTitle(
            object.markdown,
            dashboard.title,
          ),
        }
      : object,
  ),
})

const getEligibleKnowledgeBridgeDashboards = (draft: AiStudyPathDraft) =>
  draft.dashboards
    .map((dashboard, index) => ({ dashboard, index }))
    .filter(
      ({ dashboard, index }) =>
        index > 0 &&
        dashboard.dashboardRole === 'normal' &&
        dashboard.practiceType === 'none',
    )

const getEligibleKnowledgeBridgeIndexes = (draft: AiStudyPathDraft) =>
  getEligibleKnowledgeBridgeDashboards(draft).map(({ index }) => index)

const applyKnowledgeBridgeBlocks = (
  draft: AiStudyPathDraft,
  blocks: StudyGuideKnowledgeBridgeBlock[],
): AiStudyPathDraft => {
  if (!blocks.length) {
    return draft
  }

  const blocksByDashboard = new Map<number, StudyGuideKnowledgeBridgeBlock>()
  blocks.forEach((block) => {
    if (
      block.dashboardIndex >= 0 &&
      block.dashboardIndex < draft.dashboards.length &&
      !blocksByDashboard.has(block.dashboardIndex)
    ) {
      blocksByDashboard.set(block.dashboardIndex, block)
    }
  })

  if (!blocksByDashboard.size) {
    return draft
  }

  return {
    ...draft,
    dashboards: draft.dashboards.map((dashboard, index) => {
      const block = blocksByDashboard.get(index)
      if (!block) {
        return dashboard
      }

      const cleanDashboard = stripDashboardTitleEchoBeforeBridge(dashboard)
      return {
        ...cleanDashboard,
        objects: [
          ...cleanDashboard.objects,
          makeKnowledgeBridgeNote(block, cleanDashboard.title),
        ],
      }
    }),
  }
}

const generateStudyGuideKnowledgeBridgeBlocksWithAi = async ({
  provider,
  apiToken,
  model,
  title,
  prompt,
  draft,
  relevanceDecision,
  bridgeMode = 'auto',
  outputLanguage,
}: {
  provider: QuickCreateAiProvider
  apiToken: string
  model: string
  title: string
  prompt: string
  draft: AiStudyPathDraft
  relevanceDecision?: StudyGuideQuickStartRelevanceDecision
  bridgeMode?: StudyGuideBridgeMode
  outputLanguage?: StudyMeshLanguageCode
}): Promise<StudyGuideKnowledgeBridgeBlock[]> => {
  if (
    !isStrongAiProvider(provider) ||
    !relevanceDecision?.shouldUseKnownTopic ||
    !relevanceDecision.knownTopicsForQuickStart.length
  ) {
    return []
  }

  const eligibleDashboards = getEligibleKnowledgeBridgeDashboards(draft)
  if (!eligibleDashboards.length) {
    return []
  }

  try {
    const text = await callStrongAiModel({
      provider,
      apiToken,
      model,
      parts: [
        {
          text: buildStudyGuideKnowledgeBridgeBlocksPrompt({
            title,
            prompt,
            dashboards: eligibleDashboards.map(({ dashboard, index }) => ({
              dashboardIndex: index,
              title: dashboard.title,
              summary: dashboard.summary,
              rawNotes: dashboard.rawNotes,
            })),
            relevanceDecision,
            bridgeMode,
            outputLanguage,
          }),
        },
      ],
      responseSchema: STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA,
      timeoutMs: 60 * 1000,
    })

    return parseStudyGuideKnowledgeBridgeBlocks(
      text,
      draft.dashboards.length,
      eligibleDashboards.map(({ index }) => index),
    )
  } catch {
    return []
  }
}

export const generateStudyGuideQuickStartWithAi = async ({
  provider,
  apiToken,
  model,
  title,
  prompt,
  draft,
  userKnownTopics,
  outputLanguage,
  onRelevanceDecision,
}: {
  provider: QuickCreateAiProvider
  apiToken: string
  model: string
  title: string
  prompt: string
  draft: AiStudyPathDraft
  signal?: AbortSignal
  userKnownTopics?: string[]
  outputLanguage?: StudyMeshLanguageCode
  onRelevanceDecision?: (
    decision: StudyGuideQuickStartRelevanceDecision | undefined,
  ) => void
}): Promise<StudyGuideQuickStart> => {
  if (provider === 'local') {
    throw new Error('Local AI does not generate Study Guide Quick Start.')
  }

  const source = studyPathDraftToQuickStartSource(draft, prompt)
  const safeKnownTopics = sanitizeUserKnownTopics(userKnownTopics)

  if (provider === 'hosted') {
    throw new Error(
      'Hosted Study Guide Quick Start must use bundled generation.',
    )
  }

  if (!isStrongAiProvider(provider)) {
    throw new Error(`Unknown AI provider: ${provider}`)
  }

  const getRelevanceDecision = async (bridgeMode: StudyGuideBridgeMode) => {
    if (!safeKnownTopics.length) {
      return undefined
    }

    const relevanceText = await callStrongAiModel({
      provider,
      apiToken,
      model,
      parts: [
        {
          text: buildStudyGuideQuickStartRelevancePrompt({
            title,
            prompt,
            source,
            userKnownTopics: safeKnownTopics,
            bridgeMode,
            outputLanguage,
          }),
        },
      ],
      responseSchema: STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
      timeoutMs: 60 * 1000,
    })
    return parseStudyGuideQuickStartRelevanceDecision(
      relevanceText,
      safeKnownTopics,
    )
  }

  const generateQuickStartVariant = async (
    relevanceDecision: StudyGuideQuickStartRelevanceDecision | undefined,
    bridgeMode: StudyGuideBridgeMode,
  ) =>
    parseStudyGuideQuickStart(
      await callStrongAiModel({
        provider,
        apiToken,
        model,
        parts: [
          {
            text: buildStudyGuideQuickStartPrompt({
              title,
              source,
              relevanceDecision,
              bridgeMode,
              outputLanguage,
            }),
          },
        ],
        responseSchema: STUDY_GUIDE_QUICK_START_SCHEMA,
        timeoutMs: 60 * 1000,
      }),
    )

  const relevanceDecision = await getRelevanceDecision('auto')
  onRelevanceDecision?.(relevanceDecision)

  const quickStart = await generateQuickStartVariant(relevanceDecision, 'auto')
  if (!quickStart) {
    throw new Error('AI did not return a Study Guide Quick Start.')
  }

  if (
    !safeKnownTopics.length ||
    (relevanceDecision?.shouldUseKnownTopic &&
      relevanceDecision.knownTopicsForQuickStart.length)
  ) {
    return quickStart
  }

  try {
    const forcedRelevanceDecision =
      ensureForcedStudyGuideQuickStartRelevanceDecision(
        await getRelevanceDecision('force'),
        safeKnownTopics,
      )
    const forcedBridge = forcedRelevanceDecision
      ? await generateQuickStartVariant(forcedRelevanceDecision, 'force')
      : null

    return forcedBridge ? { ...quickStart, forcedBridge } : quickStart
  } catch {
    return quickStart
  }
}

const resolveProvider = (
  explicitProvider: QuickCreateAiProvider | undefined,
  apiToken: string,
): QuickCreateAiProvider => {
  if (explicitProvider) {
    return explicitProvider
  }

  if (apiToken.trim()) {
    return 'gemini'
  }

  return readQuickCreateAiSettings().provider || 'hosted'
}

export const generateQuickCreateWithAi = async (
  options: GenerateQuickCreateWithAiOptions & ProviderOptions,
): Promise<AiQuickCreateDraft> => {
  const provider = resolveProvider(options.provider, options.apiToken)

  if (provider === 'local') {
    return generateQuickCreateWithLocalAi(options, {
      onProgress: options.onProgress,
      signal: options.signal,
    })
  }

  if (provider === 'hosted') {
    return generateQuickCreateWithGemini({
      ...options,
      apiToken: '',
      model: STRONG_AI_PROVIDERS.cerebras.defaultModel,
      strongProvider: 'cerebras',
      strongTransport: createHostedAiTransport({
        surface: 'quick-create',
      }),
    })
  }

  if (!isStrongAiProvider(provider)) {
    throw new Error(`Unknown AI provider: ${provider}`)
  }

  const credentials = options.apiToken
    ? {
        apiToken: options.apiToken,
        model: options.model,
      }
    : resolveQuickCreateAiCredentials(provider)
  if (!credentials.apiToken) {
    throw new Error(
      `${
        provider === 'cerebras' ? 'Cerebras' : 'Gemini'
      } mode needs a configured provider key. Open the AI mode selector and add one, or switch to Hosted AI.`,
    )
  }

  return generateQuickCreateWithGemini({
    ...options,
    apiToken: credentials.apiToken,
    model: credentials.model,
    strongProvider: provider,
  })
}

export const generateStudyPathWithAi = async (
  options: GenerateStudyPathWithAiOptions & ProviderOptions,
): Promise<AiStudyPathDraft> => {
  const provider = resolveProvider(options.provider, options.apiToken)

  if (provider === 'local') {
    return generateStudyPathWithLocalAi(options, {
      onProgress: options.onProgress,
      signal: options.signal,
    })
  }

  if (provider === 'hosted') {
    let hostedQuickStart: StudyGuideQuickStart | null = null
    let hostedBridgeBlocks: StudyGuideKnowledgeBridgeBlock[] = []
    const draft = await generateStudyPathWithGemini({
      ...options,
      apiToken: '',
      model: STRONG_AI_PROVIDERS.cerebras.defaultModel,
      strongProvider: 'cerebras',
      // Hosted billing is per gateway call, so one guide must use one call.
      singleRequest: true,
      strongTransport: createHostedStudyGuideTransportWithQuickStart({
        userKnownTopics: options.userKnownTopics,
        outputLanguage: options.outputLanguage,
        onQuickStart: (quickStart) => {
          hostedQuickStart = quickStart
        },
        onBridgeBlocks: (bridgeBlocks) => {
          hostedBridgeBlocks = bridgeBlocks
        },
      }),
    })
    const quickStart = sanitizeStudyGuideQuickStart(hostedQuickStart)
    if (!quickStart) {
      throw new Error('Hosted AI did not return a Study Guide Quick Start.')
    }

    return applyKnowledgeBridgeBlocks(
      { ...draft, quickStart },
      parseStudyGuideKnowledgeBridgeBlocks(
        JSON.stringify({ blocks: hostedBridgeBlocks }),
        draft.dashboards.length,
        getEligibleKnowledgeBridgeIndexes(draft),
      ),
    )
  }

  if (!isStrongAiProvider(provider)) {
    throw new Error(`Unknown AI provider: ${provider}`)
  }

  const credentials = options.apiToken
    ? {
        apiToken: options.apiToken,
        model: options.model,
      }
    : resolveQuickCreateAiCredentials(provider)
  if (!credentials.apiToken) {
    throw new Error(
      `${
        provider === 'cerebras' ? 'Cerebras' : 'Gemini'
      } mode needs a configured provider key. Open the AI mode selector and add one, or switch to Hosted AI.`,
    )
  }

  const draft = await generateStudyPathWithGemini({
    ...options,
    apiToken: credentials.apiToken,
    model: credentials.model,
    strongProvider: provider,
  })
  let relevanceDecision: StudyGuideQuickStartRelevanceDecision | undefined
  const quickStart = await generateStudyGuideQuickStartWithAi({
    provider,
    apiToken: credentials.apiToken,
    model: credentials.model,
    title: draft.folderName || draft.title || options.title,
    prompt: options.prompt,
    draft,
    signal: options.signal,
    userKnownTopics: options.userKnownTopics,
    outputLanguage: options.outputLanguage,
    onRelevanceDecision: (decision) => {
      relevanceDecision = decision
    },
  })
  const bridgeBlocks = await generateStudyGuideKnowledgeBridgeBlocksWithAi({
    provider,
    apiToken: credentials.apiToken,
    model: credentials.model,
    title: draft.folderName || draft.title || options.title,
    prompt: options.prompt,
    draft,
    relevanceDecision,
    outputLanguage: options.outputLanguage,
  })

  return applyKnowledgeBridgeBlocks({ ...draft, quickStart }, bridgeBlocks)
}
