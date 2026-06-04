import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  STUDYMESH_GUIDE_STUDY_PATH_ID,
  ensureStarterDashboards,
  seedStudyMeshGuideStudyPath,
} from '../../../src/studyPack/studyMeshGuideSeed'

describe('StudyMesh guide seed', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
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
    expect(studyGuides[0].studyPath.dashboards).toHaveLength(3)

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
  })
})
