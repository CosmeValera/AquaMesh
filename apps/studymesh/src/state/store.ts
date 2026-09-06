import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  StudyPathDashboardPurpose,
  StudyPathPracticeType,
  StudyPathSourceRef,
} from '../quickCreate/types'
import type {
  ContentLanguageSource,
  StudyMeshLanguageCode,
} from '../language/contentLanguage'

export interface StateDashboard {
  id: string
  name: string
  layout?: DashboardLayout
  studymesh?: string
  aquamesh?: string
  contentLanguage?: StudyMeshLanguageCode
  contentLanguageSource?: ContentLanguageSource
  kind?: 'dashboard' | 'studyPathContainer'
  studyPath?: StudyPathContainerState
}

export interface StudyPathDashboardItem {
  id?: string
  name: string
  layout: DashboardLayout
  dashboardKey: string
  dashboardIndex: number
  dashboardCount: number
  folderName: string
  dashboardPurpose?: StudyPathDashboardPurpose
  practiceType?: StudyPathPracticeType
  layoutReason?: string
  sourceRefs?: StudyPathSourceRef[]
  contentLanguage?: StudyMeshLanguageCode
  contentLanguageSource?: ContentLanguageSource
  createdBy?: 'generator' | 'chat' | 'quickCreate' | 'manual' | 'expanded'
  deletable?: boolean
  /**
   * Set when this page was dug out of another one, so the pages panel can
   * indent it and a reader can walk back up. Root pages leave it unset; the
   * pages array itself stays flat and depth-first.
   */
  parentPageKey?: string
  /**
   * Follow-up pages offered from this page. Generated with the guide, so the
   * offer costs no extra model call.
   */
  pageIdeas?: StudyGuidePageIdea[]
  /**
   * First-person ask for a whole guide on this page's subject, written by the
   * same call that wrote the page so it names the subject rather than echoing
   * the page title. Only set on pages the reader grew.
   */
  guidePrompt?: string
}

export interface StudyGuideQuickStartVariant {
  keyIdea: string
  quickSummary: string
  bridgeTopics?: string[]
  /** 6-12 words on why this bridge is not the best fit. Only set on a weak bridge. */
  weakFitReason?: string
}

export interface StudyGuideQuickStart extends StudyGuideQuickStartVariant {
  forcedBridge?: StudyGuideQuickStartVariant
}

export type StudyGuideQuickStartView = 'default' | 'context'

/**
 * Which kind of jump this idea makes away from the current guide. Kept on the
 * idea so a slate can be checked for variety instead of trusted to be varied.
 */
export type StudyGuideNextIdeaAxis = 'curiosity' | 'utility' | 'connection'

/** One follow-up guide the reader can start from what this guide taught. */
export interface StudyGuideNextIdea {
  /** Absent on guides from providers that answer without a response schema. */
  axis?: StudyGuideNextIdeaAxis
  label: string
  prompt: string
}

/**
 * How a follow-up page digs into material the guide already put on the page.
 * Deliberately disjoint from `StudyGuideNextIdeaAxis`: the guide slate is
 * banned from suggesting depth, so depth is what a page is for.
 */
export type StudyGuidePageIdeaAxis = 'mechanism' | 'example' | 'limit'

/** One follow-up page the reader can dig out of a page they are reading. */
export interface StudyGuidePageIdea {
  /** Absent on guides from providers that answer without a response schema. */
  axis?: StudyGuidePageIdeaAxis
  label: string
  prompt: string
}

/**
 * A lesson the plan named but the guide did not write. Kept so a guide can
 * offer its own next page instead of guessing one from the pages it already
 * has, and so the offer can be previewed before any model call is paid for.
 */
export interface StudyGuidePlannedLesson {
  title: string
  summary: string
}

export interface StudyPathContainerState {
  pathId: string
  title: string
  folderName: string
  emoji?: string
  contentLanguage?: StudyMeshLanguageCode
  contentLanguageSource?: ContentLanguageSource
  /**
   * Set when the finished guide reads as a different language than the one
   * asked for. Detected locally; regenerating is the reader's call because it
   * spends Carrots again.
   */
  contentLanguageMismatch?: StudyMeshLanguageCode
  quickStart?: StudyGuideQuickStart
  quickStartView?: StudyGuideQuickStartView
  /**
   * Names the learner can choose from when claiming this topic after the quiz.
   * Generated with the guide, so the offer costs no extra model call.
   */
  learnedSkillOptions?: string[]
  /**
   * Follow-up guides offered once the reader claims the topic. Generated with
   * the guide, so the offer costs no extra model call.
   */
  nextGuideIdeas?: StudyGuideNextIdea[]
  /**
   * Lessons the plan named and the guide did not write. Generated with the
   * guide, so offering the next page costs no extra model call. Consumed one
   * at a time as the reader grows the guide.
   */
  plannedLessons?: StudyGuidePlannedLesson[]
  dashboards: StudyPathDashboardItem[]
  selectedIndex: number
  pinnedDashboardKeys?: string[]
}

export interface DashboardLayout {
  type?: string
  id?: string
  name?: string
  component?: string
  config?: {
    customProps?: Record<string, unknown>
  }
  active?: boolean
  selected?: number
  weight?: number
  enableDrag?: boolean
  enableDrop?: boolean
  enableDivide?: boolean
  children?: DashboardLayout[]
}

const createDefaultDashboard = (): StateDashboard => ({
  id: `default-dashboard-${Date.now()}`,
  name: 'Empty Dashboard',
  layout: {
    type: 'row',
    id: '#default-dashboard-layout',
    children: [],
  },
})

const DEFAULT_DASHBOARD: StateDashboard = createDefaultDashboard()

if (
  typeof window !== 'undefined' &&
  window.localStorage.getItem('studymesh-storage') === null
) {
  const legacyState = window.localStorage.getItem('aquamesh-storage')
  if (legacyState !== null) {
    window.localStorage.setItem('studymesh-storage', legacyState)
  }
}

interface StoreState {
  selectedDashboard: number
  openDashboards: StateDashboard[]
  setDashboards: (element: StateDashboard[]) => void
  setSelectedDashboard: (index: number) => void
  changeWidgetData: (data: Partial<StateDashboard>) => void
  getCurrentDashboard: () => StateDashboard | undefined
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      selectedDashboard: 0,
      openDashboards: [DEFAULT_DASHBOARD],
      setDashboards: (element) =>
        set((state) => {
          const openDashboards =
            element.length > 0 ? element : [createDefaultDashboard()]
          const selectedDashboard = Math.min(
            Math.max(state.selectedDashboard, 0),
            openDashboards.length - 1,
          )

          return { openDashboards, selectedDashboard }
        }),
      setSelectedDashboard: (index) =>
        set((state) => ({
          selectedDashboard: Math.min(
            Math.max(index, 0),
            Math.max(state.openDashboards.length - 1, 0),
          ),
        })),
      changeWidgetData: (data) => {
        const state = get()
        const updatedOpenDashboards = [...state.openDashboards]

        updatedOpenDashboards[state.selectedDashboard] = {
          ...updatedOpenDashboards[state.selectedDashboard],
          ...data,
        }

        set({ openDashboards: updatedOpenDashboards })
      },
      getCurrentDashboard: () => {
        const state = get()
        return state.openDashboards[state.selectedDashboard]
      },
    }),
    {
      name: 'studymesh-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
