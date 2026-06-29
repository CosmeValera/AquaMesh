import { beforeEach, describe, expect, it, vi } from 'vitest'

import { askDashboardSources } from '../../../src/dashboardChat/askDashboard'
import {
  callLocalLanguageModel,
  callStrongAiModel,
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
} from '../../../src/quickCreate/ai'
import { callHostedAiModel } from '../../../src/quickCreate/ai/hostedClient'

vi.mock('../../../src/quickCreate/ai', () => ({
  callLocalLanguageModel: vi.fn(),
  callStrongAiModel: vi.fn(),
  isStrongAiProvider: (provider: unknown) =>
    provider === 'gemini' || provider === 'cerebras',
  readQuickCreateAiSettings: vi.fn(),
  resolveQuickCreateAiCredentials: vi.fn(),
  STRONG_AI_PROVIDERS: {
    gemini: { label: 'Gemini', modeLabel: 'Own Gemini API token' },
    cerebras: {
      label: 'Cerebras',
      modeLabel: 'Own Cerebras API key',
      defaultModel: 'gpt-oss-120b',
    },
  },
}))

vi.mock('../../../src/quickCreate/ai/hostedClient', () => ({
  callHostedAiModel: vi.fn(),
}))

const baseOptions = {
  dashboardTitle: 'Biology',
  contextText: 'Photosynthesis turns light into chemical energy.',
  question: 'What is photosynthesis?',
  history: [],
  sourceChunks: [
    {
      id: 'chunk-1',
      title: 'Lesson notes',
      text: 'Photosynthesis turns light into chemical energy.',
      type: 'dashboard',
    },
  ],
}

describe('askDashboardSources', () => {
  beforeEach(() => {
    vi.mocked(callLocalLanguageModel).mockReset()
    vi.mocked(callStrongAiModel).mockReset()
    vi.mocked(callHostedAiModel).mockReset()
    vi.mocked(readQuickCreateAiSettings).mockReset()
    vi.mocked(resolveQuickCreateAiCredentials).mockReset()
  })

  it('uses the selected Cerebras strong provider for dashboard chat', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'cerebras',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(resolveQuickCreateAiCredentials).mockReturnValue({
      provider: 'cerebras',
      apiToken: 'cerebras-key',
      model: 'gpt-oss-120b',
      strongProviders: {},
      tokenSource: 'settings',
    })
    vi.mocked(callStrongAiModel).mockResolvedValue(
      'Photosynthesis is how plants store light energy.',
    )

    const result = await askDashboardSources(baseOptions)

    expect(resolveQuickCreateAiCredentials).toHaveBeenCalledWith('cerebras')
    expect(callStrongAiModel).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'cerebras',
        apiToken: 'cerebras-key',
        model: 'gpt-oss-120b',
        timeoutMs: 45000,
      }),
    )
    expect(result.answer).toBe(
      'Photosynthesis is how plants store light energy.',
    )
  })

  it('uses hosted Study Credits transport for dashboard chat', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'hosted',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(callHostedAiModel).mockResolvedValue(
      'Photosynthesis converts light into stored chemical energy.',
    )

    const result = await askDashboardSources(baseOptions)

    expect(callHostedAiModel).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: 'chat',
        parts: [
          expect.objectContaining({
            text: expect.stringContaining(
              'Student question: What is photosynthesis?',
            ),
          }),
        ],
        timeoutMs: 45000,
      }),
    )
    expect(callStrongAiModel).not.toHaveBeenCalled()
    expect(result).toEqual({
      answer: 'Photosynthesis converts light into stored chemical energy.',
      sourceRefs: [
        {
          citationNumber: 1,
          chunkId: 'chunk-1',
          title: 'Lesson notes',
          type: 'dashboard',
          textPreview: 'Photosynthesis turns light into chemical energy.',
          origin: undefined,
          url: undefined,
          dashboardKey: undefined,
          dashboardTitle: undefined,
          dashboardIndex: undefined,
        },
      ],
      needsExternalSource: false,
    })
  })

  it('routes hosted dashboard chat in the detected question language', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'hosted',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(callHostedAiModel).mockResolvedValue(
      'La fotosintesis convierte la luz en energia quimica.',
    )

    await askDashboardSources({
      ...baseOptions,
      question: 'Puedes explicarme que es la fotosintesis y por que importa?',
    })

    expect(callHostedAiModel).toHaveBeenCalledWith(
      expect.objectContaining({
        outputLanguage: 'es',
        parts: [
          expect.objectContaining({
            text: expect.stringContaining('Output language: Spanish'),
          }),
        ],
      }),
    )
  })

  it('marks source gaps and strips the machine marker from visible answers', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'hosted',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(callHostedAiModel).mockResolvedValue(
      'SOURCE_GAP: The dashboard sources do not contain enough information about Ansible.',
    )

    const result = await askDashboardSources(baseOptions)

    const prompt = vi.mocked(callHostedAiModel).mock.calls[0][0].parts[0].text
    expect(prompt).toContain('start your answer with "SOURCE_GAP:"')
    expect(result).toMatchObject({
      answer:
        'The dashboard sources do not contain enough information about Ansible.',
      needsExternalSource: true,
    })
  })

  it('tells the model to answer smalltalk directly and does not escalate it to web lookup', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'hosted',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(callHostedAiModel).mockResolvedValue(
      'The dashboard sources do not contain enough information.',
    )

    const result = await askDashboardSources({
      ...baseOptions,
      question: 'how you',
    })

    const prompt = vi.mocked(callHostedAiModel).mock.calls[0][0].parts[0].text
    expect(prompt).toContain('conversational smalltalk')
    expect(prompt).toContain('Do not use "SOURCE_GAP:"')
    expect(result.needsExternalSource).toBe(false)
  })

  it('marks source gaps from legacy insufficient-context wording', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'hosted',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(callHostedAiModel).mockResolvedValue(
      'The dashboard sources do not contain enough information.',
    )

    const result = await askDashboardSources(baseOptions)

    expect(result.needsExternalSource).toBe(true)
  })

  it('asks models to cite numbered dashboard sources', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'hosted',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(callHostedAiModel).mockResolvedValue('It stores energy [1].')

    await askDashboardSources({
      ...baseOptions,
      contextText:
        'Dashboard: Biology\n\n---\n\nSource 1: Lesson notes (dashboard)\nPhotosynthesis turns light into chemical energy.',
    })

    const prompt = vi.mocked(callHostedAiModel).mock.calls[0][0].parts[0].text
    expect(prompt).toContain('cite it inline with its source number')
    expect(prompt).toContain('separate bracket citations with spaces')
    expect(prompt).toContain('Never write bare citation numbers')
    expect(prompt).toContain('Use inline citations only')
    expect(prompt).toContain('Source 1: Lesson notes')
  })

  it('uses Study Guide page indexes for source citation numbers', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'hosted',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(callHostedAiModel).mockResolvedValue('Use page four [4].')

    const result = await askDashboardSources({
      ...baseOptions,
      sourceChunks: [
        {
          ...baseOptions.sourceChunks[0],
          dashboardKey: 'page-4',
          dashboardTitle: '04 - Feature Comparison',
          dashboardIndex: 4,
        },
      ],
      contextText:
        'Dashboard: Biology\n\n---\n\nSource 4: 04 - Feature Comparison (dashboard)\nDetails.',
    })

    expect(result.sourceRefs[0]).toMatchObject({
      citationNumber: 4,
      dashboardKey: 'page-4',
      dashboardIndex: 4,
    })
  })

  it('keeps later Study Guide page citation refs clickable by page index', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'hosted',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(callHostedAiModel).mockResolvedValue('Use page five [5].')

    const result = await askDashboardSources({
      ...baseOptions,
      sourceChunks: Array.from({ length: 8 }, (_, index) => ({
        id: `chunk-${index}`,
        title: `Page ${index + 1}`,
        text: `Details for page ${index + 1}.`,
        type: 'dashboard',
        dashboardKey: `page-${index + 1}`,
        dashboardTitle: `Page ${index + 1}`,
        dashboardIndex: index + 1,
      })),
      contextText:
        'Dashboard: Guide\n\n---\n\nSource 5: Page 5 (dashboard)\nDetails.',
    })

    expect(result.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          citationNumber: 5,
          dashboardKey: 'page-5',
        }),
      ]),
    )
  })

  it('keeps the first user goal and recent messages for strong dashboard chat memory', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'cerebras',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(resolveQuickCreateAiCredentials).mockReturnValue({
      provider: 'cerebras',
      apiToken: 'cerebras-key',
      model: 'gpt-oss-120b',
      strongProviders: {},
      tokenSource: 'settings',
    })
    vi.mocked(callStrongAiModel).mockResolvedValue('Use the Calvin cycle.')

    await askDashboardSources({
      ...baseOptions,
      history: [
        { role: 'user', content: 'Help me study photosynthesis for a test.' },
        { role: 'assistant', content: 'Start with light reactions.' },
        { role: 'user', content: 'What should I memorize first?' },
        { role: 'assistant', content: 'Memorize inputs and outputs.' },
        { role: 'user', content: 'Now compare it to respiration.' },
        { role: 'assistant', content: 'They move energy differently.' },
      ],
    })

    const prompt = vi.mocked(callStrongAiModel).mock.calls[0][0].parts[0].text
    expect(prompt).toContain(
      'Original student goal: Help me study photosynthesis for a test.',
    )
    expect(prompt).not.toContain('Assistant: Start with light reactions.')
    expect(prompt).toContain('Student: What should I memorize first?')
    expect(prompt).toContain('Assistant: They move energy differently.')
  })

  it('does not duplicate the first user goal when it is already recent', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'hosted',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(callHostedAiModel).mockResolvedValue('Plants use chlorophyll.')

    await askDashboardSources({
      ...baseOptions,
      history: [
        { role: 'user', content: 'Explain chlorophyll.' },
        { role: 'assistant', content: 'It absorbs light.' },
      ],
    })

    const prompt = vi.mocked(callHostedAiModel).mock.calls[0][0].parts[0].text
    expect(prompt).not.toContain('Original student goal:')
    expect(prompt).toContain('Student: Explain chlorophyll.')
    expect(prompt).toContain('Assistant: It absorbs light.')
  })

  it('omits chat history for local dashboard chat', async () => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({
      provider: 'local',
      apiToken: '',
      model: '',
      strongProviders: {},
    })
    vi.mocked(callLocalLanguageModel).mockResolvedValue('Local answer.')

    await askDashboardSources({
      ...baseOptions,
      history: [
        { role: 'user', content: 'Keep this out of local prompt.' },
        { role: 'assistant', content: 'Also keep this out.' },
      ],
    })

    const prompt = vi.mocked(callLocalLanguageModel).mock.calls[0][0]
    expect(prompt).toContain('Conversation memory:\nNone')
    expect(prompt).not.toContain('Keep this out of local prompt.')
    expect(prompt).not.toContain('Also keep this out.')
  })
})
