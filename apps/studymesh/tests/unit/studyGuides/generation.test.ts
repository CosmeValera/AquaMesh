import { describe, expect, it, vi } from 'vitest'
import { appendAiQuickCreatePage } from '../../../src/studyGuides/generation'
import { generateStudyPackWithAi } from '../../../src/studyPack/ai'
import type { StudyPathContainerState } from '../../../src/state/store'

vi.mock('../../../src/studyPack/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/studyPack/ai')>()
  return {
    ...actual,
    generateStudyPackWithAi: vi.fn().mockResolvedValue({
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
    readStudyPackAiSettings: () => ({ provider: 'gemini' }),
    resolveStudyPackAiCredentials: () => ({
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

    expect(generateStudyPackWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'improvedNotes',
        detailLevel: 'medium',
        generationTargets: ['summaries', 'definitions', 'lists'],
      }),
    )
  })
})

