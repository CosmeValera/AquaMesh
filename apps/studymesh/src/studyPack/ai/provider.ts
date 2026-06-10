import { AiStudyPackDraft } from './normalizer'
import {
  generateStudyPackWithAi as generateStudyPackWithGemini,
  generateStudyPathWithAi as generateStudyPathWithGemini,
  GenerateStudyPackWithAiOptions,
  GenerateStudyPathWithAiOptions,
  AiStudyPathDraft,
} from './strongGeneration'
import {
  generateStudyPackWithLocalAi,
  generateStudyPathWithLocalAi,
} from './localGeneration'
import {
  readStudyPackAiSettings,
  resolveStudyPackAiCredentials,
  StudyPackAiProvider,
} from './settings'
import { isStrongAiProvider, STRONG_AI_PROVIDERS } from './strongProviders'
import { LocalAiProgressEvent } from './localLanguageModel'
import { createHostedAiTransport } from './hostedClient'

type ProviderOptions = {
  provider?: StudyPackAiProvider
  onProgress?: (event: LocalAiProgressEvent) => void
  signal?: AbortSignal
}

const resolveProvider = (
  explicitProvider: StudyPackAiProvider | undefined,
  apiToken: string,
): StudyPackAiProvider => {
  if (explicitProvider) {
    return explicitProvider
  }

  if (apiToken.trim()) {
    return 'gemini'
  }

  return readStudyPackAiSettings().provider || 'hosted'
}

export const generateStudyPackWithAi = async (
  options: GenerateStudyPackWithAiOptions & ProviderOptions,
): Promise<AiStudyPackDraft> => {
  const provider = resolveProvider(options.provider, options.apiToken)

  if (provider === 'local') {
    return generateStudyPackWithLocalAi(options, {
      onProgress: options.onProgress,
      signal: options.signal,
    })
  }

  if (provider === 'hosted') {
    return generateStudyPackWithGemini({
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
    : resolveStudyPackAiCredentials(provider)
  if (!credentials.apiToken) {
    throw new Error(
      `${
        provider === 'cerebras' ? 'Cerebras' : 'Gemini'
      } mode needs a configured provider key. Open the AI mode selector and add one, or switch to Hosted AI.`,
    )
  }

  return generateStudyPackWithGemini({
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
    : resolveStudyPackAiCredentials(provider)
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
