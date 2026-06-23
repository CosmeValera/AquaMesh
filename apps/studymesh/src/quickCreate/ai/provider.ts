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
import {
  callLocalLanguageModel,
  LocalAiProgressEvent,
} from './localLanguageModel'
import {
  createHostedAiTransport,
  createHostedStudyGuideTransportWithTldr,
} from './hostedClient'
import {
  buildStudyGuideTldrPrompt,
  sanitizeStudyGuideTldr,
} from '../../studyGuides/tldr'
import { sanitizeUserKnownTopics } from '../../profileContext'

type ProviderOptions = {
  provider?: QuickCreateAiProvider
  onProgress?: (event: LocalAiProgressEvent) => void
  signal?: AbortSignal
}

const studyPathDraftToTldrSource = (
  draft: AiStudyPathDraft,
  prompt: string,
): string =>
  [
    `Study Guide: ${draft.folderName || draft.title}`,
    `Original prompt: ${prompt}`,
    ...draft.dashboards.map((dashboard, index) =>
      [
        `Page ${index + 1}: ${dashboard.title}`,
        dashboard.summary ? `Preview: ${dashboard.summary}` : '',
        dashboard.rawNotes || '',
        dashboard.sourceSummary?.bullets?.length
          ? `Source summary: ${dashboard.sourceSummary.bullets.join('; ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')

export const generateStudyGuideTldrWithAi = async ({
  provider,
  apiToken,
  model,
  title,
  prompt,
  draft,
  signal,
  userKnownTopics,
}: {
  provider: QuickCreateAiProvider
  apiToken: string
  model: string
  title: string
  prompt: string
  draft: AiStudyPathDraft
  signal?: AbortSignal
  userKnownTopics?: string[]
}): Promise<string> => {
  const tldrPrompt = buildStudyGuideTldrPrompt({
    title,
    source: studyPathDraftToTldrSource(draft, prompt),
    userKnownTopics: sanitizeUserKnownTopics(userKnownTopics),
  })
  let text = ''

  if (provider === 'local') {
    text = await callLocalLanguageModel(tldrPrompt, {
      timeoutMs: 60 * 1000,
      promptType: 'tldr',
      progressLabel: 'Creating Study Guide TLDR',
      signal,
    })
  } else {
    if (provider === 'hosted') {
      throw new Error('Hosted Study Guide TLDR must use bundled generation.')
    }

    if (!isStrongAiProvider(provider)) {
      throw new Error(`Unknown AI provider: ${provider}`)
    }

    text = await callStrongAiModel({
      provider,
      apiToken,
      model,
      parts: [{ text: tldrPrompt }],
      timeoutMs: 60 * 1000,
    })
  }

  const tldr = sanitizeStudyGuideTldr(text)
  if (!tldr) {
    throw new Error('AI did not return a Study Guide TLDR.')
  }

  return tldr
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
    const draft = await generateStudyPathWithLocalAi(options, {
      onProgress: options.onProgress,
      signal: options.signal,
    })
    return {
      ...draft,
      tldr: await generateStudyGuideTldrWithAi({
        provider,
        apiToken: '',
        model: '',
        title: draft.folderName || draft.title || options.title,
        prompt: options.prompt,
        draft,
        signal: options.signal,
        userKnownTopics: options.userKnownTopics,
      }),
    }
  }

  if (provider === 'hosted') {
    let hostedTldr = ''
    const draft = await generateStudyPathWithGemini({
      ...options,
      apiToken: '',
      model: STRONG_AI_PROVIDERS.cerebras.defaultModel,
      strongProvider: 'cerebras',
      // Hosted billing is per gateway call, so one guide must use one call.
      singleRequest: true,
      strongTransport: createHostedStudyGuideTransportWithTldr({
        userKnownTopics: options.userKnownTopics,
        onTldr: (tldr) => {
          hostedTldr = tldr
        },
      }),
    })
    const tldr = sanitizeStudyGuideTldr(hostedTldr)
    if (!tldr) {
      throw new Error('Hosted AI did not return a Study Guide TLDR.')
    }

    return { ...draft, tldr }
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
    tldr: await generateStudyGuideTldrWithAi({
      provider,
      apiToken: credentials.apiToken,
      model: credentials.model,
      title: draft.folderName || draft.title || options.title,
      prompt: options.prompt,
      draft,
      signal: options.signal,
      userKnownTopics: options.userKnownTopics,
    }),
  }
}
