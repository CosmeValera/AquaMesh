import { parseStudyPack } from '../parser'
import { augmentStudyPackPracticeObjects } from '../practice'
import {
  AiStudyPackDraft,
  applyStudyMaterialResourceTypeToDraft,
} from './normalizer'
import {
  generateStudyPackWithAi as generateStudyPackWithGemini,
  generateStudyPathWithAi as generateStudyPathWithGemini,
  GenerateStudyPackWithAiOptions,
  GenerateStudyPathWithAiOptions,
  AiStudyPathDraft,
} from './strongGeneration'
import {
  generateStudyPackWithLocalAi,
  generateStudyPathWithBasicFallback,
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

  return readStudyPackAiSettings().provider || 'basic'
}

export const generateStudyPackWithAi = async (
  options: GenerateStudyPackWithAiOptions & ProviderOptions,
): Promise<AiStudyPackDraft> => {
  const provider = resolveProvider(options.provider, options.apiToken)

  if (provider === 'basic') {
    const parsed = parseStudyPack(options.rawNotes, {
      title: options.title,
      defaultTags: ['study-pack'],
    })
    const augmented = augmentStudyPackPracticeObjects(parsed.objects, {
      packId: parsed.id,
      title: parsed.title,
      rawNotes: options.rawNotes,
      generationTargets: options.generationTargets,
      generationAmount: options.generationAmount,
    })

    return applyStudyMaterialResourceTypeToDraft(
      {
        title: parsed.title,
        sourceFormat: parsed.sourceFormat,
        rawNotes: options.rawNotes,
        objects: augmented.objects,
        warnings: [...parsed.warnings, ...augmented.warnings],
      },
      parsed.id,
      options.resourceType,
    )
  }

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
      } mode needs a configured provider key. Add one in Settings, or switch to Basic fallback.`,
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

  if (provider === 'basic') {
    return generateStudyPathWithBasicFallback(options)
  }

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
      } mode needs a configured provider key. Add one in Settings, or switch to Basic fallback.`,
    )
  }

  return generateStudyPathWithGemini({
    ...options,
    apiToken: credentials.apiToken,
    model: credentials.model,
    strongProvider: provider,
  })
}
