import {
  DEFAULT_STUDY_PACK_AI_MODEL,
  DEFAULT_STRONG_AI_PROVIDER,
  getEnvStrongProviderApiKey,
  isStrongAiProvider,
  StrongAiProviderId,
  STRONG_AI_PROVIDERS,
} from './strongProviders'

export type StudyPackAiProvider =
  | 'basic'
  | 'local'
  | 'hosted'
  | StrongAiProviderId

export interface StrongAiProviderCredential {
  apiToken: string
  model: string
}

export type StrongAiProviderCredentials = Partial<
  Record<StrongAiProviderId, StrongAiProviderCredential>
>

export interface StudyPackAiSettings {
  provider?: StudyPackAiProvider
  apiToken: string
  model: string
  strongProviders?: StrongAiProviderCredentials
}

export const STUDY_PACK_AI_SETTINGS_KEY = 'studymesh-study-pack-ai-settings-v1'
export const STUDY_PACK_AI_SESSION_KEY =
  'studymesh-study-pack-ai-session-keys-v1'
const LEGACY_STUDY_PACK_AI_SETTINGS_KEY = 'aquamesh-study-pack-ai-settings-v1'
export const STUDY_PACK_AI_SETTINGS_CHANGED_EVENT =
  'studymesh-study-pack-ai-settings-changed'

export { DEFAULT_STUDY_PACK_AI_MODEL }

export const getEnvGeminiApiKey = (): string =>
  getEnvStrongProviderApiKey('gemini')

export const getEnvCerebrasApiKey = (): string =>
  getEnvStrongProviderApiKey('cerebras')

export const getEnvStrongAiProviderApiKey = (
  provider: StrongAiProviderId,
): string => getEnvStrongProviderApiKey(provider)

const isStudyPackAiProvider = (value: unknown): value is StudyPackAiProvider =>
  value === 'basic' ||
  value === 'local' ||
  value === 'hosted' ||
  isStrongAiProvider(value)

const normalizeCredential = (
  provider: StrongAiProviderId,
  value: unknown,
): StrongAiProviderCredential => {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const apiToken =
    typeof record.apiToken === 'string' ? record.apiToken.trim() : ''
  const model =
    typeof record.model === 'string' && record.model.trim()
      ? record.model.trim()
      : STRONG_AI_PROVIDERS[provider].defaultModel

  return { apiToken, model }
}

const normalizeStrongProviders = (
  value: unknown,
): Required<Record<StrongAiProviderId, StrongAiProviderCredential>> => {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  return {
    gemini: normalizeCredential('gemini', record.gemini),
    cerebras: normalizeCredential('cerebras', record.cerebras),
  }
}

const readSessionStrongProviders = (): StrongAiProviderCredentials => {
  try {
    const stored = window.sessionStorage.getItem(STUDY_PACK_AI_SESSION_KEY)
    if (!stored) {
      return {}
    }

    return normalizeStrongProviders(JSON.parse(stored))
  } catch {
    return {}
  }
}

const writeSessionStrongProvider = (
  provider: StrongAiProviderId,
  credential: StrongAiProviderCredential,
): void => {
  try {
    const strongProviders = normalizeStrongProviders(
      readSessionStrongProviders(),
    )
    strongProviders[provider] = credential

    window.sessionStorage.setItem(
      STUDY_PACK_AI_SESSION_KEY,
      JSON.stringify(strongProviders),
    )
  } catch {
    // Session-only key storage is best-effort.
  }
}

const clearSessionStrongProviderToken = (
  provider: StrongAiProviderId,
): void => {
  try {
    const strongProviders = normalizeStrongProviders(
      readSessionStrongProviders(),
    )
    strongProviders[provider] = {
      apiToken: '',
      model: strongProviders[provider].model,
    }

    window.sessionStorage.setItem(
      STUDY_PACK_AI_SESSION_KEY,
      JSON.stringify(strongProviders),
    )
  } catch {
    // Session-only key storage is best-effort.
  }
}

const mergeSessionTokens = (
  persisted: Required<Record<StrongAiProviderId, StrongAiProviderCredential>>,
): Required<Record<StrongAiProviderId, StrongAiProviderCredential>> => {
  const session = normalizeStrongProviders(readSessionStrongProviders())

  return {
    gemini: {
      apiToken: session.gemini.apiToken,
      model: persisted.gemini.model,
    },
    cerebras: {
      apiToken: session.cerebras.apiToken,
      model: persisted.cerebras.model,
    },
  }
}

const persistSanitizedSettings = (
  provider: StudyPackAiProvider,
  strongProviders: Required<
    Record<StrongAiProviderId, StrongAiProviderCredential>
  >,
): void => {
  const credential = getCredentialForProvider({ provider, strongProviders })

  window.localStorage.setItem(
    STUDY_PACK_AI_SETTINGS_KEY,
    JSON.stringify({
      provider,
      apiToken: '',
      model: credential.model,
      strongProviders: {
        gemini: {
          apiToken: '',
          model: strongProviders.gemini.model,
        },
        cerebras: {
          apiToken: '',
          model: strongProviders.cerebras.model,
        },
      },
    }),
  )
}

const defaultProviderForStrongCredentials = (
  strongProviders: StrongAiProviderCredentials,
): StudyPackAiProvider => {
  if (
    strongProviders.gemini?.apiToken ||
    getEnvStrongProviderApiKey('gemini')
  ) {
    return 'gemini'
  }

  if (
    strongProviders.cerebras?.apiToken ||
    getEnvStrongProviderApiKey('cerebras')
  ) {
    return 'cerebras'
  }

  return 'hosted'
}

const getCredentialForProvider = (
  settings: Pick<StudyPackAiSettings, 'provider' | 'strongProviders'>,
  fallbackProvider: StrongAiProviderId = DEFAULT_STRONG_AI_PROVIDER,
): StrongAiProviderCredential => {
  const provider = isStrongAiProvider(settings.provider)
    ? settings.provider
    : fallbackProvider
  const strongProviders = normalizeStrongProviders(settings.strongProviders)

  return (
    strongProviders[provider] || {
      apiToken: '',
      model: STRONG_AI_PROVIDERS[provider].defaultModel,
    }
  )
}

export const readStudyPackAiSettings = (): StudyPackAiSettings => {
  try {
    const stored =
      window.localStorage.getItem(STUDY_PACK_AI_SETTINGS_KEY) ||
      window.localStorage.getItem(LEGACY_STUDY_PACK_AI_SETTINGS_KEY)
    if (!stored) {
      const strongProviders = mergeSessionTokens(normalizeStrongProviders({}))
      const provider = defaultProviderForStrongCredentials(strongProviders)
      const credential = getCredentialForProvider({
        provider,
        strongProviders,
      })

      return {
        provider,
        apiToken: credential.apiToken,
        model: credential.model,
        strongProviders,
      }
    }

    const parsed = JSON.parse(stored) as Partial<StudyPackAiSettings>
    const legacyApiToken =
      typeof parsed.apiToken === 'string' ? parsed.apiToken.trim() : ''
    const legacyModel =
      typeof parsed.model === 'string' && parsed.model.trim()
        ? parsed.model.trim()
        : DEFAULT_STUDY_PACK_AI_MODEL
    const strongProviders = normalizeStrongProviders(parsed.strongProviders)

    if (legacyApiToken && !strongProviders.gemini.apiToken) {
      strongProviders.gemini = {
        apiToken: legacyApiToken,
        model: legacyModel,
      }
    }

    for (const provider of Object.keys(
      STRONG_AI_PROVIDERS,
    ) as StrongAiProviderId[]) {
      if (strongProviders[provider].apiToken) {
        writeSessionStrongProvider(provider, strongProviders[provider])
      }
    }

    const provider = isStudyPackAiProvider(parsed.provider)
      ? parsed.provider
      : defaultProviderForStrongCredentials(strongProviders)
    const sessionStrongProviders = mergeSessionTokens(strongProviders)

    persistSanitizedSettings(provider, strongProviders)
    window.localStorage.removeItem(LEGACY_STUDY_PACK_AI_SETTINGS_KEY)

    const credential = getCredentialForProvider({
      provider,
      strongProviders: sessionStrongProviders,
    })

    return {
      provider,
      apiToken: credential.apiToken,
      model: credential.model,
      strongProviders: sessionStrongProviders,
    }
  } catch {
    const strongProviders = mergeSessionTokens(normalizeStrongProviders({}))
    const provider = defaultProviderForStrongCredentials(strongProviders)
    const credential = getCredentialForProvider({ provider, strongProviders })

    return {
      provider,
      apiToken: credential.apiToken,
      model: credential.model,
      strongProviders,
    }
  }
}

export const saveStudyPackAiSettings = (
  settings: StudyPackAiSettings,
): void => {
  const strongProviders = normalizeStrongProviders(settings.strongProviders)
  const provider =
    settings.provider || defaultProviderForStrongCredentials(strongProviders)

  if (isStrongAiProvider(provider)) {
    if (settings.apiToken.trim()) {
      writeSessionStrongProvider(provider, {
        apiToken: settings.apiToken.trim(),
        model:
          settings.model.trim() || STRONG_AI_PROVIDERS[provider].defaultModel,
      })
    } else {
      clearSessionStrongProviderToken(provider)
    }

    strongProviders[provider] = {
      apiToken: '',
      model:
        settings.model.trim() || STRONG_AI_PROVIDERS[provider].defaultModel,
    }
  }

  persistSanitizedSettings(provider, strongProviders)
  window.dispatchEvent(new CustomEvent(STUDY_PACK_AI_SETTINGS_CHANGED_EVENT))
}

export const clearStudyPackAiToken = (): void => {
  const current = readStudyPackAiSettings()
  const provider = isStrongAiProvider(current.provider)
    ? current.provider
    : DEFAULT_STRONG_AI_PROVIDER
  const strongProviders = normalizeStrongProviders(current.strongProviders)
  clearSessionStrongProviderToken(provider)
  saveStudyPackAiSettings({
    ...current,
    apiToken: '',
    model: strongProviders[provider]?.model || current.model,
    strongProviders: {
      ...strongProviders,
      [provider]: {
        apiToken: '',
        model:
          strongProviders[provider]?.model ||
          STRONG_AI_PROVIDERS[provider].defaultModel,
      },
    },
  })
}

export const getStudyPackAiCredentialForProvider = (
  settings: StudyPackAiSettings,
  provider: StrongAiProviderId,
): StrongAiProviderCredential =>
  normalizeStrongProviders(settings.strongProviders)[provider] || {
    apiToken: '',
    model: STRONG_AI_PROVIDERS[provider].defaultModel,
  }

export const saveStudyPackAiSessionKey = (
  provider: StrongAiProviderId,
  apiToken: string,
  model?: string,
): void =>
  writeSessionStrongProvider(provider, {
    apiToken: apiToken.trim(),
    model: model?.trim() || STRONG_AI_PROVIDERS[provider].defaultModel,
  })

export const resolveStudyPackAiCredentials = (
  requestedProvider?: StrongAiProviderId,
): StudyPackAiSettings & {
  tokenSource: 'settings' | 'env' | 'none'
} => {
  const settings = readStudyPackAiSettings()
  const strongProvider =
    requestedProvider ||
    (isStrongAiProvider(settings.provider)
      ? settings.provider
      : DEFAULT_STRONG_AI_PROVIDER)
  const credential = getStudyPackAiCredentialForProvider(
    settings,
    strongProvider,
  )

  if (credential.apiToken.trim()) {
    return {
      ...settings,
      apiToken: credential.apiToken.trim(),
      model: credential.model,
      tokenSource: 'settings',
    }
  }

  const envToken = getEnvStrongProviderApiKey(strongProvider)
  if (envToken) {
    return {
      ...settings,
      apiToken: envToken,
      model: credential.model,
      tokenSource: 'env',
    }
  }

  return {
    ...settings,
    apiToken: '',
    model: credential.model,
    tokenSource: 'none',
  }
}
