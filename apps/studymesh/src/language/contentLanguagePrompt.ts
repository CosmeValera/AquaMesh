export type StudyMeshLanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'nl'
  | 'pl'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'zh'
  | 'ja'
  | 'ko'

const DEFAULT_CONTENT_LANGUAGE: StudyMeshLanguageCode = 'en'

const contentLanguageLabels: Record<StudyMeshLanguageCode, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
}

export const getContentLanguagePromptName = (
  code: StudyMeshLanguageCode,
): string => contentLanguageLabels[code] || contentLanguageLabels.en

/**
 * Repeated at the very end of a prompt. The rules block sits far above the
 * material, and a guide drifted into the language of the text quoted last.
 */
export const createAiOutputLanguageAnchor = (
  code: StudyMeshLanguageCode | undefined,
): string =>
  `Write every string in ${getContentLanguagePromptName(
    code || DEFAULT_CONTENT_LANGUAGE,
  )}, whatever language the request, the known topics, or the material above use.`

export const createAiOutputLanguageInstruction = (
  code: StudyMeshLanguageCode | undefined,
): string => {
  const language = getContentLanguagePromptName(
    code || DEFAULT_CONTENT_LANGUAGE,
  )
  return [
    `Output language: ${language}.`,
    'Write every user-visible JSON string in that language, including title, folderName, summary, rawNotes, quickStart, lesson notes, questions, answers, hints, explanations, flashcards, and chat responses.',
    'Keep JSON keys, enum values, citations, code, formulas, URLs, product names, and API names unchanged.',
    'For language-learning content, the output language is the explanation language, not necessarily the language being studied. Use the studied language only for examples, vocabulary, and short phrases.',
  ].join(' ')
}
