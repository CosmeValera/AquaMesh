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
import { isStrongAiProvider, STRONG_AI_PROVIDERS } from './strongProviders'
import { LocalAiProgressEvent } from './localLanguageModel'
import { createHostedAiTransport } from './hostedClient'

type ProviderOptions = {
  provider?: QuickCreateAiProvider
  onProgress?: (event: LocalAiProgressEvent) => void
  signal?: AbortSignal
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
    return generateStudyPathWithGemini({
      ...options,
      apiToken: '',
      model: STRONG_AI_PROVIDERS.cerebras.defaultModel,
      strongProvider: 'cerebras',
      // Hosted billing is per gateway call, so one guide must use one call.
      singleRequest: true,
      strongTransport: createHostedAiTransport({
        surface: 'study-guide',
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

  return generateStudyPathWithGemini({
    ...options,
    apiToken: credentials.apiToken,
    model: credentials.model,
    strongProvider: provider,
  })
}
