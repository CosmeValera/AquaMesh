/**
 * Podcast listener-friendly eval.
 *
 * Goal: prove that a podcast generated from a Quick Guide reads well when spoken
 * (no emojis, arrows, ampersands, raw math notation, or very complex numbers).
 *
 * Design:
 * - Stage 1 generates a deliberately symbol/math-heavy Quick Guide (calculus
 *   derivatives) with a live model, then verifies the guide text actually
 *   contains the disruptive tokens (otherwise the podcast test would be vacuous).
 * - Stage 2 generates a podcast script from that same guide twice:
 *     - "updated" arm uses the REAL shipped prompt imported from api/hosted-ai.ts
 *       (buildPodcastScriptPrompt) — this is the thing under test.
 *     - "baseline" arm uses a mirror of the PRE-CHANGE prompt (no listener rules)
 *       as a comparator only.
 * - Stage 3 scans both transcripts for disruptive artifacts and prints the full
 *   updated transcript for a human read.
 *
 * Run: npm --workspace studymesh exec -- vite-node scripts/podcast-listener-friendly-eval.ts
 * Requires HOSTED_OPENAI_API_KEY (or OPENAI_API_KEY) in .env.local.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  alternatePodcastSpeakers,
  buildPodcastScriptPrompt,
  capPodcastTurns,
} from '../../../api/hosted-ai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const outputDir = path.join(repoRoot, 'apps/studymesh/evals')
// PODCAST_EVAL_TAG keeps repeat runs side by side instead of overwriting, which
// matters because a single sample at temp 0.2 is noisy — see the run-to-run
// variance in baseline sourceRef (1 -> 0 -> 2).
const EVAL_TAG = process.env.PODCAST_EVAL_TAG?.trim() || ''
const jsonPath = path.join(
  outputDir,
  `podcast-listener-friendly${EVAL_TAG ? `-${EVAL_TAG}` : ''}.json`,
)

// Load env keyed off the repo root (not process.cwd()), so the run works no
// matter which directory vite-node is invoked from.
const loadRepoEnv = () => {
  for (const rel of ['.env.local', '.env', 'apps/studymesh/.env.local', 'apps/studymesh/.env']) {
    const file = path.join(repoRoot, rel)
    if (!existsSync(file)) {
      continue
    }
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }
      const eq = trimmed.indexOf('=')
      if (eq <= 0) {
        continue
      }
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key && !process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

loadRepoEnv()

const apiKey = (
  process.env.HOSTED_OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  ''
).trim()
if (!apiKey) {
  throw new Error('Missing HOSTED_OPENAI_API_KEY or OPENAI_API_KEY in .env.local')
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const GUIDE_MODEL =
  process.env.HOSTED_OPENAI_STUDY_GUIDE_MODEL?.trim() || 'gpt-5.4-mini'
const PODCAST_MODEL =
  process.env.HOSTED_OPENAI_FAST_MODEL?.trim() || 'gpt-5.4-nano'

// PODCAST_EVAL_LANG=es exercises the non-English path. Worth keeping: an earlier
// version of the rules block stated a literal English sentence to reproduce, and
// the model spliced it verbatim into a Spanish script. That fails
// podcastScriptMatchesOutputLanguage and costs a second billed call
// (api/hosted-ai.ts:2875-2913). The rules are language-neutral now; this run is
// what proves they stay that way.
const EVAL_LANGUAGE = (process.env.PODCAST_EVAL_LANG?.trim() || 'en') as
  | 'en'
  | 'es'
  | 'fr'
  | 'it'
  | 'pt'
  | 'hi'
  | 'zh'
  | 'ja'

// Everything downstream that means "not English" tests this, not EVAL_LANGUAGE:
// production always resolves a concrete language (studyGuides/generation.ts:365),
// so the English arm must send 'en' rather than undefined or the English-gated
// wording anchors in buildPodcastScriptPrompt never load.
const NON_ENGLISH_EVAL = EVAL_LANGUAGE !== 'en'

type OpenAiResult = {
  text: string
  parsed?: unknown
  inputTokens: number
  outputTokens: number
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    if (fenced) {
      return JSON.parse(fenced)
    }
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first >= 0 && last > first) {
      return JSON.parse(text.slice(first, last + 1))
    }
    throw new Error('Response was not parseable JSON')
  }
}

const callOpenAi = async ({
  model,
  prompt,
  schema,
  maxTokens = 4096,
}: {
  model: string
  prompt: string
  schema?: Record<string, unknown>
  maxTokens?: number
}): Promise<OpenAiResult> => {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_completion_tokens: maxTokens,
  }
  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'podcast_script', strict: true, schema },
    }
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI failed: ${response.status}`)
  }

  const content = payload?.choices?.[0]?.message?.content
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part: { text?: string }) => part.text || '').join('')
        : ''
  const usage = payload.usage || {}
  return {
    text,
    parsed: schema ? parseJson(text) : undefined,
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  }
}

const podcastSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    transcriptTurns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          speaker: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['speaker', 'text'],
      },
    },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          startTurn: { type: 'integer' },
        },
        required: ['title', 'startTurn'],
      },
    },
  },
  required: ['title', 'description', 'transcriptTurns', 'chapters'],
}

// Two live runs need two genuinely different prompts, so the topic is a
// parameter now rather than a hardcoded calculus constant. Each entry carries
// its own slug-shaped source title, because slug echo is one of the things under
// test and the slug has to look plausible for the topic.
const TOPICS = {
  derivatives: {
    title: 'Derivatives in Calculus',
    // sourceTitle comes straight from the page/guide title
    // (GuideWorkspacePage.tsx:576-578) and a real run echoed this slug verbatim
    // into spoken dialogue, so the eval feeds a slug-shaped one on purpose.
    sourceTitle: 'derivatives-calculus',
    notation:
      'Write like real math notes: use standard notation where it is natural, for example x^2, dy/dx, the power rule, a limit, and approximations like e ≈ 2.71828 and pi ≈ 3.14159.',
  },
  compound: {
    title: 'Compound Interest and Exponential Growth',
    sourceTitle: 'compound_interest-growth',
    notation:
      'Write like real finance/math notes: use standard notation where it is natural, for example A = P(1 + r/n)^(nt), a growth rate like 7.25%, a long figure like 1,048,576, and the constant e ≈ 2.71828.',
  },
  http: {
    title: 'How HTTP Requests Work on the Web',
    sourceTitle: 'http-requests_basics',
    notation:
      'Write like real technical notes: use identifiers and notation where natural, for example GET/POST, status codes, a URL such as https://api.example.com/v1/users, header names like Content-Type, a figure like 1,048,576 bytes, a latency figure like 99.9% uptime, and abbreviations such as e.g. and etc.',
  },
} as const

type TopicKey = keyof typeof TOPICS

const TOPIC_KEY = (process.env.PODCAST_EVAL_TOPIC?.trim() ||
  'derivatives') as TopicKey
const TOPIC = TOPICS[TOPIC_KEY]
if (!TOPIC) {
  throw new Error(
    `Unknown PODCAST_EVAL_TOPIC "${TOPIC_KEY}". Known: ${Object.keys(TOPICS).join(', ')}`,
  )
}

const GUIDE_TITLE = TOPIC.title
const PODCAST_SOURCE_TITLE = TOPIC.sourceTitle

// The baseline arm is a pre-change comparator, and it costs a full billed
// generation. When the question is "does the shipped prompt behave", that spend
// buys nothing, so it can be skipped.
const SKIP_BASELINE = process.env.PODCAST_EVAL_SKIP_BASELINE === '1'

// Path to a previous results JSON whose guide.text should be reused as the podcast
// source, instead of generating a fresh guide. Pins the source text so a prompt
// change is the only variable between two runs.
const REUSE_GUIDE_FILE = process.env.PODCAST_EVAL_GUIDE_FILE?.trim() || ''

const buildGuidePrompt = () =>
  `Write concise Study Guide lesson notes for a beginner on "${GUIDE_TITLE}".

Rules:
- Return Markdown lesson notes only (no JSON, no preamble).
- 220-320 words, with a couple of short sections.
- ${TOPIC.notation}
- Include at least one percent figure and an arrow (->) to show that one step
  leads to another.
- Include one small worked example.`

// Mirror of the PRE-CHANGE api/hosted-ai.ts buildPodcastScriptPrompt (no
// listener-friendly rules). Comparator arm only — drift here is harmless.
const buildBaselinePodcastPrompt = (sourceTitle: string, sourceText: string) =>
  [
    'Create a short StudyMesh educational podcast script from ONLY the provided Study Guide source.',
    'Write the podcast in the same language as the source.',
    'Return strict JSON with: title, description, transcriptTurns, chapters.',
    'transcriptTurns must use speakers hostA and hostB only.',
    'Target 520-850 spoken words, 10-18 short turns, warm but focused two-host dialogue. Alternate hostA and hostB when natural.',
    'Do not invent facts. Do not mention web lookup. Do not cite sources unless the source text already contains them.',
    'If the source is thin, still create the best concise recap from available content without adding outside facts.',
    `Source title: ${sourceTitle}`,
    'Source:',
    sourceText,
  ].join('\n\n')

type PodcastScript = {
  title?: string
  description?: string
  transcriptTurns?: { speaker?: string; text?: string }[]
  chapters?: { title?: string; startTurn?: number }[]
}

const transcriptText = (script: PodcastScript): string =>
  [
    script.title || '',
    script.description || '',
    ...(script.transcriptTurns || []).map((turn) => turn.text || ''),
  ].join('\n')

// Only transcriptTurns reach Unreal Speech (getPodcastSpeechSegments in
// api/hosted-ai.ts sends turn.text and nothing else). Title and description are
// displayed but never spoken, so the verdict scores this text, not the above.
const spokenText = (script: PodcastScript): string =>
  (script.transcriptTurns || []).map((turn) => turn.text || '').join('\n')

// Mirrors the shipped prompt rule: "at least three turns before the closing turn
// must end with a question mark". Kept next to the detectors so the two move
// together when the rule changes again.
const REQUIRED_QUESTION_TURNS = 3

const DETECTORS: { label: string; regex: RegExp }[] = [
  { label: 'emoji', regex: /\p{Extended_Pictographic}/gu },
  { label: 'arrows', regex: /→|⇒|↔|➜|=>|->/g },
  { label: 'ampersand', regex: /&/g },
  {
    label: 'mathSymbols',
    regex: /[\^√∑∫≈≤≥×÷±°πθ]|[²³¹⁰⁴⁵⁶⁷⁸⁹]/gu,
  },
  { label: 'percentSign', regex: /%/g },
  { label: 'complexNumbers', regex: /\d+\.\d{3,}|\d{1,3}(?:,\d{3})+/g },
  // Parens are inaudible, so they cannot group anything: "(x plus h) squared"
  // is heard as "x plus h squared". Treat them as a grouping failure.
  { label: 'parens', regex: /[()[\]{}]/g },
  // Dotted abbreviations ("p.m.", "e.g.", "etc.") may be read letter-by-letter.
  {
    label: 'dottedAbbrev',
    regex: /\b[A-Za-z]\.[A-Za-z]\.?|\b(?:etc|vs|approx|Dr|Mr|Mrs|Prof|Fig)\./g,
  },
  // Underscores and URLs are never legitimate in speech. Hyphens are excluded
  // here on purpose: "well-known" is fine, so the slug case is covered by the
  // exact slugEcho check below rather than a noisy hyphen regex.
  { label: 'identifiers', regex: /\b[a-z]+_[a-z]+\b|https?:\/\/\S+/g },
  {
    label: 'slugEcho',
    regex: new RegExp(PODCAST_SOURCE_TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
  },
  // Hosts should not narrate the handout they are reading from.
  {
    label: 'sourceRef',
    regex: /\bthe (guide|source|document|notes|text|page|transcript|material|handout)\b/gi,
  },
  // The symbol detectors above are blind to rules broken in *words*. A first run
  // scored 0 across every symbol category while still saying "two point seven
  // one eight" and "x to the n minus one" — these three catch that class.
  //
  // Three or more spelled-out digits after "point" is an unrounded constant.
  {
    label: 'spelledLongDecimal',
    regex:
      /\bpoint(\s+(zero|one|two|three|four|five|six|seven|eight|nine)){3,}/gi,
  },
  // "x to the n minus one" instead of the mandated "raised to the power of".
  {
    label: 'ambiguousExponent',
    regex: /\bto the \w+ (minus|plus|over|times)\b/gi,
  },
  // "f of x plus h" instead of the mandated "the quantity f of x plus h". The
  // lookbehind is load-bearing: without it this fires *inside* correctly
  // grouped phrases and reports compliant scripts as leaking.
  {
    label: 'ungroupedFunctionArg',
    regex: /(?<!\bthe quantity\s)(?<!\bquantity\s)\b[a-z] of [a-z] (plus|minus)\s+[a-z]\b/gi,
  },
]

// The rules block hands the model a literal English sentence to reproduce. On a
// non-English run that sentence must be translated, not spliced in verbatim.
// Only scored when PODCAST_EVAL_LANG is set.
const ENGLISH_LEAK =
  /\b(the quantity|all over|raised to the power of|goes to zero|f prime of x|roughly)\b/gi

// Several word-form detectors above only match English. On a non-English run a
// zero from them means "not applicable", not "clean".
const ENGLISH_ONLY_DETECTORS = new Set([
  'sourceRef',
  'spelledLongDecimal',
  'ambiguousExponent',
  'ungroupedFunctionArg',
  'dottedAbbrev',
])

// Grouping ambiguity is not regex-detectable ("x to the n minus one" is plain
// words), so these turns are printed for a human ear-read instead of scored.
const MATHY_TURN = /\b(squared|cubed|derivative|limit|power|over|equals|plus|minus|times|divided|quantity|root|slope)\b/i

const scanArtifacts = (text: string) => {
  const perCategory: Record<string, { count: number; samples: string[] }> = {}
  let total = 0
  for (const { label, regex } of DETECTORS) {
    const matches = [...text.matchAll(regex)]
    total += matches.length
    perCategory[label] = {
      count: matches.length,
      samples: matches.slice(0, 6).map((match) => {
        const index = match.index ?? 0
        return text
          .slice(Math.max(0, index - 22), index + (match[0].length + 22))
          .replace(/\s+/g, ' ')
          .trim()
      }),
    }
  }
  return { total, perCategory }
}

const wordCount = (value: string) => (value.trim().match(/\S+/g) || []).length

// api/hosted-ai.ts normalizePodcastTurn does safePodcastText(text, 700) — a hard
// slice with no ellipsis and no error. Anything near that is silently truncated
// mid-sentence, so track turn sizes explicitly.
const TURN_HARD_CAP = 700
const TURN_SOFT_CAP = 600
// normalizePodcastScript also does .slice(0, 18) on turns (api/hosted-ai.ts:1393)
// — same silent-truncation family. The 520-word minimum pushes turn count up, so
// a 19-turn script would lose its closing with no warning.
const TURN_COUNT_CAP = 18

const measureTurns = (script: PodcastScript) => {
  const turns = (script.transcriptTurns || []).map((turn) => turn.text || '')
  const lengths = turns.map((text) => text.length)
  const spokenWords = turns.reduce((total, text) => total + wordCount(text), 0)
  const questionTurns = turns.filter((text) => text.includes('?')).length
  const englishLeaks = NON_ENGLISH_EVAL
    ? turns.join('\n').match(ENGLISH_LEAK)?.length || 0
    : 0
  // The failure that started this: the episode ended on a question the other
  // host never got to answer. The prompt now forbids it, so score it directly.
  const lastTurn = turns.at(-1) || ''
  const endsOnQuestion = lastTurn.trim().endsWith('?')
  // Two turns in a row from one host share a TTS voice, so the listener hears
  // one block instead of an exchange. The model's raw labels are scored here and
  // again after the shipped repair, because only the second number is audible.
  const countSeams = (scored: { speaker: string }[]) =>
    scored.filter(
      (turn, index) => index > 0 && turn.speaker === scored[index - 1].speaker,
    ).length
  const rawTurns = script.transcriptTurns || []
  const sameSpeakerSeams = countSeams(rawTurns)
  const seamsAfterRepair = countSeams(alternatePodcastSpeakers(rawTurns))

  return {
    sameSpeakerSeams,
    seamsAfterRepair,
    turnCount: turns.length,
    atTurnCountCap: turns.length >= TURN_COUNT_CAP,
    overTurnBudget: turns.length > TURN_COUNT_CAP,
    endsOnQuestion,
    lastTurn,
    englishLeaks,
    spokenWords,
    inWordTarget: spokenWords >= 520 && spokenWords <= 850,
    maxTurnChars: lengths.length ? Math.max(...lengths) : 0,
    minTurnChars: lengths.length ? Math.min(...lengths) : 0,
    overHardCap: lengths.filter((length) => length > TURN_HARD_CAP).length,
    overSoftCap: lengths.filter((length) => length > TURN_SOFT_CAP).length,
    questionTurns,
    turnChars: lengths,
  }
}

const main = async () => {
  mkdirSync(outputDir, { recursive: true })
  console.log(`Guide model:   ${GUIDE_MODEL}`)
  console.log(`Podcast model: ${PODCAST_MODEL}`)

  // Stage 1: generate the Quick Guide, or reuse a previous run's.
  //
  // Regenerating the guide changes the source text under the podcast, which
  // confounds any before/after comparison of the podcast prompt itself. Pointing
  // at an earlier results file pins the source so the prompt is the only variable
  // — and it makes the run a pure podcast generation, not two billed calls.
  const guideText = REUSE_GUIDE_FILE
    ? (() => {
        const previous = JSON.parse(readFileSync(REUSE_GUIDE_FILE, 'utf8'))
        const text = previous?.guide?.text
        if (typeof text !== 'string' || !text.trim()) {
          throw new Error(`No guide.text found in ${REUSE_GUIDE_FILE}`)
        }
        console.log(`\n[1/3] Reusing guide from ${REUSE_GUIDE_FILE} (no guide call).`)
        return text.trim()
      })()
    : await (async () => {
        console.log('\n[1/3] Generating Quick Guide...')
        const guide = await callOpenAi({
          model: GUIDE_MODEL,
          prompt: buildGuidePrompt(),
          maxTokens: 1200,
        })
        return guide.text.trim()
      })()
  const guideScan = scanArtifacts(guideText)
  console.log(
    `Guide words: ${wordCount(guideText)} | disruptive tokens in guide: ${guideScan.total}`,
  )
  console.log(
    'Guide token breakdown:',
    Object.fromEntries(
      Object.entries(guideScan.perCategory).map(([k, v]) => [k, v.count]),
    ),
  )
  if (guideScan.total === 0) {
    console.warn(
      '\n[WARN] Generated guide has no disruptive tokens; the podcast test would be vacuous. Re-run or adjust the topic.',
    )
  }

  // Stage 2: podcast A/B from the same guide.
  console.log('\n[2/3] Generating podcast (updated = real shipped prompt)...')
  const updated = await callOpenAi({
    model: PODCAST_MODEL,
    prompt: buildPodcastScriptPrompt({
      sourceTitle: PODCAST_SOURCE_TITLE,
      sourceText: guideText,
      outputLanguage: EVAL_LANGUAGE,
    }),
    schema: podcastSchema,
    maxTokens: 5000,
  })

  const baseline = SKIP_BASELINE
    ? null
    : await (async () => {
        console.log('[2/3] Generating podcast (baseline = pre-change prompt)...')
        return callOpenAi({
          model: PODCAST_MODEL,
          prompt: buildBaselinePodcastPrompt(PODCAST_SOURCE_TITLE, guideText),
          schema: podcastSchema,
          maxTokens: 5000,
        })
      })()
  if (SKIP_BASELINE) {
    console.log('[2/3] Baseline arm skipped (PODCAST_EVAL_SKIP_BASELINE=1).')
  }

  // Stage 3: evaluate.
  console.log('\n[3/3] Scanning transcripts...\n')
  const updatedScript = updated.parsed as PodcastScript
  const baselineScript = (baseline?.parsed ?? {
    transcriptTurns: [],
    chapters: [],
  }) as PodcastScript
  const updatedScan = scanArtifacts(spokenText(updatedScript))
  const baselineScan = scanArtifacts(spokenText(baselineScript))
  const updatedFullScan = scanArtifacts(transcriptText(updatedScript))

  // A detector that reads 0 in BOTH arms proved nothing this run — the baseline
  // never produced the artifact, so the rule went untested rather than verified.
  const table = DETECTORS.map(({ label }) => {
    const baselineCount = baselineScan.perCategory[label].count
    const updatedCount = updatedScan.perCategory[label].count
    return {
      category: label,
      baseline: baselineCount,
      updated: updatedCount,
      status:
        NON_ENGLISH_EVAL && ENGLISH_ONLY_DETECTORS.has(label)
          ? 'n/a (english-only detector)'
          : SKIP_BASELINE
            ? updatedCount === 0
              ? 'clean (no baseline arm)'
              : 'LEAKING'
            : baselineCount === 0 && updatedCount === 0
              ? 'untested (baseline clean too)'
              : updatedCount === 0
                ? 'fixed'
                : 'LEAKING',
    }
  })
  console.table(table)
  console.log(
    `TOTAL disruptive tokens in SPOKEN turns -> baseline: ${baselineScan.total} | updated: ${updatedScan.total}`,
  )
  console.log(
    `(updated incl. unspoken title/description: ${updatedFullScan.total})`,
  )

  const baselineMetrics = measureTurns(baselineScript)
  const updatedMetrics = measureTurns(updatedScript)
  console.log('\nTurn metrics (updated arm must not approach the 700-char cap):')
  console.table([
    { metric: 'turns', baseline: baselineMetrics.turnCount, updated: updatedMetrics.turnCount },
    { metric: 'spokenWords', baseline: baselineMetrics.spokenWords, updated: updatedMetrics.spokenWords },
    { metric: 'inWordTarget(520-850)', baseline: baselineMetrics.inWordTarget, updated: updatedMetrics.inWordTarget },
    { metric: 'maxTurnChars', baseline: baselineMetrics.maxTurnChars, updated: updatedMetrics.maxTurnChars },
    { metric: 'minTurnChars', baseline: baselineMetrics.minTurnChars, updated: updatedMetrics.minTurnChars },
    { metric: `turnsOver${TURN_SOFT_CAP}`, baseline: baselineMetrics.overSoftCap, updated: updatedMetrics.overSoftCap },
    { metric: `truncatedOver${TURN_HARD_CAP}`, baseline: baselineMetrics.overHardCap, updated: updatedMetrics.overHardCap },
    { metric: 'turnsWithQuestion', baseline: baselineMetrics.questionTurns, updated: updatedMetrics.questionTurns },
    { metric: 'sameSpeakerSeams(raw)', baseline: baselineMetrics.sameSpeakerSeams, updated: updatedMetrics.sameSpeakerSeams },
    { metric: 'seamsAfterRepair', baseline: baselineMetrics.seamsAfterRepair, updated: updatedMetrics.seamsAfterRepair },
  ])
  if (updatedMetrics.overHardCap > 0) {
    console.warn(
      `\n[WARN] ${updatedMetrics.overHardCap} updated turn(s) exceed ${TURN_HARD_CAP} chars and would be silently truncated mid-sentence by normalizePodcastTurn.`,
    )
  }
  if (updatedMetrics.atTurnCountCap) {
    console.warn(
      `\n[WARN] updated arm produced ${updatedMetrics.turnCount} turns, at or over normalizePodcastScript's .slice(0, ${TURN_COUNT_CAP}). Any further turns are dropped silently, taking the closing with them.`,
    )
  }

  // TTS is metered per character against PODCAST_TTS_MONTHLY_CHARACTER_CAP, and
  // verbalized math is longer than notation. Report the real cost delta.
  const ttsChars = (script: PodcastScript) =>
    (script.transcriptTurns || []).reduce(
      (total, turn) => total + (turn.text || '').length,
      0,
    )
  const baselineTts = ttsChars(baselineScript)
  const updatedTts = ttsChars(updatedScript)
  console.log(
    `\nTTS characters (metered): baseline ${baselineTts} | updated ${updatedTts} | delta ${
      baselineTts ? `${Math.round(((updatedTts - baselineTts) / baselineTts) * 100)}%` : 'n/a'
    }`,
  )

  if (NON_ENGLISH_EVAL) {
    console.log(
      `\nOutput language: ${EVAL_LANGUAGE} | English phrases leaked from the rules block: ${updatedMetrics.englishLeaks}`,
    )
    if (updatedMetrics.englishLeaks > 0) {
      console.warn(
        '[WARN] The mandated English math sentence leaked into a non-English script. Soften "exactly as" to "say the equivalent of".',
      )
    }
  }

  const verdict =
    updatedScan.total === 0 &&
    updatedMetrics.overHardCap === 0 &&
    updatedMetrics.englishLeaks === 0
      ? 'PASS (updated transcript is clean)'
      : SKIP_BASELINE
        ? `FAIL (${updatedScan.total} artifacts; no baseline arm to compare against)`
        : updatedScan.total < baselineScan.total
          ? 'PARTIAL (updated cleaner than baseline but not spotless)'
          : 'FAIL (updated not cleaner than baseline)'
  console.log(`TTS-SAFETY VERDICT: ${verdict}`)

  // The closing-turn fix has two halves and they fail differently: the prompt
  // half asks the model to land an ending inside the budget, the code half
  // (capPodcastTurns) guarantees the closing survives if it overruns anyway.
  // Score both, and run the real shipped cap over the live turns to prove it.
  const rawTurns = (updatedScript.transcriptTurns || []).map((turn) => ({
    speaker: turn.speaker === 'hostB' ? ('hostB' as const) : ('hostA' as const),
    text: turn.text || '',
  }))
  const shippedTurns = capPodcastTurns(rawTurns)
  const closingSurvived =
    shippedTurns.at(-1)?.text === rawTurns.at(-1)?.text && shippedTurns.length > 0
  const closingVerdict = updatedMetrics.endsOnQuestion
    ? 'FAIL (episode ends on a question)'
    : updatedMetrics.overTurnBudget
      ? `PASS-VIA-CAP (model wrote ${updatedMetrics.turnCount} turns; cap kept the closing: ${closingSurvived})`
      : 'PASS (landed the ending inside the turn budget)'
  console.log(`CLOSING VERDICT: ${closingVerdict}`)
  console.log(
    `  turns: ${updatedMetrics.turnCount}/${TURN_COUNT_CAP} | after shipped cap: ${shippedTurns.length} | closing preserved: ${closingSurvived}`,
  )
  console.log(`  last turn: ${updatedMetrics.lastTurn}`)

  // Scored separately: TTS safety and podcast craft trade off against each other
  // across model tiers, and a single verdict hid that. This tracked the old
  // "one question per chapter" rule and kept printing SHORTFALL after the prompt
  // moved to a flat three, which read as a regression when it was a pass.
  // Speaker seams are folded in because the fix for question counts is what
  // caused them, so scoring one without the other hides the trade.
  const craftShortfalls = [
    updatedMetrics.questionTurns >= REQUIRED_QUESTION_TURNS
      ? ''
      : `${updatedMetrics.questionTurns} question turns, needs ${REQUIRED_QUESTION_TURNS}`,
    updatedMetrics.seamsAfterRepair === 0
      ? ''
      : `${updatedMetrics.seamsAfterRepair} same-speaker seams survived the repair`,
  ].filter(Boolean)
  const craftVerdict = craftShortfalls.length
    ? `SHORTFALL (${craftShortfalls.join('; ')})`
    : `PASS (${updatedMetrics.questionTurns} question turns, no same-speaker seams after repair)`
  console.log(`CRAFT VERDICT: ${craftVerdict}`)
  console.log(
    `  raw seams from the model: ${updatedMetrics.sameSpeakerSeams} | after alternatePodcastSpeakers: ${updatedMetrics.seamsAfterRepair}`,
  )

  // Show offending snippets from each arm.
  const showSnippets = (label: string, scan: ReturnType<typeof scanArtifacts>) => {
    const hits = Object.entries(scan.perCategory).filter(([, v]) => v.count > 0)
    if (hits.length === 0) {
      console.log(`\n${label}: no disruptive snippets.`)
      return
    }
    console.log(`\n${label} offending snippets:`)
    for (const [cat, v] of hits) {
      console.log(`  ${cat}: ${v.samples.map((s) => `"${s}"`).join(' | ')}`)
    }
  }
  showSnippets('BASELINE', baselineScan)
  showSnippets('UPDATED', updatedScan)

  // Grouping ambiguity can only be judged by ear, so surface the math turns.
  console.log('\n===== UPDATED MATH TURNS (read these aloud) =====')
  const mathyTurns = (updatedScript.transcriptTurns || [])
    .map((turn, index) => ({ index, text: turn.text || '' }))
    .filter(({ text }) => MATHY_TURN.test(text))
  if (mathyTurns.length === 0) {
    console.log('(none matched the math word pattern)')
  }
  mathyTurns.forEach(({ index, text }) => {
    console.log(`[${index + 1}] ${text}\n`)
  })

  // Full updated transcript for a human read.
  console.log('\n===== UPDATED TRANSCRIPT (for human review) =====')
  console.log(`Title: ${updatedScript.title}`)
  console.log(`Description: ${updatedScript.description}\n`)
  ;(updatedScript.transcriptTurns || []).forEach((turn, index) => {
    console.log(`[${index + 1}] ${turn.speaker} (${(turn.text || '').length} chars): ${turn.text}`)
  })

  const results = {
    runAt: new Date().toISOString(),
    models: { guide: GUIDE_MODEL, podcast: PODCAST_MODEL },
    topic: TOPIC_KEY,
    skippedBaseline: SKIP_BASELINE,
    outputLanguage: EVAL_LANGUAGE,
    detectorStatus: table,
    guide: {
      title: GUIDE_TITLE,
      podcastSourceTitle: PODCAST_SOURCE_TITLE,
      text: guideText,
      scan: guideScan,
    },
    baseline: SKIP_BASELINE
      ? null
      : {
          script: baselineScript,
          scan: baselineScan,
          metrics: baselineMetrics,
          tokens: { in: baseline?.inputTokens ?? 0, out: baseline?.outputTokens ?? 0 },
        },
    updated: {
      script: updatedScript,
      scan: updatedScan,
      fullScan: updatedFullScan,
      metrics: updatedMetrics,
      tokens: { in: updated.inputTokens, out: updated.outputTokens },
    },
    verdict,
    craftVerdict,
    closingVerdict,
    closingSurvived,
    shippedTurnCount: shippedTurns.length,
  }
  writeFileSync(jsonPath, `${JSON.stringify(results, null, 2)}\n`)
  console.log(`\nWrote ${path.relative(repoRoot, jsonPath)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
