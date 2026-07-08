import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  STUDYMESH_GUIDE_STUDY_PATH_ID,
  ensureStarterDashboards,
  seedStudyMeshGuideStudyPath,
} from '../../../src/studyGuides/studyMeshGuideSeed'

describe('StudyMesh guide seed', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T10:20:30.000Z'))
    storage.clear()
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) || null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      storage.delete(key)
    })
    vi.mocked(localStorage.clear).mockImplementation(() => storage.clear())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('seeds the StudyMesh Guide only once so users can delete it', () => {
    expect(seedStudyMeshGuideStudyPath()).toBe(true)

    const dashboards = JSON.parse(
      window.localStorage.getItem('customDashboards') || '[]',
    )
    const studyGuides = JSON.parse(
      window.localStorage.getItem('studymesh_study_guides') || '[]',
    )
    expect(dashboards).toEqual([])
    expect(studyGuides).toHaveLength(1)
    expect(studyGuides[0]).toMatchObject({
      id: STUDYMESH_GUIDE_STUDY_PATH_ID,
      title: 'Welcome to StudyMesh',
    })
    expect(studyGuides[0].createdAt).toBe('2026-07-08T10:20:30.000Z')
    expect(studyGuides[0].updatedAt).toBe('2026-07-08T10:20:30.000Z')
    expect(studyGuides[0].pinnedAt).toBeNull()
    expect(studyGuides[0].studyPath.dashboards).toHaveLength(3)
    expect(studyGuides[0].studyPath.dashboards[0].name).toBe(
      '01 - StudyMesh Basics',
    )
    expect(studyGuides[0].studyPath.dashboards[1].name).toBe(
      '02 - First StudyMesh Practice',
    )
    expect(studyGuides[0].studyPath.dashboards[2].name).toBe(
      '03 - StudyMesh AI Generation Modes',
    )

    const firstLayout =
      studyGuides[0].studyPath.dashboards[0].layout.children[0].children[0]
    const secondLayout =
      studyGuides[0].studyPath.dashboards[1].layout.children[0].children[0]
    expect(firstLayout.config.customProps.components).toHaveLength(3)
    expect(secondLayout.config.customProps.components).toHaveLength(2)
    expect(firstLayout.config.customProps.components[1].type).toBe(
      'MarkdownBlock',
    )
    expect(firstLayout.config.customProps.components[2]).toMatchObject({
      type: 'QuizCarouselBlock',
      props: expect.objectContaining({
        title: 'Mini quiz',
      }),
    })
    expect(secondLayout.config.customProps.components[1]).toMatchObject({
      type: 'ListBlock',
      props: expect.objectContaining({
        interactiveChecklist: true,
      }),
    })
    expect(JSON.stringify(studyGuides)).not.toContain('Pomodoro')
    expect(JSON.stringify(studyGuides)).not.toContain('Canva')
    expect(JSON.stringify(studyGuides)).not.toContain('Misc')

    window.localStorage.setItem('studymesh_study_guides', JSON.stringify([]))

    expect(seedStudyMeshGuideStudyPath()).toBe(false)
    expect(
      JSON.parse(window.localStorage.getItem('studymesh_study_guides') || '[]'),
    ).toEqual([])
  })

  it('lets Settings reinstall the guide explicitly', () => {
    window.localStorage.setItem(
      'customDashboards',
      JSON.stringify([
        { id: 'custom', name: 'My Notes', createdAt: '', updatedAt: '' },
      ]),
    )

    expect(seedStudyMeshGuideStudyPath()).toBe(false)
    expect(seedStudyMeshGuideStudyPath({ force: true })).toBe(true)

    const dashboards = JSON.parse(
      window.localStorage.getItem('customDashboards') || '[]',
    )
    const studyGuides = JSON.parse(
      window.localStorage.getItem('studymesh_study_guides') || '[]',
    )
    expect(dashboards).toHaveLength(1)
    expect(studyGuides).toHaveLength(1)
    expect(studyGuides[0].id).toBe(STUDYMESH_GUIDE_STUDY_PATH_ID)
    expect(studyGuides[0].createdAt).toBe('2026-07-08T10:20:30.000Z')
    expect(studyGuides[0].pinnedAt).toBeNull()
  })

  it('refreshes the guide date and content when Settings reinstalls it', () => {
    expect(seedStudyMeshGuideStudyPath()).toBe(true)

    vi.setSystemTime(new Date('2026-07-09T08:00:00.000Z'))
    expect(seedStudyMeshGuideStudyPath({ force: true })).toBe(true)

    const studyGuides = JSON.parse(
      window.localStorage.getItem('studymesh_study_guides') || '[]',
    )
    expect(studyGuides).toHaveLength(1)
    expect(studyGuides[0].createdAt).toBe('2026-07-09T08:00:00.000Z')
    expect(studyGuides[0].studyPath.dashboards).toHaveLength(3)
  })

  it('removes legacy starter dashboards without recreating them', () => {
    window.localStorage.setItem(
      'customDashboards',
      JSON.stringify([
        {
          id: 'math',
          name: 'Mathematics 1 - Derivatives',
          folder: 'Mathematics',
        },
        {
          id: 'grouping',
          name: 'Grouping Layout Tutorial',
          folder: 'Tutorial',
        },
        {
          id: 'own',
          name: 'Own Dashboard',
          folder: 'Mine',
        },
      ]),
    )

    ensureStarterDashboards()

    const dashboards = JSON.parse(
      window.localStorage.getItem('customDashboards') || '[]',
    )
    expect(dashboards).toEqual([
      {
        id: 'own',
        name: 'Own Dashboard',
        folder: 'Mine',
      },
    ])
    expect(
      JSON.parse(window.localStorage.getItem('studymesh_study_guides') || '[]'),
    ).toEqual([])
  })
})
