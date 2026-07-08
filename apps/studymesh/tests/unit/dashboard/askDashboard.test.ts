import { beforeEach, describe, expect, it, vi } from 'vitest'

import { askDashboardSources } from '../../../src/dashboardChat/askDashboard'
import {
  callStrongAiModel,
  readQuickCreateAiSettings,
} from '../../../src/quickCreate/ai'

vi.mock('../../../src/quickCreate/ai', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/quickCreate/ai')
  >('../../../src/quickCreate/ai')

  return {
    ...actual,
    readQuickCreateAiSettings: vi.fn(),
    resolveQuickCreateAiCredentials: vi.fn(() => ({
      apiToken: 'gemini-token',
      model: 'gemini-test',
    })),
    callStrongAiModel: vi.fn(),
  }
})

describe('askDashboardSources', () => {
  beforeEach(() => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({ provider: 'gemini' })
    vi.mocked(callStrongAiModel).mockReset()
  })

  it('strips leaked sources JSON from the visible answer', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue(
      `Les dinosaures les plus étranges incluent Gigantoraptor et Nigersaurus [1].

{ "sources": [ { "title": "Les 5 dinosaures les plus étranges !", "summary": "Article source.", "url": "https://example.com/dinos", "citation": "1" } ] }`,
    )

    const result = await askDashboardSources({
      dashboardTitle: 'Dinosaures',
      contextText:
        '[1] Les 5 dinosaures les plus étranges ! (web source)\nGigantoraptor and Nigersaurus are unusual dinosaurs.',
      question: 'Quels sont les dinosaures les plus étranges ?',
      history: [],
      sourceChunks: [
        {
          id: 'web-source-1',
          title: 'Les 5 dinosaures les plus étranges !',
          type: 'web source',
          text: 'Gigantoraptor and Nigersaurus are unusual dinosaurs.',
          origin: 'web',
          url: 'https://example.com/dinos',
        },
      ],
      contentLanguage: 'fr',
    })

    expect(result.answer).toContain('Gigantoraptor')
    expect(result.answer).toContain('[1]')
    expect(result.answer).not.toContain('"sources"')
    expect(result.answer).not.toContain('{')
    expect(result.sourceRefs).toEqual([
      expect.objectContaining({
        citationNumber: 1,
        chunkId: 'web-source-1',
        origin: 'web',
      }),
    ])
    expect(result.answerBasis).toEqual(['web'])
    expect(result.contextSupport).toBe('direct')
  })
})
