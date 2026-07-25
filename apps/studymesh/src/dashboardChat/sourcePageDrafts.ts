import {
  callLocalLanguageModel,
  callStrongAiModel,
  isStrongAiProvider,
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
  STRONG_AI_PROVIDERS,
} from '../quickCreate/ai'
import { callHostedAiModel } from '../quickCreate/ai/hostedClient'
import {
  createAiOutputLanguageInstruction,
  isLocalAiContentLanguageSupported,
  resolveContentLanguage,
  type StudyMeshLanguageCode,
} from '../language/contentLanguage'
import type {
  DashboardExternalSource,
  DashboardExternalSourcePageDraft,
} from './externalSources'

interface PrepareDashboardExternalSourcePageDraftOptions {
  source: DashboardExternalSource
  question: string
  dashboardTitle: string
  answer: string
  contentLanguage?: StudyMeshLanguageCode
}

interface DraftResponse {
  title?: unknown
  markdown?: unknown
}

const SOURCE_PAGE_DRAFT_TIMEOUT_MS = 25000
const SOURCE_PAGE_DRAFT_TEXT_LIMIT = 6500
const MIN_DRAFT_WORDS = 45

const BOILERPLATE_PATTERN =
  /\b(?:cookie|privacy policy|subscribe|newsletter|connect with us|what are you looking for|copyright|all rights reserved|sponsor|sponsored|advertisement|funding|donate|sign in|login|share this|related articles)\b/i

export const cleanExternalSourceTextForDraft = (text: string): string =>
  text
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/!\[[^\]]*]\(\s*/g, ' ')
    .replace(/\[\]\([^)]*\)/g, ' ')
    .replace(/\[\]\(/g, ' ')
    .replace(/\[([^\]]{1,180})]\([^)]*\)/g, '$1')
    .replace(/data:image\/[^\s)]+/gi, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#{1,6}\s*/g, ' ')
    .replace(/\bIf you already have an account,?\s*Sign in\.?/gi, ' ')
    .replace(/\b(?:Menu|Search|Share|Advertisement)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const wordCount = (value: string): number =>
  value.split(/\s+/).filter(Boolean).length

const sourceDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const stripMarkdownTitle = (markdown: string): string =>
  markdown.replace(/^\s*#\s+.+(?:\r?\n)+/, '').trim()

const sanitizeDraftMarkdown = (
  markdown: string,
  source: DashboardExternalSource,
): string =>
  markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*]\(\s*/g, '')
    .replace(/\[\]\([^)]*\)/g, '')
    .replace(/\[\]\(/g, '')
    .replace(/^\s*Search query:.*$/gim, '')
    .replace(/^\s*By\s+.+$/gim, '')
    .replace(/^\s*Published\s+.+$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .replace(
      /^#\s+.+(?:\r?\n)+Source:\s*\[[^\]]+]\([^)]+\)/,
      `# ${source.title}\n\nSource: [${sourceDomain(source.url)}](${source.url})`,
    )

const extractJsonObject = (value: string): string => {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : value
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start < 0 || end <= start) {
    throw new Error('Source page draft did not return JSON.')
  }

  return candidate.slice(start, end + 1)
}

const parseDraftResponse = (
  value: string,
  source: DashboardExternalSource,
): DashboardExternalSourcePageDraft => {
  const parsed = JSON.parse(extractJsonObject(value)) as DraftResponse
  const title = String(parsed.title || source.title).trim()
  const rawMarkdown = String(parsed.markdown || '').trim()

  if (!title || !rawMarkdown) {
    throw new Error('Source page draft was empty.')
  }

  const body = stripMarkdownTitle(sanitizeDraftMarkdown(rawMarkdown, source))
    .replace(/^\s*Source:\s*(?:\[[^\]]+]\([^)]+\)|.+)\s*$/gim, '')
    .trim()
  const markdown = `# ${title}

Source: [${sourceDomain(source.url)}](${source.url})

${body}`.trim()

  if (
    wordCount(markdown) < MIN_DRAFT_WORDS ||
    BOILERPLATE_PATTERN.test(markdown) ||
    /!\[|\[\]\(/.test(markdown)
  ) {
    throw new Error('Source page draft was not clean enough to add.')
  }

  return {
    title,
    markdown,
    generatedAt: Date.now(),
  }
}

const buildDraftPrompt = ({
  source,
  question,
  dashboardTitle,
  answer,
  outputLanguage,
}: PrepareDashboardExternalSourcePageDraftOptions & {
  outputLanguage: StudyMeshLanguageCode
}) => {
  const cleanedSourceText = cleanExternalSourceTextForDraft(source.text).slice(
    0,
    SOURCE_PAGE_DRAFT_TEXT_LIMIT,
  )

  return `Create a concise RabbitHole Study Guide page from an already fetched web source.

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Use only facts from the source text below.
- Focus on the parts that help answer the chat question and connect to the Study Guide.
- Ignore site chrome, image captions, login/share text, ads, sponsors, funding, product promos, newsletter copy, author bios, navigation, and unrelated links.
- Do not mention the search query.
- Do not include images.
- Return strict JSON only: { "title": "...", "markdown": "..." }.
- markdown must start with a short source-specific page title as "# ...", then "Source: [${sourceDomain(
    source.url,
  )}](${source.url})".
- After the Source line, choose 2-4 short section headings that fit this exact source and question.
- Avoid generic repeated headings like "Why this source matters", "Key points", or "Useful details" unless they are truly the best fit.
- Make this page feel different from other source pages: emphasize the source's distinctive evidence, comparison angle, limitation, or practical takeaway.
- If the source only covers part of the user's comparison, say that naturally in the relevant section instead of using a repeated "missing piece" template.
- Keep it compact: 120-220 words.

Study Guide: ${dashboardTitle}

Chat question:
${question}

Assistant answer using this source:
${answer}

Source title: ${source.title}
Source URL: ${source.url}

Fetched source text:
${cleanedSourceText}`
}

const callDraftModel = async (
  prompt: string,
  outputLanguage: StudyMeshLanguageCode,
): Promise<string> => {
  const settings = readQuickCreateAiSettings()
  const provider = settings.provider || 'hosted'

  if (provider === 'hosted') {
    return callHostedAiModel({
      surface: 'chat',
      model: STRONG_AI_PROVIDERS.cerebras.defaultModel,
      outputLanguage,
      parts: [{ text: prompt }],
      timeoutMs: SOURCE_PAGE_DRAFT_TIMEOUT_MS,
    })
  }

  if (provider === 'local') {
    if (!isLocalAiContentLanguageSupported(outputLanguage)) {
      throw new Error(
        'Google Local AI only supports English, Spanish, and Japanese output in RabbitHole.',
      )
    }

    return callLocalLanguageModel(prompt, {
      outputLanguage,
      promptType: 'notes',
      stepLabel: 'Prepare source page',
    })
  }

  if (isStrongAiProvider(provider)) {
    const credentials = resolveQuickCreateAiCredentials(provider)
    if (!credentials.apiToken) {
      throw new Error(
        `${STRONG_AI_PROVIDERS[provider].modeLabel} mode needs a configured API key.`,
      )
    }

    return callStrongAiModel({
      provider,
      apiToken: credentials.apiToken,
      model: credentials.model,
      parts: [{ text: prompt }],
      timeoutMs: SOURCE_PAGE_DRAFT_TIMEOUT_MS,
    })
  }

  throw new Error('Choose a supported AI mode before preparing source pages.')
}

export const prepareDashboardExternalSourcePageDraft = async (
  options: PrepareDashboardExternalSourcePageDraftOptions,
): Promise<DashboardExternalSourcePageDraft> => {
  const resolvedLanguage = resolveContentLanguage({
    text: options.question,
    inheritedLanguage: options.contentLanguage,
  })
  const prompt = buildDraftPrompt({
    ...options,
    outputLanguage: resolvedLanguage.language,
  })
  const response = await callDraftModel(prompt, resolvedLanguage.language)

  return parseDraftResponse(response, options.source)
}
