import { describe, expect, it, vi } from 'vitest'
import { appendAiQuickCreatePage } from '../../../src/studyGuides/generation'
import { generateQuickCreateWithAi } from '../../../src/quickCreate/ai'
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
})
