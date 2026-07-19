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

  it('does not claim a web basis when the answer cites no web source', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue('An uncited answer.')

    const result = await askDashboardSources({
      dashboardTitle: 'Anatomy',
      contextText: '[1] Anatomy source\nRelevant anatomy content.',
      question: 'List the bones.',
      history: [],
      sourceChunks: [
        {
          id: 'web-source-1',
          title: 'Anatomy source',
          type: 'web source',
          text: 'Relevant anatomy content.',
          origin: 'web',
          url: 'https://example.com/anatomy',
        },
      ],
      allowedSources: ['web'],
    })

    expect(result.sourceRefs).toEqual([])
    expect(result.answerBasis).toEqual([])
    expect(result.contextSupport).toBe('none')
  })

  it('repairs invalid exact lists once before showing them', async () => {
    vi.mocked(callStrongAiModel)
      .mockResolvedValueOnce('1. Humerus\n1. Humerus')
      .mockResolvedValueOnce('1. Humerus\n2. Radius')

    const result = await askDashboardSources({
      dashboardTitle: 'Anatomy',
      contextText: '',
      question: 'Tell me the names of 2 bones.',
      history: [],
      sourceChunks: [],
      allowedSources: ['general'],
      exactAnswerCount: 2,
    })

    expect(result.answer).toBe('1. Humerus\n2. Radius')
    expect(callStrongAiModel).toHaveBeenCalledTimes(2)
  })

  it('does not run exact-list repair without a planned exact count', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue(
      'The 3 main bones of the arm are the humerus, radius, and ulna, and each has a distinct role.',
    )

    const result = await askDashboardSources({
      dashboardTitle: 'Anatomy',
      contextText: '',
      question: 'Give me 3 examples of arm bones and explain each one.',
      history: [],
      sourceChunks: [],
      allowedSources: ['general'],
    })

    expect(result.answer).toContain('humerus')
    expect(callStrongAiModel).toHaveBeenCalledTimes(1)
  })
})
