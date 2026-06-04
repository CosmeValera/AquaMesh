import type { SavedDashboard } from '../components/Dasboard/dashboardStorage'
import { createStudyPathContainerState } from '../components/Dasboard/studyPathContainer'
import type { StudyGuideRecord } from '../cloud/types'
import type { StudyPathContainerState } from '../state/store'

export const STUDY_GUIDES_CHANGED_EVENT = 'studymesh-study-guides-changed'
export const STUDY_GUIDES_STORAGE_KEY = 'studymesh_study_guides'

const nowIso = () => new Date().toISOString()

const dispatchStudyGuidesChanged = (
  detail: { action?: 'save' | 'delete'; studyGuideId?: string } = {},
) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(STUDY_GUIDES_CHANGED_EVENT, { detail }))
}

const readStoredStudyGuides = (): StudyGuideRecord[] => {
  try {
    const stored = window.localStorage.getItem(STUDY_GUIDES_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to read Study Guides', error)
    return []
  }
}

const writeStoredStudyGuides = (studyGuides: StudyGuideRecord[]) => {
  window.localStorage.setItem(
    STUDY_GUIDES_STORAGE_KEY,
    JSON.stringify(studyGuides),
  )
}

export const createStudyGuideRecord = (
  studyPath: StudyPathContainerState,
): StudyGuideRecord => {
  const timestamp = nowIso()

  return {
    id: studyPath.pathId,
    title: studyPath.title || studyPath.folderName || 'Study Guide',
    folderName: studyPath.folderName || 'Study Guide',
    studyPath: {
      ...studyPath,
      selectedIndex: Math.min(
        Math.max(studyPath.selectedIndex || 0, 0),
        Math.max(studyPath.dashboards.length - 1, 0),
      ),
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const createStudyGuideRecordFromDashboards = (
  dashboards: SavedDashboard[],
): StudyGuideRecord | null => {
  const studyPath = createStudyPathContainerState(dashboards)
  return studyPath ? createStudyGuideRecord(studyPath) : null
}

export const StudyGuideStorage = {
  getAll: readStoredStudyGuides,

  save(studyGuide: StudyGuideRecord): StudyGuideRecord {
    const current = readStoredStudyGuides()
    const existingIndex = current.findIndex(
      (guide) => guide.id === studyGuide.id,
    )
    const nextGuide = {
      ...studyGuide,
      updatedAt: nowIso(),
    }
    const next =
      existingIndex >= 0
        ? current.map((guide, index) =>
            index === existingIndex ? nextGuide : guide,
          )
        : [...current, nextGuide]

    writeStoredStudyGuides(next)
    dispatchStudyGuidesChanged({ action: 'save', studyGuideId: nextGuide.id })
    return nextGuide
  },

  delete(id: string): void {
    const current = readStoredStudyGuides()
    writeStoredStudyGuides(current.filter((studyGuide) => studyGuide.id !== id))
    dispatchStudyGuidesChanged({ action: 'delete', studyGuideId: id })
  },
}
