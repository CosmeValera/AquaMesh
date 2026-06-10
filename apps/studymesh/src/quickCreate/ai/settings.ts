import {
  DEFAULT_QUICK_CREATE_AI_MODEL,
  DEFAULT_STRONG_AI_PROVIDER,
  getEnvStrongProviderApiKey,
  isStrongAiProvider,
  StrongAiProviderId,
  STRONG_AI_PROVIDERS,
} from './strongProviders'

export type QuickCreateAiProvider = 'local' | 'hosted' | StrongAiProviderId

export interface StrongAiProviderCredential {
  apiToken: string
  model: string
}

export type StrongAiProviderCredentials = Partial<
  Record<StrongAiProviderId, StrongAiProviderCredential>
>

export interface QuickCreateAiSettings {
  provider?: QuickCreateAiProvider
  apiToken: string
  model: string
  strongProviders?: StrongAiProviderCredentials
}

export const QUICK_CREATE_AI_SETTINGS_KEY = 'studymesh-quick-create-ai-settings-v1'
export const QUICK_CREATE_AI_SESSION_KEY =
  'studymesh-quick-create-ai-session-keys-v1'
export const QUICK_CREATE_AI_SETTINGS_CHANGED_EVENT =
  'studymesh-quick-create-ai-settings-changed'

export { DEFAULT_QUICK_CREATE_AI_MODEL }

export const getEnvGeminiApiKey = (): string =>
  getEnvStrongProviderApiKey('gemini')

export const getEnvCerebrasApiKey = (): string =>
  getEnvStrongProviderApiKey('cerebras')

export const getEnvStrongAiProviderApiKey = (
  provider: StrongAiProviderId,
): string => getEnvStrongProviderApiKey(provider)

const isQuickCreateAiProvider = (value: unknown): value is QuickCreateAiProvider =>
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
    const stored = window.sessionStorage.getItem(QUICK_CREATE_AI_SESSION_KEY)
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
      QUICK_CREATE_AI_SESSION_KEY,
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
      QUICK_CREATE_AI_SESSION_KEY,
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
  provider: QuickCreateAiProvider,
  strongProviders: Required<
    Record<StrongAiProviderId, StrongAiProviderCredential>
  >,
): void => {
  const credential = getCredentialForProvider({ provider, strongProviders })

  window.localStorage.setItem(
    QUICK_CREATE_AI_SETTINGS_KEY,
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
): QuickCreateAiProvider => {
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
  settings: Pick<QuickCreateAiSettings, 'provider' | 'strongProviders'>,
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

export const readQuickCreateAiSettings = (): QuickCreateAiSettings => {
  try {
    const stored = window.localStorage.getItem(QUICK_CREATE_AI_SETTINGS_KEY)
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

    const parsed = JSON.parse(stored) as Partial<QuickCreateAiSettings>
    const legacyApiToken =
      typeof parsed.apiToken === 'string' ? parsed.apiToken.trim() : ''
    const legacyModel =
      typeof parsed.model === 'string' && parsed.model.trim()
        ? parsed.model.trim()
        : DEFAULT_QUICK_CREATE_AI_MODEL
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

    const provider = isQuickCreateAiProvider(parsed.provider)
      ? parsed.provider
      : defaultProviderForStrongCredentials(strongProviders)
    const sessionStrongProviders = mergeSessionTokens(strongProviders)

    persistSanitizedSettings(provider, strongProviders)

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

export const saveQuickCreateAiSettings = (
  settings: QuickCreateAiSettings,
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
  window.dispatchEvent(new CustomEvent(QUICK_CREATE_AI_SETTINGS_CHANGED_EVENT))
}

export const clearQuickCreateAiToken = (): void => {
  const current = readQuickCreateAiSettings()
  const provider = isStrongAiProvider(current.provider)
    ? current.provider
    : DEFAULT_STRONG_AI_PROVIDER
  const strongProviders = normalizeStrongProviders(current.strongProviders)
  clearSessionStrongProviderToken(provider)
  saveQuickCreateAiSettings({
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

export const getQuickCreateAiCredentialForProvider = (
  settings: QuickCreateAiSettings,
  provider: StrongAiProviderId,
): StrongAiProviderCredential =>
  normalizeStrongProviders(settings.strongProviders)[provider] || {
    apiToken: '',
    model: STRONG_AI_PROVIDERS[provider].defaultModel,
  }

export const saveQuickCreateAiSessionKey = (
  provider: StrongAiProviderId,
  apiToken: string,
  model?: string,
): void =>
  writeSessionStrongProvider(provider, {
    apiToken: apiToken.trim(),
    model: model?.trim() || STRONG_AI_PROVIDERS[provider].defaultModel,
  })

export const resolveQuickCreateAiCredentials = (
  requestedProvider?: StrongAiProviderId,
): QuickCreateAiSettings & {
  tokenSource: 'settings' | 'env' | 'none'
} => {
  const settings = readQuickCreateAiSettings()
  const strongProvider =
    requestedProvider ||
    (isStrongAiProvider(settings.provider)
      ? settings.provider
      : DEFAULT_STRONG_AI_PROVIDER)
  const credential = getQuickCreateAiCredentialForProvider(
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
