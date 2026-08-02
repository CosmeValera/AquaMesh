/**
 * Captures the /try demo guides from real generations.
 *
 * The demo has to show what a real hosted user gets, so this script drives the
 * production code on both sides of the gateway: the client assembly in
 * src/studyGuides/generation.ts, and the hosted generators in api/hosted-ai.ts.
 * Only the gateway envelope is replaced - auth, credits, Supabase storage and
 * the daily limits are the parts a capture must not touch.
 *
 * Usage, from the repository root:
 *   node --import tsx apps/studymesh/scripts/build-demo-guide.mjs
 *   node --import tsx apps/studymesh/scripts/build-demo-guide.mjs why-you-forget
 *   node --import tsx apps/studymesh/scripts/build-demo-guide.mjs --skip-audio
 *   node --import tsx apps/studymesh/scripts/build-demo-guide.mjs --from-raw
 *
 * Per slug it writes src/demo/guides/<camelSlug>.data.json, the podcast MP3 in
 * public/demo/audio/<slug>.mp3, and a readable review dump plus the raw
 * pre-normalisation capture in the git-ignored scripts/.capture/ directory.
 * The hand-written <camelSlug>.ts wrapper is never generated: it carries the
 * curated chat exchanges and stays owned by a human.
 *
 * --from-raw replays only the normalisation half: it reads
 * .capture/<slug>.raw.json and rewrites <camelSlug>.data.json without a single
 * model call, so a normalisation fix can be applied to an existing capture
 * without spending API calls and without moving any generated prose out from
 * under the curated chat exchanges. It leaves the podcast MP3 alone.
 */

import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(scriptDir, '..')
const repoRoot = resolve(appDir, '../..')
const captureDir = resolve(scriptDir, '.capture')
const guidesDir = resolve(appDir, 'src/demo/guides')
const audioDir = resolve(appDir, 'public/demo/audio')

// eld ships an ESM-only exports map, so the CommonJS resolution tsx uses for
// .ts sources cannot find eld/extrasmall. Point the bare specifier straight at
// the file instead of changing app source to suit a script.
const requireFromScript = createRequire(import.meta.url)
const eldEntry = requireFromScript.resolve(
  resolve(repoRoot, 'node_modules/eld/src/entries/static.extrasmall.js'),
)
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function resolveWithEldAlias(request, ...rest) {
  if (request === 'eld/extrasmall') {
    return eldEntry
  }

  return originalResolveFilename.call(this, request, ...rest)
}

/** One frozen timestamp for every captured record. */
const FIXED_TIMESTAMP = '2026-08-02T10:00:00.000Z'
const BONUS_DURATIONS_MS = {
  quiz: 9000,
  flashcards: 6000,
  podcast: 13000,
}
/** Mirrors STUDY_BLOCK_TYPES in src/components/study/StudyBlockView.tsx. */
const STUDY_BLOCK_TYPES = [
  'FlashcardBlock',
  'QuizBlock',
  'QuizzSingle',
  'RevealBlock',
  'StudyNoteBlock',
  'CodeBlock',
  'DefinitionBlock',
  'ComparisonBlock',
  'ListBlock',
  'SequenceBlock',
  'ReviewPromptBlock',
  'MarkdownBlock',
  'FlashcardCarouselBlock',
  'QuizCarouselBlock',
  'FocusedFlashcardSessionBlock',
  'FocusedQuizSessionBlock',
  'PodcastBlock',
]
/**
 * The real generator wraps study blocks in plain WidgetEditor primitives - a
 * Label for the widget title - so a page is not made only of study blocks.
 * Anything outside these two lists would be a component the demo cannot render.
 */
const WIDGET_PRIMITIVE_TYPES = ['Label']
const BONUS_MARKER_BLOCKS = {
  QuizCarouselBlock: 'quiz',
  FlashcardCarouselBlock: 'flashcards',
  PodcastBlock: 'podcast',
}
const LESSON_PAGE_COUNT = 3
const KEYS_TO_DROP = ['visitedPageKeys', 'pinnedAt', 'pinnedDashboardKeys']
const TIMESTAMP_KEYS = ['createdAt', 'updatedAt']
/**
 * Keys whose value is built from the Study Guide title: the guide record
 * itself, the copies every generated widget carries, and the Quick Create
 * page/tab/widget names the generator composes as "<label>: <guide title>".
 *
 * Prose keys are deliberately absent. A lesson, a quiz question or a podcast
 * turn may legitimately write "spaced-repetition" as a hyphenated adjective,
 * and humanising the guide title would not change a word of it.
 */
const TITLE_BEARING_KEYS = [
  'title',
  'name',
  'folderName',
  'sourceTitle',
  'studyPathTitle',
  'studyPathFolderName',
]
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const args = process.argv.slice(2)
const skipAudio = args.includes('--skip-audio')
const fromRaw = args.includes('--from-raw')
const requestedSlugs = args.filter((arg) => !arg.startsWith('--'))

const log = (message) => {
  console.log(`[demo-capture] ${message}`)
}

const fail = (message) => {
  throw new Error(message)
}

const toCamelSlug = (slug) =>
  slug.replace(/-([a-z0-9])/g, (_match, character) => character.toUpperCase())

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const stableClone = (value) => {
  if (Array.isArray(value)) {
    return value.map(stableClone)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        const next = stableClone(value[key])
        if (next !== undefined) {
          accumulator[key] = next
        }

        return accumulator
      }, {})
  }

  return value
}

const writeJsonFile = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(stableClone(value), null, 2)}\n`, {
    encoding: 'utf8',
  })
}

const writeTextFile = (path, text) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text.replace(/\r\n/g, '\n'), { encoding: 'utf8' })
}

const readJsonFile = (path) => {
  if (!existsSync(path)) {
    return fail(`Missing ${path}`)
  }

  return JSON.parse(readFileSync(path, { encoding: 'utf8' }))
}

// The gateway module and the normalisation both need api/hosted-ai.ts, and
// --from-raw needs it without building a gateway at all.
let hostedModulePromise = null
const loadHostedModule = () => {
  if (!hostedModulePromise) {
    hostedModulePromise = import('../../../api/hosted-ai.ts')
  }

  return hostedModulePromise
}

// --- browser surface the app modules expect -------------------------------

const createMemoryStorage = () => {
  const entries = new Map()

  return {
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => {
      entries.set(key, String(value))
    },
    removeItem: (key) => {
      entries.delete(key)
    },
    clear: () => {
      entries.clear()
    },
    key: (index) => Array.from(entries.keys())[index] ?? null,
    get length() {
      return entries.size
    },
  }
}

const installBrowserShims = () => {
  const localStorage = createMemoryStorage()
  const sessionStorage = createMemoryStorage()
  const target = new EventTarget()
  const win = {
    localStorage,
    sessionStorage,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  }

  globalThis.window = win
  globalThis.localStorage = localStorage
  globalThis.sessionStorage = sessionStorage

  // The capture is a signed-out headless run, so Supabase is never reached.
  // These only exist so isSupabaseConfigured is true and the hosted client
  // takes the same branch it takes in the browser.
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://demo-capture.invalid'
  process.env.SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY || 'demo-capture-anon-key'

  return { localStorage }
}

// --- the in-process gateway ------------------------------------------------

/**
 * A UUID stands in for the signed-in user the real gateway would bill, so the
 * raw capture carries a userId inside audioPath exactly like production does
 * and the leak scan has something real to catch.
 */
const captureUserId = randomUUID()
const capturedAudio = new Map()

const createGatewayStatus = (hostedCosts) => ({
  available: true,
  accountReady: true,
  introSeen: true,
  studyCredits: 999_999,
  initialFreeCredits: 30,
  dailyFreeCreditFloor: 7,
  costs: hostedCosts,
})

const createDemoGateway = async () => {
  const hosted = await loadHostedModule()
  const { HOSTED_AI_CREDIT_COSTS } = await import(
    '../src/quickCreate/ai/hostedCredits.ts'
  )
  const status = createGatewayStatus(HOSTED_AI_CREDIT_COSTS)
  const provider = hosted.getHostedTextProvider()

  const callStage = async (stage, stageRequest) => {
    const model = hosted.getHostedTextModelForStage(provider, stage)
    const result = await hosted.callHostedTextModel(
      stageRequest,
      provider,
      model,
      stage,
    )
    log(`  model call ${stage} (${model})`)

    return result.text
  }

  const generateWithQuickStart = async (request) => {
    const enhanced = await hosted.generateMonolithHostedStudyGuide({
      usageRequest: { ...request, requestId: `demo-capture-${randomUUID()}` },
      callStage,
      metadataFlags: {},
    })

    return { ok: true, ...enhanced, status }
  }

  const generate = async (request) => {
    const stage = request.stage || hosted.getStageForSurface(request.surface)

    return { ok: true, text: await callStage(stage, request), status }
  }

  const generatePodcast = async (request) => {
    const stage = 'podcast_script'
    const sourceText = hosted
      .buildPrompt(request.parts || [])
      .slice(0, hosted.MAX_PODCAST_SOURCE_CHARS)
    const sourceTitle = hosted.safePodcastText(
      request.podcastOptions?.sourceTitle,
      100,
    )
    const scriptText = await callStage(stage, {
      ...request,
      responseSchema: hosted.PODCAST_SCRIPT_SCHEMA,
      parts: [
        {
          text: hosted.buildPodcastScriptPrompt({
            sourceTitle,
            sourceText,
            outputLanguage: request.outputLanguage,
          }),
        },
      ],
    })
    let script = hosted.normalizePodcastScript(scriptText, sourceTitle)

    if (
      request.outputLanguage &&
      !hosted.podcastScriptMatchesOutputLanguage(script, request.outputLanguage)
    ) {
      log('  podcast script drifted off language, retrying')
      const retryText = await callStage(stage, {
        ...request,
        responseSchema: hosted.PODCAST_SCRIPT_SCHEMA,
        parts: [
          {
            text: hosted.buildPodcastLanguageRetryPrompt({
              script,
              outputLanguage: request.outputLanguage,
              sourceTitle,
              sourceText,
            }),
          },
        ],
      })
      script = hosted.normalizePodcastScript(retryText, sourceTitle)
    }

    const podcastId = `podcast-${randomUUID()}`
    const studyGuideId = String(request.podcastOptions?.studyGuideId || '')
    const audioPath = `${captureUserId}/${studyGuideId}/${podcastId}.mp3`

    if (skipAudio) {
      log('  skipping text-to-speech (--skip-audio)')
    } else {
      log(`  synthesising ${script.transcriptTurns.length} podcast turns`)
      const audio = await hosted.generatePodcastAudioFromScript(
        script,
        request.outputLanguage,
      )
      capturedAudio.set(podcastId, audio.audioBuffer)
    }

    return {
      ok: true,
      status,
      podcast: {
        id: podcastId,
        title: script.title,
        description: script.description,
        audioPath,
        mimeType: 'audio/mpeg',
        transcriptTurns: script.transcriptTurns,
        chapters: script.chapters,
        sourceTitle,
        sourceScope: request.podcastOptions?.sourceScope || 'studyGuide',
        createdAt: new Date().toISOString(),
      },
    }
  }

  return async (request) => {
    if (request.action === 'status') {
      return { ok: true, status }
    }

    if (request.action === 'generateWithQuickStart') {
      return generateWithQuickStart(request)
    }

    if (request.action === 'generate') {
      return generate(request)
    }

    if (request.action === 'generatePodcast') {
      return generatePodcast(request)
    }

    return fail(`Unsupported gateway action: ${request.action}`)
  }
}

/**
 * The hosted client asks Supabase for the access token it would send to the
 * gateway. Nothing here reaches Supabase, and the token never leaves this
 * process, but the client has to take its normal signed-in branch.
 */
const stubSupabaseSession = async () => {
  const { supabase } = await import('../src/auth/supabaseClient.ts')

  supabase.auth.getSession = async () => ({
    data: { session: { access_token: 'demo-capture-session' } },
    error: null,
  })
}

const installGatewayFetch = (gateway) => {
  const realFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : String(input?.url || input)

    if (!url.startsWith('/api/')) {
      return realFetch(input, init)
    }

    if (!url.startsWith('/api/hosted-ai')) {
      return fail(`The capture must not reach ${url}`)
    }

    const payload = await gateway(JSON.parse(String(init?.body || '{}')))

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

// --- capture ---------------------------------------------------------------

const captureRawGuide = async (definition, app) => {
  const pathId = `demo-${definition.slug}`
  log(`generating the Study Guide for ${definition.slug}`)
  const lessonPath = await app.generateStudyPathStateFromPrompt({
    id: pathId,
    prompt: definition.prompt,
    provider: 'hosted',
  })

  if (lessonPath.dashboards.length !== LESSON_PAGE_COUNT) {
    fail(
      `Expected ${LESSON_PAGE_COUNT} lesson pages, got ${lessonPath.dashboards.length}`,
    )
  }

  // Exactly what GuideWorkspacePage.quickCreatePage computes for a Study Guide
  // scoped Quick Create. Quick Create pages are excluded from the source text,
  // so it is the same for all three actions.
  const record = app.createStudyGuideRecord(lessonPath)
  const sourceText = app.getStudyGuideCreationSourceText(lessonPath)
  const sourceTitle = lessonPath.title || record.title

  let studyPath = lessonPath

  log('  creating the quiz page')
  studyPath = app.appendGeneratedStudyGuidePage(
    studyPath,
    await app.createAiQuickCreatePageDraft({
      studyPath,
      resourceType: 'quiz',
      sourceTitle,
      sourceText,
    }),
  )

  log('  creating the flashcards page')
  studyPath = app.appendGeneratedStudyGuidePage(
    studyPath,
    await app.createAiQuickCreatePageDraft({
      studyPath,
      resourceType: 'flashcards',
      sourceTitle,
      sourceText,
    }),
  )

  log('  creating the podcast page')
  studyPath = app.appendGeneratedStudyGuidePage(
    studyPath,
    await app.createAiPodcastPageDraft({
      studyPath,
      sourceTitle,
      sourceText,
      sourceScope: 'studyGuide',
    }),
  )

  return studyPath
}

// --- normalisation ---------------------------------------------------------

const collectComponents = (layout, found = []) => {
  if (!layout || typeof layout !== 'object') {
    return found
  }

  const components = layout.config?.customProps?.components

  if (Array.isArray(components)) {
    components.forEach((component) => {
      if (component && typeof component.type === 'string') {
        found.push(component)
      }
    })
  }

  ;(layout.children || []).forEach((child) => collectComponents(child, found))

  return found
}

const findPodcast = (studyPath) => {
  const podcasts = studyPath.dashboards
    .flatMap((dashboard) => collectComponents(dashboard.layout))
    .filter((component) => component.type === 'PodcastBlock')
    .map((component) => component.props?.podcast)
    .filter(Boolean)

  if (podcasts.length !== 1) {
    fail(`Expected exactly 1 PodcastBlock, found ${podcasts.length}`)
  }

  return podcasts[0]
}

const resolveBonusActionId = (page) => {
  const matches = Array.from(
    new Set(
      collectComponents(page.layout)
        .map((component) => BONUS_MARKER_BLOCKS[component.type])
        .filter(Boolean),
    ),
  )

  if (matches.length !== 1) {
    fail(
      `Page "${page.name}" has ${matches.length} Quick Create marker blocks (${
        matches.join(', ') || 'none'
      }); expected exactly 1`,
    )
  }

  return matches[0]
}

const rewriteStrings = (value, replacements) => {
  const serialized = replacements.reduce(
    (text, [from, to]) => text.replace(new RegExp(escapeRegExp(from), 'g'), to),
    JSON.stringify(value),
  )

  return JSON.parse(serialized)
}

const freezeVolatileFields = (value) => {
  if (Array.isArray(value)) {
    return value.map(freezeVolatileFields)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.entries(value).reduce((accumulator, [key, entry]) => {
    if (KEYS_TO_DROP.includes(key)) {
      return accumulator
    }

    accumulator[key] = TIMESTAMP_KEYS.includes(key)
      ? FIXED_TIMESTAMP
      : freezeVolatileFields(entry)

    return accumulator
  }, {})
}

/**
 * Replaces the guide title inside the fields that are composed from it, and
 * only there. The occurrence has to stand on its own - no word character and
 * no hyphen on either side - so "learning-bottleneck" never fires inside
 * "learning-bottlenecks" and a compound word is never split.
 */
const applyHumanGuideTitle = (value, rawTitle, humanTitle, changes) => {
  const pattern = new RegExp(
    `(?<![\\w-])${escapeRegExp(rawTitle)}(?![\\w-])`,
    'g',
  )
  const walk = (node, key) => {
    if (typeof node === 'string') {
      if (!TITLE_BEARING_KEYS.includes(key)) {
        return node
      }

      const next = node.replace(pattern, humanTitle)
      if (next !== node) {
        changes.push(`${key}: ${JSON.stringify(node)} -> ${JSON.stringify(next)}`)
      }

      return next
    }

    if (Array.isArray(node)) {
      return node.map((entry) => walk(entry, key))
    }

    if (node && typeof node === 'object') {
      return Object.entries(node).reduce((accumulator, [childKey, child]) => {
        accumulator[childKey] = walk(child, childKey)

        return accumulator
      }, {})
    }

    return node
  }

  return walk(value, '')
}

/**
 * The hosted generator used to hand back a kebab-case slug where the human
 * guide title belongs, so a capture taken before that fix carries
 * "spaced-repetition" in the library name, the workspace heading and every
 * derived page name. Running the shipped humanizeGuideTitle over the
 * title-bearing fields is exactly what the app produces now, with no model
 * call and no edit to a single word of generated prose. Once the capture
 * itself comes back humanised this is a no-op.
 */
const humanizeCapturedTitles = (rawStudyPath, humanizeGuideTitle) => {
  const rewrites = Array.from(
    new Set([rawStudyPath.title, rawStudyPath.folderName]),
  )
    .filter((value) => typeof value === 'string' && value)
    .map((value) => [value, humanizeGuideTitle(value)])
    .filter(([raw, human]) => human !== raw)
    // Longest first, so a title that contains the folder name cannot be
    // half-rewritten by the shorter pass.
    .sort(([left], [right]) => right.length - left.length)

  if (!rewrites.length) {
    return rawStudyPath
  }

  const changes = []
  const humanized = rewrites.reduce(
    (value, [raw, human]) => applyHumanGuideTitle(value, raw, human, changes),
    rawStudyPath,
  )
  log(`  humanised the guide title in ${changes.length} field(s)`)
  changes.forEach((change) => log(`    ${change}`))

  return humanized
}

const normalizeCapture = async (slug, rawStudyPath) => {
  const { humanizeGuideTitle } = await loadHostedModule()
  const pathId = `demo-${slug}`
  const titledStudyPath = humanizeCapturedTitles(rawStudyPath, humanizeGuideTitle)
  const podcast = findPodcast(titledStudyPath)
  const lessonPages = titledStudyPath.dashboards.slice(0, LESSON_PAGE_COUNT)
  const bonusPagesRaw = titledStudyPath.dashboards.slice(LESSON_PAGE_COUNT)

  if (bonusPagesRaw.length !== 3) {
    fail(`Expected 3 Quick Create pages, got ${bonusPagesRaw.length}`)
  }

  // The signed-in user the capture ran as, read back off the podcast path so
  // --from-raw scrubs the user of the original run and not of this process.
  const rawCaptureUserId = String(podcast.audioPath || '').split('/')[0]

  // One rewrite over the whole record, so studyPathId, studyPathDashboardKey,
  // every derived component id and every studymesh-page: link in the markdown
  // move together and no Date.now()/nanoid suffix survives anywhere.
  const replacements = [
    [podcast.audioPath, `/demo/audio/${slug}.mp3`],
    [podcast.id, `${pathId}-podcast`],
    ...(UUID_PATTERN.test(rawCaptureUserId)
      ? [[rawCaptureUserId, 'demo-capture-user']]
      : []),
    ...bonusPagesRaw.map((page, index) => [
      page.dashboardKey,
      `${pathId}-page-${LESSON_PAGE_COUNT + index + 1}`,
    ]),
    ...lessonPages.map((page, index) => [
      page.dashboardKey,
      `${pathId}-page-${index + 1}`,
    ]),
  ]
  const rewritten = freezeVolatileFields(
    rewriteStrings(titledStudyPath, replacements),
  )
  const dashboards = rewritten.dashboards.map((page, index) => ({
    ...page,
    dashboardIndex: index + 1,
    dashboardCount: index < LESSON_PAGE_COUNT ? LESSON_PAGE_COUNT : index + 1,
    contentLanguage: 'en',
  }))

  const studyPath = {
    ...rewritten,
    pathId,
    selectedIndex: 0,
    contentLanguage: 'en',
    dashboards: dashboards.slice(0, LESSON_PAGE_COUNT),
  }
  const bonusPages = dashboards.slice(LESSON_PAGE_COUNT).map((page) => {
    const actionId = resolveBonusActionId(page)

    return {
      actionId,
      durationMs: BONUS_DURATIONS_MS[actionId],
      page,
    }
  })

  return { studyPath, bonusPages, replacements }
}

// --- assertions ------------------------------------------------------------

const LEAK_PATTERNS = [
  ['a UUID', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i],
  ['an email address', /[\w.+-]+@[\w-]+\.[\w.-]+/],
  ['a Supabase host', /supabase\.co/i],
  ['a bearer token', /Bearer /],
  ['a JWT', /eyJ/],
  ['a Supabase storage prefix', /sb-/],
  ['an access token field', /access_token/],
]

const assertNoLeaks = (slug, content, replacements) => {
  const serialized = JSON.stringify(content)

  LEAK_PATTERNS.forEach(([label, pattern]) => {
    const match = serialized.match(pattern)
    if (match) {
      fail(`${slug} still contains ${label}: ${match[0].slice(0, 80)}`)
    }
  })

  replacements.forEach(([from]) => {
    if (serialized.includes(from)) {
      fail(`${slug} still contains the pre-normalisation value "${from}"`)
    }
  })
}

const assertShape = (slug, content) => {
  const { studyPath, bonusPages } = content

  if (studyPath.pathId !== `demo-${slug}`) {
    fail(`${slug} has pathId ${studyPath.pathId}`)
  }

  if (studyPath.dashboards.length !== LESSON_PAGE_COUNT) {
    fail(`${slug} has ${studyPath.dashboards.length} lesson pages`)
  }

  if (bonusPages.length !== 3) {
    fail(`${slug} has ${bonusPages.length} bonus pages`)
  }

  const actionIds = bonusPages.map((bonus) => bonus.actionId)
  if (new Set(actionIds).size !== actionIds.length) {
    fail(`${slug} has duplicate bonus actionIds: ${actionIds.join(', ')}`)
  }

  if (!studyPath.quickStart?.keyIdea || !studyPath.quickStart?.quickSummary) {
    fail(`${slug} has an empty Quick Start`)
  }

  const allPages = [
    ...studyPath.dashboards,
    ...bonusPages.map((bonus) => bonus.page),
  ]

  allPages.forEach((page, index) => {
    if (page.dashboardKey !== `demo-${slug}-page-${index + 1}`) {
      fail(`${slug} page ${index + 1} has dashboardKey ${page.dashboardKey}`)
    }

    const components = collectComponents(page.layout)

    components.forEach((component) => {
      if (
        !STUDY_BLOCK_TYPES.includes(component.type) &&
        !WIDGET_PRIMITIVE_TYPES.includes(component.type)
      ) {
        fail(
          `${slug} page ${index + 1} has block type "${component.type}", which the demo cannot render`,
        )
      }
    })

    if (
      !components.some((component) =>
        STUDY_BLOCK_TYPES.includes(component.type),
      )
    ) {
      fail(`${slug} page ${index + 1} has no study block at all`)
    }
  })

  studyPath.dashboards.forEach((page, index) => {
    const components = collectComponents(page.layout)
    const carriesMeta = components.some(
      (component) =>
        component.props?.studyPathId && component.props?.studyPathDashboardKey,
    )

    if (!carriesMeta) {
      fail(
        `${slug} lesson page ${index + 1} is missing studyPathId/studyPathDashboardKey`,
      )
    }
  })

  const podcastPage = bonusPages.find((bonus) => bonus.actionId === 'podcast')
  const podcast = findPodcast({ dashboards: [podcastPage.page] })

  if (podcast.audioPath !== `/demo/audio/${slug}.mp3`) {
    fail(`${slug} podcast audioPath is ${podcast.audioPath}`)
  }

  return podcast
}

// --- audio -----------------------------------------------------------------

const hasFfmpeg = () => {
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  return !probe.error && probe.status === 0
}

const writePodcastAudio = (slug, rawPodcastId) => {
  const buffer = capturedAudio.get(rawPodcastId)

  if (!buffer) {
    return { written: false, reason: 'no audio captured' }
  }

  mkdirSync(audioDir, { recursive: true })
  const target = resolve(audioDir, `${slug}.mp3`)
  const rawTarget = resolve(captureDir, `${slug}.raw.mp3`)
  mkdirSync(captureDir, { recursive: true })
  writeFileSync(rawTarget, buffer)

  if (!hasFfmpeg()) {
    writeFileSync(target, buffer)
    return {
      written: true,
      transcoded: false,
      bytes: buffer.length,
      reason: 'ffmpeg is not installed; shipped the 64 kbps provider MP3 as-is',
    }
  }

  const result = spawnSync(
    'ffmpeg',
    ['-y', '-i', rawTarget, '-ac', '1', '-b:a', '48k', '-ar', '24000', target],
    { stdio: 'ignore' },
  )

  if (result.status !== 0 || !existsSync(target)) {
    writeFileSync(target, buffer)
    return {
      written: true,
      transcoded: false,
      bytes: buffer.length,
      reason: 'ffmpeg failed; shipped the 64 kbps provider MP3 as-is',
    }
  }

  return { written: true, transcoded: true }
}

// --- review dump -----------------------------------------------------------

const reviewLinesForPage = (page) =>
  collectComponents(page.layout).flatMap((component) => {
    const props = component.props || {}

    if (typeof props.markdown === 'string') {
      return [props.markdown, '']
    }

    if (Array.isArray(props.items)) {
      return props.items.flatMap((item, index) =>
        item.kind === 'quiz'
          ? [
              `${index + 1}. ${item.question}`,
              ...(item.options || []).map(
                (option, optionIndex) =>
                  `   ${optionIndex === item.correctIndex ? '[x]' : '[ ]'} ${option}`,
              ),
              `   explanation: ${item.explanation || ''}`,
              '',
            ]
          : [`${index + 1}. ${item.question} -> ${item.answer}`, ''],
      )
    }

    if (props.podcast) {
      return [
        `Title: ${props.podcast.title}`,
        `Description: ${props.podcast.description}`,
        '',
        ...(props.podcast.transcriptTurns || []).map(
          (turn) => `**${turn.speaker}:** ${turn.text}`,
        ),
        '',
      ]
    }

    return []
  })

const markdownForReview = (definition, content) => {
  const { studyPath, bonusPages } = content

  return `${[
    `# ${definition.title}`,
    '',
    `Slug: ${definition.slug}`,
    `Prompt: ${definition.prompt}`,
    `Guide title in the workspace: ${studyPath.title}`,
    `Emoji: ${studyPath.emoji}`,
    '',
    '## Quick Start',
    '',
    `**${studyPath.quickStart.keyIdea}**`,
    '',
    studyPath.quickStart.quickSummary,
    '',
    ...studyPath.dashboards.flatMap((page) => [
      `## Lesson page: ${page.name}`,
      '',
      ...reviewLinesForPage(page),
    ]),
    ...bonusPages.flatMap((bonus) => [
      `## Bonus page (${bonus.actionId}): ${bonus.page.name}`,
      '',
      ...reviewLinesForPage(bonus.page),
    ]),
  ].join('\n')}\n`
}

// --- main ------------------------------------------------------------------

/** Normalisation, assertions and the two written artefacts, shared by both modes. */
const writeNormalizedGuide = async (definition, rawStudyPath) => {
  const { studyPath, bonusPages, replacements } = await normalizeCapture(
    definition.slug,
    rawStudyPath,
  )
  const content = { studyPath, bonusPages }
  assertNoLeaks(definition.slug, content, replacements)
  assertShape(definition.slug, content)

  const dataPath = resolve(
    guidesDir,
    `${toCamelSlug(definition.slug)}.data.json`,
  )
  writeJsonFile(dataPath, content)
  writeTextFile(
    resolve(captureDir, `${definition.slug}.review.md`),
    markdownForReview(definition, content),
  )
  log(`wrote ${dataPath}`)

  return content
}

const captureSlug = async (definition, app) => {
  const rawStudyPath = await captureRawGuide(definition, app)
  const rawPodcastId = findPodcast(rawStudyPath).id
  writeJsonFile(resolve(captureDir, `${definition.slug}.raw.json`), rawStudyPath)

  await writeNormalizedGuide(definition, rawStudyPath)

  const audio = writePodcastAudio(definition.slug, rawPodcastId)
  log(
    audio.written
      ? `wrote the podcast MP3${audio.reason ? ` (${audio.reason})` : ''}`
      : `no podcast MP3 (${audio.reason})`,
  )
}

/**
 * Replays the normalisation over an existing capture. No model call, no audio,
 * and the raw capture on disk is left exactly as it was recorded.
 */
const renormalizeSlug = async (definition) => {
  const rawPath = resolve(captureDir, `${definition.slug}.raw.json`)
  log(`re-normalising ${definition.slug} from ${rawPath}`)

  const content = await writeNormalizedGuide(definition, readJsonFile(rawPath))
  log(`  title: ${JSON.stringify(content.studyPath.title)}`)
}

const main = async () => {
  const { localStorage } = installBrowserShims()
  const { loadLocalApiEnv } = await import('../../../api/local-env.ts')
  loadLocalApiEnv()

  const { DEMO_GUIDES } = await import('../src/demo/demoGuides.ts')
  const resolveDefinitions = () =>
    requestedSlugs.length
      ? requestedSlugs.map((slug) => {
          const definition = DEMO_GUIDES.find((guide) => guide.slug === slug)
          return definition || fail(`Unknown demo slug: ${slug}`)
        })
      : DEMO_GUIDES

  if (fromRaw) {
    const definitions = resolveDefinitions()

    for (const definition of definitions) {
      await renormalizeSlug(definition)
    }

    log(`re-normalised ${definitions.length} guide(s) with no model call`)

    return
  }

  const { QUICK_CREATE_AI_SETTINGS_KEY } = await import(
    '../src/quickCreate/ai/settings.ts'
  )
  // The demo has to show the hosted experience, not whichever provider a local
  // .env happens to configure.
  localStorage.setItem(
    QUICK_CREATE_AI_SETTINGS_KEY,
    JSON.stringify({ provider: 'hosted', apiToken: '', model: '' }),
  )

  await stubSupabaseSession()
  installGatewayFetch(await createDemoGateway())

  const generation = await import('../src/studyGuides/generation.ts')
  const pages = await import('../src/studyGuides/pages.ts')
  const storage = await import('../src/studyGuides/storage.ts')
  const app = {
    generateStudyPathStateFromPrompt: generation.generateStudyPathStateFromPrompt,
    createAiQuickCreatePageDraft: generation.createAiQuickCreatePageDraft,
    createAiPodcastPageDraft: generation.createAiPodcastPageDraft,
    appendGeneratedStudyGuidePage: generation.appendGeneratedStudyGuidePage,
    getStudyGuideCreationSourceText: pages.getStudyGuideCreationSourceText,
    createStudyGuideRecord: storage.createStudyGuideRecord,
  }

  const definitions = resolveDefinitions()

  for (const definition of definitions) {
    await captureSlug(definition, app)
  }

  log(`captured ${definitions.length} guide(s)`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
