import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanExternalSourceTextForDraft,
  prepareDashboardExternalSourcePageDraft,
} from '../../../src/dashboardChat/sourcePageDrafts'
import { callStrongAiModel, readQuickCreateAiSettings } from '../../../src/quickCreate/ai'

vi.mock('../../../src/quickCreate/ai', async () => {
  const actual =
    await vi.importActual<typeof import('../../../src/quickCreate/ai')>(
      '../../../src/quickCreate/ai',
    )

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

describe('source page drafts', () => {
  beforeEach(() => {
    vi.mocked(readQuickCreateAiSettings).mockReturnValue({ provider: 'gemini' })
    vi.mocked(callStrongAiModel).mockReset()
  })

  it('cleans malformed image markdown and page chrome before prompting', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue(
      JSON.stringify({
        title: 'Raptor source notes',
        markdown:
          '# Raptor source notes\n\nSource: [popsci.com](https://popsci.com/raptor)\n\n## Why this source matters\nThis source explains that Dineobellator was a nimble raptor related to Velociraptor.\n\n## Key points\n- The fossil evidence points to strong forelimbs, claws, and a mobile tail.\n- It lived near the end of the Cretaceous in New Mexico.\n\n## Useful details\nThe source helps compare raptor adaptations with other dinosaur groups.',
      }),
    )

    const draft = await prepareDashboardExternalSourcePageDraft({
      source: {
        id: 'source-1',
        title: 'These newly discovered raptors were like feather-covered cheetahs',
        url: 'https://popsci.com/raptor',
        text: "Share Advertisement ![the newly discovered dinosaur: Dineobellator notohesperus]( A newly discovered dinosaur was a cousin of Velociraptor but might have been an even more formidable hunter than its family member. Sponsor our work.",
        searchQuery: 'student question',
        fetchedAt: 1,
      },
      question: 'What does the raptor source show?',
      dashboardTitle: 'Dinosaurs',
      answer: 'It explains raptor adaptations.',
    })

    expect(draft.markdown).toContain('Dineobellator')
    const prompt = vi.mocked(callStrongAiModel).mock.calls[0][0].parts[0].text
    expect(prompt).not.toContain('![')
    expect(prompt).not.toContain('Advertisement')
    expect(prompt).toContain('Avoid generic repeated headings')
    expect(prompt).not.toContain(
      '"## Why this source matters", "## Key points", and "## Useful details"',
    )
  })

  it('uses the chat question language instead of the source page language', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue(
      JSON.stringify({
        title: 'Platypus comparison notes',
        markdown:
          '# Platypus comparison notes\n\nSource: abdobooks.com\n\n## Why this source matters\nThis source gives basic facts about the platypus that can support a comparison with dinosaurs.\n\n## Key points\n- The platypus is a mammal, while dinosaurs were reptiles.\n- The source discusses habitat, diet, and behavior rather than site metadata.\n\n## Useful details\nThese details help separate animal traits from unrelated page information.',
      }),
    )

    const draft = await prepareDashboardExternalSourcePageDraft({
      source: {
        id: 'source-1',
        title: 'Ornitorrinco - Visao geral',
        url: 'https://abdobooks.com/platypus',
        text: 'El ornitorrinco is an Australian mammal with a bill, webbed feet, and egg-laying reproduction.',
        searchQuery: 'ornitorrinco dinasour',
        fetchedAt: 1,
      },
      question:
        'Answer in English: search information on the internet to compare a platypus to a dinosaur.',
      dashboardTitle: 'Animals',
      answer: 'The source can help compare animal traits.',
      contentLanguage: 'pt',
    })

    const prompt = vi.mocked(callStrongAiModel).mock.calls[0][0].parts[0].text
    expect(prompt).toContain('Output language: English.')
    expect(prompt).not.toContain('Output language: Portuguese.')
    expect(draft.markdown.match(/^Source:/gim)).toHaveLength(1)
    expect(draft.markdown).not.toContain('Source: abdobooks.com')
  })

  it('rejects weak or boilerplate draft output', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue(
      JSON.stringify({
        title: 'Bad source',
        markdown:
          '# Bad source\n\nSource: [example.com](https://example.com)\n\nSubscribe to our newsletter and sponsor our page.',
      }),
    )

    await expect(
      prepareDashboardExternalSourcePageDraft({
        source: {
          id: 'source-1',
          title: 'Bad source',
          url: 'https://example.com',
          text: 'Useful science text about dinosaurs and fossils.',
          searchQuery: 'student question',
          fetchedAt: 1,
        },
        question: 'What does this source show?',
        dashboardTitle: 'Dinosaurs',
        answer: 'It should answer.',
      }),
    ).rejects.toThrow(/not clean enough|empty/i)
  })

  it('does not call Tavily or source fetch helpers', async () => {
    vi.mocked(callStrongAiModel).mockResolvedValue(
      JSON.stringify({
        title: 'Clean source notes',
        markdown:
          '# Clean source notes\n\nSource: [example.com](https://example.com)\n\n## Why this source matters\nThis source gives useful study context about dinosaur fossils and evidence.\n\n## Key points\n- Fossil details can support comparison between dinosaur groups.\n- Source text is used without another web search.\n\n## Useful details\nThe added page remains tied to the original fetched source.',
      }),
    )

    await prepareDashboardExternalSourcePageDraft({
      source: {
        id: 'source-1',
        title: 'Clean source',
        url: 'https://example.com',
        text: 'Fossil details can support comparison between dinosaur groups.',
        searchQuery: 'student question',
        fetchedAt: 1,
      },
      question: 'How does it compare?',
      dashboardTitle: 'Dinosaurs',
      answer: 'It compares fossils.',
    })

    expect(callStrongAiModel).toHaveBeenCalledTimes(1)
    expect(cleanExternalSourceTextForDraft('![alt](broken')).not.toContain('![')
  })
})
