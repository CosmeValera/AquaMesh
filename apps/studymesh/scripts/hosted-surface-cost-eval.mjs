import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const outputDir = path.join(repoRoot, 'apps/studymesh/evals')
const resultPath = path.join(outputDir, 'hosted-surface-cost-results.json')
const summaryPath = path.join(outputDir, 'hosted-surface-cost-summary.md')

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_MINI_MODEL = 'gpt-5.4-mini'
const DEFAULT_NANO_MODEL = 'gpt-5.4-nano'
const PRICING_SOURCE =
  'default_openai_rates_mini_0.75in_0.075cached_4.50out_nano_0.20in_0.02cached_1.25out'

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return
  }

  const content = readFileSync(filePath, 'utf8')
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      return
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) {
      return
    }

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) {
      return
    }

    let value = rawValue.trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value.replace(/\\n/g, '\n')
  })
}

const loadLocalEnv = () => {
  ;['.env.local', '.env', 'apps/studymesh/.env.local', 'apps/studymesh/.env'].forEach(
    (relativePath) => loadEnvFile(path.join(repoRoot, relativePath)),
  )
}

loadLocalEnv()

const getEnv = (name) => process.env[name]?.trim() || ''
const apiKey = getEnv('HOSTED_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY')
if (!apiKey) {
  throw new Error(
    'Missing HOSTED_OPENAI_API_KEY or OPENAI_API_KEY. Add one locally before running this eval.',
  )
}

const miniModel =
  getEnv('HOSTED_OPENAI_STUDY_GUIDE_MODEL') ||
  getEnv('HOSTED_OPENAI_PLANNER_MODEL') ||
  getEnv('HOSTED_OPENAI_MODEL') ||
  DEFAULT_MINI_MODEL
const nanoModel =
  getEnv('HOSTED_OPENAI_FAST_MODEL') ||
  getEnv('HOSTED_OPENAI_IMPLEMENTER_MODEL') ||
  DEFAULT_NANO_MODEL

const getDefaultOpenAiInputPrice = (model) => (model.includes('nano') ? 0.2 : 0.75)
const getDefaultOpenAiCachedInputPrice = (model) =>
  model.includes('nano') ? 0.02 : 0.075
const getDefaultOpenAiOutputPrice = (model) => (model.includes('nano') ? 1.25 : 4.5)

const getTokenPricePerMillion = (model, kind) => {
  if (kind === 'INPUT') {
    return getDefaultOpenAiInputPrice(model)
  }
  if (kind === 'CACHED_INPUT') {
    return getDefaultOpenAiCachedInputPrice(model)
  }
  return getDefaultOpenAiOutputPrice(model)
}

const estimateCostUsd = (model, inputTokens, cachedInputTokens, outputTokens) => {
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens)
  const cost =
    (uncachedInputTokens * getTokenPricePerMillion(model, 'INPUT')) / 1_000_000 +
    (cachedInputTokens * getTokenPricePerMillion(model, 'CACHED_INPUT')) /
      1_000_000 +
    (outputTokens * getTokenPricePerMillion(model, 'OUTPUT')) / 1_000_000
  return Number(cost.toFixed(8))
}

const extractText = (payload) => {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content.map((part) => part.text || '').join('')
  }
  return payload?.choices?.[0]?.text || ''
}

const parseJson = (text) => {
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
  surface,
  strategy,
  stage,
  model,
  prompt,
  schema,
  maxTokens = 4096,
}) => {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_completion_tokens: maxTokens,
  }

  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: `${surface}_${stage}`.replace(/[^A-Za-z0-9_]+/g, '_').slice(0, 64),
        strict: true,
        schema,
      },
    }
  }

  const startedAt = Date.now()
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI request failed: ${response.status}`)
  }

  const text = extractText(payload)
  const usage = payload.usage || {}
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0
  const cachedInputTokens =
    usage.prompt_tokens_details?.cached_tokens ??
    usage.input_tokens_details?.cached_tokens ??
    0
  const totalTokens = usage.total_tokens || inputTokens + outputTokens
  const estimatedCostUsd = estimateCostUsd(
    model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
  )

  return {
    surface,
    strategy,
    stage,
    model,
    promptCharacters: prompt.length,
    responseCharacters: text.length,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
    estimatedCostCents: Number((estimatedCostUsd * 100).toFixed(4)),
    latencyMs: Date.now() - startedAt,
    text,
    parsed: schema ? parseJson(text) : undefined,
  }
}

const stringArraySchema = {
  type: 'array',
  items: { type: 'string' },
}

const quizSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          options: stringArraySchema,
          correctIndex: { type: 'integer' },
          explanation: { type: 'string' },
          skillTested: { type: 'string' },
        },
        required: ['question', 'options', 'correctIndex', 'explanation', 'skillTested'],
      },
    },
  },
  required: ['questions'],
}

const flashcardSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          front: { type: 'string' },
          back: { type: 'string' },
          concept: { type: 'string' },
        },
        required: ['front', 'back', 'concept'],
      },
    },
  },
  required: ['cards'],
}

const blueprintSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          concept: { type: 'string' },
          objective: { type: 'string' },
          facts: stringArraySchema,
          traps: stringArraySchema,
          questionAngles: stringArraySchema,
        },
        required: ['concept', 'objective', 'facts', 'traps', 'questionAngles'],
      },
    },
  },
  required: ['title', 'concepts'],
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

const angularNotes = `Angular is a TypeScript-based front-end framework for building structured web applications. Components combine a class, an HTML template, and styles. Templates connect to component state with interpolation, property binding, event binding, and two-way binding. Services hold reusable logic and data access, and dependency injection provides those services to components. Angular Router maps URLs to components. Reactive forms define form controls in TypeScript, while template-driven forms are simpler for small forms. HttpClient returns Observables, and the async pipe can display emitted values while reducing manual subscription cleanup. Guards control route access, resolvers can fetch data before route activation, and lazy loading delays feature code until it is needed.`

const ansibleNotes = `Ansible is agentless automation that usually connects to Linux hosts over SSH and Windows hosts over WinRM. Inventory defines target hosts and groups. Playbooks map hosts to ordered tasks. Tasks should call modules such as package, service, template, and copy instead of raw shell commands when possible. Idempotence means rerunning the same task should not create extra changes when the desired state already exists. Variables, facts, conditionals, loops, templates, handlers, roles, tags, check mode, diff mode, serial rollout, delegate_to, and run_once help make automation reusable and safer.`

const helmNotes = `Helm is a Kubernetes package manager. A chart is a reusable package of Kubernetes manifests plus templates and default values. values.yaml provides default configuration, and users override values during install or upgrade. Templates use Go template syntax to render Kubernetes YAML from chart files and values. A release is an installed instance of a chart in a namespace. helm install creates a release, helm upgrade changes it, helm rollback returns to a prior revision, and helm template renders manifests locally for inspection. Good charts keep templates readable, expose clear values, and avoid hiding too much behavior in complex template logic.`

const terraformNotes = `Terraform is infrastructure as code for provisioning cloud and platform resources. Configuration declares providers, resources, variables, outputs, and modules. Terraform builds a dependency graph, compares configuration with state, shows a plan, and applies changes to converge infrastructure toward the declared configuration. State maps real infrastructure to configuration and must be protected. Modules package reusable infrastructure patterns. Providers expose resource types and APIs. Terraform is declarative but not a general configuration management tool: it is strongest for creating and changing infrastructure resources, while tools like Ansible often configure software inside machines.`

const romanNotes = `The Roman Empire grew from the Roman Republic after decades of civil conflict. Augustus became the first emperor in 27 BCE while preserving republican forms in appearance. The empire combined military power, roads, law, taxation, urbanization, and local elites to govern large territories. Roman citizenship expanded over time, culminating in the Constitutio Antoniniana in 212 CE. The empire faced succession problems, civil wars, frontier pressure, economic stress, and administrative division. The western empire fragmented in the fifth century CE, while the eastern empire continued for centuries as the Byzantine Empire.`

const photoNotes = `Exposure in photography depends on aperture, shutter speed, and ISO. Aperture changes depth of field and the amount of light entering the lens. Shutter speed controls motion blur or freezing action. ISO changes sensor amplification and can increase noise. Composition uses framing, leading lines, contrast, color, balance, and subject separation to guide attention. Focal length affects field of view and compression. Good beginner practice is to choose one subject, decide what should be sharp, set shutter speed for motion, then adjust aperture and ISO for the desired look and exposure.`

const sourceWithNumbers = (title, body, number = 1) =>
  `[${number}] ${title}\nType: dashboard\nText: ${body}`

const buildChatPrompt = ({ dashboardTitle, contextText, question, history = [] }) => {
  const memory = history.length
    ? `Recent chat:\n${history
        .map((message) =>
          `${message.role === 'user' ? 'Student' : 'Assistant'}: ${message.content}`,
        )
        .join('\n')}`
    : 'None'

  return `You are StudyMesh's dashboard assistant. Help the student understand the current dashboard.

Rules:
- Write the answer in English.
- Answer using only the provided dashboard, study, and web source context.
- Web sources in the context are allowed sources. Use them when dashboard-only material lacks the answer.
- If the student message is conversational smalltalk, a greeting, thanks, or a casual acknowledgement, answer briefly and naturally. Do not use "SOURCE_GAP:", do not cite sources, and do not search for dashboard/web evidence for smalltalk.
- If the answer is not supported by any provided context, start your answer with "SOURCE_GAP:" and explain that the provided sources do not contain enough information for the student's request.
- Do not invent facts, citations, links, or source names.
- When you use a specific source, cite it inline with its source number like [1] or [2].
- Only cite source numbers shown in the dashboard/source context.
- Never output JSON, code blocks, objects, arrays, "sources" fields, or structured metadata.
- Be concise, clear, student-friendly, and practical.

Dashboard title: ${dashboardTitle}

Dashboard/source context:
${contextText}

Conversation memory:
${memory}

Student question: ${question}

Answer:`
}

const buildQuizPrompt = ({ title, source, count, style = 'mixed' }) => `Create a quiz JSON object from the source.

Return strict JSON only:
{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "..."],
      "correctIndex": 0,
      "explanation": "...",
      "skillTested": "..."
    }
  ]
}

Rules:
- Create exactly ${count} multiple-choice questions.
- Use 3 or 4 options per question.
- Vary the correct answer position.
- Prefer scenario, application, contrast, error-fixing, why/how, and common-mistake questions over literal recall.
- Avoid "According to the text", "Which statement best explains", "What is the core idea", and questions about what the notes say.
- Distractors must be plausible but clearly wrong.
- Every explanation must teach why the answer is correct.
- Stay grounded in the source and do not add advanced outside facts.
- Style: ${style}.

Title: ${title}

Source:
${source}`

const buildFlashcardPrompt = ({ title, source, count }) => `Create a flashcard JSON object from the source.

Return strict JSON only:
{
  "cards": [
    {
      "front": "...",
      "back": "...",
      "concept": "..."
    }
  ]
}

Rules:
- Create exactly ${count} flashcards.
- Fronts must ask the learner to use, choose, compare, diagnose, predict, explain, or repair a concept.
- Avoid copied headings and weak definition-only cards unless a concept truly needs a definition.
- Backs must be self-contained, brief, and teach the reason.
- Stay grounded in the source and do not add advanced outside facts.

Title: ${title}

Source:
${source}`

const buildBlueprintPrompt = ({ title, source, count, artifact }) => `Create a compact ${artifact} blueprint from this source.

Return strict JSON only:
{
  "title": "...",
  "concepts": [
    {
      "concept": "...",
      "objective": "...",
      "facts": ["..."],
      "traps": ["..."],
      "questionAngles": ["..."]
    }
  ]
}

Rules:
- Plan for exactly ${count} high-quality ${artifact === 'quiz' ? 'quiz questions' : 'flashcards'}.
- Mini owns factual selection: include only facts supported by the source.
- Include traps/misconceptions and application angles, not only recall facts.
- Keep the blueprint compact.

Title: ${title}

Source:
${source}`

const buildQuizFromBlueprintPrompt = ({ blueprint, count }) => `Create the final quiz from this locked blueprint.

Return strict JSON only with this shape:
{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "..."],
      "correctIndex": 0,
      "explanation": "...",
      "skillTested": "..."
    }
  ]
}

Rules:
- Create exactly ${count} questions.
- Use only the facts and traps from the blueprint.
- Use application, contrast, diagnosis, and common-mistake questions.
- Do not ask literal text-copy questions.
- Do not add facts beyond the blueprint.

Blueprint:
${JSON.stringify(blueprint, null, 2)}`

const buildFlashcardsFromBlueprintPrompt = ({ blueprint, count }) => `Create the final flashcards from this locked blueprint.

Return strict JSON only with this shape:
{
  "cards": [
    {
      "front": "...",
      "back": "...",
      "concept": "..."
    }
  ]
}

Rules:
- Create exactly ${count} flashcards.
- Use only the facts and traps from the blueprint.
- Fronts must require retrieval or reasoning, not copied definitions.
- Backs must be brief but self-contained.
- Do not add facts beyond the blueprint.

Blueprint:
${JSON.stringify(blueprint, null, 2)}`

const buildPodcastPrompt = ({ sourceTitle, sourceText, target }) => `Create a short StudyMesh educational podcast script from ONLY the provided Study Guide source.

Write the podcast in English.

Return strict JSON with: title, description, transcriptTurns, chapters.

transcriptTurns must use speakers hostA and hostB only.

Target ${target}, warm but focused two-host dialogue. Alternate hostA and hostB when natural.

Do not invent facts. Do not mention web lookup. Do not cite sources unless the source text already contains them.

If the source is thin, still create the best concise recap from available content without adding outside facts.

Source title: ${sourceTitle}

Source:

${sourceText}`

const wordCount = (value) => (value.trim().match(/\S+/g) || []).length
const endsCleanly = (value) => /[.!?)]["']?$/.test(value.trim())
const uniq = (items) => Array.from(new Set(items))

const evaluateQuiz = (questions) => {
  const issues = []
  questions.forEach((question, index) => {
    const label = `Q${index + 1}`
    if (!endsCleanly(question.question)) {
      issues.push(`${label} stem may be truncated`)
    }
    if (!Array.isArray(question.options) || question.options.length < 3) {
      issues.push(`${label} has fewer than 3 options`)
    }
    if (uniq((question.options || []).map((option) => option.toLowerCase())).length !== question.options?.length) {
      issues.push(`${label} has duplicate options`)
    }
    if (
      /according to|which statement best|what is the core idea|what do the notes/i.test(
        question.question,
      )
    ) {
      issues.push(`${label} smells text-literal`)
    }
    if (!endsCleanly(question.explanation || '')) {
      issues.push(`${label} explanation may be truncated`)
    }
  })

  const applicationLike = questions.filter((question) =>
    /scenario|if |when |why|how|mistake|compare|difference|choose|predict|fix|diagnose/i.test(
      `${question.question} ${question.explanation}`,
    ),
  ).length

  return {
    count: questions.length,
    applicationLike,
    issueCount: issues.length,
    issues: issues.slice(0, 12),
    quality: scoreFromIssues(questions.length, issues.length, applicationLike),
  }
}

const evaluateFlashcards = (cards) => {
  const issues = []
  cards.forEach((card, index) => {
    const label = `Card ${index + 1}`
    if (!endsCleanly(card.front || '')) {
      issues.push(`${label} front may be truncated`)
    }
    if (!endsCleanly(card.back || '')) {
      issues.push(`${label} back may be truncated`)
    }
    if (/^what is |^define |^what does .+ mean/i.test(card.front || '')) {
      issues.push(`${label} is definition-heavy`)
    }
    if (wordCount(card.back || '') < 8) {
      issues.push(`${label} back is too thin`)
    }
  })
  const reasoningLike = cards.filter((card) =>
    /when|why|how|compare|choose|mistake|predict|diagnose|repair|should/i.test(
      `${card.front} ${card.back}`,
    ),
  ).length

  return {
    count: cards.length,
    reasoningLike,
    issueCount: issues.length,
    issues: issues.slice(0, 12),
    quality: scoreFromIssues(cards.length, issues.length, reasoningLike),
  }
}

const evaluateChat = (text, expectsGap) => {
  const hasGap = /^SOURCE_GAP:/i.test(text.trim())
  const citations = text.match(/\[\d+]/g) || []
  const issues = []
  if (expectsGap && !hasGap) {
    issues.push('expected SOURCE_GAP but answer did not mark it')
  }
  if (!expectsGap && /SOURCE_GAP:/i.test(text)) {
    issues.push('unexpected source gap')
  }
  if (!expectsGap && citations.length === 0 && wordCount(text) > 20) {
    issues.push('grounded answer has no citation')
  }
  if (/```|\{\s*"sources"|based on sources/i.test(text)) {
    issues.push('leaked structured/source section formatting')
  }
  if (!endsCleanly(text)) {
    issues.push('answer may be truncated')
  }

  return {
    wordCount: wordCount(text),
    hasGap,
    citations,
    issueCount: issues.length,
    issues,
    quality: Math.max(1, 5 - issues.length),
  }
}

const evaluatePodcast = (script) => {
  const transcript = (script.transcriptTurns || []).map((turn) => turn.text).join('\n\n')
  const issues = []
  const speakers = (script.transcriptTurns || []).map((turn) => turn.speaker)
  if ((script.transcriptTurns || []).length < 4) {
    issues.push('fewer than 4 turns')
  }
  if (speakers.some((speaker) => speaker !== 'hostA' && speaker !== 'hostB')) {
    issues.push('invalid speaker id')
  }
  if (!endsCleanly(transcript)) {
    issues.push('transcript may be truncated')
  }
  if ((script.chapters || []).length < 1) {
    issues.push('no chapters')
  }
  if (/web lookup|internet|source says/i.test(transcript)) {
    issues.push('mentions lookup/source mechanics')
  }

  return {
    turns: (script.transcriptTurns || []).length,
    chapters: (script.chapters || []).length,
    transcriptWords: wordCount(transcript),
    ttsCharacters: transcript.length,
    issueCount: issues.length,
    issues,
    quality: Math.max(1, 5 - issues.length),
  }
}

const scoreFromIssues = (count, issueCount, reasoningCount) => {
  let score = 5
  if (count === 0) {
    return 1
  }
  if (issueCount >= Math.max(2, Math.ceil(count * 0.25))) {
    score -= 2
  } else if (issueCount > 0) {
    score -= 1
  }
  if (reasoningCount < Math.ceil(count * 0.45)) {
    score -= 1
  }
  return Math.max(1, score)
}

const summarizeCalls = (calls) => {
  const totalCostUsd = calls.reduce((total, call) => total + call.estimatedCostUsd, 0)
  return {
    calls: calls.length,
    totalCostUsd: Number(totalCostUsd.toFixed(8)),
    totalCostCents: Number((totalCostUsd * 100).toFixed(4)),
    avgCostCents: Number(((totalCostUsd * 100) / Math.max(1, calls.length)).toFixed(4)),
  }
}

const repriceCall = (call) => {
  const estimatedCostUsd = estimateCostUsd(
    call.model,
    call.inputTokens || 0,
    call.cachedInputTokens || 0,
    call.outputTokens || 0,
  )
  return {
    ...call,
    estimatedCostUsd,
    estimatedCostCents: Number((estimatedCostUsd * 100).toFixed(4)),
  }
}

const repriceResults = (results) => {
  const repriced = {
    ...results,
    pricingSource: PRICING_SOURCE,
    repricedAt: new Date().toISOString(),
    surfaces: {},
  }

  Object.entries(results.surfaces || {}).forEach(([surface, result]) => {
    const calls = (result.calls || []).map(repriceCall)
    repriced.surfaces[surface] = {
      ...result,
      calls,
      summary: summarizeCalls(calls),
    }
  })

  return repriced
}

const compactCall = (call) => ({
  surface: call.surface,
  strategy: call.strategy,
  stage: call.stage,
  model: call.model,
  promptCharacters: call.promptCharacters,
  responseCharacters: call.responseCharacters,
  inputTokens: call.inputTokens,
  cachedInputTokens: call.cachedInputTokens,
  outputTokens: call.outputTokens,
  totalTokens: call.totalTokens,
  estimatedCostUsd: call.estimatedCostUsd,
  estimatedCostCents: call.estimatedCostCents,
  latencyMs: call.latencyMs,
})

const runChatEval = async () => {
  const cases = [
    {
      strategy: 'nano_smalltalk',
      model: nanoModel,
      expectsGap: false,
      prompt: buildChatPrompt({
        dashboardTitle: 'Angular Basics',
        contextText: sourceWithNumbers('Angular Basics', angularNotes),
        question: 'thanks!',
      }),
    },
    {
      strategy: 'nano_grounded_normal',
      model: nanoModel,
      expectsGap: false,
      prompt: buildChatPrompt({
        dashboardTitle: 'Angular Basics',
        contextText: sourceWithNumbers('Angular Basics', angularNotes),
        question: 'When should I use a service instead of keeping logic in the component?',
      }),
    },
    {
      strategy: 'nano_source_gap_latest',
      model: nanoModel,
      expectsGap: true,
      prompt: buildChatPrompt({
        dashboardTitle: 'Angular Basics',
        contextText: sourceWithNumbers('Angular Basics', angularNotes),
        question: 'What changed in Angular 22 signal APIs?',
      }),
    },
    {
      strategy: 'nano_multi_source_reasoning',
      model: nanoModel,
      expectsGap: false,
      prompt: buildChatPrompt({
        dashboardTitle: 'Automation Tools',
        contextText: [
          sourceWithNumbers('Ansible Notes', ansibleNotes, 1),
          sourceWithNumbers('Terraform Notes', terraformNotes, 2),
        ].join('\n\n'),
        history: [
          { role: 'user', content: 'I know Docker and Kubernetes already.' },
          {
            role: 'assistant',
            content: 'Use orchestration comparisons carefully and stay source-grounded.',
          },
        ],
        question:
          'Compare Ansible and Terraform in one practical paragraph, then give a memory hook.',
      }),
    },
    {
      strategy: 'mini_source_gap_compare',
      model: miniModel,
      expectsGap: true,
      prompt: buildChatPrompt({
        dashboardTitle: 'Angular Basics',
        contextText: sourceWithNumbers('Angular Basics', angularNotes),
        question: 'What changed in Angular 22 signal APIs?',
      }),
    },
  ]

  const calls = []
  const outputs = []
  for (const testCase of cases) {
    const call = await callOpenAi({
      surface: 'chat',
      strategy: testCase.strategy,
      stage: 'chat',
      model: testCase.model,
      prompt: testCase.prompt,
      maxTokens: 1400,
    })
    calls.push(compactCall(call))
    outputs.push({
      strategy: testCase.strategy,
      answer: call.text,
      evaluation: evaluateChat(call.text, testCase.expectsGap),
    })
  }

  return { summary: summarizeCalls(calls), calls, outputs }
}

const runQuizEval = async () => {
  const calls = []
  const outputs = []

  const current = await callOpenAi({
    surface: 'quiz',
    strategy: 'nano_current_medium_30',
    stage: 'quick_create',
    model: nanoModel,
    prompt: buildQuizPrompt({
      title: 'Angular medium quiz',
      source: angularNotes,
      count: 30,
      style: 'mixed, app-like current medium count',
    }),
    schema: quizSchema,
    maxTokens: 6500,
  })
  calls.push(compactCall(current))
  outputs.push({
    strategy: current.strategy,
    evaluation: evaluateQuiz(current.parsed.questions || []),
    sample: (current.parsed.questions || []).slice(0, 3),
  })

  const lean = await callOpenAi({
    surface: 'quiz',
    strategy: 'nano_lean_8',
    stage: 'quick_create',
    model: nanoModel,
    prompt: buildQuizPrompt({
      title: 'Ansible lean quiz',
      source: ansibleNotes,
      count: 8,
      style: 'scenario-heavy 1SC lean pack',
    }),
    schema: quizSchema,
    maxTokens: 3200,
  })
  calls.push(compactCall(lean))
  outputs.push({
    strategy: lean.strategy,
    evaluation: evaluateQuiz(lean.parsed.questions || []),
    sample: (lean.parsed.questions || []).slice(0, 3),
  })

  const blueprintCall = await callOpenAi({
    surface: 'quiz',
    strategy: 'mini_blueprint_10',
    stage: 'quiz_blueprint',
    model: miniModel,
    prompt: buildBlueprintPrompt({
      title: 'Terraform vs Ansible quiz blueprint',
      source: `${terraformNotes}\n\n${ansibleNotes}`,
      count: 10,
      artifact: 'quiz',
    }),
    schema: blueprintSchema,
    maxTokens: 2200,
  })
  calls.push(compactCall(blueprintCall))

  const hybrid = await callOpenAi({
    surface: 'quiz',
    strategy: 'mini_blueprint_nano_10',
    stage: 'quick_create',
    model: nanoModel,
    prompt: buildQuizFromBlueprintPrompt({
      blueprint: blueprintCall.parsed,
      count: 10,
    }),
    schema: quizSchema,
    maxTokens: 3600,
  })
  calls.push(compactCall(hybrid))
  outputs.push({
    strategy: hybrid.strategy,
    blueprintConcepts: blueprintCall.parsed.concepts?.length || 0,
    evaluation: evaluateQuiz(hybrid.parsed.questions || []),
    sample: (hybrid.parsed.questions || []).slice(0, 3),
  })

  const miniLean = await callOpenAi({
    surface: 'quiz',
    strategy: 'mini_lean_8_compare',
    stage: 'quick_create',
    model: miniModel,
    prompt: buildQuizPrompt({
      title: 'Ansible lean quiz',
      source: ansibleNotes,
      count: 8,
      style: 'scenario-heavy 1SC lean pack',
    }),
    schema: quizSchema,
    maxTokens: 3200,
  })
  calls.push(compactCall(miniLean))
  outputs.push({
    strategy: miniLean.strategy,
    evaluation: evaluateQuiz(miniLean.parsed.questions || []),
    sample: (miniLean.parsed.questions || []).slice(0, 3),
  })

  return { summary: summarizeCalls(calls), calls, outputs }
}

const runFlashcardEval = async () => {
  const calls = []
  const outputs = []

  const current = await callOpenAi({
    surface: 'flashcard',
    strategy: 'nano_current_medium_40',
    stage: 'quick_create',
    model: nanoModel,
    prompt: buildFlashcardPrompt({
      title: 'Helm medium flashcards',
      source: helmNotes,
      count: 40,
    }),
    schema: flashcardSchema,
    maxTokens: 6500,
  })
  calls.push(compactCall(current))
  outputs.push({
    strategy: current.strategy,
    evaluation: evaluateFlashcards(current.parsed.cards || []),
    sample: (current.parsed.cards || []).slice(0, 4),
  })

  const lean = await callOpenAi({
    surface: 'flashcard',
    strategy: 'nano_lean_10',
    stage: 'quick_create',
    model: nanoModel,
    prompt: buildFlashcardPrompt({
      title: 'Roman Empire lean flashcards',
      source: romanNotes,
      count: 10,
    }),
    schema: flashcardSchema,
    maxTokens: 2500,
  })
  calls.push(compactCall(lean))
  outputs.push({
    strategy: lean.strategy,
    evaluation: evaluateFlashcards(lean.parsed.cards || []),
    sample: (lean.parsed.cards || []).slice(0, 4),
  })

  const technical = await callOpenAi({
    surface: 'flashcard',
    strategy: 'nano_technical_16',
    stage: 'quick_create',
    model: nanoModel,
    prompt: buildFlashcardPrompt({
      title: 'Ansible technical flashcards',
      source: ansibleNotes,
      count: 16,
    }),
    schema: flashcardSchema,
    maxTokens: 3800,
  })
  calls.push(compactCall(technical))
  outputs.push({
    strategy: technical.strategy,
    evaluation: evaluateFlashcards(technical.parsed.cards || []),
    sample: (technical.parsed.cards || []).slice(0, 4),
  })

  const blueprintCall = await callOpenAi({
    surface: 'flashcard',
    strategy: 'mini_blueprint_12',
    stage: 'flashcard_blueprint',
    model: miniModel,
    prompt: buildBlueprintPrompt({
      title: 'Terraform flashcard blueprint',
      source: terraformNotes,
      count: 12,
      artifact: 'flashcard',
    }),
    schema: blueprintSchema,
    maxTokens: 2200,
  })
  calls.push(compactCall(blueprintCall))

  const hybrid = await callOpenAi({
    surface: 'flashcard',
    strategy: 'mini_blueprint_nano_12',
    stage: 'quick_create',
    model: nanoModel,
    prompt: buildFlashcardsFromBlueprintPrompt({
      blueprint: blueprintCall.parsed,
      count: 12,
    }),
    schema: flashcardSchema,
    maxTokens: 3000,
  })
  calls.push(compactCall(hybrid))
  outputs.push({
    strategy: hybrid.strategy,
    blueprintConcepts: blueprintCall.parsed.concepts?.length || 0,
    evaluation: evaluateFlashcards(hybrid.parsed.cards || []),
    sample: (hybrid.parsed.cards || []).slice(0, 4),
  })

  return { summary: summarizeCalls(calls), calls, outputs }
}

const runPodcastEval = async () => {
  const calls = []
  const outputs = []
  const sourceLong = [angularNotes, ansibleNotes, helmNotes].join('\n\n')
  const cases = [
    {
      strategy: 'nano_current_target_520_850',
      model: nanoModel,
      sourceTitle: 'Angular Basics',
      sourceText: angularNotes,
      target: '520-850 spoken words, 10-18 short turns',
    },
    {
      strategy: 'nano_compact_target_300_450',
      model: nanoModel,
      sourceTitle: 'Photography Basics',
      sourceText: photoNotes,
      target: '300-450 spoken words, 6-10 short turns',
    },
    {
      strategy: 'nano_medium_target_420_620',
      model: nanoModel,
      sourceTitle: 'Ansible Basics',
      sourceText: ansibleNotes,
      target: '420-620 spoken words, 8-12 short turns',
    },
    {
      strategy: 'mini_current_target_520_850',
      model: miniModel,
      sourceTitle: 'Angular Basics',
      sourceText: angularNotes,
      target: '520-850 spoken words, 10-18 short turns',
    },
    {
      strategy: 'nano_current_long_source',
      model: nanoModel,
      sourceTitle: 'Frontend and Automation Review',
      sourceText: sourceLong,
      target: '520-850 spoken words, 10-18 short turns',
    },
  ]

  for (const testCase of cases) {
    const call = await callOpenAi({
      surface: 'podcast',
      strategy: testCase.strategy,
      stage: 'podcast_script',
      model: testCase.model,
      prompt: buildPodcastPrompt(testCase),
      schema: podcastSchema,
      maxTokens: 5000,
    })
    calls.push(compactCall(call))
    outputs.push({
      strategy: testCase.strategy,
      evaluation: evaluatePodcast(call.parsed),
      sample: {
        title: call.parsed.title,
        description: call.parsed.description,
        firstTurns: (call.parsed.transcriptTurns || []).slice(0, 3),
      },
    })
  }

  return { summary: summarizeCalls(calls), calls, outputs }
}

const buildMarkdownSummary = (results) => {
  const formatOutputMetric = (output) => {
    const evaluation = output.evaluation || {}
    if (typeof evaluation.count === 'number') {
      return `n=${evaluation.count}`
    }
    if (typeof evaluation.ttsCharacters === 'number') {
      return `${evaluation.transcriptWords} words, ${evaluation.ttsCharacters} TTS chars`
    }
    if (typeof evaluation.wordCount === 'number') {
      return `${evaluation.wordCount} words`
    }
    return ''
  }

  const lines = [
    '# Hosted Surface Cost Eval',
    '',
    `Run: ${results.runAt}`,
    `Mini model: ${results.models.mini}`,
    `Nano model: ${results.models.nano}`,
    `Pricing source: ${results.pricingSource || PRICING_SOURCE}`,
    '',
    '| Surface | Calls | Total cents | Avg cents/call | Best candidates |',
    '| --- | ---: | ---: | ---: | --- |',
  ]

  Object.entries(results.surfaces).forEach(([surface, result]) => {
    const best = result.outputs
      .map((output) => {
        const callCost = result.calls
          .filter((call) =>
            output.strategy.includes('mini_blueprint_nano')
              ? call.strategy.includes('blueprint') ||
                call.strategy === output.strategy
              : call.strategy === output.strategy,
          )
          .reduce((total, call) => total + call.estimatedCostCents, 0)
        const metric = formatOutputMetric(output)
        return `${output.strategy}: ${callCost.toFixed(4)}c, q${output.evaluation.quality}${
          metric ? `, ${metric}` : ''
        }`
      })
      .join('<br>')
    lines.push(
      `| ${surface} | ${result.summary.calls} | ${result.summary.totalCostCents.toFixed(
        4,
      )} | ${result.summary.avgCostCents.toFixed(4)} | ${best} |`,
    )
  })

  lines.push('', '## Calls')
  Object.entries(results.surfaces).forEach(([surface, result]) => {
    lines.push('', `### ${surface}`)
    result.calls.forEach((call) => {
      lines.push(
        `- ${call.strategy} (${call.model}): ${call.estimatedCostCents.toFixed(
          4,
        )}c, in ${call.inputTokens}, out ${call.outputTokens}`,
      )
    })
  })

  return `${lines.join('\n')}\n`
}

const main = async () => {
  mkdirSync(outputDir, { recursive: true })
  const results = {
    runAt: new Date().toISOString(),
    pricingSource: PRICING_SOURCE,
    models: { mini: miniModel, nano: nanoModel },
    surfaces: {},
  }

  if (process.argv.includes('--reprice')) {
    const existing = JSON.parse(readFileSync(resultPath, 'utf8'))
    const repriced = repriceResults(existing)
    writeFileSync(resultPath, `${JSON.stringify(repriced, null, 2)}\n`)
    writeFileSync(summaryPath, buildMarkdownSummary(repriced))
    console.log(`Repriced ${path.relative(repoRoot, resultPath)}`)
    console.log(`Wrote ${path.relative(repoRoot, summaryPath)}`)
    return
  }

  console.log(`Using mini=${miniModel}, nano=${nanoModel}`)
  console.log('Running chat eval...')
  results.surfaces.chat = await runChatEval()
  console.log('Running quiz eval...')
  results.surfaces.quiz = await runQuizEval()
  console.log('Running flashcard eval...')
  results.surfaces.flashcard = await runFlashcardEval()
  console.log('Running podcast eval...')
  results.surfaces.podcast = await runPodcastEval()

  writeFileSync(resultPath, `${JSON.stringify(results, null, 2)}\n`)
  writeFileSync(summaryPath, buildMarkdownSummary(results))

  console.log(`Wrote ${path.relative(repoRoot, resultPath)}`)
  console.log(`Wrote ${path.relative(repoRoot, summaryPath)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
