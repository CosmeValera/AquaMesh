import type { SavedDashboard } from '../components/Dasboard/dashboardStorage'
import { createStudyPathContainerState } from '../components/Dasboard/studyPathContainer'
import type { StudyGuideRecord } from '../cloud/types'
import type { StudyPathContainerState } from '../state/store'

export const STUDY_GUIDES_CHANGED_EVENT = 'studymesh-study-guides-changed'
export const STUDY_GUIDES_STORAGE_KEY = 'studymesh_study_guides'

const nowIso = () => new Date().toISOString()

const guideEmojiRules: Array<[RegExp, string]> = [
  [/\b(math|algebra|calculus|geometry|equation|statistics)\b/i, '\u{1f522}'],
  [/\b(biology|anatomy|cell|organ|medicine|health)\b/i, '\u{1f9ec}'],
  [/\b(history|war|empire|revolution|ancient)\b/i, '\u{1f3db}\ufe0f'],
  [/\b(language|spanish|english|grammar|vocab|literature)\b/i, '\u{1f4da}'],
  [/\b(code|programming|javascript|python|react|software)\b/i, '\u{1f4bb}'],
  [/\b(physics|chemistry|science|energy|atom)\b/i, '\u2697\ufe0f'],
  [/\b(music|art|design|drawing)\b/i, '\u{1f3a8}'],
]

export const getStudyGuideEmoji = (title: string): string => {
  const match = guideEmojiRules.find(([pattern]) => pattern.test(title))
  return match?.[1] || '\u2728'
}

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
  options: { id?: string; createdAt?: string; emoji?: string } = {},
): StudyGuideRecord => {
  const timestamp = nowIso()
  const id = options.id || studyPath.pathId

  return {
    id,
    title: studyPath.title || studyPath.folderName || 'Study Guide',
    folderName: studyPath.folderName || 'Study Guide',
    emoji:
      options.emoji ||
      getStudyGuideEmoji(studyPath.title || studyPath.folderName || ''),
    studyPath: {
      ...studyPath,
      pathId: id,
      selectedIndex: Math.min(
        Math.max(studyPath.selectedIndex || 0, 0),
        Math.max(studyPath.dashboards.length - 1, 0),
      ),
      dashboards: studyPath.dashboards.map((dashboard) => ({
        ...dashboard,
        createdBy: dashboard.createdBy || 'generator',
        deletable: dashboard.deletable ?? false,
      })),
    },
    createdAt: options.createdAt || timestamp,
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

  getById(id: string): StudyGuideRecord | null {
    return readStoredStudyGuides().find((studyGuide) => studyGuide.id === id) ||
      null
  },

  save(studyGuide: StudyGuideRecord): StudyGuideRecord {
    const current = readStoredStudyGuides()
    const existingIndex = current.findIndex(
      (guide) => guide.id === studyGuide.id,
    )
    const nextGuide = {
      ...current[existingIndex],
      ...studyGuide,
      emoji: studyGuide.emoji || getStudyGuideEmoji(studyGuide.title),
      pinnedAt: studyGuide.pinnedAt ?? current[existingIndex]?.pinnedAt ?? null,
      createdAt:
        studyGuide.createdAt || current[existingIndex]?.createdAt || nowIso(),
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

  saveWithId(id: string, studyPath: StudyPathContainerState): StudyGuideRecord {
    const existing = StudyGuideStorage.getById(id)
    return StudyGuideStorage.save(
      createStudyGuideRecord(
        {
          ...studyPath,
          pathId: id,
        },
        {
          id,
          createdAt: existing?.createdAt,
          emoji: existing?.emoji,
        },
      ),
    )
  },

  rename(id: string, title: string): StudyGuideRecord | null {
    const trimmed = title.trim()
    if (!trimmed) {
      return null
    }

    const current = readStoredStudyGuides()
    const existing = current.find((studyGuide) => studyGuide.id === id)
    if (!existing) {
      return null
    }

    return StudyGuideStorage.save({
      ...existing,
      title: trimmed,
      folderName: trimmed,
      emoji: existing.emoji || getStudyGuideEmoji(trimmed),
      studyPath: {
        ...existing.studyPath,
        title: trimmed,
        folderName: trimmed,
      },
    })
  },

  togglePinned(id: string): StudyGuideRecord | null {
    const existing = StudyGuideStorage.getById(id)
    if (!existing) {
      return null
    }

    return StudyGuideStorage.save({
      ...existing,
      pinnedAt: existing.pinnedAt ? null : nowIso(),
    })
  },

  delete(id: string): void {
    const current = readStoredStudyGuides()
    writeStoredStudyGuides(current.filter((studyGuide) => studyGuide.id !== id))
    dispatchStudyGuidesChanged({ action: 'delete', studyGuideId: id })
  },
}
