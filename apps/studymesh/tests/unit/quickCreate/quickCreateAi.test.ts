import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hostedAiClientMock = vi.hoisted(() => ({
  callHostedAiModel: vi.fn(),
  generateHostedAiPodcast: vi.fn(),
  getHostedAiPodcastAudioUrl: vi.fn(),
  getHostedAiStatus: vi.fn(),
  markHostedAiIntroSeen: vi.fn(),
}))

vi.mock('../../../src/quickCreate/ai/hostedClient', () => ({
  callHostedAiModel: hostedAiClientMock.callHostedAiModel,
  createHostedAiTransport:
    ({ surface }: { surface: string }) =>
    (options: {
      model: string
      parts: Array<{ text?: string }>
      responseSchema?: Record<string, unknown>
      timeoutMs: number
    }) =>
      hostedAiClientMock.callHostedAiModel({
        surface,
        ...options,
      }),
  createHostedStudyGuideTransportWithQuickStart:
    ({
      onQuickStart,
    }: {
      onQuickStart: (quickStart: {
        keyIdea: string
        quickSummary: string
      }) => void
    }) =>
    async (options: {
      model: string
      parts: Array<{ text?: string }>
      responseSchema?: Record<string, unknown>
      timeoutMs: number
    }) => {
      const text = await hostedAiClientMock.callHostedAiModel({
        surface: 'study-guide',
        ...options,
      })
      onQuickStart({
        keyIdea: 'A short guide-wide key idea.',
        quickSummary: 'A short guide-wide quick summary.',
      })
      return text
    },
  getHostedAiStatus: hostedAiClientMock.getHostedAiStatus,
  generateHostedAiPodcast: hostedAiClientMock.generateHostedAiPodcast,
  getHostedAiPodcastAudioUrl: hostedAiClientMock.getHostedAiPodcastAudioUrl,
  markHostedAiIntroSeen: hostedAiClientMock.markHostedAiIntroSeen,
}))

import {
  callLocalLanguageModel,
  DEFAULT_QUICK_CREATE_AI_MODEL,
  generateStudyPathWithLocalAi,
  generateQuickCreateWithAi as generateQuickCreateWithProvider,
  generateStudyPathWithAi as generateStudyPathWithProvider,
  generateQuickCreateWithGemini as generateQuickCreateWithAi,
  generateStudyPathWithGemini as generateStudyPathWithAi,
  isLocalAiGenerationError,
  applyStudyMaterialResourceTypeToDraft,
  DEFAULT_HOSTED_AI_CREDIT_PACK_ID,
  getHostedAiCreditCost,
  HOSTED_AI_CREDIT_PACKS,
  HOSTED_AI_CREDIT_COSTS,
  HOSTED_AI_INITIAL_FREE_CREDITS,
  HOSTED_AI_REFILL_CURRENCY,
  STUDY_CREDITS_LABEL,
  normalizeAiQuickCreateDraft,
  normalizeLocalAiQuickCreateDraft,
  parseLocalAiJson,
  readQuickCreateAiSettings,
  resetLocalLanguageModelCooldownForTests,
  resolveQuickCreateAiCredentials,
  saveQuickCreateAiSettings,
  QUICK_CREATE_AI_SETTINGS_KEY,
  testLocalLanguageModel,
  clearQuickCreateAiToken,
  saveQuickCreateAiSessionKey,
} from '../../../src/quickCreate/ai'
import {
  createApplicationQuestion,
  extractLearningConcepts,
} from '../../../src/quickCreate/concepts'
import type { LearningConcept } from '../../../src/quickCreate/concepts'

const QUICK_CREATE_AI_SESSION_KEY = 'studymesh-quick-create-ai-session-keys-v1'

const localStudyPathPlanJson = (
  count: number,
  title = 'Italian B1',
  folderName = title,
) =>
  JSON.stringify({
    title,
    folderName,
    dashboards: Array.from({ length: count }, (_, index) => ({
      title: `${String(index + 1).padStart(2, '0')} - Lesson ${index + 1}`,
      goal: `Teach lesson ${index + 1}.`,
      sections: [
        {
          title: `Section ${index + 1}A`,
          goal: `Explain lesson ${index + 1} core ideas.`,
          focus: `Seed ${index + 1}A1; Seed ${index + 1}A2; Seed ${
            index + 1
          }A3`,
        },
        {
          title: `Section ${index + 1}B`,
          goal: `Show lesson ${index + 1} examples and mistakes.`,
          focus: `Seed ${index + 1}B1; Seed ${index + 1}B2; Seed ${
            index + 1
          }B3`,
        },
      ],
      topics: [`Topic ${index + 1}`, `Practice ${index + 1}`],
      avoid: 'summary dashboard; exercises-only dashboard',
    })),
  })

const localStudyPathPracticeJson = (
  index: number,
  topic = `Lesson ${index}`,
  options = ['Correct answer', 'Wrong answer', 'Unrelated answer'],
) =>
  JSON.stringify({
    flashcards: [
      {
        question: `What is ${topic} useful for?`,
        answer: `${topic} helps learners produce clearer sentences.`,
      },
      {
        question: `How should students practice ${topic}?`,
        answer: `Students should practice ${topic} in realistic phrases.`,
      },
    ],
    quizzes: [
      {
        question: `Which option fits ${topic}?`,
        options,
        correctIndex: 0,
      },
    ],
  })

const localStudyPathMarkdownSection = (
  heading: string,
  focus: string,
) => `## ${heading}

### Core meanings
- **Meaning**: ${focus} gives learners a clear phrase to recognize and reuse.
- **Register**: choose informal language with friends and formal language with teachers, staff, or older adults.
- **Timing**: match greetings to the moment, especially morning, afternoon, evening, and leaving.

### When to use each one
- Use short phrases for quick contact.
- Use full phrases when you need clarity.
- Repeat examples aloud before changing names, places, or times.`

const localStudyPathMarkdownFromPrompt = (
  promptText: string,
  focus = 'Study notes',
): string => {
  const heading =
    promptText.match(/Start exactly with this heading:\s*\n(## .+)/)?.[1] ||
    `## ${focus}`

  return `${heading}

### Core meanings
- **Meaning**: ${focus} gives learners a clear pattern for realistic study tasks.
- **Register**: choose the form that fits the audience and setting.
- **Timing**: connect the idea to the right moment.

### When to use each one
- Use short examples first, then adapt them with new details.
- Compare a correct version with one likely mistake.
- Keep practice focused on the current topic before mixing older material.`
}

describe('quick create AI settings', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {}
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage[key] ?? null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value
      },
    )
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete storage[key]
    })
    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage = {}
    })
    localStorage.clear()
    sessionStorage.clear()
    delete process.env.GEMINI_API_KEY
    delete process.env.CEREBRAS_API_KEY
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses default model and no token when settings are empty', () => {
    expect(readQuickCreateAiSettings()).toEqual({
      provider: 'hosted',
      apiToken: '',
      model: DEFAULT_QUICK_CREATE_AI_MODEL,
      strongProviders: {
        gemini: {
          apiToken: '',
          model: 'gemini-2.5-flash',
        },
        cerebras: {
          apiToken: '',
          model: 'gpt-oss-120b',
        },
      },
    })
    expect(resolveQuickCreateAiCredentials()).toMatchObject({
      tokenSource: 'none',
    })
  })

  it('keeps hosted Study Credits costs in the shared contract', () => {
    expect(STUDY_CREDITS_LABEL).toBe('Study Credits')
    expect(HOSTED_AI_INITIAL_FREE_CREDITS).toBe(20)
    expect(HOSTED_AI_REFILL_CURRENCY).toBe('eur')
    expect(DEFAULT_HOSTED_AI_CREDIT_PACK_ID).toBe('popular')
    expect(HOSTED_AI_CREDIT_PACKS).toEqual([
      {
        id: 'starter',
        credits: 80,
        priceCents: 200,
        currency: 'eur',
        label: '2 EUR',
        badge: 'Economic',
      },
      {
        id: 'popular',
        credits: 250,
        priceCents: 500,
        currency: 'eur',
        label: '5 EUR',
        badge: 'Most popular',
      },
      {
        id: 'value',
        credits: 600,
        priceCents: 1000,
        currency: 'eur',
        label: '10 EUR',
        badge: 'Best value',
      },
    ])
    expect(HOSTED_AI_CREDIT_COSTS).toEqual({
      'study-guide': 2,
      'quick-create': 1,
      chat: 1,
      podcast: 1,
    })
    expect(getHostedAiCreditCost('study-guide')).toBe(2)
    expect(getHostedAiCreditCost('podcast')).toBe(1)
  })

  it('routes hosted Quick Create through the hosted gateway without a browser API key', async () => {
    const hostedDraft = {
      sourceSummary: {
        title: 'Photosynthesis summary',
        bullets: ['Plants convert light into chemical energy.'],
      },
      conceptRecap: {
        title: 'Photosynthesis concepts',
        sections: [
          {
            title: 'Light energy conversion',
            bullets: ['Chloroplasts help convert light into stored energy.'],
            example: 'A plant leaf uses sunlight to make sugars.',
          },
        ],
      },
      practice: {
        multipleChoice: [
          {
            question: 'What does photosynthesis store?',
            options: ['Light energy as chemical energy', 'Sound', 'Heat only'],
            correctIndex: 0,
            explanation: 'Photosynthesis stores energy in sugars.',
          },
        ],
      },
      flashcards: [
        {
          front: 'What is photosynthesis?',
          back: 'A process that converts light into stored chemical energy.',
        },
      ],
    }
    hostedAiClientMock.callHostedAiModel.mockResolvedValue(
      JSON.stringify(hostedDraft),
    )

    const draft = await generateQuickCreateWithProvider({
      provider: 'hosted',
      apiToken: '',
      model: '',
      title: 'Photosynthesis',
      rawNotes: 'Photosynthesis turns light into chemical energy.',
      packId: 'photosynthesis',
    })

    expect(hostedAiClientMock.callHostedAiModel).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: 'quick-create',
        model: expect.any(String),
        parts: expect.any(Array),
        responseSchema: expect.any(Object),
        timeoutMs: expect.any(Number),
      }),
    )
    const request = hostedAiClientMock.callHostedAiModel.mock.calls[0][0]
    expect(JSON.stringify(request.parts)).not.toContain('inline_data')
    expect(draft.title).toBe('Photosynthesis')
  })

  it('routes hosted Study Guide through the hosted gateway without a browser API key', async () => {
    const hostedPathDraft = {
      title: 'Algebra Study Guide',
      folderName: 'Algebra Study Guide',
      dashboards: [
        {
          title: '01 - Linear equations',
          summary: 'Linear equations preview',
          rawNotes:
            'Linear equations lesson notes explain solving one-variable equations with examples and common mistakes.',
          sourceSummary: {
            title: 'Linear equations source summary',
            bullets: ['Linear equations balance both sides.'],
          },
          conceptRecap: {
            title: 'Linear equations concept recap',
            sections: [
              {
                title: 'Balance rule',
                bullets: ['Apply the same operation to both sides.'],
                example: 'x + 2 = 5 becomes x = 3.',
              },
            ],
          },
          practice: {
            shortAnswer: [
              {
                question: 'How do you solve x + 2 = 5?',
                expectedAnswer: 'Subtract 2 from both sides.',
                explanation: 'Inverse operations isolate x.',
              },
            ],
            multipleChoice: [
              {
                question: 'What is x if x + 2 = 5?',
                options: ['3', '2', '7'],
                correctOptionIndex: 0,
                explanation: 'Subtract 2 from both sides.',
              },
            ],
          },
          flashcards: [
            {
              front: 'What keeps an equation balanced?',
              back: 'Doing the same operation to both sides.',
            },
          ],
        },
      ],
    }
    hostedAiClientMock.callHostedAiModel.mockResolvedValue(
      JSON.stringify(hostedPathDraft),
    )

    const draft = await generateStudyPathWithProvider({
      provider: 'hosted',
      apiToken: '',
      model: '',
      title: 'Algebra',
      prompt: 'Teach me linear equations',
      folderName: '',
      generationAmount: 'few',
    })

    expect(hostedAiClientMock.callHostedAiModel).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: 'study-guide',
        model: expect.any(String),
        parts: expect.any(Array),
        responseSchema: expect.any(Object),
      }),
    )
    expect(hostedAiClientMock.callHostedAiModel).toHaveBeenCalledTimes(1)
    const request = hostedAiClientMock.callHostedAiModel.mock.calls[0][0]
    const promptText = request.parts[0].text
    expect(promptText).toContain('"quickStart"')
    expect(promptText).toContain(
      'Lean hosted profile: create exactly 3 dashboards',
    )
    expect(promptText).toContain('rawNotes must be 180-260 words')
    expect(promptText).toContain(
      'final dashboard must include exactly 3 multiple-choice questions',
    )
    expect(promptText).toContain(
      'base guide must not include flashcards, podcast material, supportArtifacts',
    )
    expect(promptText).toContain('"flashcards": []')
    expect(promptText).not.toContain('"front": "..."')
    expect(promptText).not.toContain('"supportArtifacts": {')
    expect(draft.title).toBe('Algebra Study Guide')
  })

  it('prefers settings token over env token', () => {
    process.env.GEMINI_API_KEY = 'env-token'
    saveQuickCreateAiSettings({
      provider: 'gemini',
      apiToken: 'settings-token',
      model: 'gemini-test',
      strongProviders: {},
    })

    expect(storage[QUICK_CREATE_AI_SETTINGS_KEY]).not.toContain(
      'settings-token',
    )
    expect(sessionStorage.getItem(QUICK_CREATE_AI_SESSION_KEY)).toContain(
      'settings-token',
    )
    expect(resolveQuickCreateAiCredentials()).toMatchObject({
      provider: 'gemini',
      apiToken: 'settings-token',
      model: 'gemini-test',
      tokenSource: 'settings',
    })
  })

  it('falls back to env token when settings token is empty', () => {
    process.env.GEMINI_API_KEY = 'env-token'
    saveQuickCreateAiSettings({
      provider: 'gemini',
      apiToken: '',
      model: 'gemini-test',
      strongProviders: {},
    })

    expect(resolveQuickCreateAiCredentials()).toMatchObject({
      provider: 'gemini',
      apiToken: 'env-token',
      model: 'gemini-test',
      tokenSource: 'env',
    })
  })

  it('keeps Gemini and Cerebras credentials separate', () => {
    saveQuickCreateAiSettings({
      provider: 'gemini',
      apiToken: 'gemini-token',
      model: 'gemini-test',
      strongProviders: {},
    })
    saveQuickCreateAiSettings({
      ...readQuickCreateAiSettings(),
      provider: 'cerebras',
      apiToken: 'cerebras-token',
      model: 'gpt-oss-120b',
    })

    const settings = readQuickCreateAiSettings()
    expect(settings.strongProviders.gemini).toEqual({
      apiToken: 'gemini-token',
      model: 'gemini-test',
    })
    expect(settings.strongProviders.cerebras).toEqual({
      apiToken: 'cerebras-token',
      model: 'gpt-oss-120b',
    })
    expect(resolveQuickCreateAiCredentials('cerebras')).toMatchObject({
      provider: 'cerebras',
      apiToken: 'cerebras-token',
      model: 'gpt-oss-120b',
      tokenSource: 'settings',
    })
  })

  it('migrates legacy localStorage tokens into sessionStorage and strips local storage', () => {
    storage[QUICK_CREATE_AI_SETTINGS_KEY] = JSON.stringify({
      provider: 'cerebras',
      apiToken: 'legacy-gemini-token',
      model: 'gemini-legacy',
      strongProviders: {
        cerebras: {
          apiToken: 'legacy-cerebras-token',
          model: 'cerebras-legacy',
        },
      },
    })

    const settings = readQuickCreateAiSettings()

    expect(settings).toMatchObject({
      provider: 'cerebras',
      apiToken: 'legacy-cerebras-token',
      model: 'cerebras-legacy',
    })
    expect(storage[QUICK_CREATE_AI_SETTINGS_KEY]).not.toContain(
      'legacy-gemini-token',
    )
    expect(storage[QUICK_CREATE_AI_SETTINGS_KEY]).not.toContain(
      'legacy-cerebras-token',
    )
    expect(sessionStorage.getItem(QUICK_CREATE_AI_SESSION_KEY)).toContain(
      'legacy-cerebras-token',
    )
  })

  it('keeps missing selected strong provider credentials empty until a session key is saved', () => {
    saveQuickCreateAiSettings({
      provider: 'cerebras',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })

    expect(resolveQuickCreateAiCredentials('cerebras')).toMatchObject({
      provider: 'cerebras',
      apiToken: '',
      model: 'gpt-oss-120b',
      tokenSource: 'none',
    })

    saveQuickCreateAiSessionKey(
      'cerebras',
      'session-cerebras-token',
      'gpt-oss-120b',
    )

    expect(resolveQuickCreateAiCredentials('cerebras')).toMatchObject({
      provider: 'cerebras',
      apiToken: 'session-cerebras-token',
      model: 'gpt-oss-120b',
      tokenSource: 'settings',
    })
    expect(storage[QUICK_CREATE_AI_SETTINGS_KEY]).not.toContain(
      'session-cerebras-token',
    )
    expect(sessionStorage.getItem(QUICK_CREATE_AI_SESSION_KEY)).toContain(
      'session-cerebras-token',
    )
  })

  it('clears only the selected provider session key', () => {
    saveQuickCreateAiSettings({
      provider: 'gemini',
      apiToken: 'gemini-session-token',
      model: 'gemini-test',
      strongProviders: {},
    })
    saveQuickCreateAiSettings({
      ...readQuickCreateAiSettings(),
      provider: 'cerebras',
      apiToken: 'cerebras-session-token',
      model: 'gpt-oss-120b',
    })

    clearQuickCreateAiToken()

    expect(resolveQuickCreateAiCredentials('cerebras')).toMatchObject({
      apiToken: '',
      tokenSource: 'none',
    })
    expect(resolveQuickCreateAiCredentials('gemini')).toMatchObject({
      apiToken: 'gemini-session-token',
      tokenSource: 'settings',
    })
    expect(storage[QUICK_CREATE_AI_SETTINGS_KEY]).not.toContain('session-token')
  })

  it('falls back to Cerebras env token for Cerebras provider', () => {
    process.env.CEREBRAS_API_KEY = 'cerebras-env-token'
    saveQuickCreateAiSettings({
      provider: 'cerebras',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })

    expect(resolveQuickCreateAiCredentials('cerebras')).toMatchObject({
      provider: 'cerebras',
      apiToken: 'cerebras-env-token',
      model: 'gpt-oss-120b',
      tokenSource: 'env',
    })
  })
})

describe('quick create AI normalizer', () => {
  const strictContract = {
    title: 'French Subjunctive',
    sourceSummary: {
      title: 'Subjunctive summary',
      bullets: ['Use the subjunctive after triggers like il faut que.'],
    },
    conceptRecap: {
      title: 'Concept recap',
      sections: [
        {
          title: 'Subjunctive trigger: il faut que',
          bullets: ['Il faut que introduces a required action.'],
          example: 'Il faut que nous partions.',
        },
      ],
    },
    practice: {
      shortAnswer: [
        {
          question: 'Complete: Il faut que nous ___ tôt.',
          expectedAnswer: 'partions',
          explanation: 'Il faut que triggers the subjunctive.',
        },
      ],
      multipleChoice: [
        {
          question:
            'Which conjunction normally requires the subjunctive in French?',
          options: ['bien que', 'parce que', 'puisque'],
          correctOptionIndex: 0,
          explanation: 'Bien que introduces concession and uses subjunctive.',
        },
      ],
    },
    flashcards: [
      {
        front: 'What mood follows il faut que?',
        back: 'The subjunctive.',
      },
    ],
  }

  it('maps a strict AI contract and drops invalid nested items', () => {
    const draft = normalizeAiQuickCreateDraft(
      {
        title: 'Cell Biology',
        sourceSummary: {
          title: 'Cell summary',
          bullets: ['Cells carry DNA', 'Cells carry DNA'],
        },
        conceptRecap: {
          title: 'Concept recap',
          sections: [
            {
              title: 'Cell structure',
              bullets: ['Cells store genetic information in DNA.'],
              example: 'A skin cell contains DNA.',
            },
          ],
        },
        practice: {
          shortAnswer: [
            {
              question:
                'How would you identify the molecule that stores inherited traits?',
              expectedAnswer: 'Look for DNA.',
              explanation: 'DNA carries genetic information.',
            },
          ],
          multipleChoice: [
            {
              question:
                'Which structure stores inherited information in a cell?',
              options: ['DNA', 'Glucose', 'Water', 'DNA'],
              correctOptionIndex: 0,
              explanation: 'DNA carries genetic information.',
            },
            {
              question: 'What does DNA help you understand?',
              options: ['DNA', 'Glucose', 'Water'],
              correctOptionIndex: 0,
              explanation: 'Generic prompt should be dropped.',
            },
          ],
        },
        flashcards: [{ front: 'What stores inherited traits?', back: 'DNA' }],
      },
      'cell-biology',
    )

    expect(draft.sourceSummary).toEqual({
      title: 'Cell summary',
      bullets: ['Cells carry DNA'],
    })
    expect(draft.objects).toHaveLength(3)
    expect(draft.objects[0]).toMatchObject({
      kind: 'list',
      title: 'Cell structure',
    })
    expect(draft.objects[1]).toMatchObject({
      kind: 'quiz',
      quizMode: 'multipleChoice',
      answer: 'DNA',
      options: ['DNA', 'Glucose', 'Water'],
    })
    expect(draft.objects[2]).toMatchObject({
      kind: 'qa',
      question: 'What stores inherited traits?',
      answer: 'DNA',
    })
    expect(draft.debugTrace?.droppedOrRepairedItems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('removed duplicate options'),
        expect.stringContaining('Dropped multipleChoice 2'),
      ]),
    )
  })

  it('rejects loose AI objects instead of guessing kinds', () => {
    const draft = normalizeAiQuickCreateDraft(
      {
        title: 'Loose',
        objects: [{ kind: 'flashcard', front: 'A', back: 'B' }],
      },
      'loose',
    )

    expect(draft.objects).toEqual([])
    expect(draft.warnings).toEqual([
      'AI response did not match the strict Quick Create schema.',
    ])
    expect(draft.debugTrace?.validatedContract).toBeNull()
  })

  it('enforces summary dashboards as recap-only', () => {
    const draft = normalizeAiQuickCreateDraft(strictContract, 'summary-pack', {
      dashboardRole: 'summary',
    })

    expect(draft.dashboardRole).toBe('summary')
    expect(draft.objects.map((object) => object.kind)).toEqual(['list'])
    expect(JSON.stringify(draft.objects)).not.toContain('QuizBlock')
    expect(draft.debugTrace?.droppedOrRepairedItems).toEqual(
      expect.arrayContaining([
        'Dropped practice: summary dashboards are recap-only.',
        'Dropped flashcards: summary dashboards are recap-only.',
      ]),
    )
  })

  it('enforces exercises dashboards as practice-only', () => {
    const draft = normalizeAiQuickCreateDraft(strictContract, 'exercise-pack', {
      dashboardRole: 'exercises',
    })

    expect(draft.dashboardRole).toBe('exercises')
    expect(draft.objects.map((object) => object.kind)).toEqual(['quiz', 'qa'])
    expect(draft.objects).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'list' })]),
    )
    expect(draft.debugTrace?.droppedOrRepairedItems).toContain(
      'Dropped conceptRecap: exercises dashboards are practice-only.',
    )
  })

  it('filters normalized drafts to the selected Quick Create resource type', () => {
    const draft = normalizeAiQuickCreateDraft(strictContract, 'resource-pack', {
      rawNotes:
        'Il faut que triggers the subjunctive and students should practice the rule.',
    })

    const improvedNotes = applyStudyMaterialResourceTypeToDraft(
      draft,
      'resource-pack',
      'improvedNotes',
    )
    expect(improvedNotes.objects).toEqual([
      expect.objectContaining({
        kind: 'markdown',
        title: 'Expand on this',
        markdown: expect.stringContaining('Subjunctive trigger: il faut que'),
      }),
    ])

    const flashcards = applyStudyMaterialResourceTypeToDraft(
      draft,
      'resource-pack',
      'flashcards',
    )
    expect(flashcards.objects.map((object) => object.kind)).toEqual(['qa'])

    const quiz = applyStudyMaterialResourceTypeToDraft(
      draft,
      'resource-pack',
      'quiz',
    )
    expect(quiz.objects.map((object) => object.kind)).toEqual(['quiz'])
  })
})

describe('local AI helpers', () => {
  afterEach(() => {
    resetLocalLanguageModelCooldownForTests()
    vi.useRealTimers()
  })

  it('repairs loose local AI objects without changing Gemini strict behavior', () => {
    const parsed = parseLocalAiJson(`\`\`\`json
{"title":"Local","objects":[
  {"kind":"markdown","title":"Intro","content":"# Intro"},
  {"kind":"list","title":"Steps","content":"First\\nSecond"},
  {"kind":"reviewPrompt","title":"Review this later"},
  {"kind":"term","title":"Mitosis","answer":"Cell division"},
  {"kind":"qa","question":"What divides?","answer":"Cells"},
  {"kind":"quiz","question":"Which is correct?","quizMode":"multipleChoice","options":["A","B","C"],"correctIndex":1,"explanation":"B works"}
]}
\`\`\``)

    const draft = normalizeLocalAiQuickCreateDraft(parsed, 'local')

    expect(draft.objects.map((object) => object.kind)).toEqual([
      'markdown',
      'list',
      'reviewPrompt',
      'term',
      'qa',
      'quiz',
    ])
    expect(draft.debugTrace?.droppedOrRepairedItems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Repaired markdown'),
        expect.stringContaining('Repaired list'),
        expect.stringContaining('Repaired reviewPrompt'),
      ]),
    )
    expect(draft.debugTrace?.validatedContract).not.toBeNull()
  })

  it('repairs local concept contracts and drops weak generated practice', () => {
    const draft = normalizeLocalAiQuickCreateDraft(
      {
        title: 'Atomic theories',
        summary: { content: 'Atomic theory changed through evidence.' },
        sourceSummary: [
          'Dalton proposed atoms as tiny indivisible particles.',
          'Rutherford used gold foil evidence for the nucleus.',
        ],
        concepts: [
          {
            concept: 'Dalton atomic theory',
            definition: 'Dalton proposed that matter is made of atoms.',
            keyFact: 'Atoms combine in fixed ratios.',
            sourcePhrase: 'Dalton proposed atoms.',
          },
          {
            concept: 'target rule formation rule',
            definition: 'Bad generated label.',
          },
        ],
        quizzes: [
          {
            question: 'What rule does Proposed that matter describe?',
            options: ['Dalton', 'Dalton', 'Rutherford'],
            correctOptionIndex: 0,
            explanation: 'Weak generated template.',
          },
          {
            question: 'Which scientist proposed that matter is made of atoms?',
            options: ['Dalton', 'Thomson', 'Rutherford', 'Dalton'],
            correctOptionIndex: 0,
            explanation: 'Dalton proposed atomic theory.',
          },
        ],
        flashcards: [
          {
            front: 'What did Dalton propose about atoms?',
            back: 'Matter is made of atoms that combine in fixed ratios.',
          },
        ],
      },
      'atomic-theories',
    )

    expect(draft.rawNotes).toContain('Atomic theory changed')
    expect(draft.debugTrace?.validatedContract).not.toBeNull()
    expect(JSON.stringify(draft.objects)).not.toContain('target rule')
    expect(JSON.stringify(draft.objects)).not.toContain('What rule does')
    expect(draft.objects.filter((object) => object.kind === 'quiz')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question: 'Which scientist proposed that matter is made of atoms?',
          options: ['Dalton', 'Thomson', 'Rutherford'],
          correctIndex: 0,
        }),
      ]),
    )
    expect(draft.debugTrace?.droppedOrRepairedItems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('converted object to text'),
        expect.stringContaining('Dropped concept 2'),
        expect.stringContaining('Dropped quiz 1'),
        expect.stringContaining('removed duplicate options'),
      ]),
    )
  })

  it('does not turn markdown heading fragments into local fallback quiz questions', () => {
    const rawNotes =
      'Charts, Releases, and Values ## Chart structure A Helm chart is a directory that contains templates and metadata for an application.\n\n' +
      'A release is rendered with a chosen set of values and stored as a release.\n\n' +
      'Values are configuration inputs that customize a release for one environment.'
    const concepts = extractLearningConcepts(
      rawNotes,
      'Charts, Releases, and Values',
    )
    const serializedConcepts = JSON.stringify(concepts)

    expect(serializedConcepts).not.toContain('##')
    expect(serializedConcepts).not.toContain(
      'Charts, Releases, and Values ## Chart structure',
    )

    const questions = concepts
      .map((concept, index) =>
        createApplicationQuestion(concept, index, concepts),
      )
      .filter(Boolean)

    expect(JSON.stringify(questions)).not.toContain('What rule does')
    expect(JSON.stringify(questions)).not.toContain('This describe')
  })

  it('skips suspicious local quiz concepts instead of forcing generic stems', () => {
    const badConcept: LearningConcept = {
      concept: 'This',
      type: 'definition',
      explanation:
        'This placeholder label came from a malformed fallback concept and should be ignored.',
      example: '',
      correctAnswer:
        'A placeholder label came from a malformed fallback concept.',
      expectedLearning:
        'Recognize that placeholder labels are not useful quiz concepts.',
      distractors: [
        'A chart package with Kubernetes templates.',
        'A release rendered with selected values.',
      ],
      sourceLine: 1,
      definition:
        'This placeholder label came from a malformed fallback concept.',
      formationRule: '',
      usageRule: '',
      commonMistake: '',
      contrast: '',
    }
    const definitionConcepts: LearningConcept[] = [
      {
        concept: 'Helm chart',
        type: 'definition',
        explanation:
          'A Helm chart is a reusable package containing Kubernetes templates and metadata.',
        example: '',
        correctAnswer:
          'A reusable package containing Kubernetes templates and metadata.',
        expectedLearning:
          'Explain that a Helm chart is the reusable package layer.',
        distractors: [
          'One installed instance of a chart in a cluster.',
          'Configuration inputs that customize a release.',
        ],
        sourceLine: 1,
        definition:
          'A Helm chart is a reusable package containing Kubernetes templates and metadata.',
        formationRule: '',
        usageRule: '',
        commonMistake: '',
        contrast: '',
      },
      {
        concept: 'Helm release',
        type: 'definition',
        explanation:
          'A Helm release is one installed instance of a chart in a Kubernetes cluster.',
        example: '',
        correctAnswer: 'One installed instance of a chart in a cluster.',
        expectedLearning: 'Explain that a release is the installed instance.',
        sourceLine: 2,
        definition:
          'A Helm release is one installed instance of a chart in a Kubernetes cluster.',
        formationRule: '',
        usageRule: '',
        commonMistake: '',
        contrast: '',
      },
    ]

    const usageConcepts: LearningConcept[] = [
      {
        concept: 'Subjunctive trigger: pour que',
        type: 'usage',
        explanation:
          'Pour que introduces a dependent clause that normally requires the subjunctive.',
        example: '',
        correctAnswer: 'pour que',
        expectedLearning:
          'Recognize pour que as a trigger for the subjunctive.',
        distractors: ['parce que', 'quand', 'apres que'],
        sourceLine: 3,
        definition: '',
        formationRule: '',
        usageRule:
          'Pour que introduces a dependent clause that normally requires the subjunctive.',
        commonMistake: '',
        contrast: '',
      },
    ]

    expect(createApplicationQuestion(badConcept, 0, [badConcept])).toBeNull()
    expect(
      createApplicationQuestion(definitionConcepts[0], 0, definitionConcepts),
    ).toBeNull()
    expect(
      createApplicationQuestion(usageConcepts[0], 0, usageConcepts),
    ).toEqual(
      expect.objectContaining({
        question: 'Which expression or context requires pour que?',
      }),
    )
  })

  it('builds usable multiple-choice quizzes from Local AI concepts when quiz output is missing', () => {
    const draft = normalizeLocalAiQuickCreateDraft(
      {
        title: 'Cell transport',
        summary: 'Cells move material across membranes in different ways.',
        concepts: [
          {
            concept: 'Diffusion',
            definition:
              'Particles move from higher concentration to lower concentration.',
          },
          {
            concept: 'Osmosis',
            definition: 'Water moves across a selectively permeable membrane.',
          },
          {
            concept: 'Active transport',
            definition:
              'Cells use energy to move substances against a concentration gradient.',
          },
        ],
      },
      'cell-transport',
      { resourceType: 'quiz', detailLevel: 'short' },
    )

    const quizzes = draft.objects.filter((object) => object.kind === 'quiz')
    expect(quizzes.length).toBeGreaterThanOrEqual(3)
    expect(quizzes[0]).toEqual(
      expect.objectContaining({
        quizMode: 'multipleChoice',
        options: expect.arrayContaining([
          'Particles move from higher concentration to lower concentration.',
          'Water moves across a selectively permeable membrane.',
          'Cells use energy to move substances against a concentration gradient.',
        ]),
      }),
    )
    expect(JSON.stringify(quizzes)).not.toMatch(/"A"|"B"|"C"/)
  })

  it('keeps local Study Guide dashboards useful when fields drift', async () => {
    const destroy = vi.fn()
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(3, 'Spanish B1'))
      .mockResolvedValueOnce(
        JSON.stringify({
          title: '01 - Past tense contrast',
          summary: { body: 'Contrast preterite and imperfect.' },
          sourceSummary: [
            'Use preterite for completed events.',
            'Use imperfect for background and habits.',
          ],
          concepts: [
            {
              concept: 'Preterite vs imperfect',
              definition:
                'Choose preterite for completed events and imperfect for background or habitual actions.',
              keyFact: 'The tense choice changes the meaning of a past action.',
              example: 'Ayer fui al mercado mientras llovia.',
            },
          ],
          quizzes: [
            {
              question:
                'Which tense fits a completed action in Spanish B1 narration?',
              options: ['preterite', 'imperfect', 'present'],
              correctOptionIndex: 0,
              explanation: 'Completed events use preterite.',
            },
          ],
          flashcards: [
            {
              front: 'When do you use the imperfect?',
              back: 'Use it for background, habits, and ongoing states.',
            },
          ],
        }),
      )
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(1, 'Italian modal verbs')
          : localStudyPathMarkdownFromPrompt(promptText, 'Italian modal verbs'),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          title: '02 - Opinions with connectors',
          notes:
            '## Goal\nGive opinions with connectors.\n\n## Explanation\nB1 Spanish uses connectors such as aunque, sin embargo, and por eso to join ideas and justify opinions.\n\n## Examples\nCreo que es util, aunque cuesta practicar.',
          flashcards: [
            {
              question: 'What do opinion connectors join?',
              answer:
                'Connectors join an opinion with a contrast, cause, or result.',
            },
          ],
          quizzes: [
            {
              question: 'Which connector introduces contrast?',
              options: ['aunque', 'por eso', 'porque'],
              correctIndex: 0,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          title: '03 - Travel situations',
          notes:
            '## Goal\nHandle travel and work situations.\n\n## Explanation\nB1 speakers explain plans, problems, preferences, and solutions with connected sentences.\n\n## Practice\nAsk for alternatives and explain a preference.',
          flashcards: [
            {
              question: 'What should a travel problem response include?',
              answer:
                'Explain a travel problem and request a clear alternative.',
            },
          ],
          quizzes: [
            {
              question: 'What makes a useful travel request?',
              options: [
                'polite request with reasons',
                'single noun',
                'random greeting',
              ],
              correctIndex: 0,
            },
          ],
        }),
      )
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(1, 'Fallback practice')
          : localStudyPathMarkdownFromPrompt(promptText, 'Fallback notes'),
      )
    const create = vi.fn().mockResolvedValue({ prompt, destroy })
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create,
    })

    const draft = await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Spanish B1',
      prompt: 'I want to learn Spanish level B1',
      folderName: '',
    })

    expect(draft.folderName).toBe('Spanish B1')
    expect(draft.dashboards).toHaveLength(3)
    expect(draft.dashboards[0]).toMatchObject({
      dashboardPurpose: 'lesson',
      practiceType: 'quiz',
    })
    expect(
      draft.dashboards.every(
        (dashboard) =>
          dashboard.rawNotes.trim() &&
          dashboard.objects[0]?.kind === 'markdown' &&
          dashboard.objects.length >= 3,
      ),
    ).toBe(true)
    expect(JSON.stringify(draft.dashboards)).not.toMatch(
      /how do you say hello/i,
    )
    expect(draft.dashboards[0].debugTrace?.validatedContract).not.toBeNull()
    expect(String(prompt.mock.calls[0][0])).toContain(
      'Plan a Study Guide with exactly 3 lesson dashboards',
    )
  })

  it('joins Local Study Guide source notes from two Markdown section calls', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          title: 'Italian A1',
          folderName: 'Italian A1',
          dashboards: [
            {
              title: '01 - Greetings',
              goal: 'Learn useful greeting phrases.',
              sections: [
                {
                  title: 'Common greetings',
                  goal: 'Explain greeting meanings and register.',
                  focus: 'ciao; buongiorno; arrivederci',
                },
                {
                  title: 'Examples and mistakes',
                  goal: 'Show usage examples and common mistakes.',
                  focus: 'formal greeting; informal greeting; time of day',
                },
              ],
              avoid: 'long dialogues; advanced grammar',
            },
            {
              title: '02 - Introductions',
              goal: 'Learn simple introduction phrases.',
              sections: [
                {
                  title: 'Name and origin',
                  goal: 'Explain name and origin sentences.',
                },
                {
                  title: 'Practice examples',
                  goal: 'Show examples and common mistakes.',
                },
              ],
              avoid: ['advanced grammar'],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        localStudyPathMarkdownSection('Common greetings', 'Greeting meaning'),
      )
      .mockResolvedValueOnce(
        localStudyPathMarkdownSection(
          'Examples and mistakes',
          'Example practice',
        ),
      )
      .mockResolvedValueOnce(localStudyPathPracticeJson(1, 'Greetings'))
      .mockResolvedValueOnce(
        localStudyPathMarkdownSection(
          'Name and origin',
          'Introduction meaning',
        ),
      )
      .mockResolvedValueOnce(
        localStudyPathMarkdownSection('Practice examples', 'Practice use'),
      )
      .mockResolvedValueOnce(localStudyPathPracticeJson(2, 'Introductions'))
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi(
      {
        apiToken: '',
        model: '',
        title: 'Italian A1',
        prompt: 'Teach Italian A1 greetings and introductions',
        folderName: '',
      },
      { dashboardConcurrency: 1 },
    )

    const markdown = draft.dashboards[0].objects.find(
      (object) => object.kind === 'markdown',
    )
    expect(markdown).toMatchObject({
      kind: 'markdown',
      markdown: expect.stringContaining('# 01 - Greetings'),
    })
    expect(markdown?.kind === 'markdown' ? markdown.markdown : '').toContain(
      '## Common greetings',
    )
    expect(markdown?.kind === 'markdown' ? markdown.markdown : '').toContain(
      '## Examples and mistakes',
    )
    expect(markdown?.kind === 'markdown' ? markdown.markdown : '').not.toMatch(
      /^\s*[\[{]/,
    )
    const markdownPrompt = String(prompt.mock.calls[1][0])
    const practicePrompt = String(prompt.mock.calls[3][0])
    expect(markdownPrompt).toContain('Return Markdown only')
    expect(markdownPrompt).toContain('Start exactly with this heading:')
    expect(markdownPrompt).toContain('## Common greetings')
    expect(markdownPrompt).toContain('Section focus')
    expect(markdownPrompt).toContain('ciao; buongiorno; arrivederci')
    expect(practicePrompt).toContain('## Common greetings')
    expect(practicePrompt).toContain('## Examples and mistakes')
  })

  it('plans Local AI Study Guides before generating three normal dashboards', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          title: 'Learn Italian level B1',
          folderName: 'Italian B1',
          dashboards: [
            {
              title: '01 - Past tense review',
              goal: 'Review past tense choices.',
              topics: ['passato prossimo', 'imperfetto'],
              avoid: ['summary dashboard'],
            },
            {
              title: '02 - Connectors',
              goal: 'Connect opinions and reasons.',
              topics: ['perche', 'anche se'],
              avoid: ['exercises-only dashboard'],
            },
            {
              title: '03 - Practical situations',
              goal: 'Use B1 language in daily contexts.',
              topics: ['travel', 'work'],
              avoid: ['final recap only'],
            },
          ],
        }),
      )
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(1, 'Fallback practice')
          : localStudyPathMarkdownFromPrompt(promptText, 'Fallback notes'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Italian B1',
      prompt: 'Learn Italian level B1',
      folderName: '',
    })

    expect(draft.folderName).toBe('Italian B1')
    expect(draft.dashboards).toHaveLength(3)
    expect(
      draft.dashboards.map((dashboard) => dashboard.dashboardRole),
    ).toEqual(['normal', 'normal', 'normal'])
    expect(draft.dashboards.map((dashboard) => dashboard.title)).toEqual([
      '01 - Past tense review',
      '02 - Connectors',
      '03 - Practical situations',
    ])
    expect(JSON.stringify(draft.dashboards)).not.toMatch(
      /"dashboardRole":"(?:summary|exercises)"/,
    )
    const firstDashboardPrompt = String(prompt.mock.calls[1][0])
    expect(firstDashboardPrompt).toContain(
      'Study path topic: Learn Italian level B1',
    )
    expect(firstDashboardPrompt).toContain(
      'Outline titles: 01 - Past tense review | 02 - Connectors | 03 - Practical situations',
    )
    expect(firstDashboardPrompt).toContain('Return Markdown only')
    expect(firstDashboardPrompt).toContain('Current section title:')
    expect(firstDashboardPrompt).toContain('Section focus:')
  })

  it('salvages malformed Local AI planner JSON with separate dashboard fragments', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(
        `\`\`\`json
{"title":"Study Guide","folderName":"Learn German B1","dashboards":[{"title":"01 - German Grammar Basics","goal":"Understand fundamental grammar structures","topics":["Noun genders","Verb conjugation"],"avoid":["summary dashboard"]}]}
{"title":"02 - Conversational German","goal":"Develop basic conversation skills","topics":["Greetings","Daily routines"]}
}
\`\`\``,
      )
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(1, 'German B1')
          : localStudyPathMarkdownFromPrompt(promptText, 'German B1'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Study Guide',
      prompt: 'learn german b1',
      folderName: '',
    })

    expect(draft.folderName).toBe('Learn German B1')
    expect(draft.dashboards.map((dashboard) => dashboard.title)).toEqual([
      '01 - German Grammar Basics',
      '02 - Conversational German',
    ])
    expect(
      draft.dashboards.map((dashboard) => dashboard.dashboardRole),
    ).toEqual(['normal', 'normal'])
  })

  it('salvages overlong truncated Local AI planner sections', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(
        `\`\`\`json
{"title":"Learn Italian B2 Study Guide","folderName":"Italian B2","dashboards":[{"title":"01 - Grammar & Fluency","goal":"Improve grammar flow","sections":[{"title":"Verb Conjugation","goal":"Master verb tenses","focus":"Present; Past; Future"},{"title":"Sentence Structure","goal":"Build complex sentences","focus":"Adverbs; Prepositions; Connectors"},{"title":"Idioms & Expressions","goal":"Understand common phrases","focus":"Slang; Figurative language; Regionalisms"},{"title":"Writing Practice","goal":"Improve written communication","focus":"Emails; Letters; Essays"}],"avoid":"Basic grammar; Vocabulary; Pronunciation"},{"title":"02 - Culture & Communication","goal":"Understand Italian culture","sections":[{"title":"Italian Culture","goal":"Learn about customs","focus":"Food; Family; Traditions"},{"title":"Social Communication","goal":"Understand social interactions","focus":"Greetings; Politeness; Etiquette"},{"title":"Cultural Sensitivity","goal":"Be respectful","focus":"Religion; History; Arts"}],"avoid":"Basic vocabulary; Grammar Review; Pronunciation practice"}
\`\`\``,
      )
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(1, 'Italian B2')
          : localStudyPathMarkdownFromPrompt(promptText, 'Italian B2'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi(
      {
        apiToken: '',
        model: '',
        title: 'Italian B2',
        prompt: 'learn italian b2',
        folderName: '',
      },
      { dashboardConcurrency: 1 },
    )

    expect(draft.folderName).toBe('Italian B2')
    expect(draft.dashboards.map((dashboard) => dashboard.title)).toEqual([
      '01 - Grammar & Fluency',
      '02 - Culture & Communication',
    ])
    const firstMarkdownPrompt = String(prompt.mock.calls[1][0])
    const secondMarkdownPrompt = String(prompt.mock.calls[2][0])
    expect(firstMarkdownPrompt).toContain(
      'Current section title: Verb Conjugation',
    )
    expect(firstMarkdownPrompt).toContain(
      'Current section goal: Master verb tenses',
    )
    expect(firstMarkdownPrompt).toContain(
      'Section focus: Present; Past; Future',
    )
    expect(secondMarkdownPrompt).toContain(
      'Current section title: Sentence Structure',
    )
    expect(secondMarkdownPrompt).toContain(
      'Section focus: Adverbs; Prepositions; Connectors',
    )
    expect(firstMarkdownPrompt).not.toContain('Idioms & Expressions')
  })

  it('emits estimated prompt progress without reporting 100 before completion', async () => {
    vi.useFakeTimers({ now: 0 })
    const events: Array<{ phase: string; percent: number }> = []
    const destroy = vi.fn()
    const prompt = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          window.setTimeout(() => resolve('done'), 500)
        }),
    )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy }),
    })

    const request = callLocalLanguageModel('Return done', {
      timeoutMs: 1000,
      onProgress: (event) => events.push(event),
    })

    await vi.advanceTimersByTimeAsync(500)
    await expect(request).resolves.toBe('done')
    const pending = events.filter((event) => event.phase === 'generation')
    expect(pending.length).toBeGreaterThan(0)
    expect(pending.every((event) => event.percent < 100)).toBe(true)
    expect(events.at(-1)).toMatchObject({ phase: 'complete', percent: 100 })
    expect(destroy).toHaveBeenCalled()
  })

  it('emits 100 timeout progress when a prompt times out', async () => {
    vi.useFakeTimers({ now: 0 })
    const events: Array<{ phase: string; percent: number; label: string }> = []
    const destroy = vi.fn()
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        prompt: vi.fn(() => new Promise(() => {})),
        destroy,
      }),
    })

    const request = callLocalLanguageModel('Return done', {
      timeoutMs: 1000,
      onProgress: (event) => events.push(event),
    })
    const rejection = expect(request).rejects.toThrow(/choose a smaller path/i)

    await vi.advanceTimersByTimeAsync(1000)
    await rejection
    expect(events.at(-1)).toMatchObject({
      phase: 'timeout',
      percent: 100,
    })
    expect(events.at(-1)?.label).not.toMatch(/Basic fallback/i)
    expect(destroy).toHaveBeenCalled()
  })

  it('uses 4 minutes for Local Quick Create prompting progress', async () => {
    vi.useFakeTimers({ now: 0 })
    const events: Array<{
      phase: string
      percent: number
      timeoutMs?: number
    }> = []
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        prompt: vi.fn().mockImplementation(() => new Promise(() => {})),
        destroy: vi.fn(),
      }),
    })

    const request = generateQuickCreateWithProvider({
      provider: 'local',
      apiToken: '',
      model: '',
      title: 'Atomic theories',
      rawNotes: 'Dalton proposed that matter is made of atoms.',
      packId: 'atomic-theories',
      onProgress: (event) => events.push(event),
    })
    const rejection = expect(request).rejects.toThrow(/choose a smaller path/i)

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    await vi.waitFor(() =>
      expect(events.filter((event) => event.phase === 'timeout')).toHaveLength(
        1,
      ),
    )
    await vi.advanceTimersByTimeAsync(8500)
    await vi.waitFor(() =>
      expect(
        events.filter((event) => event.phase === 'generation').length,
      ).toBeGreaterThanOrEqual(2),
    )
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    await vi.waitFor(() =>
      expect(events.filter((event) => event.phase === 'timeout')).toHaveLength(
        2,
      ),
    )
    await vi.advanceTimersByTimeAsync(8500)
    await vi.waitFor(() =>
      expect(
        events.filter((event) => event.phase === 'generation').length,
      ).toBeGreaterThanOrEqual(3),
    )
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    await rejection
    expect(events.find((event) => event.phase === 'generation')).toMatchObject({
      timeoutMs: 4 * 60 * 1000,
    })
    expect(events.filter((event) => event.phase === 'timeout')).toHaveLength(3)
    expect(events.at(-1)).toMatchObject({ phase: 'timeout', percent: 100 })
  })

  it('passes Quick Create resource choice into Local AI prompts', async () => {
    const prompt = vi.fn().mockResolvedValue(
      JSON.stringify({
        title: 'Atomic theories',
        objects: [
          {
            kind: 'qa',
            question: 'What did Dalton propose about matter?',
            answer: 'Matter is made of atoms.',
          },
          {
            kind: 'quiz',
            question: 'Which idea matches Dalton?',
            quizMode: 'multipleChoice',
            options: ['Matter is made of atoms', 'Cells divide', 'Water boils'],
            correctIndex: 0,
            answer: 'Matter is made of atoms',
            explanation: 'Dalton proposed atoms.',
          },
        ],
      }),
    )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateQuickCreateWithProvider({
      provider: 'local',
      apiToken: '',
      model: '',
      title: 'Atomic theories',
      rawNotes: 'Dalton proposed that matter is made of atoms.',
      packId: 'atomic-theories',
      resourceType: 'flashcards',
      detailLevel: 'short',
      generationTargets: ['flashcards'],
      generationAmount: 'few',
    })

    expect(prompt.mock.calls[0][0]).toContain('Allowed kind only: qa')
    expect(prompt.mock.calls[0][0]).toContain('Create 3-4 flashcards')
    expect(draft.objects.map((object) => object.kind)).toEqual(['qa'])
  })

  it('retries Local AI Quick Create generation when JSON is invalid', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(
        JSON.stringify({
          title: 'Atomic theories',
          objects: [
            {
              kind: 'qa',
              question: 'What did Dalton propose about matter?',
              answer: 'Matter is made of atoms.',
            },
          ],
        }),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateQuickCreateWithProvider({
      provider: 'local',
      apiToken: '',
      model: '',
      title: 'Atomic theories',
      rawNotes: 'Dalton proposed that matter is made of atoms.',
      packId: 'atomic-theories',
      resourceType: 'flashcards',
      detailLevel: 'short',
      generationTargets: ['flashcards'],
      generationAmount: 'few',
    })

    expect(prompt).toHaveBeenCalledTimes(2)
    expect(draft.objects.map((object) => object.kind)).toEqual(['qa'])
  })

  it('uses 240 second per-dashboard progress and combined dashboard labels for Local Average', async () => {
    const events: Array<{
      phase: string
      dashboardIndex?: number
      dashboardCount?: number
      timeoutMs?: number
    }> = []
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(5, 'Spanish B1'))
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(1, 'Progress practice')
          : localStudyPathMarkdownFromPrompt(promptText, 'Progress notes'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi(
      {
        apiToken: '',
        model: '',
        title: 'Spanish B1',
        prompt: 'I want to learn Spanish level B1',
        folderName: '',
      },
      { onProgress: (event) => events.push(event) },
    )

    expect(draft.dashboards).toHaveLength(5)
    expect(prompt.mock.calls.length).toBeGreaterThanOrEqual(12)
    expect(events.filter((event) => event.phase === 'generation')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Planning path, attempt 1/3...',
          timeoutMs: 180 * 1000,
        }),
        expect.objectContaining({
          dashboardCount: 5,
          label: 'Generating 0 of 5 dashboards',
          dashboardProgress: expect.arrayContaining([
            expect.objectContaining({
              dashboardIndex: 1,
              label: 'Markdown part 1 for dashboard 1/5, attempt 1/3',
              studyPathStep: 'markdown1',
            }),
            expect.objectContaining({
              dashboardIndex: 2,
              label: 'Markdown part 1 for dashboard 2/5, attempt 1/3',
              studyPathStep: 'markdown1',
            }),
          ]),
          timeoutMs: 300 * 1000,
        }),
        expect.objectContaining({
          dashboardCount: 5,
          label: 'Generated 5 of 5 dashboards',
          timeoutMs: 240 * 1000,
          studyPathPipeline: expect.objectContaining({
            label: 'Study Guide pipeline',
            estimatedRemainingMs: expect.any(Number),
            steps: expect.arrayContaining([
              expect.objectContaining({
                label: 'Dashboard 1: Flashcards',
                status: 'complete',
              }),
              expect.objectContaining({
                label: 'Dashboard 1: Quizzes',
                status: 'complete',
              }),
            ]),
          }),
        }),
      ]),
    )
  })

  it('rejects Local Deep before creating a LanguageModel session', async () => {
    const create = vi.fn()
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create,
    })

    await expect(
      generateStudyPathWithLocalAi({
        apiToken: '',
        model: '',
        title: 'Spanish B1',
        prompt: 'I want to learn Spanish level B1',
        folderName: '',
      }),
    ).rejects.toThrow(/Deep Study Guide is not available with Local AI/i)
    expect(create).not.toHaveBeenCalled()
  })

  it('tests local AI with a tiny hello prompt and destroys the session', async () => {
    const destroy = vi.fn()
    const prompt = vi.fn().mockResolvedValue('hello')
    const create = vi.fn().mockResolvedValue({ prompt, destroy })
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create,
    })

    await expect(testLocalLanguageModel()).resolves.toMatchObject({
      supported: true,
      availability: 'available',
      result: 'hello',
    })
    expect(prompt).toHaveBeenCalledWith(
      'Return exactly one word: hello',
      expect.objectContaining({ signal: expect.any(Object) }),
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        outputLanguage: 'en',
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        monitor: expect.any(Function),
      }),
    )
    expect(destroy).toHaveBeenCalled()
  })

  it('returns not supported when LanguageModel is absent', async () => {
    vi.stubGlobal('LanguageModel', undefined)

    await expect(testLocalLanguageModel()).resolves.toMatchObject({
      supported: false,
      availability: 'unavailable',
    })
  })

  it('times out local AI session creation, cools down, and destroys late sessions', async () => {
    vi.useFakeTimers({ now: 0 })
    const lateDestroy = vi.fn()
    let resolveCreate:
      | ((session: {
          prompt: () => Promise<string>
          destroy: () => void
        }) => void)
      | undefined
    const create = vi.fn(
      () =>
        new Promise<{ prompt: () => Promise<string>; destroy: () => void }>(
          (resolve) => {
            resolveCreate = resolve
          },
        ),
    )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create,
    })

    const request = callLocalLanguageModel('Return exactly one word: hello')
    const rejection = expect(request).rejects.toThrow(
      /timed out while creating a session/i,
    )

    await vi.advanceTimersByTimeAsync(60 * 1000)
    await rejection
    await expect(
      callLocalLanguageModel('Return exactly one word: hello'),
    ).rejects.toThrow(/cooling down after a timeout/i)
    expect(create).toHaveBeenCalledTimes(1)

    resolveCreate?.({
      prompt: vi.fn().mockResolvedValue('late'),
      destroy: lateDestroy,
    })
    await Promise.resolve()
    await vi.runAllTicks()
    expect(lateDestroy).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(8000)
    vi.useRealTimers()
  })

  it('destroys the session and rejects immediate retries during prompt cooldown', async () => {
    vi.useFakeTimers({ now: 0 })
    const destroy = vi.fn()
    const create = vi.fn().mockResolvedValue({
      prompt: vi.fn(() => new Promise(() => {})),
      destroy,
    })
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create,
    })

    const request = callLocalLanguageModel('Return exactly one word: hello', {
      timeoutMs: 1000,
    })
    const rejection = expect(request).rejects.toThrow(
      /Local AI timed out. Try again, choose a smaller path, or use Own Gemini token/i,
    )

    await vi.advanceTimersByTimeAsync(1000)
    await rejection
    expect(destroy).toHaveBeenCalled()
    await expect(
      callLocalLanguageModel('Return exactly one word: hello'),
    ).rejects.toThrow(/cooling down after a timeout/i)
    expect(create).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(8000)
    vi.useRealTimers()
  })

  it('does not auto-use Basic fallback when Local Quick Create prompting times out', async () => {
    vi.useFakeTimers({ now: 0 })
    const destroy = vi.fn()
    const prompt = vi.fn().mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        prompt,
        destroy,
      }),
    })

    const request = generateQuickCreateWithProvider({
      provider: 'local',
      apiToken: '',
      model: '',
      title: 'Atomic theories',
      rawNotes: 'Dalton proposed that matter is made of atoms.',
      packId: 'atomic-theories',
    })
    const rejection = expect(request).rejects.toThrow(
      /Local AI timed out. Try again, choose a smaller path, or use Own Gemini token/i,
    )

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    await vi.advanceTimersByTimeAsync(8500)
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    await vi.advanceTimersByTimeAsync(8500)
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    await rejection
    expect(destroy).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(8000)
    vi.useRealTimers()
  })

  it('does not auto-use Basic fallback when Local Study Guide dashboard prompting times out', async () => {
    vi.useFakeTimers({ now: 0 })
    const destroy = vi.fn()
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Spanish B1'))
      .mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        prompt,
        destroy,
      }),
    })

    const request = generateStudyPathWithLocalAi(
      {
        apiToken: '',
        model: '',
        title: 'Spanish B1',
        prompt: 'I want to learn Spanish level B1',
        folderName: '',
      },
      { dashboardConcurrency: 1 },
    )
    const rejection = expect(request).rejects.toThrow(
      /Try again, choose a smaller path, or use Own Gemini token/i,
    )

    await vi.advanceTimersByTimeAsync(2400 * 1000)
    await rejection
    expect(destroy).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(8000)
    vi.useRealTimers()
  })

  it('reports malformed Local Study Guide Markdown with raw failure debug', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B1'))
      .mockResolvedValueOnce('not json at all')
      .mockResolvedValueOnce('not json at all again')
      .mockResolvedValueOnce('not json at all final')
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    try {
      await generateStudyPathWithLocalAi(
        {
          apiToken: '',
          model: '',
          title: 'Italian B1',
          prompt: 'Teach Italian B1 modal verbs',
          folderName: '',
        },
        { dashboardConcurrency: 1 },
      )
      throw new Error('Expected Local AI generation to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toMatch(/could not map it into widgets/i)
      expect(isLocalAiGenerationError(error)).toBe(true)
      if (isLocalAiGenerationError(error)) {
        expect(error.code).toBe('noUsableObjects')
        expect(error.debug).toMatchObject({
          dashboardIndex: 1,
          dashboardCount: 2,
          attempt: 3,
          attemptCount: 3,
          rawResponse: 'not json at all final',
        })
        expect(error.debug?.mappingError).toMatch(/Markdown did not start/i)
        expect(error.debug?.attempts).toHaveLength(3)
      }
    }
  })

  it('retries malformed Local Study Guide Markdown with smaller section prompts', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B1'))
      .mockResolvedValueOnce('{"title":"Broken"')
      .mockImplementationOnce((promptText: string) =>
        localStudyPathMarkdownFromPrompt(promptText, 'Modal verb notes'),
      )
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(2, 'Modal verb practice')
          : localStudyPathMarkdownFromPrompt(promptText, 'Modal verb notes'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi(
      {
        apiToken: '',
        model: '',
        title: 'Italian B1',
        prompt: 'Teach Italian B1 modal verbs',
        folderName: '',
      },
      { dashboardConcurrency: 1 },
    )

    const retryPrompt = String(prompt.mock.calls[2][0])
    expect(retryPrompt).toContain('Return Markdown only')
    expect(retryPrompt).toContain('## Section 1A')
    expect(retryPrompt).toContain('Section focus:')
    expect(retryPrompt).toContain(
      'Use simpler structured Markdown with fewer bullets.',
    )
    expect(draft.dashboards).toHaveLength(2)
    expect(draft.dashboards[0].debugTrace?.localAiFailedAttempts).toHaveLength(
      1,
    )
  })

  it('repairs invalid Local AI JSON backslash escapes before parsing', () => {
    expect(parseLocalAiJson('{"phrase":"Watashi wa \\[name] desu"}')).toEqual({
      phrase: 'Watashi wa [name] desu',
    })
    expect(
      parseLocalAiJson('{"quote":"say \\"hello\\"","path":"a\\\\b"}'),
    ).toEqual({
      quote: 'say "hello"',
      path: 'a\\b',
    })
  })

  it('repairs incomplete Local AI JSON with missing closing delimiters', () => {
    expect(
      parseLocalAiJson('{"title":"Lesson","listItems":["a","b","c"]'),
    ).toEqual({
      title: 'Lesson',
      listItems: ['a', 'b', 'c'],
    })
    expect(
      parseLocalAiJson('{"title":"Lesson","listItems":["a","b","c"'),
    ).toEqual({
      title: 'Lesson',
      listItems: ['a', 'b', 'c'],
    })
    expect(
      parseLocalAiJson('```json\n{"title":"Lesson","listItems":["a","b"]\n```'),
    ).toEqual({
      title: 'Lesson',
      listItems: ['a', 'b'],
    })
    expect(
      parseLocalAiJson(
        '{"phrase":"Watashi wa \\[name] desu","listItems":["a"]',
      ),
    ).toEqual({
      phrase: 'Watashi wa [name] desu',
      listItems: ['a'],
    })
  })

  it('maps valid loose Local Study Guide objects without treating record debug as a contract', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Japanese A1'))
      .mockResolvedValueOnce(
        JSON.stringify({
          title: '01 - Japanese introductions',
          summary: 'Practice a useful Japanese self-introduction pattern.',
          rawNotes:
            'Use Watashi wa [name] desu for simple introductions and replace the bracketed name.',
          objects: [
            {
              kind: 'markdown',
              title: 'Explanation',
              markdown:
                'Watashi wa [name] desu means I am [name]. Use it for simple introductions.',
            },
            {
              kind: 'qa',
              question: 'How do you introduce your name with this pattern?',
              answer: 'Watashi wa [name] desu.',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          title: '02 - Practice',
          summary: 'Practice changing the name in the sentence.',
          rawNotes:
            'Swap the placeholder for a real name and say the full sentence aloud.',
          objects: [
            {
              kind: 'quiz',
              question: 'Which sentence introduces Hana?',
              options: [
                'Watashi wa Hana desu',
                'Watashi wa desu Hana',
                'Hana wa watashi desu',
              ],
              correctIndex: 0,
              answer: 'Watashi wa Hana desu',
              explanation: 'The name comes before desu.',
            },
          ],
        }),
      )
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(1, 'Italian modal verbs')
          : localStudyPathMarkdownFromPrompt(promptText, 'Italian modal verbs'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Japanese A1',
      prompt: 'Teach Japanese A1 introductions',
      folderName: '',
    })

    expect(draft.dashboards).toHaveLength(2)
    expect(draft.dashboards[0].objects.length).toBeGreaterThan(0)
    expect(draft.dashboards[0].debugTrace?.droppedOrRepairedItems).toEqual(
      expect.any(Array),
    )
  })

  it('prefers compact Local Study Guide dashboard JSON and maps recall widgets', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B1'))
      .mockResolvedValueOnce(
        JSON.stringify({
          title: '01 - Italian modal verbs',
          notes:
            'Italian B1 modal verbs help express what someone can, must, or wants to do.',
          flashcards: [
            {
              question: 'Which modal verb expresses obligation?',
              answer: 'Dovere expresses obligation.',
            },
            {
              question: 'Which modal verb expresses ability?',
              answer: 'Potere expresses ability.',
            },
          ],
          quizzes: [
            {
              question: 'Which sentence means I must study?',
              options: ['Devo studiare', 'Posso studiare', 'Voglio studiare'],
              correctIndex: 0,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          title: '02 - Practice',
          notes:
            'Choose the right modal verb for ability, obligation, or desire.',
          flashcards: [
            {
              question: 'Which modal verb expresses desire?',
              answer: 'Volere expresses desire.',
            },
          ],
          quizzes: [
            {
              question: 'Which sentence means I want to leave?',
              options: ['Voglio partire', 'Devo partire', 'Posso partire'],
              correctIndex: 0,
            },
          ],
        }),
      )
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(1, 'Italian modal verbs')
          : localStudyPathMarkdownFromPrompt(promptText, 'Italian modal verbs'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Italian B1',
      prompt: 'Teach Italian B1 modal verbs',
      folderName: '',
    })

    expect(draft.dashboards[0].objects.map((object) => object.kind)).toEqual([
      'markdown',
      'qa',
      'qa',
      'quiz',
    ])
    expect(draft.dashboards[0].debugTrace?.droppedOrRepairedItems).toContain(
      'Mapped Local AI notes and recall dashboard shape into study objects.',
    )
  })

  it('accepts Local AI dashboards with notes and flashcards but no quizzes', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B1'))
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? JSON.stringify({
              flashcards: [
                {
                  question: 'Which verb expresses obligation?',
                  answer: 'Dovere expresses obligation.',
                },
                {
                  question: 'Which verb expresses ability?',
                  answer: 'Potere expresses ability.',
                },
              ],
              quizzes: [],
            })
          : localStudyPathMarkdownFromPrompt(promptText, 'Modal verbs'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Italian B1',
      prompt: 'Teach Italian B1 modal verbs',
      folderName: '',
    })

    expect(draft.dashboards[0].objects.map((object) => object.kind)).toEqual([
      'markdown',
      'qa',
      'qa',
      'quiz',
    ])
  })

  it('repairs merged Local AI flashcard question and answer pairs', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B1'))
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? JSON.stringify({
              flashcards: [
                {
                  question:
                    'Q1: Which verb expresses obligation?\nA1: Dovere.\nQ2: Which verb expresses ability?\nA2: Potere.',
                  answer: 'Q3: Which verb expresses desire?\nA3: Volere.',
                },
              ],
              quizzes: [],
            })
          : localStudyPathMarkdownFromPrompt(promptText, 'Modal verbs'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Italian B1',
      prompt: 'Teach Italian B1 modal verbs',
      folderName: '',
    })

    expect(
      draft.dashboards[0].objects.filter((object) => object.kind === 'qa'),
    ).toHaveLength(3)
    expect(draft.dashboards[0].debugTrace?.droppedOrRepairedItems).toContain(
      'Repaired flashcard 1: split merged question/answer pairs.',
    )
  })

  it('drops weak Local Study Guide quiz options and ignores listItems widgets', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B1'))
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? JSON.stringify({
              flashcards: [
                {
                  question: 'Which verb expresses obligation?',
                  answer: 'Dovere.',
                },
              ],
              quizzes: [
                {
                  question: 'Which verb expresses obligation?',
                  options: ['Dovere', 'Dovere', 'Potere'],
                  correctIndex: 0,
                },
              ],
              listItems: ['Do not render this as a list widget'],
            })
          : localStudyPathMarkdownFromPrompt(promptText, 'Modal verbs'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Italian B1',
      prompt: 'Teach Italian B1 modal verbs',
      folderName: '',
    })

    expect(draft.dashboards[0].objects.map((object) => object.kind)).toEqual([
      'markdown',
      'qa',
      'quiz',
    ])
    expect(draft.dashboards[0].debugTrace?.droppedOrRepairedItems).toContain(
      'Dropped quiz 1: fewer than 3 unique options.',
    )
  })

  it('drops placeholder Local AI quiz options without rejecting good notes and flashcards', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B1'))
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? JSON.stringify({
              flashcards: [
                {
                  question: 'Which verb expresses obligation?',
                  answer: 'Dovere.',
                },
              ],
              quizzes: [
                {
                  question: 'Which verb expresses obligation?',
                  options: ['A', 'B', 'C'],
                  correctIndex: 0,
                },
              ],
            })
          : localStudyPathMarkdownFromPrompt(promptText, 'Modal verbs'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Italian B1',
      prompt: 'Teach Italian B1 modal verbs',
      folderName: '',
    })

    expect(draft.dashboards[0].objects.map((object) => object.kind)).toEqual([
      'markdown',
      'qa',
      'quiz',
    ])
    expect(draft.dashboards[0].debugTrace?.droppedOrRepairedItems).toContain(
      'Dropped quiz 1: placeholder options.',
    )
  })

  it('recovers malformed Local Study Guide practice JSON without retrying the dashboard', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B1'))
      .mockImplementationOnce((promptText: string) =>
        localStudyPathMarkdownFromPrompt(promptText, 'Modal verbs'),
      )
      .mockImplementationOnce((promptText: string) =>
        localStudyPathMarkdownFromPrompt(promptText, 'Modal verbs'),
      )
      .mockResolvedValueOnce(
        `\`\`\`json
{flashcards:[{question:"Which verb expresses obligation?",answer:"Dovere."},{"question":"Which verb expresses obligation?","answer":"Dovere duplicate."},{"question":"Which verb expresses ability?","answer":"Potere."}]
\`\`\``,
      )
      .mockResolvedValueOnce(
        `{"quizzes":[{"question":"Which modal means obligation?","options":["Dovere","Potere","Volere"],"correctIndex":0}], [{"question":"Which modal means ability?","options":["Potere","Dovere","Volere"],"correctIndex":0}]}`,
      )
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(2, 'Modal verbs')
          : localStudyPathMarkdownFromPrompt(promptText, 'Modal verbs'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi(
      {
        apiToken: '',
        model: '',
        title: 'Italian B1',
        prompt: 'Teach Italian B1 modal verbs',
        folderName: '',
      },
      { dashboardConcurrency: 1 },
    )

    const firstDashboardQuestions = draft.dashboards[0].objects
      .filter((object) => object.kind === 'qa' || object.kind === 'quiz')
      .map((object) => object.question)

    expect(firstDashboardQuestions).toEqual(
      expect.arrayContaining([
        'Which verb expresses obligation?',
        'Which verb expresses ability?',
        'Which modal means obligation?',
        'Which modal means ability?',
      ]),
    )
    expect(
      firstDashboardQuestions.filter(
        (question) => question === 'Which verb expresses obligation?',
      ),
    ).toHaveLength(1)
    expect(draft.dashboards[0].debugTrace?.droppedOrRepairedItems).toEqual(
      expect.arrayContaining([
        'Repaired flashcards: stripped code fence or invalid escapes.',
        'Repaired flashcards: dropped duplicate question.',
        'Repaired quizzes: recovered standalone practice objects.',
      ]),
    )
  })

  it('recovers repeated standalone flashcards with stray closing delimiters', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B1'))
      .mockImplementationOnce((promptText: string) =>
        localStudyPathMarkdownFromPrompt(promptText, 'Modal verbs'),
      )
      .mockImplementationOnce((promptText: string) =>
        localStudyPathMarkdownFromPrompt(promptText, 'Modal verbs'),
      )
      .mockResolvedValueOnce(
        `{"question":"What is a modal verb?",answer:"A helper verb."}]}; {"question":"Which modal expresses desire?",answer:"Volere."}]};`,
      )
      .mockResolvedValueOnce(localStudyPathPracticeJson(1, 'Modal verbs'))
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(2, 'Modal verbs')
          : localStudyPathMarkdownFromPrompt(promptText, 'Modal verbs'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi(
      {
        apiToken: '',
        model: '',
        title: 'Italian B1',
        prompt: 'Teach Italian B1 modal verbs',
        folderName: '',
      },
      { dashboardConcurrency: 1 },
    )

    expect(draft.dashboards[0].objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'qa',
          question: 'What is a modal verb?',
          answer: 'A helper verb.',
        }),
        expect.objectContaining({
          kind: 'qa',
          question: 'Which modal expresses desire?',
          answer: 'Volere.',
        }),
      ]),
    )
    expect(draft.dashboards[0].debugTrace?.droppedOrRepairedItems).toContain(
      'Repaired flashcards: recovered standalone practice objects.',
    )
  })

  it('skips later Local Study Guide dashboards after three retryable failures', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(3, 'Italian B1'))
      .mockImplementationOnce((promptText: string) =>
        localStudyPathMarkdownFromPrompt(promptText, 'Lesson 1'),
      )
      .mockImplementationOnce((promptText: string) =>
        localStudyPathMarkdownFromPrompt(promptText, 'Lesson 1'),
      )
      .mockResolvedValueOnce(localStudyPathPracticeJson(1, 'Lesson 1'))
      .mockResolvedValueOnce(localStudyPathPracticeJson(1, 'Lesson 1'))
      .mockResolvedValueOnce('not json 2a')
      .mockResolvedValueOnce('not json 2b')
      .mockResolvedValueOnce('not json 2c')
      .mockImplementationOnce((promptText: string) =>
        localStudyPathMarkdownFromPrompt(promptText, 'Lesson 3'),
      )
      .mockImplementationOnce((promptText: string) =>
        localStudyPathMarkdownFromPrompt(promptText, 'Lesson 3'),
      )
      .mockResolvedValueOnce(localStudyPathPracticeJson(3, 'Lesson 3'))
      .mockResolvedValueOnce(localStudyPathPracticeJson(3, 'Lesson 3'))
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi(
      {
        apiToken: '',
        model: '',
        title: 'Italian B1',
        prompt: 'Teach Italian B1 modal verbs',
        folderName: '',
      },
      { dashboardConcurrency: 1 },
    )

    expect(draft.dashboards).toHaveLength(2)
    expect(draft.dashboards.map((dashboard) => dashboard.title)).toEqual([
      '01 - Lesson 1',
      '03 - Lesson 3',
    ])
    expect(draft.warnings).toContain(
      'Dashboard 2 could not be generated after 3 Local AI attempts and was skipped.',
    )
  })

  it('keeps Local dashboards normal and treats notes as raw notes', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B1'))
      .mockResolvedValueOnce(
        JSON.stringify({
          title: '01 - Lesson',
          notes: '## Summary\n\nModal verbs express ability and obligation.',
          flashcards: [
            {
              question: 'Which verb expresses obligation?',
              answer: 'Dovere.',
            },
          ],
          quizzes: [
            {
              question: 'Which sentence means I must study?',
              options: ['Devo studiare', 'Posso studiare', 'Voglio studiare'],
              correctIndex: 0,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          title: '02 - Exercises',
          notes: 'Practice modal verbs in realistic sentences.',
          flashcards: [
            {
              question: 'Which verb expresses desire?',
              answer: 'Volere.',
            },
          ],
          quizzes: [
            {
              question: 'Which sentence means I want to leave?',
              options: ['Voglio partire', 'Devo partire', 'Posso partire'],
              correctIndex: 0,
            },
          ],
        }),
      )
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(2, 'Modal verb practice')
          : localStudyPathMarkdownFromPrompt(promptText, 'Modal verb notes'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    const draft = await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Italian B1',
      prompt: 'Teach Italian B1 modal verbs',
      folderName: '',
    })

    expect(draft.dashboards[0].rawNotes).toContain('Modal verb notes')
    expect(draft.dashboards[0].objects[0]).toMatchObject({
      kind: 'markdown',
      title: 'Lesson notes',
      markdown: expect.stringContaining('Modal verb notes'),
    })
    expect(
      draft.dashboards[0].objects.filter(
        (object) => object.kind === 'markdown',
      ),
    ).toHaveLength(1)
    expect(draft.dashboards[0].debugTrace?.validatedContract).not.toMatchObject(
      {
        concepts: expect.arrayContaining([
          expect.objectContaining({ concept: 'Summary' }),
        ]),
      },
    )
    expect(
      draft.dashboards.every((dashboard) => dashboard.dashboardRole),
    ).toEqual(true)
    expect(
      draft.dashboards.map((dashboard) => dashboard.dashboardRole),
    ).toEqual(['normal', 'normal'])
    expect(draft.dashboards[1].objects.map((object) => object.kind)).toEqual([
      'markdown',
      'qa',
      'qa',
      'quiz',
    ])
  })

  it('reports mapped Local Study Guide JSON without usable widgets', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'French B2'))
      .mockResolvedValue(
        JSON.stringify({
          title: '',
          summary: '',
          rawNotes: '',
          concepts: [
            {
              concept: 'it',
              definition: '',
            },
          ],
          objects: [
            {
              kind: 'qa',
              question: 'What do the notes say?',
              answer: '',
            },
          ],
        }),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    try {
      await generateStudyPathWithLocalAi({
        apiToken: '',
        model: '',
        title: 'French B2',
        prompt: 'Teach French B2 argument connectors',
        folderName: '',
      })
      throw new Error('Expected Local AI generation to fail.')
    } catch (error) {
      expect((error as Error).message).toMatch(/could not map it into widgets/i)
      expect(isLocalAiGenerationError(error)).toBe(true)
      if (isLocalAiGenerationError(error)) {
        expect(error.code).toBe('noUsableObjects')
        expect(error.debug?.rawResponse).toContain('"objects"')
        expect(error.debug?.mappingError).toMatch(
          /JSON instead of Markdown notes/i,
        )
      }
    }
  })

  it('preserves unsupported Local AI setup errors for Study Guide generation', async () => {
    vi.stubGlobal('LanguageModel', undefined)

    try {
      await generateStudyPathWithLocalAi({
        apiToken: '',
        model: '',
        title: 'German B1',
        prompt: 'Teach German B1 word order',
        folderName: '',
      })
      throw new Error('Expected unsupported Local AI generation to fail.')
    } catch (error) {
      expect((error as Error).message).toMatch(/not supported in this browser/i)
    }
  })

  it('keeps unknown Local Study Guide failures distinct with the original cause', async () => {
    const failure = new Error('Model exploded')
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'German B1'))
      .mockRejectedValueOnce(failure)
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    try {
      await generateStudyPathWithLocalAi({
        apiToken: '',
        model: '',
        title: 'German B1',
        prompt: 'Teach German B1 word order',
        folderName: '',
      })
      throw new Error('Expected unknown Local AI generation to fail.')
    } catch (error) {
      expect((error as Error).message).toBe('Model exploded')
      expect(isLocalAiGenerationError(error)).toBe(true)
      if (isLocalAiGenerationError(error)) {
        expect(error.code).toBe('unknown')
        expect(error.cause).toBe(failure)
        expect(error.debug).toMatchObject({
          dashboardIndex: 1,
          dashboardCount: 2,
        })
      }
    }
  })

  it('uses generic language-learning guidance for Local Study Guide prompts', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(localStudyPathPlanJson(2, 'Italian B2'))
      .mockImplementation((promptText: string) =>
        /Create (?:flashcards|quizzes)/i.test(promptText)
          ? localStudyPathPracticeJson(1, 'Grammar practice')
          : localStudyPathMarkdownFromPrompt(promptText, 'Grammar notes'),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    await generateStudyPathWithLocalAi({
      apiToken: '',
      model: '',
      title: 'Italian B2',
      prompt: 'Teach Italian B2 conversation',
      folderName: '',
    })

    const dashboardPrompt = String(prompt.mock.calls[1][0])
    const secondDashboardPrompt = String(prompt.mock.calls[2][0])
    const practicePrompt = String(
      prompt.mock.calls.find((call) =>
        /Create (?:flashcards|quizzes)/i.test(String(call[0])),
      )?.[0] || '',
    )
    expect(dashboardPrompt).toContain('Return Markdown only')
    expect(dashboardPrompt).toContain('Section focus:')
    expect(secondDashboardPrompt).toContain('Return Markdown only')
    expect(practicePrompt).toContain('Create flashcards')
    expect(practicePrompt).toContain('Ask for 2 flashcards')
    expect(practicePrompt).toContain(
      'Do not merge multiple flashcards into one object',
    )
    expect(dashboardPrompt).toContain(
      'Use the section focus topics as anchors.',
    )
    expect(dashboardPrompt).not.toMatch(
      /Spanish B1|For B1, avoid A1 greetings/i,
    )
  })
})

describe('Gemini quick create client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const makeStrictPathDashboard = (index: number, label: string) => ({
    title: `${String(index).padStart(2, '0')} - ${label}`,
    summary: `${label} preview`,
    rawNotes: `${label} lesson notes explain the topic with examples and common mistakes for this Study Guide section.`,
    sourceSummary: {
      title: `${label} source summary`,
      bullets: [`${label} connects the Study Guide ideas.`],
    },
    conceptRecap: {
      title: `${label} concept recap`,
      sections: [
        {
          title: `${label} rule`,
          bullets: [`Apply ${label.toLowerCase()} in a new example.`],
          example: `${label} example`,
        },
      ],
    },
    practice: {
      shortAnswer: [
        {
          question: `How would you apply ${label.toLowerCase()} to a new example?`,
          expectedAnswer: `Use the ${label.toLowerCase()} rule.`,
          explanation: `${label} practice checks transfer.`,
        },
      ],
      multipleChoice: [
        {
          question: `Which option best applies ${label.toLowerCase()} in context?`,
          options: [
            `${label} application`,
            'A copied heading',
            'An unrelated fact',
          ],
          correctOptionIndex: 0,
          explanation: `${label} application is the transfer choice.`,
        },
      ],
    },
    flashcards: [
      {
        front: `When should you use ${label.toLowerCase()}?`,
        back: `Use ${label.toLowerCase()} for the relevant rule.`,
      },
    ],
  })

  const mockStudyPathResponse = (dashboardCount: number) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'French Subjunctive Path',
                    folderName: 'French Subjunctive Path',
                    dashboards: Array.from(
                      { length: dashboardCount },
                      (_value, index) =>
                        makeStrictPathDashboard(
                          index + 1,
                          `Lesson ${index + 1}`,
                        ),
                    ),
                  }),
                },
              ],
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    return fetchMock
  }

  const mockSparseStudyPathResponse = (dashboardCount: number) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Sparse Study Guide',
                    folderName: 'Sparse Study Guide',
                    dashboards: Array.from(
                      { length: dashboardCount },
                      (_value, index) => ({
                        title: `${String(index + 1).padStart(
                          2,
                          '0',
                        )} - Sparse ${index + 1}`,
                        summary: `Sparse dashboard ${index + 1}`,
                        rawNotes: `Sparse notes ${
                          index + 1
                        } explain one usable idea with enough context for a Study Guide dashboard.`,
                        sourceSummary: {
                          title: `Sparse summary ${index + 1}`,
                          bullets: [
                            `Sparse source summary bullet ${index + 1}.`,
                          ],
                        },
                      }),
                    ),
                  }),
                },
              ],
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    return fetchMock
  }

  const makeRichPathDashboard = (index: number, label: string) => ({
    title: `${String(index).padStart(2, '0')} - ${label}`,
    summary: `${label} preview`,
    rawNotes: `${label} teaches a specific rule with clear examples, contrasts, and common mistakes. Students should apply the rule in new contexts and explain why the answer works.`,
    sourceSummary: {
      title: `${label} source summary`,
      bullets: [
        `${label} introduces a concrete learning rule.`,
        `${label} shows how the rule changes in context.`,
        `${label} highlights a common mistake to avoid.`,
      ],
    },
    conceptRecap: {
      title: `${label} concept recap`,
      sections: [
        {
          title: `${label} rule`,
          bullets: [`Use ${label.toLowerCase()} when the context requires it.`],
          example: `${label} example one.`,
        },
        {
          title: `${label} contrast`,
          bullets: [`Compare ${label.toLowerCase()} with a near miss.`],
          example: `${label} example two.`,
        },
      ],
    },
    practice: {
      shortAnswer: [
        {
          question: `How would you apply ${label.toLowerCase()} in a new context?`,
          expectedAnswer: `Use the ${label.toLowerCase()} rule and explain the trigger.`,
          explanation: `${label} short-answer practice checks transfer.`,
        },
        {
          question: `What common mistake should you avoid with ${label.toLowerCase()}?`,
          expectedAnswer: `Do not apply the rule when the trigger is absent.`,
          explanation: `${label} mistake practice checks contrast.`,
        },
      ],
      multipleChoice: [
        {
          question: `Which option correctly applies ${label.toLowerCase()}?`,
          options: [
            `${label} correct application`,
            `${label} copied heading`,
            `${label} unrelated fact`,
          ],
          correctOptionIndex: 0,
          explanation: `${label} correct application uses the rule.`,
        },
        {
          question: `Which option avoids the common ${label.toLowerCase()} mistake?`,
          options: [
            `${label} overgeneralized answer`,
            `${label} careful contrast`,
            `${label} unrelated answer`,
          ],
          correctOptionIndex: 1,
          explanation: `${label} careful contrast avoids the mistake.`,
        },
      ],
    },
    flashcards: [
      {
        front: `What is the main ${label.toLowerCase()} rule?`,
        back: `Apply ${label.toLowerCase()} only when the trigger is present.`,
      },
      {
        front: `What contrast matters for ${label.toLowerCase()}?`,
        back: `Check whether the similar case lacks the trigger.`,
      },
      {
        front: `What mistake should ${label.toLowerCase()} practice prevent?`,
        back: `Avoid copying headings instead of applying the rule.`,
      },
    ],
  })

  const contentModes = [
    'orientationMap',
    'conceptLesson',
    'workedExampleLab',
    'contrastLab',
    'practiceCheckpoint',
    'synthesisReview',
    'procedureGuide',
    'vocabularyReference',
  ] as const

  it('auto-plans Study Guides before generating and evaluating individual dashboards', async () => {
    const blueprint = {
      title: 'Python Loops',
      folderName: 'Python Loops',
      pathPromise: 'Build a zero-to-map overview of Python loops.',
      entryLevel: 'Beginner',
      exitCapability: 'Explain loop types and attempt first loop tasks.',
      dashboardCount: 3,
      dashboardCountReason: 'Three dashboards are enough for a first map.',
      learnerProfile: 'Beginner programming student.',
      scope: 'Learn loop fundamentals and common mistakes.',
      prerequisites: ['Variables', 'basic expressions'],
      learningObjectives: ['Use for loops', 'Use while loops', 'debug loops'],
      conceptGraph: ['for loop -> while loop -> loop debugging'],
      modules: [
        {
          title: 'Loop foundations',
          goal: 'Build useful loop intuition.',
          lessonIndexes: [0, 1, 2],
        },
      ],
      lessons: [1, 2, 3].map((index) => ({
        title: `Loop lesson ${index}`,
        moduleTitle: 'Loop foundations',
        lessonType: index === 3 ? 'checkpoint' : 'concept',
        learnerQuestion: `How do loops work in case ${index}?`,
        learningOutcome: `Apply loop pattern ${index}.`,
        dashboardPurpose: index === 3 ? 'practice' : 'lesson',
        practiceType: index === 3 ? 'mixed' : 'none',
        contentMode:
          index === 1
            ? 'orientationMap'
            : index === 3
              ? 'practiceCheckpoint'
              : 'workedExampleLab',
        sectionPlan: ['Topic map', 'Worked loop', 'Try it'],
        mustTeach: [`Loop idea ${index}`],
        workedExample: `Loop worked example ${index}.`,
        misconceptionChecks: [`Loop mistake ${index}.`],
        retrievalPractice: [`Recall loop rule ${index}.`],
      })),
      finalReviewPlan: ['Mix for and while loop decisions.'],
    }
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(blueprint) }] } },
        ],
      }),
    })
    ;[1, 2, 3].forEach((index) => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        ...makeRichPathDashboard(index, `Loop lesson ${index}`),
                        contentMode:
                          index === 1
                            ? 'orientationMap'
                            : index === 3
                              ? 'practiceCheckpoint'
                              : 'workedExampleLab',
                        supportArtifacts:
                          index === 1
                            ? {
                                glossary: [
                                  {
                                    term: 'for loop',
                                    definition:
                                      'A loop that repeats over items in a sequence.',
                                  },
                                ],
                                contrastTable: {
                                  title: 'Loop choice',
                                  headers: ['Use case', 'Loop'],
                                  rows: [
                                    ['Known sequence', 'for loop'],
                                    ['Unknown stopping point', 'while loop'],
                                  ],
                                },
                                discussionPrompts: [
                                  'When would a while loop be clearer than a for loop?',
                                ],
                              }
                            : undefined,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        score: 4,
                        issues: [],
                        repairInstructions: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        })
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateStudyPathWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Python Loops',
      prompt: 'Teach me Python loops',
      folderName: '',
    })

    expect(fetchMock).toHaveBeenCalledTimes(7)
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'Plan a high-quality StudyMesh Study Guide',
    )
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'Choose dashboardCount between 3 and 7',
    )
    expect(fetchMock.mock.calls[1][1].body).toContain(
      'Create one StudyMesh Study Guide dashboard',
    )
    expect(fetchMock.mock.calls[2][1].body).toContain(
      'Evaluate this StudyMesh Study Guide dashboard',
    )
    expect(draft.blueprint?.learningObjectives).toContain('Use for loops')
    expect(draft.dashboards[0]).toMatchObject({
      moduleTitle: 'Loop foundations',
      contentMode: 'orientationMap',
      learnerQuestion: 'How do loops work in case 1?',
      learningOutcome: 'Apply loop pattern 1.',
      qualityScore: 4,
      qualityIssues: [],
    })
    expect(draft.dashboardCountReason).toBe(
      'Three dashboards are enough for a first map.',
    )
    expect(draft.dashboards[0].objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'term', term: 'for loop' }),
        expect.objectContaining({ kind: 'table', title: 'Loop choice' }),
        expect.objectContaining({
          kind: 'reviewPrompt',
          prompt: 'When would a while loop be clearer than a for loop?',
        }),
      ]),
    )
  })

  it('normalizes invalid Auto Study Guide dashboard counts to five dashboards', async () => {
    const blueprint = {
      title: 'Invalid Count Path',
      folderName: 'Invalid Count Path',
      pathPromise: 'Build a first map.',
      entryLevel: 'Beginner',
      exitCapability: 'Explain the topic shape.',
      dashboardCount: 8,
      dashboardCountReason: 'The planner tried to make a long path.',
      learnerProfile: 'Beginner.',
      scope: 'Bounded sprint.',
      prerequisites: [],
      learningObjectives: ['Understand the map'],
      conceptGraph: ['map -> practice'],
      modules: [
        {
          title: 'Core',
          goal: 'Understand the topic.',
          lessonIndexes: [0, 1, 2, 3, 4],
        },
      ],
      lessons: Array.from({ length: 8 }, (_value, index) => ({
        title: `Auto lesson ${index + 1}`,
        moduleTitle: 'Core',
        lessonType: index === 0 ? 'orientation' : 'concept',
        learnerQuestion: `Question ${index + 1}?`,
        learningOutcome: `Outcome ${index + 1}.`,
        dashboardPurpose: 'lesson',
        practiceType: 'none',
        contentMode: contentModes[index],
        sectionPlan: ['Map', 'Example'],
        mustTeach: [`Idea ${index + 1}`],
        workedExample: `Example ${index + 1}.`,
        misconceptionChecks: [],
        retrievalPractice: [],
      })),
      finalReviewPlan: [],
    }
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(blueprint) }] } },
        ],
      }),
    })

    Array.from({ length: 5 }, (_value, index) => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        ...makeRichPathDashboard(
                          index + 1,
                          `Auto lesson ${index + 1}`,
                        ),
                        contentMode: contentModes[index],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        score: 4,
                        issues: [],
                        repairInstructions: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        })
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateStudyPathWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Invalid Count Path',
      prompt: 'Teach a broad topic',
      folderName: '',
    })

    expect(draft.dashboards).toHaveLength(5)
    expect(draft.dashboardCountReason).toContain(
      'Planner requested 8 dashboards',
    )
  })

  it('requests structured JSON and normalizes generated study objects', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Derivatives',
                    sourceFormat: 'text',
                    sourceSummary: {
                      title: 'Derivative summary',
                      bullets: [
                        'A derivative measures instantaneous rate of change.',
                      ],
                    },
                    conceptRecap: {
                      title: 'Concept recap',
                      sections: [
                        {
                          title: 'Derivative',
                          bullets: [
                            'Use derivatives to reason about instantaneous rates of change.',
                          ],
                          example: 'Velocity is the derivative of position.',
                        },
                      ],
                    },
                    practice: {
                      multipleChoice: [
                        {
                          question:
                            'Which situation is best modeled by a derivative?',
                          options: [
                            'Instantaneous speed',
                            'A fixed label',
                            'A category name',
                          ],
                          correctOptionIndex: 0,
                          explanation:
                            'Instantaneous speed is a rate of change.',
                        },
                      ],
                    },
                    flashcards: [
                      {
                        front: 'What does a derivative measure?',
                        back: 'Instantaneous rate of change.',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateQuickCreateWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Derivatives',
      rawNotes: 'Derivative = instantaneous rate of change',
      packId: 'derivatives',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/gemini-test:generateContent'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-goog-api-key': 'test-token',
        }),
      }),
    )
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig,
    ).toMatchObject({
      responseMimeType: 'application/json',
    })
    expect(draft.sourceSummary?.bullets).toEqual([
      'A derivative measures instantaneous rate of change.',
    ])
    expect(draft.objects[0]).toMatchObject({
      kind: 'list',
      title: 'Derivative',
    })
    expect(draft.objects.filter((object) => object.kind === 'quiz')).toEqual([
      expect.objectContaining({ quizMode: 'multipleChoice' }),
    ])
    expect(draft.objects.filter((object) => object.kind === 'qa')).toHaveLength(
      1,
    )
    expect(
      draft.objects
        .filter((object) => object.kind === 'quiz')
        .map((object) => object.question)
        .join(' '),
    ).not.toContain('Which statement best explains')
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'Quizzes should be 50-60% of the pack',
    )
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'do not always put the correct answer first',
    )
    expect(fetchMock.mock.calls[0][1].body).toContain('"sourceSummary"')
    expect(fetchMock.mock.calls[0][1].body).toContain('strict valid JSON')
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'Which statement best explains X?',
    )
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'Do not output \\"objects\\"',
    )
    expect(draft.debugTrace?.rawAiResponse).toContain('Derivative summary')
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('passes Quick Create resource choice into Gemini and filters extras', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Derivatives',
                    sourceFormat: 'text',
                    sourceSummary: {
                      title: 'Derivative summary',
                      bullets: [
                        'A derivative measures instantaneous rate of change.',
                      ],
                    },
                    conceptRecap: {
                      title: 'Concept recap',
                      sections: [
                        {
                          title: 'Derivative',
                          bullets: [
                            'Use derivatives to reason about rates of change.',
                          ],
                          example: 'Velocity is a derivative.',
                        },
                      ],
                    },
                    practice: {
                      shortAnswer: [
                        {
                          question:
                            'How would you apply a derivative to compare motion?',
                          expectedAnswer:
                            'Compare instantaneous rates of change.',
                          explanation:
                            'Derivatives describe instantaneous rates.',
                        },
                      ],
                      multipleChoice: [
                        {
                          question:
                            'Which derivative use best compares changing motion?',
                          options: [
                            'Compare instantaneous rates of change',
                            'Count total objects only',
                            'Ignore time completely',
                          ],
                          correctOptionIndex: 0,
                          explanation:
                            'Derivatives describe instantaneous rates.',
                        },
                      ],
                    },
                    flashcards: [
                      {
                        front: 'What does a derivative measure?',
                        back: 'Instantaneous rate of change.',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateQuickCreateWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Derivatives',
      rawNotes: 'Derivative = instantaneous rate of change',
      packId: 'derivatives',
      resourceType: 'quiz',
      detailLevel: 'long',
      generationTargets: ['quizzes'],
      generationAmount: 'many',
    })

    expect(fetchMock.mock.calls[0][1].body).toContain(
      'Selected resource type: Quiz',
    )
    expect(fetchMock.mock.calls[0][1].body).toContain('Detail level: Long')
    expect(fetchMock.mock.calls[0][1].body).toContain(
      '30-40 multiple-choice questions',
    )
    expect(fetchMock.mock.calls[0][1].body).not.toContain(
      `Leave practice.${'shortAnswer'} empty`,
    )
    expect(fetchMock.mock.calls[0][1].body).not.toContain(
      `practice.${'shortAnswer'}`,
    )
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'Never output typed-answer',
    )
    expect(draft.objects.map((object) => object.kind)).toEqual(['quiz'])
    expect(draft.objects).toEqual([
      expect.objectContaining({ quizMode: 'multipleChoice' }),
    ])
    expect(draft.warnings).toContain(
      'Filtered generated content to the selected resource type.',
    )
  })

  it('asks strong models for quiz-style flashcards around the requested count', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Subjunctive',
                    sourceFormat: 'text',
                    sourceSummary: {
                      title: 'Source summary',
                      bullets: ['The subjunctive appears after doubt.'],
                    },
                    conceptRecap: {
                      title: 'Concept recap',
                      sections: [],
                    },
                    practice: {
                      multipleChoice: [
                        {
                          question: 'Which sentence needs subjunctive?',
                          options: [
                            'A doubt trigger with a new subject',
                            'A confirmed fact',
                            'A direct command',
                          ],
                          correctOptionIndex: 0,
                          explanation: 'Doubt can trigger subjunctive.',
                        },
                      ],
                    },
                    flashcards: [
                      {
                        front:
                          'A sentence has doubt plus a new subject. What mood should the verb use?',
                        back: 'Use the subjunctive because doubt with a new subject triggers it.',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateQuickCreateWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Subjunctive',
      rawNotes: 'Use subjunctive after doubt when subjects change.',
      packId: 'subjunctive',
      resourceType: 'flashcards',
      detailLevel: 'long',
      generationTargets: ['flashcards'],
      generationAmount: 'many',
    })

    const body = fetchMock.mock.calls[0][1].body
    expect(body).toContain('Selected resource type: Flashcards')
    expect(body).toContain('40-50 flashcards')
    expect(body).toContain(
      'same reasoning/application quality expected from quizzes',
    )
    expect(body).toContain('Prefer scenario, application, contrast')
    expect(body).toContain('Do not copy headings, first sentences')
    expect(draft.objects.map((object) => object.kind)).toEqual(['qa'])
    expect(draft.warnings).toContain(
      'Filtered generated content to the selected resource type.',
    )
  })

  it('retries Study Guide generation when Gemini returns malformed JSON with strict dashboards', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"dashboards": [' }] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'French Past Tense',
                      folderName: 'French Past Tense',
                      dashboards: [
                        {
                          title: '01 - Content 1',
                          summary: 'Past tense basics',
                          rawNotes:
                            'The passe compose is a French past tense used for completed actions. It is formed with avoir or etre plus a past participle.',
                          sourceSummary: {
                            title: 'Past tense basics',
                            bullets: [
                              'The passe compose is used for completed actions.',
                            ],
                          },
                          conceptRecap: {
                            title: 'Passe compose recap',
                            sections: [
                              {
                                title: 'Passe compose formation',
                                bullets: [
                                  'Form it with avoir or etre plus a past participle.',
                                ],
                                example: 'J ai parle.',
                              },
                            ],
                          },
                          practice: {
                            shortAnswer: [
                              {
                                question:
                                  'How would you form a completed-action sentence with passe compose?',
                                expectedAnswer:
                                  'Use avoir or etre plus the past participle.',
                                explanation:
                                  'The auxiliary plus past participle forms the tense.',
                              },
                            ],
                            multipleChoice: [],
                          },
                          flashcards: [
                            {
                              front: 'What does passe compose express?',
                              back: 'Completed past actions.',
                            },
                          ],
                          objects: [
                            {
                              kind: 'markdown',
                              title: 'Passé composé',
                              markdown:
                                'The passe compose is a French past tense used for completed actions.',
                            },
                          ],
                        },
                        {
                          title: '02 - Content 2',
                          summary: 'Auxiliary choice',
                          rawNotes:
                            'Use etre with movement verbs and reflexive verbs. A common mistake is choosing avoir for those verbs.',
                          sourceSummary: {
                            title: 'Auxiliary choice',
                            bullets: [
                              'Use etre with movement and reflexive verbs.',
                            ],
                          },
                          conceptRecap: {
                            title: 'Auxiliary recap',
                            sections: [
                              {
                                title: 'Etre verbs',
                                bullets: [
                                  'Movement and reflexive verbs use etre.',
                                ],
                                example: 'Elle est allee.',
                              },
                            ],
                          },
                          practice: {
                            shortAnswer: [],
                            multipleChoice: [
                              {
                                question:
                                  'Which auxiliary should you choose for a reflexive verb?',
                                options: ['etre', 'avoir', 'faire'],
                                correctOptionIndex: 0,
                                explanation:
                                  'Reflexive verbs use etre in passe compose.',
                              },
                            ],
                          },
                          flashcards: [],
                          concepts: [
                            {
                              concept: 'Auxiliary choice',
                              definition:
                                'French compound tenses choose an auxiliary based on verb type.',
                              usageRule:
                                'Use etre with movement verbs and reflexive verbs.',
                            },
                          ],
                          objects: [
                            {
                              kind: 'markdown',
                              title: 'Auxiliary choice',
                              markdown:
                                'Use etre with movement verbs and reflexive verbs.',
                            },
                          ],
                        },
                        {
                          title: '03 - Exercises',
                          summary: 'Mixed practice',
                          rawNotes:
                            'Use this dashboard to answer mixed exercises from the Study Guide.',
                          sourceSummary: {
                            title: 'Mixed practice',
                            bullets: ['Practice passe compose choices.'],
                          },
                          conceptRecap: {
                            title: 'Mixed recap',
                            sections: [
                              {
                                title: 'Auxiliary and participle',
                                bullets: [
                                  'Choose the auxiliary before applying the participle.',
                                ],
                                example: 'Nous sommes partis.',
                              },
                            ],
                          },
                          practice: {
                            shortAnswer: [
                              {
                                question:
                                  'Correct the sentence by choosing the right auxiliary: Je me ___ leve.',
                                expectedAnswer: 'suis',
                                explanation:
                                  'Reflexive verbs use etre, so je me suis leve.',
                              },
                            ],
                            multipleChoice: [],
                          },
                          flashcards: [],
                          concepts: [],
                          objects: [
                            {
                              kind: 'quiz',
                              question:
                                'What do the notes say about exercises?',
                              quizMode: 'shortAnswer',
                              answer: 'Practice',
                            },
                          ],
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateStudyPathWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'French Past Tense',
      prompt: 'Teach me passe compose',
      folderName: '',
      generationAmount: 'few',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1].body).toContain(
      'Return syntactically valid JSON',
    )
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'plan multiple-choice retrieval questions',
    )
    expect(fetchMock.mock.calls[0][1].body).not.toContain('layoutArchetype')
    expect(
      draft.dashboards.map((dashboard) => dashboard.dashboardRole),
    ).toEqual(['normal', 'normal', 'normal'])
    expect(draft.dashboards[0]).toMatchObject({
      dashboardPurpose: 'lesson',
      practiceType: 'none',
    })
    expect(draft.dashboards[2]).toMatchObject({
      dashboardPurpose: 'lesson',
      practiceType: 'none',
    })
    expect(JSON.stringify(draft.dashboards[2].objects)).not.toContain(
      'What do the notes say about exercises?',
    )
    expect(draft.dashboards[2].objects).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'list' })]),
    )
  })

  it('uses valid Study Guide purpose metadata and falls back when metadata is invalid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Layout Path',
                    folderName: 'Layout Path',
                    dashboards: [
                      {
                        ...makeStrictPathDashboard(1, 'Reference Lesson'),
                        dashboardPurpose: 'lesson',
                        practiceType: 'quiz',
                        layoutReason: 'Keep grammar reference beside quiz.',
                      },
                      {
                        ...makeStrictPathDashboard(2, 'Bad Metadata'),
                        dashboardPurpose: 'randomPurpose',
                        practiceType: 'randomPractice',
                      },
                      makeStrictPathDashboard(3, 'Final Practice'),
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateStudyPathWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Layout Path',
      prompt: 'Teach grammar',
      folderName: '',
      generationAmount: 'few',
    })

    expect(draft.dashboards[0]).toMatchObject({
      dashboardPurpose: 'lesson',
      practiceType: 'quiz',
    })
    expect(draft.dashboards[1]).toMatchObject({
      dashboardPurpose: 'lesson',
      practiceType: 'none',
    })
    expect(draft.dashboards[2]).toMatchObject({
      dashboardPurpose: 'lesson',
      practiceType: 'none',
    })
  })

  it('keeps a Study Guide dashboard with only rawNotes and sourceSummary', async () => {
    mockSparseStudyPathResponse(3)

    const draft = await generateStudyPathWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Sparse Study Guide',
      prompt: 'Teach sparse material',
      folderName: '',
      generationAmount: 'few',
    })

    expect(draft.dashboards).toHaveLength(3)
    expect(draft.dashboards[0]).toMatchObject({
      title: '01 - Sparse 1',
      dashboardRole: 'normal',
    })
    expect(draft.dashboards[0].objects).toHaveLength(1)
    expect(
      draft.dashboards[0].objects.every((object) => object.kind === 'list'),
    ).toBe(true)
    expect(draft.dashboards[0].debugTrace?.finalObjects).toEqual(
      draft.dashboards[0].objects,
    )
  })

  it('repairs source-summary-only normal Study Guide dashboards before fallback', async () => {
    const sparseDashboards = Array.from({ length: 5 }, (_value, index) => ({
      title: `${String(index + 1).padStart(2, '0')} - Sparse ${index + 1}`,
      summary: `Sparse dashboard ${index + 1}`,
      rawNotes: `Sparse notes ${
        index + 1
      } explain a rich rule with examples and mistakes that can support practice and flashcards.`,
      sourceSummary: {
        title: `Sparse summary ${index + 1}`,
        bullets: [`Sparse source summary bullet ${index + 1}.`],
      },
    }))
    const repairedDashboards = Array.from({ length: 5 }, (_value, index) =>
      makeRichPathDashboard(index + 1, `Lesson ${index + 1}`),
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'Repaired Path',
                      folderName: 'Repaired Path',
                      dashboards: sparseDashboards,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'Repaired Path',
                      folderName: 'Repaired Path',
                      dashboards: repairedDashboards,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateStudyPathWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Sparse Study Guide',
      prompt: 'Teach sparse material',
      folderName: '',
      generationAmount: 'medium',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'practice and flashcards should usually be empty',
    )
    expect(fetchMock.mock.calls[1][1].body).toContain('Original JSON')
    expect(fetchMock.mock.calls[1][1].body).toContain(
      'Preserve the exact dashboard count, order, titles, summaries, and rawNotes',
    )
    expect(draft.dashboards).toHaveLength(5)
    expect(
      draft.dashboards.slice(0, 3).map((dashboard) => dashboard.objects.length),
    ).toEqual([5, 5, 5])
    expect(
      draft.dashboards
        .slice(0, 3)
        .flatMap((dashboard) => dashboard.objects)
        .every((object) => object.kind === 'quiz' || object.kind === 'qa'),
    ).toBe(true)
    expect(draft.dashboards[0].debugTrace?.droppedOrRepairedItems).toEqual(
      expect.arrayContaining([
        'AI provided sourceSummary only before repair.',
        'AI missing normal-dashboard practice/flashcards before repair.',
        'Repair retry used for incomplete normal dashboard.',
        expect.stringContaining(
          'Intentionally suppressed 2 conceptRecap/list-style normal-dashboard objects',
        ),
      ]),
    )
    expect(draft.dashboards[0].debugTrace?.droppedOrRepairedItems).not.toEqual(
      expect.arrayContaining([expect.stringContaining('Fallback used')]),
    )
  })

  it.each([
    ['few' as const, 3],
    ['medium' as const, 5],
    ['many' as const, 7],
  ])(
    'preserves %s Study Guide dashboard count with sparse usable dashboards',
    async (generationAmount, expectedCount) => {
      mockSparseStudyPathResponse(expectedCount)

      const draft = await generateStudyPathWithAi({
        apiToken: 'test-token',
        model: 'gemini-test',
        title: 'Sparse Study Guide',
        prompt: 'Teach sparse material',
        folderName: '',
        generationAmount,
      })

      expect(draft.dashboards).toHaveLength(expectedCount)
      expect(draft.dashboards.map((dashboard) => dashboard.title)).toEqual(
        Array.from(
          { length: expectedCount },
          (_value, index) =>
            `${String(index + 1).padStart(2, '0')} - Sparse ${index + 1}`,
        ),
      )
      expect(
        draft.dashboards.every((dashboard) => dashboard.objects.length > 0),
      ).toBe(true)
    },
  )

  it('drops only completely unusable Study Guide dashboard entries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Sparse Study Guide',
                    folderName: 'Sparse Study Guide',
                    dashboards: [
                      {},
                      {
                        title: '02 - Usable',
                        summary: 'Usable sparse dashboard',
                        rawNotes:
                          'Usable notes explain one idea well enough to preserve the dashboard.',
                        sourceSummary: {
                          title: 'Usable summary',
                          bullets: ['Keep this dashboard.'],
                        },
                      },
                      {},
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateStudyPathWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Sparse Study Guide',
      prompt: 'Teach sparse material',
      folderName: '',
      generationAmount: 'few',
    })

    expect(draft.dashboards).toHaveLength(1)
    expect(draft.dashboards[0].title).toBe('02 - Usable')
  })

  it('filters balanced Study Guide final mappings by dashboard role', async () => {
    mockStudyPathResponse(5)

    const draft = await generateStudyPathWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'French Subjunctive',
      prompt: 'Teach French subjunctive',
      folderName: '',
      generationAmount: 'medium',
    })
    const summary = draft.dashboards[3]
    const exercises = draft.dashboards[4]

    expect(
      draft.dashboards
        .slice(0, 3)
        .flatMap((dashboard) => dashboard.objects)
        .every((object) => object.kind === 'quiz' || object.kind === 'qa'),
    ).toBe(true)
    expect(draft.dashboards[0].debugTrace?.droppedOrRepairedItems).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Intentionally suppressed 1 conceptRecap/list-style normal-dashboard object',
        ),
      ]),
    )
    expect(draft.dashboards[0].debugTrace?.finalObjects).toEqual(
      draft.dashboards[0].objects,
    )

    expect(summary.dashboardRole).toBe('normal')
    expect(
      summary.objects.every(
        (object) => object.kind === 'quiz' || object.kind === 'qa',
      ),
    ).toBe(true)
    expect(summary.debugTrace?.finalObjects).toEqual(summary.objects)
    expect(JSON.stringify(summary.debugTrace?.rawDashboardInput)).toContain(
      'Use the lesson 4 rule.',
    )

    expect(exercises.dashboardRole).toBe('normal')
    expect(
      exercises.objects.filter(
        (object) => object.kind === 'list' || object.kind === 'markdown',
      ),
    ).toHaveLength(0)
    expect(exercises.debugTrace?.finalObjects).toEqual(exercises.objects)
    expect(JSON.stringify(exercises.debugTrace?.rawDashboardInput)).toContain(
      'conceptRecap',
    )
  })

  it('keeps extended Study Guide generated dashboards role-neutral', async () => {
    mockStudyPathResponse(7)

    const draft = await generateStudyPathWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'French Subjunctive',
      prompt: 'Teach French subjunctive',
      folderName: '',
      generationAmount: 'many',
    })
    const summary = draft.dashboards[5]
    const exercises = draft.dashboards[6]

    expect(summary.dashboardRole).toBe('normal')
    expect(
      summary.objects.every(
        (object) => object.kind === 'quiz' || object.kind === 'qa',
      ),
    )

    expect(exercises.dashboardRole).toBe('normal')
    expect(
      exercises.objects.every(
        (object) => object.kind === 'quiz' || object.kind === 'qa',
      ),
    ).toBe(true)
  })

  it('keeps compact Study Guide generated dashboards role-neutral', async () => {
    mockStudyPathResponse(3)

    const draft = await generateStudyPathWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'French Subjunctive',
      prompt: 'Teach French subjunctive',
      folderName: '',
      generationAmount: 'few',
    })
    const exercises = draft.dashboards[2]

    expect(exercises.dashboardRole).toBe('normal')
    expect(
      exercises.objects.every(
        (object) => object.kind === 'quiz' || object.kind === 'qa',
      ),
    ).toBe(true)
    expect(exercises.objects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'list' }),
        expect.objectContaining({ kind: 'markdown' }),
      ]),
    )
  })

  it('stops Gemini requests after the hard timeout', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('Request aborted', 'AbortError'))
          })
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const request = generateQuickCreateWithAi({
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Derivatives',
      rawNotes: 'Derivative = instantaneous rate of change',
      packId: 'derivatives',
    })
    const rejection = expect(request).rejects.toThrow(/longer than 5 minutes/i)

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    await rejection
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true)
    vi.useRealTimers()
  })

  it('returns a useful message when Gemini rate limits the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          status: 'RESOURCE_EXHAUSTED',
          message:
            'You reached your peak requests per day to gemini, revise the usage here https://ai.google.dev/gemini-api/docs/rate-limits',
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      generateQuickCreateWithAi({
        apiToken: 'test-token',
        model: 'gemini-test',
        title: 'Derivatives',
        rawNotes: 'Derivative = instantaneous rate of change',
        packId: 'derivatives',
      }),
    ).rejects.toThrow(/Gemini rate limit reached for today/i)
  })

  it('uses Cerebras chat completions as a strong model provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Derivatives',
                sourceFormat: 'text',
                sourceSummary: {
                  title: 'Derivative summary',
                  bullets: [
                    'A derivative measures instantaneous rate of change.',
                  ],
                },
                conceptRecap: {
                  title: 'Concept recap',
                  sections: [
                    {
                      title: 'Derivative',
                      bullets: [
                        'Use derivatives to reason about rates of change.',
                      ],
                      example: 'Velocity is a derivative.',
                    },
                  ],
                },
                practice: {
                  shortAnswer: [],
                  multipleChoice: [],
                },
                flashcards: [],
              }),
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateQuickCreateWithAi({
      strongProvider: 'cerebras',
      apiToken: 'cerebras-token',
      model: 'gpt-oss-120b',
      title: 'Derivatives',
      rawNotes: 'Derivative = instantaneous rate of change',
      packId: 'derivatives',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cerebras.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer cerebras-token',
        }),
      }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      model: 'gpt-oss-120b',
      temperature: 0.2,
      max_completion_tokens: 8192,
    })
    expect(body.response_format.type).toBe('json_schema')
    expect(body.messages[0].content).toContain('strict valid JSON')
    expect(draft.sourceSummary?.bullets).toEqual([
      'A derivative measures instantaneous rate of change.',
    ])
  })

  it('returns a useful message when Cerebras rate limits the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message: 'rate limit exceeded',
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      generateQuickCreateWithAi({
        strongProvider: 'cerebras',
        apiToken: 'cerebras-token',
        model: 'gpt-oss-120b',
        title: 'Derivatives',
        rawNotes: 'Derivative = instantaneous rate of change',
        packId: 'derivatives',
      }),
    ).rejects.toThrow(/Cerebras free limit reached/i)
  })
})
