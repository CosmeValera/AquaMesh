import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readCreatedNextIdeaPrompts } from '../../../src/studyGuides/nextGuideIdeas'
import { StudyGuideCreationQueueStorage } from '../../../src/studyGuides/creationQueue'
import { StudyGuideStorage } from '../../../src/studyGuides/storage'

/**
 * A follow-up idea is matched against the prompt creation stored, by prefix:
 * what actually gets sent also carries the bridge sentence, whose wording
 * follows the interface language.
 */
const IDEA = {
  axis: 'connection' as const,
  label: 'Idempotent systems',
  prompt: 'Teach me how idempotent systems stay convergent.',
}

const OTHER_IDEA = {
  axis: 'utility' as const,
  label: 'Debugging a run',
  prompt: 'Teach me how to debug a failing run.',
}

const storedGuide = (id: string, description: string) => ({
  id,
  title: 'Existing guide',
  folderName: 'Existing guide',
  description,
  studyPath: {
    pathId: id,
    title: 'Existing guide',
    folderName: 'Existing guide',
    dashboards: [],
    selectedIndex: 0,
    pinnedDashboardKeys: [],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('readCreatedNextIdeaPrompts', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.removeItem).mockImplementation(
      (key: string) => {
        storage.delete(key)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
  })

  it('marks an idea whose guide exists, matching past the bridge sentence', () => {
    StudyGuideStorage.save(
      storedGuide(
        'guide-1',
        `${IDEA.prompt}\n\nExplain it through Ansible playbooks, which I already know.`,
      ),
    )

    const created = readCreatedNextIdeaPrompts([IDEA, OTHER_IDEA])

    expect(created).toContain(IDEA.prompt)
    expect(created).not.toContain(OTHER_IDEA.prompt)
  })

  it('marks an idea that is still generating in the creation queue', () => {
    StudyGuideCreationQueueStorage.upsert({
      id: 'job-1',
      prompt: OTHER_IDEA.prompt,
      provider: 'hosted',
      status: 'running',
      estimateSeconds: 60,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      resultStudyGuideId: null,
    })

    expect(readCreatedNextIdeaPrompts([IDEA, OTHER_IDEA])).toEqual(
      [OTHER_IDEA.prompt],
    )
  })

  it('does not match a guide that merely mentions the same words later on', () => {
    StudyGuideStorage.save(
      storedGuide('guide-2', `Something else. ${IDEA.prompt}`),
    )

    expect(readCreatedNextIdeaPrompts([IDEA])).toEqual([])
  })

  it('returns nothing when there are no ideas to check', () => {
    expect(readCreatedNextIdeaPrompts([])).toEqual([])
  })
})
