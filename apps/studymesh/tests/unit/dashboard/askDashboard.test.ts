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
    expect(result.answerBasis).toEqual(['general'])
    expect(result.contextSupport).toBe('none')
  })

  it('always reports a basis, falling back to the guide when it is the only source', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue(
      'The guide covers nine organ systems.',
    )

    const result = await askDashboardSources({
      dashboardTitle: 'Anatomy',
      contextText: '[1] Organ systems\nNine systems are listed.',
      question: 'What organ systems are covered in this guide?',
      history: [],
      sourceChunks: [],
      allowedSources: ['study-guide'],
    })

    expect(result.sourceRefs).toEqual([])
    expect(result.answerBasis).toEqual(['study-guide'])
  })

  it('tells the model to ground the answer in fetched web sources', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue('Lentils simmer 20 minutes.')

    await askDashboardSources({
      dashboardTitle: 'Anatomy',
      contextText: '[1] Lentil recipe\nSimmer lentils for 20 minutes.',
      question: 'search in internet the best way to cook lentils',
      history: [],
      sourceChunks: [
        {
          id: 'web-source-1',
          title: 'Lentil recipe',
          type: 'web source',
          text: 'Simmer lentils for 20 minutes.',
          origin: 'web',
          url: 'https://example.com/lentils',
        },
      ],
      allowedSources: ['web', 'general'],
    })

    const prompt = vi.mocked(callStrongAiModel).mock.calls[0][0].parts[0].text
    expect(prompt).toContain('Web sources were fetched for this question')
  })

  it('does not add the web grounding rule without fetched web sources', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue('An answer.')

    await askDashboardSources({
      dashboardTitle: 'Anatomy',
      contextText: '',
      question: 'What is homeostasis?',
      history: [],
      sourceChunks: [],
      allowedSources: ['study-guide', 'general'],
    })

    const prompt = vi.mocked(callStrongAiModel).mock.calls[0][0].parts[0].text
    expect(prompt).not.toContain('Web sources were fetched for this question')
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

  it('extracts the citation-quotes bookkeeping block and attaches quotes to their source refs', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue(
      `Kubernetes schedules containers across a cluster of worker nodes [1].

[[CITATION_QUOTES]]
1: Kubernetes schedules containers across a cluster of worker nodes.
[[/CITATION_QUOTES]]`,
    )

    const result = await askDashboardSources({
      dashboardTitle: 'DevOps',
      contextText:
        '[1] Kubernetes basics\nKubernetes schedules containers across a cluster of worker nodes.',
      question: 'What does Kubernetes do?',
      history: [],
      sourceChunks: [
        {
          id: 'page-1',
          title: 'Kubernetes basics',
          type: 'study guide page',
          text: 'Kubernetes schedules containers across a cluster of worker nodes.',
          origin: 'dashboard',
          dashboardKey: 'page-1-key',
          dashboardIndex: 1,
        },
      ],
    })

    expect(result.answer).not.toContain('CITATION_QUOTES')
    expect(result.answer).toContain('Kubernetes schedules containers')
    expect(result.sourceRefs).toEqual([
      expect.objectContaining({
        citationNumber: 1,
        quote: 'Kubernetes schedules containers across a cluster of worker nodes.',
      }),
    ])
  })

  it('falls back to the chunk text when the model omits a citation quote', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue(
      'A Pod wraps one or more containers that share networking and storage [1].',
    )

    const result = await askDashboardSources({
      dashboardTitle: 'Kubernetes',
      contextText:
        '[1] Pods\nIt wraps one or more containers that share networking and storage.',
      question: 'What is a pod?',
      history: [],
      sourceChunks: [
        {
          id: 'page-1',
          title: 'Pods',
          type: 'study guide page',
          text: 'It wraps one or more containers that share networking and storage.',
          origin: 'dashboard',
          dashboardKey: 'page-1-key',
          dashboardIndex: 1,
        },
      ],
    })

    expect(result.sourceRefs).toEqual([
      expect.objectContaining({
        citationNumber: 1,
        quote: 'It wraps one or more containers that share networking and storage.',
      }),
    ])
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
