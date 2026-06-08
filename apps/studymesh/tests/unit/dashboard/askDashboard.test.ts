import { beforeEach, describe, expect, it, vi } from 'vitest'

import { askDashboardSources } from '../../../src/dashboardChat/askDashboard'
import {
  callStrongAiModel,
  readStudyPackAiSettings,
  resolveStudyPackAiCredentials,
} from '../../../src/studyPack/ai'
import { callHostedAiModel } from '../../../src/studyPack/ai/hostedClient'

vi.mock('../../../src/studyPack/ai', () => ({
  callLocalLanguageModel: vi.fn(),
  callStrongAiModel: vi.fn(),
  isStrongAiProvider: (provider: unknown) =>
    provider === 'gemini' || provider === 'cerebras',
  readStudyPackAiSettings: vi.fn(),
  resolveStudyPackAiCredentials: vi.fn(),
  STRONG_AI_PROVIDERS: {
    gemini: { label: 'Gemini', modeLabel: 'Own Gemini API token' },
    cerebras: { label: 'Cerebras', modeLabel: 'Own Cerebras API key' },
  },
}))

vi.mock('../../../src/studyPack/ai/hostedClient', () => ({
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
    vi.mocked(callStrongAiModel).mockReset()
    vi.mocked(callHostedAiModel).mockReset()
    vi.mocked(readStudyPackAiSettings).mockReset()
    vi.mocked(resolveStudyPackAiCredentials).mockReset()
  })

  it('uses the selected Cerebras strong provider for dashboard chat', async () => {
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
      provider: 'cerebras',
      apiToken: '',
      model: 'gpt-oss-120b',
      strongProviders: {},
    })
    vi.mocked(resolveStudyPackAiCredentials).mockReturnValue({
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

    expect(resolveStudyPackAiCredentials).toHaveBeenCalledWith('cerebras')
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
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
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
      sources: ['Lesson notes'],
    })
  })
})
