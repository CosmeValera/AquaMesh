import { describe, expect, it, vi } from 'vitest'
import {
  appendAiPodcastPage,
  appendAiQuickCreatePage,
  generateStudyPathStateFromPrompt,
} from '../../../src/studyGuides/generation'
import {
  generateHostedAiPodcast,
  generateQuickCreateWithAi,
  generateStudyPathWithAi,
} from '../../../src/quickCreate/ai'
import type { StudyPathContainerState } from '../../../src/state/store'

vi.mock('../../../src/quickCreate/ai', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/quickCreate/ai')>()
  return {
    ...actual,
    generateQuickCreateWithAi: vi.fn().mockResolvedValue({
      title: 'Expanded notes',
      sourceFormat: 'text',
      rawNotes: 'Source notes',
      objects: [
        {
          id: 'note-1',
          kind: 'markdown',
          title: 'Expanded notes',
          markdown: '# Expanded notes\n\nPlants use light.',
          sourceLine: 1,
          tags: [],
        },
      ],
      warnings: [],
    }),
    generateHostedAiPodcast: vi.fn().mockResolvedValue({
      id: 'podcast-1',
      title: 'Podcast: Biology',
      description: 'A short biology recap.',
      audioPath: 'user-1/guide-1/podcast-1.mp3',
      mimeType: 'audio/mpeg',
      transcriptTurns: [
        { speaker: 'hostA', text: 'Today we recap photosynthesis.' },
        { speaker: 'hostB', text: 'Plants use light to make energy.' },
      ],
      chapters: [{ title: 'Photosynthesis', startTurn: 0 }],
      sourceTitle: 'Biology',
      sourceScope: 'studyGuide',
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    generateStudyPathWithAi: vi.fn().mockResolvedValue({
      title: 'Terraform State',
      folderName: 'Terraform State',
      emoji: '🧱',
      learnedSkillOptions: ['Terraform state', 'Remote backends'],
      nextGuideIdeas: [
        { label: 'Helm charts', prompt: 'Teach me how Helm charts work.' },
      ],
      dashboards: [
        {
          title: '01 - State files',
          objects: [
            {
              id: 'note-1',
              kind: 'markdown',
              title: 'State files',
              markdown: '# State files\n\nTerraform tracks resources.',
              sourceLine: 1,
              tags: [],
            },
          ],
          warnings: [],
        },
      ],
      warnings: [],
    }),
    readQuickCreateAiSettings: () => ({ provider: 'gemini' }),
    resolveQuickCreateAiCredentials: () => ({
      apiToken: 'token',
      model: 'model',
    }),
  }
})

const studyPath: StudyPathContainerState = {
  pathId: 'guide-1',
  title: 'Biology',
  folderName: 'Biology',
  dashboards: [],
  selectedIndex: 0,
  pinnedDashboardKeys: [],
}

describe('appendAiQuickCreatePage', () => {
  it('normalizes object quick-create requests before generation', async () => {
    await appendAiQuickCreatePage({
      studyPath,
      resourceType: {
        actionId: 'improvedNotes',
        resourceType: 'improvedNotes',
        label: 'Expand on this',
      },
      sourceTitle: 'Photosynthesis',
      sourceText: 'Source notes',
    })

    expect(generateQuickCreateWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'improvedNotes',
        detailLevel: 'medium',
        generationTargets: ['summaries', 'definitions', 'lists'],
      }),
    )
  })

  it('uses the Study Guide language when creating quiz or flashcard pages', async () => {
    await appendAiQuickCreatePage({
      studyPath: {
        ...studyPath,
        contentLanguage: 'en',
        contentLanguageSource: 'detected',
      },
      resourceType: {
        actionId: 'quiz',
        resourceType: 'quiz',
        label: 'Create quiz',
      },
      sourceTitle: 'React',
      sourceText:
        'Qual diferença principal entre componentes funcionais e baseados em classe?',
    })

    expect(generateQuickCreateWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'quiz',
        outputLanguage: 'en',
      }),
    )
  })

  it('appends hosted podcast pages with a PodcastBlock', async () => {
    const next = await appendAiPodcastPage({
      studyPath,
      sourceTitle: 'Biology',
      sourceText: 'Photosynthesis uses light. Cells use ATP.',
      sourceScope: 'studyGuide',
    })

    expect(generateHostedAiPodcast).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: 'Photosynthesis uses light. Cells use ATP.',
        studyGuideId: 'guide-1',
        sourceTitle: 'Biology',
        sourceScope: 'studyGuide',
      }),
    )
    expect(next.dashboards).toHaveLength(1)
    expect(JSON.stringify(next.dashboards[0].layout)).toContain('PodcastBlock')
    expect(next.dashboards[0].createdBy).toBe('quickCreate')
  })
})

describe('generateStudyPathStateFromPrompt', () => {
  it('carries the claimable skills and follow-up ideas into the saved guide', async () => {
    // Regression: both were generated with the guide and then dropped here, so
    // the quiz fell back to the guide title and offered no follow-up guides.
    const studyPath = await generateStudyPathStateFromPrompt({
      id: 'guide-2',
      prompt: 'Teach me Terraform state',
    })

    expect(studyPath.learnedSkillOptions).toEqual([
      'Terraform state',
      'Remote backends',
    ])
    expect(studyPath.nextGuideIdeas).toEqual([
      { label: 'Helm charts', prompt: 'Teach me how Helm charts work.' },
    ])
  })
})

describe('study guide language selection', () => {
  it('resolves the language from the learner prompt and instructs in it', async () => {
    // Regression: the claimed-skill sentence used to be interface-language text
    // glued onto the prompt, so a Spanish interface pulled English guides into
    // Spanish through both detection and the model.
    await generateStudyPathStateFromPrompt({
      id: 'guide-3',
      prompt:
        'Teach me how consent-based decision rules work in cooperatives, community groups, and other organizations.',
      knownSkill: 'reviewing open-source contributions',
    })

    const call = vi.mocked(generateStudyPathWithAi).mock.calls.at(-1)?.[0]
    expect(call?.outputLanguage).toBe('en')
    expect(call?.prompt).toContain(
      'Explain it through reviewing open-source contributions, which I already know.',
    )
    expect(call?.prompt).not.toContain('Explícamelo')
  })

  it('writes the claimed-skill instruction in the prompt language', async () => {
    await generateStudyPathStateFromPrompt({
      id: 'guide-4',
      prompt:
        'Quiero aprender cómo funcionan las reglas de consenso en cooperativas y otras organizaciones.',
      knownSkill: 'revisar contribuciones',
    })

    const call = vi.mocked(generateStudyPathWithAi).mock.calls.at(-1)?.[0]
    expect(call?.outputLanguage).toBe('es')
    expect(call?.prompt).toContain('Explícamelo a través de revisar contribuciones')
  })

  it('flags a guide that came back in another language', async () => {
    vi.mocked(generateStudyPathWithAi).mockResolvedValueOnce({
      title: 'Consenso',
      folderName: 'Consenso',
      emoji: '🤝',
      quickStart: {
        keyIdea:
          'Las colas de revisión reúnen propuestas y los permisos de escritura reservan la incorporación final a pocos mantenedores.',
        quickSummary:
          'Piensa en las colas de revisión: muchas personas pueden enviar cambios, pero el trabajo pendiente se acumula y debe priorizarse.',
      },
      dashboards: [
        {
          title: '01 - Consenso',
          rawNotes:
            'Las reglas de integración funcionan como un filtro estable para las propuestas de la comunidad.',
          objects: [],
          warnings: [],
        },
      ],
      warnings: [],
    } as never)

    const studyPath = await generateStudyPathStateFromPrompt({
      id: 'guide-5',
      prompt:
        'Teach me how consent-based decision rules work in cooperatives, community groups, and other organizations.',
    })

    expect(studyPath.contentLanguage).toBe('en')
    expect(studyPath.contentLanguageMismatch).toBe('es')
  })
})
