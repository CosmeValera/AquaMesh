import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { loadLocalApiEnv } from '../../../api/local-env'
import {
  buildStudyGuideKnowledgeBridgeBlocksPrompt,
  buildStudyGuideQuickStartPrompt,
  buildStudyGuideQuickStartRelevancePrompt,
  parseStudyGuideKnowledgeBridgeBlocks,
  parseStudyGuideQuickStart,
  parseStudyGuideQuickStartRelevanceDecision,
  STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA,
  STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
  STUDY_GUIDE_QUICK_START_SCHEMA,
  type StudyGuideQuickStartRelevanceDecision,
} from '../src/studyGuides/quickStart'
import {
  generateStudyPathWithAi,
  type AiStudyPathDashboardDraft,
  type AiStudyPathDraft,
  type StrongAiModelTransport,
} from '../src/quickCreate/ai/strongGeneration'

loadLocalApiEnv()

const apiKey = process.env.HOSTED_OPENAI_API_KEY || process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error('Missing HOSTED_OPENAI_API_KEY or OPENAI_API_KEY')
}

const MINI_MODEL = 'gpt-5.4-mini'
const NANO_MODEL = 'gpt-5.4-nano'

type ModelName = typeof MINI_MODEL | typeof NANO_MODEL

type StageCost = {
  option: string
  stage: string
  model: ModelName
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
}

type Usage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
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
}

type EvalResult = {
  option: string
  prompt: string
  knownTopics?: string[]
  expectedKnownTopic?: string
  selectedKnownTopics?: string[]
  selectedExpectedTopic?: boolean
  route?: string
  usedFallback?: boolean
  validator?: {
    pass: boolean
    score: number
    issues: string[]
    strengths: string[]
    verdict: string
  }
  deterministicChecks: Record<string, unknown>
  guide: EvalGuide
  stageCosts: StageCost[]
  totalCostUsd: number
  notes: string[]
}

const priceByModel: Record<
  ModelName,
  { input: number; cachedInput: number; output: number }
> = {
  [MINI_MODEL]: { input: 0.75, cachedInput: 0.075, output: 4.5 },
  [NANO_MODEL]: { input: 0.2, cachedInput: 0.02, output: 1.25 },
}

const strictGuideNoQuizSchema = {
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
          rawNotes: { type: 'string' },
        },
      },
    },
  },
}

const strictQuizSchema = {
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

const strictPlannerSchema = {
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

const strictBlueprintSchema = {
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

const strictPageSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    rawNotes: { type: 'string' },
  },
}

const strictValidatorSchema = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'number' },
    issues: { type: 'array', items: { type: 'string' } },
    strengths: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string' },
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

const completionText = (payload: any): string => {
  const content = payload?.choices?.[0]?.message?.content

  return typeof content === 'string' ? content : ''
}

const costFromUsage = (
  option: string,
  stage: string,
  model: ModelName,
  usage?: Usage,
): StageCost => {
  const inputTokens = usage?.prompt_tokens || 0
  const cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens || 0
  const outputTokens = usage?.completion_tokens || 0
  const prices = priceByModel[model]
  const billableInputTokens = Math.max(0, inputTokens - cachedInputTokens)
  const costUsd =
    (billableInputTokens * prices.input +
      cachedInputTokens * prices.cachedInput +
      outputTokens * prices.output) /
    1_000_000

  return {
    option,
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
  option,
  stage,
  model,
  prompt,
  schema,
}: {
  option: string
  stage: string
  model: ModelName
  prompt: string
  schema?: Record<string, unknown>
}): Promise<{ text: string; cost: StageCost }> => {
  const body: Record<string, unknown> = {
    model,
    temperature: model === NANO_MODEL ? 0.15 : 0.25,
    messages: [{ role: 'user', content: prompt }],
  }

  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'studymesh_response',
        schema: toJsonSchema(schema),
        strict: true,
      },
    }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json()

  if (!response.ok) {
    throw new Error(
      `${option}/${stage}/${model} failed: ${response.status} ${JSON.stringify(
        payload,
      )}`,
    )
  }

  return {
    text: completionText(payload),
    cost: costFromUsage(option, stage, model, payload.usage),
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

const quizQuestionsFromDashboard = (
  dashboard: AiStudyPathDashboardDraft,
): QuizQuestion[] => {
  const questions = (dashboard as any).practice?.multipleChoice
  const studyObjectQuestions = Array.isArray((dashboard as any).objects)
    ? (dashboard as any).objects.filter(
        (object: any) => object?.kind === 'quiz',
      )
    : []

  if (studyObjectQuestions.length) {
    return studyObjectQuestions.map((question: any) => ({
      question: String(question.question || ''),
      options: Array.isArray(question.options)
        ? question.options.map((option: unknown) => String(option))
        : [],
      correctIndex: Number(question.correctIndex || 0),
      explanation: String(question.explanation || question.answer || ''),
      skillTested: '',
    }))
  }

  return Array.isArray(questions)
    ? questions.map((question: any) => ({
        question: String(question.question || ''),
        options: Array.isArray(question.options)
          ? question.options.map((option: unknown) => String(option))
          : [],
        correctIndex: Number(
          question.correctOptionIndex ?? question.correctIndex ?? 0,
        ),
        explanation: String(question.explanation || ''),
        skillTested: '',
      }))
    : []
}

const fromDraft = (draft: AiStudyPathDraft): EvalGuide => ({
  title: draft.title,
  quickStart: draft.quickStart || {
    keyIdea: '',
    quickSummary: '',
  },
  pages: draft.dashboards.map((dashboard) => ({
    title: dashboard.title,
    rawNotes: dashboard.rawNotes,
    quizQuestions: quizQuestionsFromDashboard(dashboard),
  })),
})

const sourceFromGuide = (prompt: string, guide: EvalGuide): string =>
  [
    `Prompt: ${prompt}`,
    `Title: ${guide.title}`,
    `Quick Start: ${guide.quickStart.keyIdea}\n${guide.quickStart.quickSummary}`,
    ...guide.pages.map((page, index) =>
      [`Page ${index + 1}: ${page.title}`, page.rawNotes].join('\n'),
    ),
  ].join('\n\n---\n\n')

const sourceFromDraft = (prompt: string, draft: AiStudyPathDraft): string =>
  sourceFromGuide(prompt, fromDraft(draft))

const productMain = async (
  option: string,
  prompt: string,
  model: ModelName,
): Promise<{ draft: AiStudyPathDraft; stageCosts: StageCost[] }> => {
  const stageCosts: StageCost[] = []
  const transport: StrongAiModelTransport = async (request) => {
    const promptText = request.parts
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('\n\n')
    const result = await callModel({
      option,
      stage: 'study_guide_main',
      model,
      prompt: promptText,
      schema: request.responseSchema,
    })
    stageCosts.push(result.cost)

    return result.text
  }

  const draft = await generateStudyPathWithAi({
    apiToken: apiKey || '',
    model,
    strongProvider: 'openai',
    strongTransport: transport,
    singleRequest: true,
    studyGuideProfile: 'lean',
    title: prompt,
    prompt,
    folderName: '',
  })

  return { draft, stageCosts }
}

const withoutMainQuizPrompt = (promptText: string): string =>
  promptText
    .replace(
      'Lean hosted profile: only the final dashboard may include practice.multipleChoice.',
      'Lean hosted profile: no dashboard may include practice.multipleChoice. Leave practice.multipleChoice empty on every dashboard because a separate final quiz will be generated later.',
    )
    .replace(
      'Lean hosted profile: final dashboard must include exactly 3 multiple-choice questions, exactly 3 options per question, and short explanations only.',
      'Lean hosted profile: do not include multiple-choice questions in the main guide. Keep the final page as a normal lesson/application page.',
    )
    .replace(
      'Visible dashboard rule: one Markdown lesson widget plus a QuizCarouselBlock when practiceType is "quiz" or "mixed" and practice.multipleChoice is filled.',
      'Visible dashboard rule: one Markdown lesson widget only. Do not ask for QuizCarouselBlock in the main guide.',
    )
    .replace(
      'Add practice.multipleChoice only on dashboards selected for quiz practice. Quiz dashboards should usually have 3-6 questions.',
      'Do not add practice.multipleChoice in the main guide. A separate quiz call will create final practice questions.',
    )

const productMainNoQuiz = async (
  option: string,
  prompt: string,
  model: ModelName,
): Promise<{ draft: AiStudyPathDraft; stageCosts: StageCost[] }> => {
  const stageCosts: StageCost[] = []
  const transport: StrongAiModelTransport = async (request) => {
    const promptText = withoutMainQuizPrompt(
      request.parts
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('\n\n'),
    )
    const result = await callModel({
      option,
      stage: 'study_guide_main_no_quiz',
      model,
      prompt: promptText,
      schema: request.responseSchema,
    })
    stageCosts.push(result.cost)

    return result.text
  }

  const draft = await generateStudyPathWithAi({
    apiToken: apiKey || '',
    model,
    strongProvider: 'openai',
    strongTransport: transport,
    singleRequest: true,
    studyGuideProfile: 'lean',
    title: prompt,
    prompt,
    folderName: '',
  })

  return { draft, stageCosts }
}

const eligibleBridgeDashboards = (draft: AiStudyPathDraft) =>
  draft.dashboards
    .map((dashboard, index) => ({ dashboard, index }))
    .filter(
      ({ dashboard, index }) =>
        index > 0 &&
        dashboard.dashboardRole === 'normal' &&
        dashboard.practiceType === 'none',
    )
    .map(({ dashboard, index }) => ({
      dashboardIndex: index,
      title: dashboard.title,
      summary: dashboard.summary,
      rawNotes: dashboard.rawNotes,
    }))

const runNanoSupport = async ({
  option,
  prompt,
  guide,
  draft,
  knownTopics,
  supportModel = NANO_MODEL,
}: {
  option: string
  prompt: string
  guide: EvalGuide
  draft: AiStudyPathDraft
  knownTopics: string[]
  supportModel?: ModelName
}) => {
  const stageCosts: StageCost[] = []
  const source = sourceFromGuide(prompt, guide)
  const relevance = await callModel({
    option,
    stage: 'quick_start_relevance_auto',
    model: supportModel,
    prompt: buildStudyGuideQuickStartRelevancePrompt({
      title: guide.title,
      prompt,
      source,
      userKnownTopics: knownTopics,
      bridgeMode: 'auto',
    }),
    schema: STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
  })
  stageCosts.push(relevance.cost)
  const relevanceDecision = parseStudyGuideQuickStartRelevanceDecision(
    relevance.text,
    knownTopics,
  )
  let quickStart = guide.quickStart
  let bridgeBlockCount = 0

  if (
    relevanceDecision.shouldUseKnownTopic &&
    relevanceDecision.knownTopicsForQuickStart.length
  ) {
    const personalized = await callModel({
      option,
      stage: 'quick_start_personalized',
      model: supportModel,
      prompt: buildStudyGuideQuickStartPrompt({
        title: guide.title,
        source,
        relevanceDecision,
        bridgeMode: 'auto',
      }),
      schema: STUDY_GUIDE_QUICK_START_SCHEMA,
    })
    stageCosts.push(personalized.cost)
    quickStart = parseStudyGuideQuickStart(personalized.text) || quickStart

    const bridgeDashboards = eligibleBridgeDashboards(draft)
    if (bridgeDashboards.length) {
      const bridge = await callModel({
        option,
        stage: 'knowledge_bridge_blocks',
        model: supportModel,
        prompt: buildStudyGuideKnowledgeBridgeBlocksPrompt({
          title: guide.title,
          prompt,
          dashboards: bridgeDashboards,
          relevanceDecision,
          bridgeMode: 'auto',
        }),
        schema: STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA,
      })
      stageCosts.push(bridge.cost)
      bridgeBlockCount = parseStudyGuideKnowledgeBridgeBlocks(
        bridge.text,
        draft.dashboards.length,
        bridgeDashboards.map((dashboard) => dashboard.dashboardIndex),
      ).length
    }
  }

  return {
    quickStart,
    relevanceDecision,
    bridgeBlockCount,
    stageCosts,
  }
}

const quizBadSmellCount = (questions: QuizQuestion[]): number => {
  const badStem =
    /(according to|as stated|directly stated|what does the page say|what is mentioned|which term is defined|what is the main idea of)/i

  return questions.filter((question) => badStem.test(question.question)).length
}

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
- Avoid literal recall of a copied sentence.
- Prefer application, comparison, error diagnosis, prediction, or transfer.
- Do not ask "According to the page..." or "Which statement is directly stated...".
- Every question must be answerable from the guide.
- Keep explanations short and specific.

Topic: ${prompt}

Guide:
${sourceFromGuide(prompt, guide).slice(0, 18000)}`

const runOption1 = async (
  prompt: string,
  knownTopics: string[],
  expectedKnownTopic: string,
): Promise<EvalResult> => {
  const option = '1-mini-main-nano-support'
  const main = await productMain(option, prompt, MINI_MODEL)
  let guide = fromDraft(main.draft)
  const support = await runNanoSupport({
    option,
    prompt,
    guide,
    draft: main.draft,
    knownTopics,
  })
  guide = { ...guide, quickStart: support.quickStart }
  const selectedKnownTopics = support.relevanceDecision.knownTopicsForQuickStart
  const stageCosts = [...main.stageCosts, ...support.stageCosts]

  return {
    option,
    prompt,
    knownTopics,
    expectedKnownTopic,
    selectedKnownTopics,
    selectedExpectedTopic: selectedKnownTopics.some(
      (topic) => topic.toLowerCase() === expectedKnownTopic.toLowerCase(),
    ),
    deterministicChecks: {
      pageCount: guide.pages.length,
      bridgeBlockCount: support.bridgeBlockCount,
      codeBlockCount: codeBlockCount(guide.pages),
      finalQuizQuestions: guide.pages.at(-1)?.quizQuestions?.length || 0,
    },
    guide,
    stageCosts,
    totalCostUsd: totalCost(stageCosts),
    notes: [
      `Nano relevance picked: ${selectedKnownTopics.join(', ') || 'none'}`,
    ],
  }
}

const noQuizMainPrompt = (
  prompt: string,
): string => `Create a lean StudyMesh Study Guide for "${prompt}".

Return strict JSON only:
{
  "title": "...",
  "quickStart": { "keyIdea": "...", "quickSummary": "two short paragraphs separated by a blank line" },
  "pages": [
    { "title": "01 - ...", "rawNotes": "Markdown lesson notes" }
  ]
}

Rules:
- Create exactly 3 pages.
- Do not include any quiz, practice, flashcards, podcast, glossary, supportArtifacts, answer key, or rubric.
- rawNotes must be 220-330 words per page.
- For programming languages, frameworks, CLIs, config tools, APIs, or infrastructure tools, include small fenced code/config blocks when code is the clearest example.
- quickStart must explain the concept itself directly. Do not write "This guide teaches" or "You will learn".
- Make pages useful as teaching content, not outlines.
- Keep claims conservative and beginner-friendly.

Topic: ${prompt}`

const runOption2 = async (prompt: string): Promise<EvalResult> => {
  const option = '2-mini-no-quiz-nano-final-quiz'
  const main = await callModel({
    option,
    stage: 'study_guide_main_no_quiz',
    model: MINI_MODEL,
    prompt: noQuizMainPrompt(prompt),
    schema: strictGuideNoQuizSchema,
  })
  const parsed = parseJson<EvalGuide>(main.text)
  const quiz = await callModel({
    option,
    stage: 'final_quiz_nano',
    model: NANO_MODEL,
    prompt: quizPrompt(prompt, parsed, 6),
    schema: strictQuizSchema,
  })
  const questions = parseJson<{ questions: QuizQuestion[] }>(
    quiz.text,
  ).questions
  const pages = parsed.pages.map((page, index) =>
    index === parsed.pages.length - 1
      ? { ...page, quizQuestions: questions }
      : { ...page, quizQuestions: [] },
  )
  const guide = { ...parsed, pages }
  const stageCosts = [main.cost, quiz.cost]
  const badSmells = quizBadSmellCount(questions)

  return {
    option,
    prompt,
    deterministicChecks: {
      pageCount: guide.pages.length,
      finalQuizQuestions: questions.length,
      quizBadSmellCount: badSmells,
      codeBlockCount: codeBlockCount(guide.pages),
      averagePageWords:
        guide.pages.reduce(
          (total, page) => total + wordCount(page.rawNotes),
          0,
        ) / Math.max(1, guide.pages.length),
    },
    guide,
    stageCosts,
    totalCostUsd: totalCost(stageCosts),
    notes: [
      badSmells
        ? `${badSmells} quiz stems look like literal-recall bad smells.`
        : 'No obvious literal-recall quiz stem bad smells.',
    ],
  }
}

const runOption2Realistic = async ({
  prompt,
  knownTopics,
}: {
  prompt: string
  knownTopics: string[]
}): Promise<EvalResult> => {
  const option = '2-realistic-mini-context-nano-final-quiz'
  const main = await productMainNoQuiz(option, prompt, MINI_MODEL)
  let guide = fromDraft(main.draft)
  guide = {
    ...guide,
    pages: guide.pages.map((page) => ({ ...page, quizQuestions: [] })),
  }
  const support = await runNanoSupport({
    option,
    prompt,
    guide,
    draft: main.draft,
    knownTopics,
    supportModel: MINI_MODEL,
  })
  guide = { ...guide, quickStart: support.quickStart }
  const quiz = await callModel({
    option,
    stage: 'final_quiz_nano',
    model: NANO_MODEL,
    prompt: quizPrompt(prompt, guide, 6),
    schema: strictQuizSchema,
  })
  const questions = parseJson<{ questions: QuizQuestion[] }>(
    quiz.text,
  ).questions
  guide = {
    ...guide,
    pages: guide.pages.map((page, index) =>
      index === guide.pages.length - 1
        ? { ...page, quizQuestions: questions }
        : page,
    ),
  }
  const stageCosts = [...main.stageCosts, ...support.stageCosts, quiz.cost]
  const badSmells = quizBadSmellCount(questions)

  return {
    option,
    prompt,
    knownTopics,
    selectedKnownTopics: support.relevanceDecision.knownTopicsForQuickStart,
    deterministicChecks: {
      pageCount: guide.pages.length,
      bridgeBlockCount: support.bridgeBlockCount,
      finalQuizQuestions: questions.length,
      quizBadSmellCount: badSmells,
      codeBlockCount: codeBlockCount(guide.pages),
      averagePageWords:
        guide.pages.reduce(
          (total, page) => total + wordCount(page.rawNotes),
          0,
        ) / Math.max(1, guide.pages.length),
    },
    guide,
    stageCosts,
    totalCostUsd: totalCost(stageCosts),
    notes: [
      `Mini relevance picked: ${
        support.relevanceDecision.knownTopicsForQuickStart.join(', ') || 'none'
      }`,
      badSmells
        ? `${badSmells} quiz stems look like literal-recall bad smells.`
        : 'No obvious literal-recall quiz stem bad smells.',
    ],
  }
}

const plannerPrompt = (
  prompt: string,
): string => `Plan a high-quality 3-page Study Guide for "${prompt}".

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
- mustCover must contain 5-7 precise bullets per page.
- Own the facts here: later nano calls must follow this plan.
- For technical topics, specify code/config examples where helpful.
- Final page quizSkills should test application/comparison, not copied text.

Topic: ${prompt}`

const writePagePrompt = (
  prompt: string,
  plan: Record<string, unknown>,
  page: Record<string, unknown>,
): string => `Write one Study Guide page from this locked mini plan.

Return strict JSON only:
{ "title": "...", "rawNotes": "Markdown lesson notes" }

Rules:
- Write 260-380 words.
- Use only facts from the plan. Do not add new factual claims.
- Include a fenced code/config block only if codeOrConfigExample asks for it.
- Make it readable, concrete, and beginner-friendly.

Topic: ${prompt}

Full plan:
${JSON.stringify(plan, null, 2)}

Page plan:
${JSON.stringify(page, null, 2)}`

const validatePrompt = (
  prompt: string,
  guide: EvalGuide,
): string => `Judge this generated Study Guide.

Return strict JSON only:
{
  "pass": true,
  "score": 1,
  "issues": ["..."],
  "strengths": ["..."],
  "verdict": "..."
}

Rubric:
- 5: specific, accurate, useful examples, coherent progression, quiz tests application/comparison.
- 4: good, minor issues.
- 3: usable but generic/thin.
- 2: weak, possibly misleading, bad quiz, or poor structure.
- 1: unusable.
- Fail if content invents unsupported facts, quiz asks literal copied sentences, or pages are thin.

Topic: ${prompt}
Guide:
${JSON.stringify(guide, null, 2).slice(0, 22000)}`

const runMiniValidator = async (
  option: string,
  prompt: string,
  guide: EvalGuide,
) => {
  const result = await callModel({
    option,
    stage: 'mini_validator',
    model: MINI_MODEL,
    prompt: validatePrompt(prompt, guide),
    schema: strictValidatorSchema,
  })

  return {
    validator: parseJson<EvalResult['validator']>(result.text),
    cost: result.cost,
  }
}

const runOption3 = async (prompt: string): Promise<EvalResult> => {
  const option = '3-mini-planner-nano-pages-mini-validator'
  const planResult = await callModel({
    option,
    stage: 'mini_planner',
    model: MINI_MODEL,
    prompt: plannerPrompt(prompt),
    schema: strictPlannerSchema,
  })
  const plan = parseJson<{
    title: string
    quickStart: QuickStart
    pages: Record<string, unknown>[]
  }>(planResult.text)
  const pageCosts: StageCost[] = []
  const pages: EvalPage[] = []

  for (const [index, pagePlan] of plan.pages.entries()) {
    const page = await callModel({
      option,
      stage: `nano_page_${index + 1}`,
      model: NANO_MODEL,
      prompt: writePagePrompt(prompt, plan, pagePlan),
      schema: strictPageSchema,
    })
    pageCosts.push(page.cost)
    pages.push({ ...parseJson<EvalPage>(page.text), quizQuestions: [] })
  }

  const guideWithoutQuiz = {
    title: plan.title,
    quickStart: plan.quickStart,
    pages,
  }
  const quiz = await callModel({
    option,
    stage: 'nano_final_quiz',
    model: NANO_MODEL,
    prompt: quizPrompt(prompt, guideWithoutQuiz, 6),
    schema: strictQuizSchema,
  })
  const questions = parseJson<{ questions: QuizQuestion[] }>(
    quiz.text,
  ).questions
  const guide = {
    ...guideWithoutQuiz,
    pages: pages.map((page, index) =>
      index === pages.length - 1 ? { ...page, quizQuestions: questions } : page,
    ),
  }
  const validation = await runMiniValidator(option, prompt, guide)
  const stageCosts = [planResult.cost, ...pageCosts, quiz.cost, validation.cost]

  return {
    option,
    prompt,
    validator: validation.validator,
    deterministicChecks: {
      pageCount: guide.pages.length,
      finalQuizQuestions: questions.length,
      quizBadSmellCount: quizBadSmellCount(questions),
      codeBlockCount: codeBlockCount(guide.pages),
      averagePageWords:
        guide.pages.reduce(
          (total, page) => total + wordCount(page.rawNotes),
          0,
        ) / Math.max(1, guide.pages.length),
    },
    guide,
    stageCosts,
    totalCostUsd: totalCost(stageCosts),
    notes: ['Qualifier run includes mini validation, but no repair pass yet.'],
  }
}

const blueprintPrompt = (
  prompt: string,
): string => `Create a compact factual blueprint for a 3-page Study Guide about "${prompt}".

Return strict JSON only:
{
  "title": "...",
  "quickStart": { "keyIdea": "...", "quickSummary": "two short paragraphs" },
  "pages": [
    {
      "title": "01 - ...",
      "keyFacts": ["fact"],
      "conciseNotes": "80-120 words",
      "examplesNeeded": ["example"],
      "quizSkills": ["skill"]
    }
  ]
}

Rules:
- Exactly 3 pages.
- keyFacts must contain 6-8 precise facts per page.
- conciseNotes must be enough to anchor later expansion.
- For technical topics, include exact examples/config/code ideas in examplesNeeded.
- Do not include a quiz here.

Topic: ${prompt}`

const expandPagePrompt = (
  prompt: string,
  blueprint: Record<string, unknown>,
  page: Record<string, unknown>,
): string => `Expand one Study Guide page using only this mini-authored blueprint.

Return strict JSON only:
{ "title": "...", "rawNotes": "Markdown lesson notes" }

Rules:
- Write 280-400 words.
- Do not add facts not present or directly implied by keyFacts/conciseNotes/examplesNeeded.
- Add connective explanation, examples, and learner-friendly structure.
- Include fenced code/config only when examplesNeeded calls for it.

Topic: ${prompt}

Full blueprint:
${JSON.stringify(blueprint, null, 2)}

Page blueprint:
${JSON.stringify(page, null, 2)}`

const runOption4 = async (prompt: string): Promise<EvalResult> => {
  const option = '4-mini-blueprint-nano-expansion'
  const blueprintResult = await callModel({
    option,
    stage: 'mini_blueprint',
    model: MINI_MODEL,
    prompt: blueprintPrompt(prompt),
    schema: strictBlueprintSchema,
  })
  const blueprint = parseJson<{
    title: string
    quickStart: QuickStart
    pages: Record<string, unknown>[]
  }>(blueprintResult.text)
  const pageCosts: StageCost[] = []
  const pages: EvalPage[] = []

  for (const [index, pageBlueprint] of blueprint.pages.entries()) {
    const page = await callModel({
      option,
      stage: `nano_expand_page_${index + 1}`,
      model: NANO_MODEL,
      prompt: expandPagePrompt(prompt, blueprint, pageBlueprint),
      schema: strictPageSchema,
    })
    pageCosts.push(page.cost)
    pages.push({ ...parseJson<EvalPage>(page.text), quizQuestions: [] })
  }

  const guideWithoutQuiz = {
    title: blueprint.title,
    quickStart: blueprint.quickStart,
    pages,
  }
  const quiz = await callModel({
    option,
    stage: 'nano_final_quiz',
    model: NANO_MODEL,
    prompt: quizPrompt(prompt, guideWithoutQuiz, 6),
    schema: strictQuizSchema,
  })
  const questions = parseJson<{ questions: QuizQuestion[] }>(
    quiz.text,
  ).questions
  const guide = {
    ...guideWithoutQuiz,
    pages: pages.map((page, index) =>
      index === pages.length - 1 ? { ...page, quizQuestions: questions } : page,
    ),
  }
  const stageCosts = [blueprintResult.cost, ...pageCosts, quiz.cost]

  return {
    option,
    prompt,
    deterministicChecks: {
      pageCount: guide.pages.length,
      finalQuizQuestions: questions.length,
      quizBadSmellCount: quizBadSmellCount(questions),
      codeBlockCount: codeBlockCount(guide.pages),
      averagePageWords:
        guide.pages.reduce(
          (total, page) => total + wordCount(page.rawNotes),
          0,
        ) / Math.max(1, guide.pages.length),
    },
    guide,
    stageCosts,
    totalCostUsd: totalCost(stageCosts),
    notes: [
      'Nano expansion constrained to mini-authored facts; no mini validator in this option.',
    ],
  }
}

const deterministicDraftPass = (guide: EvalGuide): boolean => {
  const finalQuizCount = guide.pages.at(-1)?.quizQuestions?.length || 0
  const averageWords =
    guide.pages.reduce((total, page) => total + wordCount(page.rawNotes), 0) /
    Math.max(1, guide.pages.length)

  return guide.pages.length === 3 && finalQuizCount >= 3 && averageWords >= 150
}

const runOption5 = async (prompt: string): Promise<EvalResult> => {
  const option = '5-nano-draft-mini-judge-fallback'
  const stageCosts: StageCost[] = []
  const notes: string[] = []
  let guide: EvalGuide | null = null
  let validator: EvalResult['validator'] | undefined
  let usedFallback = false

  try {
    const nano = await productMain(option, prompt, NANO_MODEL)
    stageCosts.push(...nano.stageCosts)
    guide = fromDraft(nano.draft)
    const validation = await runMiniValidator(option, prompt, guide)
    validator = validation.validator
    stageCosts.push(validation.cost)

    if (
      !deterministicDraftPass(guide) ||
      !validator?.pass ||
      validator.score < 4
    ) {
      notes.push(
        'Nano draft failed deterministic or mini-judge quality threshold.',
      )
      usedFallback = true
    }
  } catch (error) {
    notes.push(`Nano draft threw: ${(error as Error).message.slice(0, 220)}`)
    usedFallback = true
  }

  if (usedFallback) {
    const fallback = await productMain(option, prompt, MINI_MODEL)
    stageCosts.push(...fallback.stageCosts)
    guide = fromDraft(fallback.draft)
  }

  if (!guide) {
    throw new Error('Option 5 produced no guide')
  }

  return {
    option,
    prompt,
    usedFallback,
    validator,
    deterministicChecks: {
      pageCount: guide.pages.length,
      finalQuizQuestions: guide.pages.at(-1)?.quizQuestions?.length || 0,
      codeBlockCount: codeBlockCount(guide.pages),
      averagePageWords:
        guide.pages.reduce(
          (total, page) => total + wordCount(page.rawNotes),
          0,
        ) / Math.max(1, guide.pages.length),
    },
    guide,
    stageCosts,
    totalCostUsd: totalCost(stageCosts),
    notes,
  }
}

const routerRoute = (prompt: string): string => {
  const lower = prompt.toLowerCase()

  if (
    /(roman|history|empire|war|medical|legal|current|election|science)/.test(
      lower,
    )
  ) {
    return 'mini-main-safe'
  }

  if (
    /(terraform|helm|vue|angular|docker|react|api|framework|code|cli)/.test(
      lower,
    )
  ) {
    return 'mini-blueprint-nano-expansion'
  }

  return 'mini-main-safe'
}

const runOption6 = async (prompt: string): Promise<EvalResult> => {
  const route = routerRoute(prompt)

  if (route === 'mini-blueprint-nano-expansion') {
    const result = await runOption4(prompt)
    return {
      ...result,
      option: '6-router-by-topic',
      route,
      stageCosts: result.stageCosts.map((cost) => ({
        ...cost,
        option: '6-router-by-topic',
      })),
      notes: [
        `Router chose ${route} for this technical/basic-tool prompt.`,
        ...result.notes,
      ],
    }
  }

  const option = '6-router-by-topic'
  const main = await productMain(option, prompt, MINI_MODEL)
  const guide = fromDraft(main.draft)

  return {
    option,
    prompt,
    route,
    deterministicChecks: {
      pageCount: guide.pages.length,
      finalQuizQuestions: guide.pages.at(-1)?.quizQuestions?.length || 0,
      codeBlockCount: codeBlockCount(guide.pages),
      averagePageWords:
        guide.pages.reduce(
          (total, page) => total + wordCount(page.rawNotes),
          0,
        ) / Math.max(1, guide.pages.length),
    },
    guide,
    stageCosts: main.stageCosts,
    totalCostUsd: totalCost(main.stageCosts),
    notes: [`Router chose ${route}.`],
  }
}

const summarize = (results: EvalResult[]) =>
  results.map((result) => ({
    option: result.option,
    prompt: result.prompt,
    totalCostUsd: result.totalCostUsd,
    selectedKnownTopics: result.selectedKnownTopics,
    selectedExpectedTopic: result.selectedExpectedTopic,
    route: result.route,
    usedFallback: result.usedFallback,
    validatorScore: result.validator?.score,
    validatorPass: result.validator?.pass,
    deterministicChecks: result.deterministicChecks,
    notes: result.notes,
    stageCosts: result.stageCosts.map((cost) => ({
      stage: cost.stage,
      model: cost.model,
      costUsd: cost.costUsd,
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
    })),
  }))

const main = async () => {
  const results: EvalResult[] = []
  const mode = process.env.HYBRID_EVAL_MODE || 'all'

  if (mode === 'option2-realistic') {
    results.push(
      await runOption2Realistic({
        prompt: 'What is Vue?',
        knownTopics: ['React'],
      }),
    )
    results.push(
      await runOption2Realistic({
        prompt: 'What is Terraform?',
        knownTopics: ['Rundeck', 'Docker', 'MinIO/S3', 'Ansible'],
      }),
    )
  } else {
    results.push(
      await runOption1(
        'What is Terraform?',
        ['Rundeck', 'Docker', 'MinIO/S3', 'Ansible'],
        'Ansible',
      ),
    )
    results.push(
      await runOption1(
        'What is Helm?',
        ['Docker', 'Terraform', 'Kubernetes', 'Ansible'],
        'Kubernetes',
      ),
    )

    results.push(await runOption2('What is Vue?'))
    results.push(await runOption2('Basics of photography'))

    const qualifierPrompt = 'What is Terraform?'
    results.push(await runOption3(qualifierPrompt))
    results.push(await runOption4(qualifierPrompt))
    results.push(await runOption5(qualifierPrompt))
    results.push(await runOption6(qualifierPrompt))
  }

  const payload = {
    createdAt: new Date().toISOString(),
    models: { mini: MINI_MODEL, nano: NANO_MODEL },
    summary: summarize(results),
    results,
  }
  const outputPath = resolve(
    process.cwd(),
    mode === 'option2-realistic'
      ? 'apps/studymesh/evals/study-guide-option2-realistic-results.json'
      : 'apps/studymesh/evals/study-guide-hybrid-results.json',
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
