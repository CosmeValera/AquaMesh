import type { SavedDashboard } from '../components/Dasboard/dashboardStorage'
import { createStudyPathContainerState } from '../components/Dasboard/studyPathContainer'
import type { StudyGuideRecord, StudyGuideSummary } from '../cloud/types'
import type { StudyPathContainerState } from '../state/store'

export const STUDY_GUIDES_CHANGED_EVENT = 'studymesh-study-guides-changed'
export const STUDY_GUIDES_STORAGE_KEY = 'studymesh_study_guides'
export const STUDY_GUIDES_SUMMARY_STORAGE_KEY =
  'studymesh_study_guides_summaries'
export const STUDY_GUIDES_PINNED_KEY = 'studymesh.studyGuides.pinned'
export const STUDY_GUIDES_STORAGE_FULL_MESSAGE =
  'Your Study Guide library is full. Delete a few old or unused Study Guides, then try again.'

export type StudyGuideChangeAction =
  | 'save'
  | 'metadata'
  | 'pin'
  | 'progress'
  | 'delete'
  | 'cache'

export interface StudyGuideChangeDetail {
  action?: StudyGuideChangeAction
  studyGuideId?: string
}

const nowIso = () => new Date().toISOString()

const guideEmojiRules: Array<[RegExp, string]> = [
  [/\b(math|algebra|calculus|geometry|equation|statistics)\b/i, '\u{1f522}'],
  [/\b(biology|anatomy|cell|organ|medicine|health)\b/i, '\u{1f9ec}'],
  [/\b(history|war|empire|revolution|ancient)\b/i, '\u{1f3db}\ufe0f'],
  [/\b(language|grammar|vocab|literature)\b/i, '\u{1f4da}'],
  [/\b(code|programming|software)\b/i, '\u{1f4bb}'],
  [/\b(physics|chemistry|science|energy|atom)\b/i, '\u2697\ufe0f'],
  [/\b(music|art|design|drawing)\b/i, '\u{1f3a8}'],
]

export const getStudyGuideEmoji = (title: string): string => {
  const match = guideEmojiRules.find(([pattern]) => pattern.test(title))
  return match?.[1] || '\u2728'
}

const dispatchStudyGuidesChanged = (
  detail: StudyGuideChangeDetail = {},
) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(STUDY_GUIDES_CHANGED_EVENT, { detail }))
}

type StudyGuideLike = Partial<StudyGuideRecord & StudyGuideSummary> & {
  id: string
  title: string
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const hasStudyGuideSummaryFields = (
  value: unknown,
): value is StudyGuideLike =>
  isObjectRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string'

const hasStudyGuideRecordFields = (
  value: StudyGuideLike,
): value is StudyGuideRecord =>
  isObjectRecord(value.studyPath) &&
  Array.isArray(value.studyPath.dashboards)

const readStoredStudyGuideLikeItems = (): StudyGuideLike[] => {
  const stored = window.localStorage.getItem(STUDY_GUIDES_STORAGE_KEY)
  const parsed = stored ? JSON.parse(stored) : []
  return Array.isArray(parsed)
    ? parsed.filter(hasStudyGuideSummaryFields)
    : []
}

const toStudyGuideSummary = (studyGuide: StudyGuideLike): StudyGuideSummary => {
  const studyPath = isObjectRecord(studyGuide.studyPath)
    ? (studyGuide.studyPath as Partial<StudyPathContainerState>)
    : undefined
  const dashboards = Array.isArray(studyPath?.dashboards)
    ? studyPath.dashboards
    : []
  const createdAt = studyGuide.createdAt || nowIso()

  return {
    id: studyGuide.id,
    title: studyGuide.title,
    folderName: studyGuide.folderName || studyPath?.folderName || studyGuide.title,
    description: studyGuide.description,
    emoji:
      studyGuide.emoji ||
      studyPath?.emoji ||
      getStudyGuideEmoji(studyGuide.title),
    pinnedAt: studyGuide.pinnedAt ?? null,
    pageCount: studyGuide.pageCount ?? dashboards.length,
    firstPageTitle: studyGuide.firstPageTitle || dashboards[0]?.name,
    createdAt,
    updatedAt: studyGuide.updatedAt || createdAt,
  }
}

const readStoredStudyGuides = (): StudyGuideRecord[] => {
  try {
    const studyGuides = readStoredStudyGuideLikeItems().filter(
      hasStudyGuideRecordFields,
    )
    const pinnedGuides = readPinnedStudyGuides()

    return studyGuides.map((studyGuide) => ({
      ...studyGuide,
      pinnedAt: pinnedGuides[studyGuide.id] ?? studyGuide.pinnedAt ?? null,
    }))
  } catch (error) {
    console.error('Failed to read Study Guides', error)
    return []
  }
}

const readPinnedStudyGuides = (): Record<string, string> => {
  try {
    const stored = window.localStorage.getItem(STUDY_GUIDES_PINNED_KEY)
    if (!stored) {
      return {}
    }

    const parsed = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  } catch {
    return {}
  }
}

const writePinnedStudyGuides = (pinnedGuides: Record<string, string>) => {
  writeStorageValue(STUDY_GUIDES_PINNED_KEY, JSON.stringify(pinnedGuides))
}

const setStoredPinnedStudyGuide = (id: string, pinnedAt: string | null) => {
  const pinnedGuides = readPinnedStudyGuides()
  if (pinnedAt) {
    pinnedGuides[id] = pinnedAt
  } else {
    delete pinnedGuides[id]
  }
  writePinnedStudyGuides(pinnedGuides)
}

const readStoredStudyGuideSummaries = (): StudyGuideSummary[] => {
  try {
    const stored = window.localStorage.getItem(STUDY_GUIDES_SUMMARY_STORAGE_KEY)
    const summaries: StudyGuideSummary[] = stored ? JSON.parse(stored) : []
    const pinnedGuides = readPinnedStudyGuides()

    if (summaries.length > 0) {
      return summaries.map((summary) => ({
        ...summary,
        pinnedAt: pinnedGuides[summary.id] ?? summary.pinnedAt ?? null,
      }))
    }

    return readStoredStudyGuideLikeItems().map(toStudyGuideSummary)
  } catch (error) {
    console.error('Failed to read Study Guide summaries', error)
    return readStoredStudyGuides().map(toStudyGuideSummary)
  }
}

export const isStudyGuidesStorageQuotaError = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014)

const writeStorageValue = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch (error) {
    if (isStudyGuidesStorageQuotaError(error)) {
      throw new Error(STUDY_GUIDES_STORAGE_FULL_MESSAGE)
    }

    throw error
  }
}

const writeStoredStudyGuides = (studyGuides: StudyGuideRecord[]) => {
  writeStorageValue(STUDY_GUIDES_STORAGE_KEY, JSON.stringify(studyGuides))
}

const writeStoredStudyGuideSummaries = (summaries: StudyGuideSummary[]) => {
  writeStorageValue(STUDY_GUIDES_SUMMARY_STORAGE_KEY, JSON.stringify(summaries))
}

const upsertStoredStudyGuideSummary = (summary: StudyGuideSummary) => {
  const current = readStoredStudyGuideSummaries()
  const existingIndex = current.findIndex((item) => item.id === summary.id)
  const pinnedAt = readPinnedStudyGuides()[summary.id] ?? summary.pinnedAt ?? null
  const nextSummary = { ...summary, pinnedAt }
  const next =
    existingIndex >= 0
      ? current.map((item, index) =>
          index === existingIndex ? nextSummary : item,
        )
      : [nextSummary, ...current]
  writeStoredStudyGuideSummaries(next)
}

const removeStoredStudyGuideSummary = (id: string) => {
  writeStoredStudyGuideSummaries(
    readStoredStudyGuideSummaries().filter((summary) => summary.id !== id),
  )
}

const isSummaryNewerThanFullRecord = (
  summary: StudyGuideSummary | null,
  record: StudyGuideRecord,
): boolean => {
  if (!summary?.updatedAt || !record.updatedAt) {
    return false
  }

  return Date.parse(summary.updatedAt) > Date.parse(record.updatedAt)
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
      studyPath.emoji ||
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

  getSummaries: readStoredStudyGuideSummaries,

  getSummaryById(id: string): StudyGuideSummary | null {
    return (
      readStoredStudyGuideSummaries().find((summary) => summary.id === id) ||
      null
    )
  },

  getById(id: string): StudyGuideRecord | null {
    const existing =
      readStoredStudyGuides().find((studyGuide) => studyGuide.id === id) || null
    if (!existing) {
      return null
    }

    return isSummaryNewerThanFullRecord(
      StudyGuideStorage.getSummaryById(id),
      existing,
    )
      ? null
      : existing
  },

  replaceSummariesFromCloud(summaries: StudyGuideSummary[]): void {
    const pinnedGuides = readPinnedStudyGuides()
    writeStoredStudyGuideSummaries(
      summaries.map((summary) => ({
        ...summary,
        pinnedAt: pinnedGuides[summary.id] ?? summary.pinnedAt ?? null,
      })),
    )
  },

  cacheFromCloud(studyGuide: StudyGuideRecord): StudyGuideRecord {
    const current = readStoredStudyGuides()
    const existingIndex = current.findIndex(
      (guide) => guide.id === studyGuide.id,
    )
    const pinnedAt =
      readPinnedStudyGuides()[studyGuide.id] ?? studyGuide.pinnedAt ?? null
    const nextGuide = { ...studyGuide, pinnedAt }
    const next =
      existingIndex >= 0
        ? current.map((guide, index) =>
            index === existingIndex ? nextGuide : guide,
          )
        : [...current, nextGuide]

    writeStoredStudyGuides(next)
    upsertStoredStudyGuideSummary(toStudyGuideSummary(nextGuide))
    dispatchStudyGuidesChanged({ action: 'cache', studyGuideId: nextGuide.id })
    return nextGuide
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
      pinnedAt: Object.prototype.hasOwnProperty.call(studyGuide, 'pinnedAt')
        ? (studyGuide.pinnedAt ?? null)
        : (current[existingIndex]?.pinnedAt ?? null),
      createdAt:
        studyGuide.createdAt || current[existingIndex]?.createdAt || nowIso(),
      updatedAt: nowIso(),
    }
    setStoredPinnedStudyGuide(nextGuide.id, nextGuide.pinnedAt ?? null)
    const next =
      existingIndex >= 0
        ? current.map((guide, index) =>
            index === existingIndex ? nextGuide : guide,
          )
        : [...current, nextGuide]

    writeStoredStudyGuides(next)
    upsertStoredStudyGuideSummary(toStudyGuideSummary(nextGuide))
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
    if (existing) {
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
    }

    const summary = StudyGuideStorage.getSummaryById(id)
    if (!summary) {
      return null
    }

    upsertStoredStudyGuideSummary({
      ...summary,
      title: trimmed,
      folderName: trimmed,
      emoji: summary.emoji || getStudyGuideEmoji(trimmed),
      updatedAt: nowIso(),
    })
    dispatchStudyGuidesChanged({ action: 'metadata', studyGuideId: id })
    return null
  },

  togglePinned(id: string): StudyGuideRecord | null {
    const existing = readStoredStudyGuides().find(
      (studyGuide) => studyGuide.id === id,
    )
    const summary = StudyGuideStorage.getSummaryById(id)
    if (!existing && !summary) {
      return null
    }

    const nextPinnedAt = (existing?.pinnedAt || summary?.pinnedAt)
      ? null
      : nowIso()
    setStoredPinnedStudyGuide(id, nextPinnedAt)

    if (existing) {
      const nextGuide = { ...existing, pinnedAt: nextPinnedAt }
      writeStoredStudyGuides(
        readStoredStudyGuides().map((studyGuide) =>
          studyGuide.id === id ? nextGuide : studyGuide,
        ),
      )
      upsertStoredStudyGuideSummary(toStudyGuideSummary(nextGuide))
      dispatchStudyGuidesChanged({ action: 'pin', studyGuideId: id })
      return nextGuide
    }

    upsertStoredStudyGuideSummary({
      ...summary!,
      pinnedAt: nextPinnedAt,
    })
    dispatchStudyGuidesChanged({ action: 'pin', studyGuideId: id })
    return null
  },

  markVisitedPage(id: string, pageKey: string): StudyGuideRecord | null {
    const existing = readStoredStudyGuides().find(
      (studyGuide) => studyGuide.id === id,
    )
    if (!existing || existing.visitedPageKeys?.includes(pageKey)) {
      return existing || null
    }

    const nextGuide = {
      ...existing,
      visitedPageKeys: [...(existing.visitedPageKeys || []), pageKey],
    }
    writeStoredStudyGuides(
      readStoredStudyGuides().map((studyGuide) =>
        studyGuide.id === id ? nextGuide : studyGuide,
      ),
    )
    dispatchStudyGuidesChanged({ action: 'progress', studyGuideId: id })
    return nextGuide
  },

  delete(id: string): void {
    const current = readStoredStudyGuides()
    setStoredPinnedStudyGuide(id, null)
    writeStoredStudyGuides(current.filter((studyGuide) => studyGuide.id !== id))
    removeStoredStudyGuideSummary(id)
    dispatchStudyGuidesChanged({ action: 'delete', studyGuideId: id })
  },
}
