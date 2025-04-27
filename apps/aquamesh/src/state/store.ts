import { create } from "zustand"
import { persist, createJSONStorage } from 'zustand/middleware'

export interface StateView {
  id: string;
  name: string;
  layout?: ViewLayout;
  aquamesh?: string;
}

export interface ViewLayout {
  type?: string;
  id?: string;
  children?: ViewLayout[];
}

interface StoreState {
  selectedView: number;
  openViews: StateView[];
  setViews: (element: StateView[]) => void;
  setSelectedView: (index: number) => void;
  changePanelData: (data: Partial<StateView>) => void;
  getCurrentView: () => StateView | undefined;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      selectedView: 0,
      openViews: [],
      setViews: (element) => set({ openViews: element }),
      setSelectedView: (index) => set({ selectedView: index }),
      changePanelData: (data) => {
        const state = get()
        const updatedOpenViews = [...state.openViews]

        updatedOpenViews[state.selectedView] = {
          ...updatedOpenViews[state.selectedView],
          ...data,
        }

        set({ openViews: updatedOpenViews })
      },
      getCurrentView: () => {
        const state = get()
        return state.openViews[state.selectedView]
      },
    }),
    {
      name: 'aquamesh-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
