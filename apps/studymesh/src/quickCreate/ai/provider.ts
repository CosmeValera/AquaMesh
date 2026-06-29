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
  buildStudyGuideQuickStartPrompt,
  buildStudyGuideQuickStartRelevancePrompt,
  parseStudyGuideQuickStart,
  parseStudyGuideQuickStartRelevanceDecision,
  sanitizeStudyGuideQuickStart,
  STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
  STUDY_GUIDE_QUICK_START_SCHEMA,
} from '../../studyGuides/quickStart'
import type { StudyGuideQuickStartRelevanceDecision } from '../../studyGuides/quickStart'
import type { StudyGuideQuickStart } from '../../state/store'
import { sanitizeUserKnownTopics } from '../../profileContext'
import type { StudyMeshLanguageCode } from '../../language/contentLanguage'

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

export const generateStudyGuideQuickStartWithAi = async ({
  provider,
  apiToken,
  model,
  title,
  prompt,
  draft,
  userKnownTopics,
  outputLanguage,
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
}): Promise<StudyGuideQuickStart> => {
  if (provider === 'local') {
    throw new Error('Local AI does not generate Study Guide Quick Start.')
  }

  const source = studyPathDraftToQuickStartSource(draft, prompt)
  const safeKnownTopics = sanitizeUserKnownTopics(userKnownTopics)
  let relevanceDecision: StudyGuideQuickStartRelevanceDecision | undefined

  if (provider === 'hosted') {
    throw new Error(
      'Hosted Study Guide Quick Start must use bundled generation.',
    )
  }

  if (!isStrongAiProvider(provider)) {
    throw new Error(`Unknown AI provider: ${provider}`)
  }

  if (safeKnownTopics.length) {
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
            outputLanguage,
          }),
        },
      ],
      responseSchema: STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
      timeoutMs: 60 * 1000,
    })
    relevanceDecision = parseStudyGuideQuickStartRelevanceDecision(
      relevanceText,
      safeKnownTopics,
    )
  }

  const text = await callStrongAiModel({
    provider,
    apiToken,
    model,
    parts: [
      {
        text: buildStudyGuideQuickStartPrompt({
          title,
          source,
          relevanceDecision,
          outputLanguage,
        }),
      },
    ],
    responseSchema: STUDY_GUIDE_QUICK_START_SCHEMA,
    timeoutMs: 60 * 1000,
  })

  const quickStart = parseStudyGuideQuickStart(text)
  if (!quickStart) {
    throw new Error('AI did not return a Study Guide Quick Start.')
  }

  return quickStart
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
      }),
    })
    const quickStart = sanitizeStudyGuideQuickStart(hostedQuickStart)
    if (!quickStart) {
      throw new Error('Hosted AI did not return a Study Guide Quick Start.')
    }

    return { ...draft, quickStart }
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
  return {
    ...draft,
    quickStart: await generateStudyGuideQuickStartWithAi({
      provider,
      apiToken: credentials.apiToken,
      model: credentials.model,
      title: draft.folderName || draft.title || options.title,
      prompt: options.prompt,
      draft,
      signal: options.signal,
      userKnownTopics: options.userKnownTopics,
      outputLanguage: options.outputLanguage,
    }),
  }
}
