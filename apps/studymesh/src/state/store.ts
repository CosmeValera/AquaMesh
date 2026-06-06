import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  StudyPathDashboardPurpose,
  StudyPathPracticeType,
  StudyPathSourceRef,
} from '../studyPack/types'

export interface StateDashboard {
  id: string
  name: string
  layout?: DashboardLayout
  studymesh?: string
  aquamesh?: string
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
}

export interface StudyPathContainerState {
  pathId: string
  title: string
  folderName: string
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
