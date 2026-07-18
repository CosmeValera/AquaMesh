import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { loadLocalApiEnv } from '../../../api/local-env'
import {
  buildStudyGuideKnowledgeBridgeBlocksPrompt,
  buildStudyGuideQuickStartPrompt,
  buildStudyGuideQuickStartRelevancePrompt,
  ensureForcedStudyGuideQuickStartRelevanceDecision,
  parseStudyGuideKnowledgeBridgeBlocks,
  parseStudyGuideQuickStart,
  parseStudyGuideQuickStartRelevanceDecision,
  type StudyGuideBridgeMode,
  STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA,
  STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
  STUDY_GUIDE_QUICK_START_SCHEMA,
  type StudyGuideKnowledgeBridgeBlock,
} from '../src/studyGuides/quickStart'

loadLocalApiEnv()

const apiKey = process.env.HOSTED_OPENAI_API_KEY || process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error('Missing HOSTED_OPENAI_API_KEY or OPENAI_API_KEY')
}

const DEFAULT_MINI_MODEL = 'gpt-5.4-mini'
const MINI_MODEL =
  process.env.STUDY_GUIDE_BLUEPRINT_MODEL?.trim() || DEFAULT_MINI_MODEL
const NANO_MODEL = 'gpt-5.4-nano'
const MINI_PRICE_MULTIPLIER = Number(
  process.env.STUDY_GUIDE_BLUEPRINT_PRICE_MULTIPLIER || '1',
)
const MINI_REASONING_EFFORT =
  process.env.STUDY_GUIDE_BLUEPRINT_REASONING_EFFORT?.trim() || undefined
const SUPPORT_MODEL =
  process.env.STUDY_GUIDE_SUPPORT_MODEL?.trim() || MINI_MODEL
const BLUEPRINT_BREVITY = process.env.STUDY_GUIDE_BLUEPRINT_BREVITY === '1'
const SUPPORT_BREVITY = process.env.STUDY_GUIDE_SUPPORT_BREVITY === '1'
const SUPPORT_SOURCE_CHARS = Number(
  process.env.STUDY_GUIDE_SUPPORT_SOURCE_CHARS || '0',
)

type ModelName = string

type EvalOption = '3+2' | '4+2' | '4+2-enhanced'

type StageCost = {
  stage: string
  model: ModelName
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
}

type QuickStart = {
  keyIdea: string
  quickSummary: string
}

type QuizQuestion = {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  skillTested: string
}

type EvalPage = {
  title: string
  rawNotes: string
  quizQuestions?: QuizQuestion[]
}

type EvalGuide = {
  title: string
  quickStart: QuickStart
  pages: EvalPage[]
  bridgeBlocks: StudyGuideKnowledgeBridgeBlock[]
}

type GenerationResult = {
  option: EvalOption
  tupleId: string
  prompt: string
  knownTopics: string[]
  expectedKnownTopic: string
  selectedKnownTopics: string[]
  selectedExpectedTopic: boolean
  guide: EvalGuide
  stageCosts: StageCost[]
  generationCostUsd: number
  deterministicChecks: Record<string, unknown>
  hardEval?: HardEval
  hardEvalCostUsd?: number
}

type HardEval = {
  wouldShip: boolean
  overallScore: number
  accuracyScore: number
  pedagogyScore: number
  contextScore: number
  quizScore: number
  hallucinationRisk: 'low' | 'medium' | 'high'
  strengths: string[]
  issues: string[]
  verdict: string
}

type PairwiseEval = {
  tupleId: string
  prompt: string
  winner: '3+2' | '4+2' | 'tie'
  qualityWinner: '3+2' | '4+2' | 'tie'
  valueWinner: '3+2' | '4+2' | 'tie'
  reason: string
  costTradeoff: string
  evaluatorCostUsd: number
}

type Usage = {
  prompt_tokens?: number
  completion_tokens?: number
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  input_tokens_details?: { cached_tokens?: number }
}

const priceByModel: Record<
  ModelName,
  { input: number; cachedInput: number; output: number }
> = {
  [DEFAULT_MINI_MODEL]: { input: 0.75, cachedInput: 0.075, output: 4.5 },
  [NANO_MODEL]: { input: 0.2, cachedInput: 0.02, output: 1.25 },
  [MINI_MODEL]: {
    input: 0.75 * MINI_PRICE_MULTIPLIER,
    cachedInput: 0.075 * MINI_PRICE_MULTIPLIER,
    output: 4.5 * MINI_PRICE_MULTIPLIER,
  },
}

const tuples = [
  {
    id: 'terraform-hard-context',
    prompt: 'What is Terraform?',
    knownTopics: ['Rundeck', 'Docker', 'MinIO/S3', 'Ansible'],
    expectedKnownTopic: 'Ansible',
  },
  {
    id: 'vue-react-context',
    prompt: 'What is Vue?',
    knownTopics: ['React'],
    expectedKnownTopic: 'React',
  },
  {
    id: 'roman-empire-history-context',
    prompt: 'What was the Roman Empire?',
    knownTopics: [
      'Roman Republic',
      'Ancient Greece',
      'Medieval Europe',
      'React',
    ],
    expectedKnownTopic: 'Roman Republic',
  },
  {
    id: 'photography-lightroom-context',
    prompt: 'Basics of photography',
    knownTopics: ['Lightroom', 'Photoshop', 'Figma', 'React'],
    expectedKnownTopic: 'Lightroom',
  },
] as const

const plannerSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    quickStart: {
      type: 'object',
      properties: {
        keyIdea: { type: 'string' },
        quickSummary: { type: 'string' },
      },
    },
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          learningGoal: { type: 'string' },
          mustCover: { type: 'array', items: { type: 'string' } },
          examplesNeeded: { type: 'array', items: { type: 'string' } },
          codeOrConfigExample: { type: 'string' },
          quizSkills: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const blueprintSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    quickStart: {
      type: 'object',
      properties: {
        keyIdea: { type: 'string' },
        quickSummary: { type: 'string' },
      },
    },
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          keyFacts: { type: 'array', items: { type: 'string' } },
          conciseNotes: { type: 'string' },
          examplesNeeded: { type: 'array', items: { type: 'string' } },
          quizSkills: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const pageSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    rawNotes: { type: 'string' },
  },
}

const quizSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctIndex: { type: 'number' },
          explanation: { type: 'string' },
          skillTested: { type: 'string' },
        },
      },
    },
  },
}

const hardEvalSchema = {
  type: 'object',
  properties: {
    wouldShip: { type: 'boolean' },
    overallScore: { type: 'number' },
    accuracyScore: { type: 'number' },
    pedagogyScore: { type: 'number' },
    contextScore: { type: 'number' },
    quizScore: { type: 'number' },
    hallucinationRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
    strengths: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string' },
  },
}

const pairwiseSchema = {
  type: 'object',
  properties: {
    winner: { type: 'string', enum: ['3+2', '4+2', 'tie'] },
    qualityWinner: { type: 'string', enum: ['3+2', '4+2', 'tie'] },
    valueWinner: { type: 'string', enum: ['3+2', '4+2', 'tie'] },
    reason: { type: 'string' },
    costTradeoff: { type: 'string' },
  },
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toJsonSchema = (schema: unknown): unknown => {
  if (Array.isArray(schema)) {
    return schema.map(toJsonSchema)
  }

  if (!isObject(schema)) {
    return schema
  }

  const next: Record<string, unknown> = {}
  Object.entries(schema).forEach(([key, value]) => {
    if (key === 'type' && typeof value === 'string') {
      next.type = value.toLowerCase()
      return
    }

    next[key] = toJsonSchema(value)
  })

  if (next.type === 'object') {
    next.additionalProperties = false
    if (isObject(next.properties)) {
      next.required = Object.keys(next.properties)
    }
  }

  return next
}

const parseJson = <T>(text: string): T => JSON.parse(text) as T

const textFromPayload = (payload: any): string => {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content
  }

  if (typeof payload?.output_text === 'string') {
    return payload.output_text
  }

  if (Array.isArray(payload?.output)) {
    return payload.output
      .filter((item: any) => item?.type === 'message')
      .flatMap((item: any) => (Array.isArray(item.content) ? item.content : []))
      .filter((part: any) => typeof part?.text === 'string')
      .map((part: any) => part.text)
      .join('')
  }

  return ''
}

const costFromUsage = (
  stage: string,
  model: ModelName,
  usage?: Usage,
): StageCost => {
  const inputTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? 0
  const cachedInputTokens =
    usage?.prompt_tokens_details?.cached_tokens ??
    usage?.input_tokens_details?.cached_tokens ??
    0
  const outputTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 0
  const prices = priceByModel[model]
  if (!prices) {
    throw new Error(`Missing price configuration for ${model}`)
  }
  const billableInputTokens = Math.max(0, inputTokens - cachedInputTokens)
  const costUsd =
    (billableInputTokens * prices.input +
      cachedInputTokens * prices.cachedInput +
      outputTokens * prices.output) /
    1_000_000

  return {
    stage,
    model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens: usage?.total_tokens || inputTokens + outputTokens,
    costUsd: Number(costUsd.toFixed(8)),
  }
}

const callModel = async ({
  stage,
  model,
  prompt,
  schema,
}: {
  stage: string
  model: ModelName
  prompt: string
  schema?: Record<string, unknown>
}): Promise<{ text: string; cost: StageCost }> => {
  const useResponsesApi = model !== DEFAULT_MINI_MODEL && model !== NANO_MODEL
  const body: Record<string, unknown> = useResponsesApi
    ? {
        model,
        input: prompt,
      }
    : {
        model,
        messages: [{ role: 'user', content: prompt }],
      }

  if (!useResponsesApi && model === NANO_MODEL) {
    body.temperature = 0.15
  } else if (!useResponsesApi && model === DEFAULT_MINI_MODEL) {
    body.temperature = 0.2
  }

  if (useResponsesApi && MINI_REASONING_EFFORT) {
    body.reasoning = { effort: MINI_REASONING_EFFORT }
  }

  if (schema) {
    const jsonSchema = toJsonSchema(schema)
    body[useResponsesApi ? 'text' : 'response_format'] = useResponsesApi
      ? {
          format: {
            type: 'json_schema',
            name: 'studymesh_response',
            schema: jsonSchema,
            strict: true,
          },
        }
      : {
          type: 'json_schema',
          json_schema: {
            name: 'studymesh_response',
            schema: jsonSchema,
            strict: true,
          },
        }
  }

  const response = await fetch(
    useResponsesApi
      ? 'https://api.openai.com/v1/responses'
      : 'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  const payload = await response.json()

  if (!response.ok) {
    throw new Error(
      `${stage}/${model} failed: ${response.status} ${JSON.stringify(payload)}`,
    )
  }

  const text = textFromPayload(payload)
  if (!text) {
    throw new Error(
      `${stage}/${model} returned empty text. Payload: ${JSON.stringify(
        payload,
      ).slice(0, 2000)}`,
    )
  }

  return {
    text,
    cost: costFromUsage(stage, model, payload.usage),
  }
}

const totalCost = (costs: StageCost[]): number =>
  Number(costs.reduce((total, cost) => total + cost.costUsd, 0).toFixed(8))

const wordCount = (value: string): number =>
  value.split(/\s+/).filter(Boolean).length

const codeBlockCount = (pages: EvalPage[]): number =>
  pages.reduce(
    (count, page) =>
      count + Math.floor((page.rawNotes.match(/```/g) || []).length / 2),
    0,
  )

const quizBadSmellCount = (questions: QuizQuestion[]): number => {
  const badStem =
    /(according to|as stated|directly stated|what does the page say|which term is defined|what is mentioned|what is the main idea of)/i

  return questions.filter((question) => badStem.test(question.question)).length
}

const hasIncompleteEnding = (value: string): boolean =>
  /(?:,|:|;|\b(?:and|or|but|because|while|when|with|to|of|in|at|the))\s*$/i.test(
    value.trim(),
  )

const placeholderExampleCount = (guide: EvalGuide): number => {
  const placeholderPattern =
    /(example_resource|arguments would go here|component logic goes here|configuration would go here|pseudo-code placeholder)/i

  return guide.pages.filter((page) => placeholderPattern.test(page.rawNotes))
    .length
}

const sourceFromGuide = (
  prompt: string,
  guide: Pick<EvalGuide, 'title' | 'quickStart' | 'pages'>,
): string =>
  [
    `Prompt: ${prompt}`,
    `Title: ${guide.title}`,
    `Quick Start: ${guide.quickStart.keyIdea}\n${guide.quickStart.quickSummary}`,
    ...guide.pages.map((page, index) =>
      [`Page ${index + 1}: ${page.title}`, page.rawNotes].join('\n'),
    ),
  ].join('\n\n---\n\n')

const plannerPrompt = (
  prompt: string,
): string => `Plan a full StudyMesh Study Guide for "${prompt}".

Return strict JSON only:
{
  "title": "...",
  "quickStart": { "keyIdea": "...", "quickSummary": "two short paragraphs" },
  "pages": [
    {
      "title": "01 - ...",
      "learningGoal": "...",
      "mustCover": ["specific factual point"],
      "examplesNeeded": ["specific example"],
      "codeOrConfigExample": "short description or empty string",
      "quizSkills": ["skill to test on final quiz"]
    }
  ]
}

Rules:
- Exactly 3 pages.
- Do not write the pages. Create a high-quality plan that nano can follow safely.
- mustCover must contain 6-8 precise, conservative facts per page.
- Include concrete examples and code/config requirements where useful.
- Include enough final quiz skills for a 6-question application quiz.
- quickStart explains the concept directly, not the guide structure.

Topic: ${prompt}`

const blueprintPrompt = (
  prompt: string,
): string => `Create a compact factual blueprint for a full StudyMesh Study Guide about "${prompt}".

Return strict JSON only:
{
  "title": "...",
  "quickStart": { "keyIdea": "...", "quickSummary": "two short paragraphs" },
  "pages": [
    {
      "title": "01 - ...",
      "keyFacts": ["fact"],
      "conciseNotes": "100-140 words",
      "examplesNeeded": ["example"],
      "quizSkills": ["skill"]
    }
  ]
}

Rules:
- Exactly 3 pages.
- keyFacts must contain 7-9 precise facts per page.
- conciseNotes must include enough factual material to anchor nano expansion.
- For technical topics, include exact examples/config/code ideas in examplesNeeded.
- Include enough final quiz skills for a 6-question application quiz.
- quickStart explains the concept directly, not the guide structure.

Topic: ${prompt}`

const enhancedBlueprintPrompt = (
  tuple: (typeof tuples)[number],
): string => `Create an enhanced compact factual blueprint for a full StudyMesh Study Guide about "${
  tuple.prompt
}".

Return strict JSON only:
{
  "title": "...",
  "quickStart": { "keyIdea": "...", "quickSummary": "two short paragraphs" },
  "pages": [
    {
      "title": "01 - ...",
      "keyFacts": ["fact"],
      "conciseNotes": "100-140 words",
      "examplesNeeded": ["example"],
      "quizSkills": ["skill"]
    }
  ]
}

Rules:
- Exactly 3 pages.
- Mini owns facts and structure; nano will only expand this blueprint.
- keyFacts must contain 8-10 precise, conservative facts per page.
- conciseNotes must include enough factual material to anchor expansion.
- quickStart is mini-owned: explain the concept directly, not the guide structure.
- quickSummary target is 70-105 words. Every paragraph must end with a complete sentence.
- If close to a word target, finish the current sentence cleanly instead of ending mid-thought.
- Prefer a shorter complete sentence over using the whole word budget.
- Use the learner context candidates when they truly help: ${tuple.knownTopics.join(
  ', ',
)}.
- Best expected context candidate for this eval: ${tuple.expectedKnownTopic}.
- Include comparison material in keyFacts/conciseNotes when the expected context candidate helps reduce confusion.
- Do not force irrelevant analogies inside the pages, but prepare the best useful bridge for Quick Start and bridge blocks.
- For programming, framework, DevOps, IaC, config, or command-line topics, examplesNeeded must request at least one real minimal code/config/command snippet.
- Never ask nano for placeholder snippets. Forbidden examples include "example_resource", "arguments would go here", "component logic goes here", "configuration would go here", and "pseudo-code placeholder".
- For non-code topics, examplesNeeded should request concrete examples, timelines, scenarios, or comparisons instead of code.
- Include enough final quiz skills for a 6-question application quiz.
${
  BLUEPRINT_BREVITY
    ? `
Brevity rules (mandatory):
- keyFacts: exactly 8 per page, each one compact sentence with no filler words.
- conciseNotes: 90-110 words, packed with facts, no restating of keyFacts.
- examplesNeeded: at most 2 per page.
- quizSkills: exactly 2 per page.
- quickSummary: 60-85 words.
- Maximize factual density per word; never pad or repeat.
`
    : ''
}
Topic: ${tuple.prompt}`

const pageFromPlanPrompt = ({
  prompt,
  plan,
  page,
}: {
  prompt: string
  plan: Record<string, unknown>
  page: Record<string, unknown>
}): string => `Write one Study Guide page from this locked mini plan.

Return strict JSON only:
{ "title": "...", "rawNotes": "Markdown lesson notes" }

Rules:
- Write 260-360 words.
- Use only facts from the plan. Do not add unsupported factual claims.
- Include fenced code/config only if codeOrConfigExample asks for it.
- Do not include quiz questions in rawNotes.
- Make it concrete, beginner-friendly, and product-ready.

Topic: ${prompt}

Full plan:
${JSON.stringify(plan, null, 2)}

Page plan:
${JSON.stringify(page, null, 2)}`

const pageFromBlueprintPrompt = ({
  prompt,
  blueprint,
  page,
}: {
  prompt: string
  blueprint: Record<string, unknown>
  page: Record<string, unknown>
}): string => `Expand one Study Guide page using only this mini-authored blueprint.

Return strict JSON only:
{ "title": "...", "rawNotes": "Markdown lesson notes" }

Rules:
- Write 280-380 words.
- Do not add facts not present or directly implied by keyFacts/conciseNotes/examplesNeeded.
- Add connective explanation, examples, and learner-friendly structure.
- Include fenced code/config only when examplesNeeded calls for it.
- Do not include quiz questions in rawNotes.

Topic: ${prompt}

Full blueprint:
${JSON.stringify(blueprint, null, 2)}

Page blueprint:
${JSON.stringify(page, null, 2)}`

const enhancedPageFromBlueprintPrompt = ({
  prompt,
  blueprint,
  page,
}: {
  prompt: string
  blueprint: Record<string, unknown>
  page: Record<string, unknown>
}): string => `Expand one Study Guide page using only this enhanced mini-authored blueprint.

Return strict JSON only:
{ "title": "...", "rawNotes": "Markdown lesson notes" }

Rules:
- Write 280-360 words.
- Finish every paragraph and the final line as a complete sentence.
- If close to the word target, finish the current sentence cleanly instead of ending mid-thought.
- Do not end rawNotes with a comma, colon, "and", "or", "but", "because", "while", or an unfinished list.
- Do not add facts not present or directly implied by keyFacts/conciseNotes/examplesNeeded.
- Add connective explanation, examples, and learner-friendly structure.
- If examplesNeeded requests code/config/commands, include a real fenced snippet with a language tag.
- Never write placeholder snippets or placeholder comments like "arguments would go here", "component logic goes here", or "configuration would go here".
- If the blueprint does not provide enough detail for a real snippet, use a concrete prose example instead of fake code.
- Do not include quiz questions in rawNotes.

Topic: ${prompt}

Full blueprint:
${JSON.stringify(blueprint, null, 2)}

Page blueprint:
${JSON.stringify(page, null, 2)}`

const quizPrompt = (
  prompt: string,
  guide: EvalGuide,
  count = 6,
): string => `Create ${count} strong multiple-choice questions for the final page of this Study Guide.

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
- Create exactly ${count} questions.
- Each question has exactly 3 options.
- Avoid literal recall of copied sentences.
- Prefer application, comparison, error diagnosis, prediction, or transfer.
- Do not ask "According to the page..." or "Which statement is directly stated...".
- Every question must be answerable from the guide.
- Keep explanations short and specific.

Topic: ${prompt}

Guide:
${sourceFromGuide(prompt, guide).slice(0, 18000)}

Context bridge notes:
${JSON.stringify(guide.bridgeBlocks, null, 2)}`

const QUICK_START_BREVITY_SUFFIX = `

Extra rules:
- Keep quickSummary under 100 words total.
- End every paragraph with a complete sentence, never mid-thought.`

const BRIDGE_BREVITY_SUFFIX = `

Extra rules:
- Keep each bridge block body under 85 words.
- End the body with a complete sentence, never mid-thought.`

const applyContext = async ({
  option,
  prompt,
  knownTopics,
  guide,
  bridgeMode = 'auto',
}: {
  option: EvalOption
  prompt: string
  knownTopics: string[]
  guide: EvalGuide
  bridgeMode?: StudyGuideBridgeMode
}): Promise<{
  guide: EvalGuide
  selectedKnownTopics: string[]
  costs: StageCost[]
}> => {
  const costs: StageCost[] = []
  const fullSource = sourceFromGuide(prompt, guide)
  const source =
    SUPPORT_SOURCE_CHARS > 0
      ? fullSource.slice(0, SUPPORT_SOURCE_CHARS)
      : fullSource
  const relevance = await callModel({
    stage: `${option}_quick_start_relevance_auto`,
    model: SUPPORT_MODEL,
    prompt: buildStudyGuideQuickStartRelevancePrompt({
      title: guide.title,
      prompt,
      source,
      userKnownTopics: knownTopics,
      bridgeMode,
    }),
    schema: STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
  })
  costs.push(relevance.cost)
  const parsedRelevanceDecision = parseStudyGuideQuickStartRelevanceDecision(
    relevance.text,
    knownTopics,
  )
  const relevanceDecision =
    bridgeMode === 'force'
      ? ensureForcedStudyGuideQuickStartRelevanceDecision(
          parsedRelevanceDecision,
          knownTopics,
        ) || parsedRelevanceDecision
      : parsedRelevanceDecision
  let quickStart = guide.quickStart
  let bridgeBlocks: StudyGuideKnowledgeBridgeBlock[] = []

  if (
    relevanceDecision.shouldUseKnownTopic &&
    relevanceDecision.knownTopicsForQuickStart.length
  ) {
    const personalized = await callModel({
      stage: `${option}_quick_start_personalized`,
      model: SUPPORT_MODEL,
      prompt:
        buildStudyGuideQuickStartPrompt({
          title: guide.title,
          source,
          relevanceDecision,
          bridgeMode,
        }) + (SUPPORT_BREVITY ? QUICK_START_BREVITY_SUFFIX : ''),
      schema: STUDY_GUIDE_QUICK_START_SCHEMA,
    })
    costs.push(personalized.cost)
    quickStart = parseStudyGuideQuickStart(personalized.text) || quickStart

    const bridge = await callModel({
      stage: `${option}_knowledge_bridge_blocks`,
      model: SUPPORT_MODEL,
      prompt:
        buildStudyGuideKnowledgeBridgeBlocksPrompt({
          title: guide.title,
          prompt,
          dashboards: guide.pages.slice(1, 2).map((page, index) => ({
            dashboardIndex: index + 1,
            title: page.title,
            rawNotes: page.rawNotes,
          })),
          relevanceDecision,
          bridgeMode,
        }) + (SUPPORT_BREVITY ? BRIDGE_BREVITY_SUFFIX : ''),
      schema: STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA,
    })
    costs.push(bridge.cost)
    bridgeBlocks = parseStudyGuideKnowledgeBridgeBlocks(
      bridge.text,
      guide.pages.length,
      [1],
    )
  }

  return {
    guide: { ...guide, quickStart, bridgeBlocks },
    selectedKnownTopics: relevanceDecision.knownTopicsForQuickStart,
    costs,
  }
}

const generateOption3Plus2 = async (
  tuple: (typeof tuples)[number],
): Promise<GenerationResult> => {
  const option = '3+2' as const
  const costs: StageCost[] = []
  const planResult = await callModel({
    stage: '3+2_mini_planner',
    model: MINI_MODEL,
    prompt: plannerPrompt(tuple.prompt),
    schema: plannerSchema,
  })
  costs.push(planResult.cost)
  const plan = parseJson<{
    title: string
    quickStart: QuickStart
    pages: Record<string, unknown>[]
  }>(planResult.text)
  let guide: EvalGuide = {
    title: plan.title,
    quickStart: plan.quickStart,
    pages: [],
    bridgeBlocks: [],
  }

  for (const [index, page] of plan.pages.entries()) {
    const pageResult = await callModel({
      stage: `3+2_nano_page_${index + 1}`,
      model: NANO_MODEL,
      prompt: pageFromPlanPrompt({ prompt: tuple.prompt, plan, page }),
      schema: pageSchema,
    })
    costs.push(pageResult.cost)
    guide.pages.push({
      ...parseJson<EvalPage>(pageResult.text),
      quizQuestions: [],
    })
  }

  const context = await applyContext({
    option,
    prompt: tuple.prompt,
    knownTopics: [...tuple.knownTopics],
    guide,
  })
  guide = context.guide
  costs.push(...context.costs)

  const quiz = await callModel({
    stage: '3+2_nano_final_quiz',
    model: NANO_MODEL,
    prompt: quizPrompt(tuple.prompt, guide),
    schema: quizSchema,
  })
  costs.push(quiz.cost)
  const questions = parseJson<{ questions: QuizQuestion[] }>(
    quiz.text,
  ).questions
  guide.pages = guide.pages.map((page, index) =>
    index === guide.pages.length - 1
      ? { ...page, quizQuestions: questions }
      : page,
  )

  return buildResult(option, tuple, guide, context.selectedKnownTopics, costs)
}

const generateOption4Plus2 = async (
  tuple: (typeof tuples)[number],
): Promise<GenerationResult> => {
  const option = '4+2' as const
  const costs: StageCost[] = []
  const blueprintResult = await callModel({
    stage: '4+2_mini_blueprint',
    model: MINI_MODEL,
    prompt: blueprintPrompt(tuple.prompt),
    schema: blueprintSchema,
  })
  costs.push(blueprintResult.cost)
  const blueprint = parseJson<{
    title: string
    quickStart: QuickStart
    pages: Record<string, unknown>[]
  }>(blueprintResult.text)
  let guide: EvalGuide = {
    title: blueprint.title,
    quickStart: blueprint.quickStart,
    pages: [],
    bridgeBlocks: [],
  }

  for (const [index, page] of blueprint.pages.entries()) {
    const pageResult = await callModel({
      stage: `4+2_nano_expand_page_${index + 1}`,
      model: NANO_MODEL,
      prompt: pageFromBlueprintPrompt({
        prompt: tuple.prompt,
        blueprint,
        page,
      }),
      schema: pageSchema,
    })
    costs.push(pageResult.cost)
    guide.pages.push({
      ...parseJson<EvalPage>(pageResult.text),
      quizQuestions: [],
    })
  }

  const context = await applyContext({
    option,
    prompt: tuple.prompt,
    knownTopics: [...tuple.knownTopics],
    guide,
  })
  guide = context.guide
  costs.push(...context.costs)

  const quiz = await callModel({
    stage: '4+2_nano_final_quiz',
    model: NANO_MODEL,
    prompt: quizPrompt(tuple.prompt, guide),
    schema: quizSchema,
  })
  costs.push(quiz.cost)
  const questions = parseJson<{ questions: QuizQuestion[] }>(
    quiz.text,
  ).questions
  guide.pages = guide.pages.map((page, index) =>
    index === guide.pages.length - 1
      ? { ...page, quizQuestions: questions }
      : page,
  )

  return buildResult(option, tuple, guide, context.selectedKnownTopics, costs)
}

const generateEnhancedOption4Plus2 = async (
  tuple: (typeof tuples)[number],
): Promise<GenerationResult> => {
  const option = '4+2-enhanced' as const
  const costs: StageCost[] = []
  const blueprintResult = await callModel({
    stage: '4+2-enhanced_mini_blueprint',
    model: MINI_MODEL,
    prompt: enhancedBlueprintPrompt(tuple),
    schema: blueprintSchema,
  })
  costs.push(blueprintResult.cost)
  const blueprint = parseJson<{
    title: string
    quickStart: QuickStart
    pages: Record<string, unknown>[]
  }>(blueprintResult.text)
  let guide: EvalGuide = {
    title: blueprint.title,
    quickStart: blueprint.quickStart,
    pages: [],
    bridgeBlocks: [],
  }

  for (const [index, page] of blueprint.pages.entries()) {
    const pageResult = await callModel({
      stage: `4+2-enhanced_nano_expand_page_${index + 1}`,
      model: NANO_MODEL,
      prompt: enhancedPageFromBlueprintPrompt({
        prompt: tuple.prompt,
        blueprint,
        page,
      }),
      schema: pageSchema,
    })
    costs.push(pageResult.cost)
    guide.pages.push({
      ...parseJson<EvalPage>(pageResult.text),
      quizQuestions: [],
    })
  }

  const context = await applyContext({
    option,
    prompt: tuple.prompt,
    knownTopics: [...tuple.knownTopics],
    guide,
    bridgeMode: 'force',
  })
  guide = context.guide
  costs.push(...context.costs)

  const quiz = await callModel({
    stage: '4+2-enhanced_nano_final_quiz',
    model: NANO_MODEL,
    prompt: quizPrompt(tuple.prompt, guide),
    schema: quizSchema,
  })
  costs.push(quiz.cost)
  const questions = parseJson<{ questions: QuizQuestion[] }>(
    quiz.text,
  ).questions
  guide.pages = guide.pages.map((page, index) =>
    index === guide.pages.length - 1
      ? { ...page, quizQuestions: questions }
      : page,
  )

  return buildResult(option, tuple, guide, context.selectedKnownTopics, costs)
}

const buildResult = (
  option: EvalOption,
  tuple: (typeof tuples)[number],
  guide: EvalGuide,
  selectedKnownTopics: string[],
  stageCosts: StageCost[],
): GenerationResult => {
  const finalQuiz = guide.pages.at(-1)?.quizQuestions || []

  return {
    option,
    tupleId: tuple.id,
    prompt: tuple.prompt,
    knownTopics: [...tuple.knownTopics],
    expectedKnownTopic: tuple.expectedKnownTopic,
    selectedKnownTopics,
    selectedExpectedTopic: selectedKnownTopics.some(
      (topic) => topic.toLowerCase() === tuple.expectedKnownTopic.toLowerCase(),
    ),
    guide,
    stageCosts,
    generationCostUsd: totalCost(stageCosts),
    deterministicChecks: {
      pageCount: guide.pages.length,
      finalQuizQuestions: finalQuiz.length,
      quizBadSmellCount: quizBadSmellCount(finalQuiz),
      bridgeBlockCount: guide.bridgeBlocks.length,
      codeBlockCount: codeBlockCount(guide.pages),
      quickSummaryIncompleteEnding: hasIncompleteEnding(
        guide.quickStart.quickSummary,
      ),
      rawNotesIncompleteEnding: guide.pages.some((page) =>
        hasIncompleteEnding(page.rawNotes),
      ),
      placeholderExampleCount: placeholderExampleCount(guide),
      averagePageWords:
        guide.pages.reduce(
          (total, page) => total + wordCount(page.rawNotes),
          0,
        ) / Math.max(1, guide.pages.length),
    },
  }
}

const hardEvalPrompt = (
  result: GenerationResult,
): string => `Hard-evaluate this generated StudyMesh Study Guide.

Return strict JSON only:
{
  "wouldShip": true,
  "overallScore": 1,
  "accuracyScore": 1,
  "pedagogyScore": 1,
  "contextScore": 1,
  "quizScore": 1,
  "hallucinationRisk": "low",
  "strengths": ["..."],
  "issues": ["..."],
  "verdict": "..."
}

Scoring:
- Scores are 1-10.
- Be strict. Penalize generic content, unsupported claims, wrong known-topic bridge, weak examples, missing practical details, and literal-recall quiz questions.
- Reward accurate beginner teaching, useful examples/code, clear progression, correct context bridge, and quiz questions that test application/comparison/error diagnosis.
- Context bridge should use the expected known topic when it is clearly best.
- Cost matters only lightly in this individual quality eval; focus on quality. Pairwise eval will compare value.

Prompt: ${result.prompt}
Known topics: ${result.knownTopics.join(', ')}
Expected best known topic: ${result.expectedKnownTopic}
Selected known topics: ${result.selectedKnownTopics.join(', ') || 'none'}
Generation cost USD: ${result.generationCostUsd}

Guide:
${JSON.stringify(result.guide, null, 2).slice(0, 30000)}`

const runHardEval = async (
  result: GenerationResult,
): Promise<{ evalResult: HardEval; cost: StageCost }> => {
  const response = await callModel({
    stage: `${result.option}_hard_eval_${result.tupleId}`,
    model: MINI_MODEL,
    prompt: hardEvalPrompt(result),
    schema: hardEvalSchema,
  })

  return {
    evalResult: parseJson<HardEval>(response.text),
    cost: response.cost,
  }
}

const pairwisePrompt = (
  tuple: (typeof tuples)[number],
  option3: GenerationResult,
  option4: GenerationResult,
): string => `Compare these two full Study Guide generations for the same prompt.

Return strict JSON only:
{
  "winner": "3+2" | "4+2" | "tie",
  "qualityWinner": "3+2" | "4+2" | "tie",
  "valueWinner": "3+2" | "4+2" | "tie",
  "reason": "...",
  "costTradeoff": "..."
}

Rules:
- Consider both quality and generation cost.
- Quality matters more than tiny cost differences.
- Treat a difference under $0.001 as small unless quality is tied.
- Penalize wrong context selection, weak or copied quiz questions, hallucination risk, placeholder examples, or thin pages.
- Pick a winner only if meaningful; otherwise tie.

Prompt: ${tuple.prompt}
Known topics: ${tuple.knownTopics.join(', ')}
Expected best known topic: ${tuple.expectedKnownTopic}

3+2:
Cost: ${option3.generationCostUsd}
Hard eval: ${JSON.stringify(option3.hardEval, null, 2)}
Checks: ${JSON.stringify(option3.deterministicChecks, null, 2)}

4+2:
Cost: ${option4.generationCostUsd}
Hard eval: ${JSON.stringify(option4.hardEval, null, 2)}
Checks: ${JSON.stringify(option4.deterministicChecks, null, 2)}

3+2 guide excerpt:
${JSON.stringify(option3.guide, null, 2).slice(0, 14000)}

4+2 guide excerpt:
${JSON.stringify(option4.guide, null, 2).slice(0, 14000)}`

const runPairwise = async (
  tuple: (typeof tuples)[number],
  option3: GenerationResult,
  option4: GenerationResult,
): Promise<PairwiseEval> => {
  const response = await callModel({
    stage: `pairwise_${tuple.id}`,
    model: MINI_MODEL,
    prompt: pairwisePrompt(tuple, option3, option4),
    schema: pairwiseSchema,
  })
  const parsed = parseJson<
    Omit<PairwiseEval, 'tupleId' | 'prompt' | 'evaluatorCostUsd'>
  >(response.text)

  return {
    tupleId: tuple.id,
    prompt: tuple.prompt,
    ...parsed,
    evaluatorCostUsd: response.cost.costUsd,
  }
}

const summarizeResult = (result: GenerationResult) => ({
  option: result.option,
  tupleId: result.tupleId,
  prompt: result.prompt,
  generationCostUsd: result.generationCostUsd,
  selectedKnownTopics: result.selectedKnownTopics,
  selectedExpectedTopic: result.selectedExpectedTopic,
  deterministicChecks: result.deterministicChecks,
  hardEval: result.hardEval,
  stageCosts: result.stageCosts.map((cost) => ({
    stage: cost.stage,
    model: cost.model,
    costUsd: cost.costUsd,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
  })),
})

const loadBaselineOption4Results = (): Map<string, GenerationResult> => {
  const baselinePath = resolve(
    process.cwd(),
    'apps/studymesh/evals/study-guide-3plus2-vs-4plus2-results.json',
  )
  let parsed: { results?: GenerationResult[] }
  try {
    parsed = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
      results?: GenerationResult[]
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Map()
    }

    throw error
  }

  return new Map(
    (parsed.results || [])
      .filter((result) => result.option === '4+2')
      .map((result) => [result.tupleId, result]),
  )
}

const summarizeBaselineComparison = (
  enhanced: GenerationResult,
  baseline?: GenerationResult,
) => {
  if (!baseline) {
    return {
      tupleId: enhanced.tupleId,
      missingBaseline: true,
    }
  }

  return {
    tupleId: enhanced.tupleId,
    prompt: enhanced.prompt,
    baselineCostUsd: baseline.generationCostUsd,
    enhancedCostUsd: enhanced.generationCostUsd,
    costDeltaUsd: Number(
      (enhanced.generationCostUsd - baseline.generationCostUsd).toFixed(8),
    ),
    baselineSelectedKnownTopics: baseline.selectedKnownTopics,
    enhancedSelectedKnownTopics: enhanced.selectedKnownTopics,
    baselineSelectedExpectedTopic: baseline.selectedExpectedTopic,
    enhancedSelectedExpectedTopic: enhanced.selectedExpectedTopic,
    baselineChecks: baseline.deterministicChecks,
    enhancedChecks: enhanced.deterministicChecks,
  }
}

const mainEnhancedOnly = async () => {
  const baselineByTuple = loadBaselineOption4Results()
  const results: GenerationResult[] = []
  const tupleFilter = (process.env.STUDY_GUIDE_TUPLE_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const selectedTuples = tupleFilter.length
    ? tuples.filter((tuple) => tupleFilter.includes(tuple.id))
    : [...tuples]

  for (const tuple of selectedTuples) {
    const result = await generateEnhancedOption4Plus2(tuple)
    results.push(result)
  }

  const comparisons = results.map((result) =>
    summarizeBaselineComparison(result, baselineByTuple.get(result.tupleId)),
  )
  const payload = {
    createdAt: new Date().toISOString(),
    mode: '4+2-enhanced-only-no-evaluator',
    models: {
      mini: MINI_MODEL,
      nano: NANO_MODEL,
      support: SUPPORT_MODEL,
      miniPriceMultiplier: MINI_PRICE_MULTIPLIER,
      miniReasoningEffort: MINI_REASONING_EFFORT || null,
      blueprintBrevity: BLUEPRINT_BREVITY,
      supportBrevity: SUPPORT_BREVITY,
      supportSourceChars: SUPPORT_SOURCE_CHARS || null,
    },
    tuples: selectedTuples,
    summary: {
      results: results.map(summarizeResult),
      comparisons,
      generationCostUsdTotal: totalCost(
        results.flatMap((result) => result.stageCosts),
      ),
    },
    results,
    comparisons,
  }
  const outputPath = resolve(
    process.cwd(),
    process.env.STUDY_GUIDE_EVAL_OUTPUT_PATH ||
      'apps/studymesh/evals/study-guide-4plus2-enhanced-results.json',
  )
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify(payload.summary, null, 2))
  console.log(`Saved enhanced results to ${outputPath}`)
}

const main = async () => {
  if (process.argv.includes('--enhanced-only')) {
    await mainEnhancedOnly()
    return
  }

  const results: GenerationResult[] = []
  const evaluatorCosts: StageCost[] = []
  const pairwise: PairwiseEval[] = []

  for (const tuple of tuples) {
    const option3 = await generateOption3Plus2(tuple)
    const option4 = await generateOption4Plus2(tuple)

    for (const result of [option3, option4]) {
      const hardEval = await runHardEval(result)
      result.hardEval = hardEval.evalResult
      result.hardEvalCostUsd = hardEval.cost.costUsd
      evaluatorCosts.push(hardEval.cost)
      results.push(result)
    }

    const pair = await runPairwise(tuple, option3, option4)
    pairwise.push(pair)
  }

  const payload = {
    createdAt: new Date().toISOString(),
    models: { mini: MINI_MODEL, nano: NANO_MODEL },
    tuples,
    summary: {
      results: results.map(summarizeResult),
      pairwise,
      generationCostUsdTotal: totalCost(
        results.flatMap((result) => result.stageCosts),
      ),
      evaluatorCostUsdTotal: totalCost(evaluatorCosts),
      pairwiseEvaluatorCostUsdTotal: Number(
        pairwise
          .reduce((total, item) => total + item.evaluatorCostUsd, 0)
          .toFixed(8),
      ),
    },
    results,
    pairwise,
  }
  const outputPath = resolve(
    process.cwd(),
    'apps/studymesh/evals/study-guide-3plus2-vs-4plus2-results.json',
  )
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify(payload.summary, null, 2))
  console.log(`Saved full results to ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
