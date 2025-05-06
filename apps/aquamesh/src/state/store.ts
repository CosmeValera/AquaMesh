import { create } from "zustand"
import { persist, createJSONStorage } from 'zustand/middleware'

export interface StateDashboard {
  id: string;
  name: string;
  layout?: DashboardLayout;
  aquamesh?: string;
}

export interface DashboardLayout {
  type?: string;
  id?: string;
  children?: DashboardLayout[];
}

interface StoreState {
  selectedDashboard: number;
  openDashboards: StateDashboard[];
  setDashboards: (element: StateDashboard[]) => void;
  setSelectedDashboard: (index: number) => void;
  changeWidgetData: (data: Partial<StateDashboard>) => void;
  getCurrentDashboard: () => StateDashboard | undefined;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      selectedDashboard: 0,
      openDashboards: [],
      setDashboards: (element) => set({ openDashboards: element }),
      setSelectedDashboard: (index) => set({ selectedDashboard: index }),
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
      name: 'aquamesh-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
