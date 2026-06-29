import { eld } from '../../../../node_modules/eld/src/entries/static.extrasmall.js'

export type StudyMeshLanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'nl'
  | 'pl'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'zh'
  | 'ja'
  | 'ko'

export type ContentLanguageSource =
  | 'explicit'
  | 'detected'
  | 'inherited'
  | 'settings'
  | 'fallback'

export interface ContentLanguageOption {
  code: StudyMeshLanguageCode
  label: string
  localAiSupported?: boolean
}

export interface ContentLanguageSettings {
  defaultContentLanguage: StudyMeshLanguageCode
  autoDetectAiLanguage: boolean
}

export interface ResolvedContentLanguage {
  language: StudyMeshLanguageCode
  source: ContentLanguageSource
}

export const CONTENT_LANGUAGE_SETTINGS_KEY =
  'studymesh-language-settings-v1'
export const CONTENT_LANGUAGE_SETTINGS_CHANGED_EVENT =
  'studymesh-language-settings-changed'

export const DEFAULT_CONTENT_LANGUAGE: StudyMeshLanguageCode = 'en'

export const CONTENT_LANGUAGE_OPTIONS: ContentLanguageOption[] = [
  { code: 'en', label: 'English', localAiSupported: true },
  { code: 'es', label: 'Spanish', localAiSupported: true },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese', localAiSupported: true },
  { code: 'ko', label: 'Korean' },
]

const supportedEldLanguageCodes = CONTENT_LANGUAGE_OPTIONS.map(
  (option) => option.code,
)

eld.setLanguageSubset(supportedEldLanguageCodes)

const optionByCode = new Map(
  CONTENT_LANGUAGE_OPTIONS.map((option) => [option.code, option]),
)

const explicitLanguagePatterns: Array<[StudyMeshLanguageCode, RegExp]> = [
  ['en', /\b(?:answer|respond|write|generate|create)\s+in\s+english\b/i],
  [
    'es',
    /\b(?:answer|respond|write|generate|create)\s+in\s+(?:spanish|espanol)\b|\b(?:responde|escribe|genera|crea)\s+en\s+espanol\b/i,
  ],
  [
    'fr',
    /\b(?:answer|respond|write|generate|create)\s+in\s+french\b|\b(?:reponds|ecris|genere|cree)\s+en\s+francais\b/i,
  ],
  [
    'de',
    /\b(?:answer|respond|write|generate|create)\s+in\s+german\b|\b(?:antworte|schreibe|erstelle)\s+auf\s+deutsch\b/i,
  ],
  [
    'it',
    /\b(?:answer|respond|write|generate|create)\s+in\s+italian\b|\b(?:rispondi|scrivi|crea)\s+in\s+italiano\b/i,
  ],
  [
    'pt',
    /\b(?:answer|respond|write|generate|create)\s+in\s+portuguese\b|\b(?:responda|escreva|crie)\s+em\s+portugues\b/i,
  ],
]

const promptLanguageMarkers: Array<{
  code: StudyMeshLanguageCode
  patterns: Array<[RegExp, number]>
}> = [
  {
    code: 'en',
    patterns: [
      [/\b(?:i|me|my|what|why|how|help|please)\b/g, 2],
      [/\b(?:want|learn|study|understand|explain|create)\b/g, 2],
      [/\b(?:what\s+is|help\s+me|i\s+want|teach\s+me)\b/g, 4],
    ],
  },
  {
    code: 'es',
    patterns: [
      [/\b(?:yo|me|mi|mis|que|qué|como|cómo|por\s+que|por\s+qué)\b/g, 2],
      [/\b(?:quiero|ayudame|ayúdame|aprender|estudiar|entender|explicame|explícame|crea|crear)\b/g, 3],
      [/\b(?:un|una|el|la|los|las|de|del|sobre|para|realmente|poquito|guia|guía|tecnologia|tecnología)\b/g, 1],
    ],
  },
  {
    code: 'fr',
    patterns: [
      [/\b(?:je|j|me|mon|ma|mes|que|quoi|comment|pourquoi)\b/g, 2],
      [/\b(?:veux|voudrais|aide|apprendre|etudier|étudier|comprendre|explique|cree|crée)\b/g, 3],
      [/\b(?:un|une|le|la|les|des|du|de|sur|pour|vraiment|peu)\b/g, 1],
    ],
  },
  {
    code: 'de',
    patterns: [
      [/\b(?:ich|mir|mein|meine|was|wie|warum)\b/g, 2],
      [/\b(?:will|mochte|möchte|lernen|studieren|verstehen|erklare|erkläre|erstelle)\b/g, 3],
      [/\b(?:ein|eine|der|die|das|uber|über|fur|für)\b/g, 1],
    ],
  },
  {
    code: 'it',
    patterns: [
      [/\b(?:io|mi|mio|mia|che|cosa|come|perche|perché)\b/g, 2],
      [/\b(?:voglio|aiutami|imparare|studiare|capire|spiegami|crea|creare)\b/g, 3],
      [/\b(?:un|una|il|lo|la|gli|le|di|su|per)\b/g, 1],
    ],
  },
  {
    code: 'pt',
    patterns: [
      [/\b(?:eu|me|meu|minha|que|o\s+que|como|por\s+que|porque)\b/g, 2],
      [/\b(?:quero|ajude|aprender|estudar|entender|explica|explique|cria|criar)\b/g, 3],
      [/\b(?:um|uma|o|a|os|as|de|do|da|sobre|para)\b/g, 1],
    ],
  },
  {
    code: 'nl',
    patterns: [
      [/\b(?:ik|mij|mijn|wat|hoe|waarom)\b/g, 2],
      [/\b(?:wil|leren|studeren|begrijpen|leg|maak)\b/g, 3],
      [/\b(?:een|de|het|over|voor)\b/g, 1],
    ],
  },
]

const normalizeLanguageCode = (
  value: unknown,
): StudyMeshLanguageCode | null => {
  if (typeof value !== 'string') {
    return null
  }

  const code = value.trim().toLowerCase().slice(0, 2)
  return optionByCode.has(code as StudyMeshLanguageCode)
    ? (code as StudyMeshLanguageCode)
    : null
}

export const isStudyMeshLanguageCode = (
  value: unknown,
): value is StudyMeshLanguageCode => Boolean(normalizeLanguageCode(value))

export const getContentLanguageLabel = (
  code: StudyMeshLanguageCode,
): string => optionByCode.get(code)?.label || 'English'

export const getContentLanguagePromptName = (
  code: StudyMeshLanguageCode,
): string => getContentLanguageLabel(code)

export const isLocalAiContentLanguageSupported = (
  code: StudyMeshLanguageCode,
): code is 'en' | 'es' | 'ja' => Boolean(optionByCode.get(code)?.localAiSupported)

export const getBrowserDefaultContentLanguage = (): StudyMeshLanguageCode => {
  if (typeof navigator === 'undefined') {
    return DEFAULT_CONTENT_LANGUAGE
  }

  return (
    normalizeLanguageCode(navigator.language) ||
    normalizeLanguageCode(navigator.languages?.[0]) ||
    DEFAULT_CONTENT_LANGUAGE
  )
}

export const readContentLanguageSettings = (): ContentLanguageSettings => {
  const fallback: ContentLanguageSettings = {
    defaultContentLanguage: getBrowserDefaultContentLanguage(),
    autoDetectAiLanguage: true,
  }

  try {
    const stored = window.localStorage.getItem(CONTENT_LANGUAGE_SETTINGS_KEY)
    if (!stored) {
      return fallback
    }

    const parsed = JSON.parse(stored) as Partial<ContentLanguageSettings>
    return {
      defaultContentLanguage:
        normalizeLanguageCode(parsed.defaultContentLanguage) ||
        fallback.defaultContentLanguage,
      autoDetectAiLanguage: parsed.autoDetectAiLanguage !== false,
    }
  } catch {
    return fallback
  }
}

export const saveContentLanguageSettings = (
  settings: ContentLanguageSettings,
): void => {
  const normalized: ContentLanguageSettings = {
    defaultContentLanguage:
      normalizeLanguageCode(settings.defaultContentLanguage) ||
      DEFAULT_CONTENT_LANGUAGE,
    autoDetectAiLanguage: settings.autoDetectAiLanguage !== false,
  }

  window.localStorage.setItem(
    CONTENT_LANGUAGE_SETTINGS_KEY,
    JSON.stringify(normalized),
  )
  window.dispatchEvent(new CustomEvent(CONTENT_LANGUAGE_SETTINGS_CHANGED_EVENT))
}

const normalizeForLanguagePattern = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const countPatternMatches = (text: string, pattern: RegExp): number => {
  pattern.lastIndex = 0
  return text.match(pattern)?.length || 0
}

const detectPromptLanguageByMarkers = (
  text: string,
): StudyMeshLanguageCode | null => {
  const normalized = normalizeForLanguagePattern(text).toLowerCase()
  const scores = promptLanguageMarkers
    .map(({ code, patterns }) => ({
      code,
      score: patterns.reduce(
        (total, [pattern, weight]) =>
          total + countPatternMatches(normalized, pattern) * weight,
        0,
      ),
    }))
    .sort((left, right) => right.score - left.score)
  const best = scores[0]
  const second = scores[1]

  if (!best || best.score < 4 || best.score - (second?.score || 0) < 2) {
    return null
  }

  return best.code
}

const hasEnoughNaturalLanguage = (text: string): boolean => {
  const compact = text.replace(/\s+/g, ' ').trim()
  const words = compact.match(/[\p{L}]{2,}/gu) || []
  const codeLikeChars = compact.match(/[{}[\]<>/=|\\;]/g)?.length || 0
  return words.length >= 4 && codeLikeChars / Math.max(compact.length, 1) < 0.08
}

export const detectExplicitContentLanguage = (
  text: string,
): StudyMeshLanguageCode | null =>
  explicitLanguagePatterns.find(([_code, pattern]) =>
    pattern.test(normalizeForLanguagePattern(text)),
  )?.[0] || null

const detectScriptLanguage = (text: string): StudyMeshLanguageCode | null => {
  if (/[\u3040-\u30ff]/.test(text)) {
    return 'ja'
  }

  if (/[\uac00-\ud7af]/.test(text)) {
    return 'ko'
  }

  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh'
  }

  if (/[\u0600-\u06ff]/.test(text)) {
    return 'ar'
  }

  if (/[\u0900-\u097f]/.test(text)) {
    return 'hi'
  }

  if (/[\u0400-\u04ff]/.test(text)) {
    return 'ru'
  }

  return null
}

export const detectContentLanguage = (
  text: string,
): StudyMeshLanguageCode | null => {
  const explicit = detectExplicitContentLanguage(text)
  if (explicit) {
    return explicit
  }

  const script = detectScriptLanguage(text)
  if (script) {
    return script
  }

  const markerLanguage = detectPromptLanguageByMarkers(text)
  if (markerLanguage) {
    return markerLanguage
  }

  if (!hasEnoughNaturalLanguage(text)) {
    return null
  }

  const result = eld.detect(text)
  const detected = normalizeLanguageCode(result.language)

  if (!detected || !result.isReliable()) {
    return null
  }

  return detected
}

export const resolveContentLanguage = ({
  text,
  inheritedLanguage,
  settings = readContentLanguageSettings(),
}: {
  text?: string
  inheritedLanguage?: StudyMeshLanguageCode
  settings?: ContentLanguageSettings
}): ResolvedContentLanguage => {
  const explicit = text ? detectExplicitContentLanguage(text) : null
  if (explicit) {
    return { language: explicit, source: 'explicit' }
  }

  if (settings.autoDetectAiLanguage && text) {
    const detected = detectContentLanguage(text)
    if (detected) {
      return { language: detected, source: 'detected' }
    }
  }

  if (inheritedLanguage) {
    return { language: inheritedLanguage, source: 'inherited' }
  }

  if (settings.defaultContentLanguage) {
    return { language: settings.defaultContentLanguage, source: 'settings' }
  }

  return { language: DEFAULT_CONTENT_LANGUAGE, source: 'fallback' }
}

export const createAiOutputLanguageInstruction = (
  code: StudyMeshLanguageCode | undefined,
): string => {
  const language = getContentLanguagePromptName(code || DEFAULT_CONTENT_LANGUAGE)
  return [
    `Output language: ${language}.`,
    'Write every user-visible JSON string in that language, including title, folderName, summary, rawNotes, quickStart, lesson notes, questions, answers, hints, explanations, flashcards, and chat responses.',
    'Keep JSON keys, enum values, citations, code, formulas, URLs, product names, and API names unchanged.',
    'For language-learning content, the output language is the explanation language, not necessarily the language being studied. Use the studied language only for examples, vocabulary, and short phrases.',
  ].join(' ')
}
