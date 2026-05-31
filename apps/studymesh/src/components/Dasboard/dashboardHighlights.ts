/**
 * Dashboard Highlights System
 * 
 * Allows users to:
 * - Highlight text within dashboard widgets
 * - Add notes to highlighted sections
 * - Link highlights to other Study Paths or Dashboards
 */

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

export interface HighlightLink {
  type: 'study-path' | 'dashboard'
  targetId: string
  targetLabel: string
}

export interface DashboardHighlight {
  id: string
  dashboardId: string
  widgetId: string
  blockType: string
  // Text selection content (snapshot)
  selectedText: string
  // Display
  color: HighlightColor
  // Optional note
  note?: string
  // Optional link to other content
  link?: HighlightLink
  createdAt: string
  updatedAt: string
}

export interface DashboardHighlightsSettings {
  highlights: DashboardHighlight[]
}

const STORAGE_KEY = 'dashboardHighlights'

const dispatchHighlightsChanged = (dashboardId: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studymesh-highlights-changed', { 
      detail: { dashboardId } 
    }))
  }
}

export const DashboardHighlightsStorage = {
  getAll: (): DashboardHighlightsSettings => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : { highlights: [] }
    } catch {
      return { highlights: [] }
    }
  },

  getByDashboard: (dashboardId: string): DashboardHighlight[] => {
    const settings = DashboardHighlightsStorage.getAll()
    return settings.highlights.filter(h => h.dashboardId === dashboardId)
  },

  getByWidget: (dashboardId: string, widgetId: string): DashboardHighlight[] => {
    const settings = DashboardHighlightsStorage.getAll()
    return settings.highlights.filter(
      h => h.dashboardId === dashboardId && h.widgetId === widgetId
    )
  },

  add: (highlight: Omit<DashboardHighlight, 'id' | 'createdAt' | 'updatedAt'>): DashboardHighlight => {
    const settings = DashboardHighlightsStorage.getAll()
    const now = new Date().toISOString()
    const newHighlight: DashboardHighlight = {
      ...highlight,
      id: `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    }
    settings.highlights.push(newHighlight)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    dispatchHighlightsChanged(highlight.dashboardId)
    return newHighlight
  },

  update: (id: string, updates: Partial<Omit<DashboardHighlight, 'id' | 'dashboardId' | 'createdAt'>>): void => {
    const settings = DashboardHighlightsStorage.getAll()
    const index = settings.highlights.findIndex(h => h.id === id)
    if (index >= 0) {
      settings.highlights[index] = {
        ...settings.highlights[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      dispatchHighlightsChanged(settings.highlights[index].dashboardId)
    }
  },

  delete: (id: string): void => {
    const settings = DashboardHighlightsStorage.getAll()
    const highlight = settings.highlights.find(h => h.id === id)
    if (highlight) {
      settings.highlights = settings.highlights.filter(h => h.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      dispatchHighlightsChanged(highlight.dashboardId)
    }
  },

  deleteByDashboard: (dashboardId: string): void => {
    const settings = DashboardHighlightsStorage.getAll()
    const hadHighlights = settings.highlights.some(h => h.dashboardId === dashboardId)
    settings.highlights = settings.highlights.filter(h => h.dashboardId !== dashboardId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    if (hadHighlights) {
      dispatchHighlightsChanged(dashboardId)
    }
  },
}

// Color utilities
export const HIGHLIGHT_COLORS: Record<HighlightColor, { bg: string; label: string }> = {
  yellow: { bg: 'rgba(255, 235, 59, 0.5)', label: 'Yellow' },
  green: { bg: 'rgba(129, 199, 132, 0.5)', label: 'Green' },
  blue: { bg: 'rgba(100, 181, 246, 0.5)', label: 'Blue' },
  pink: { bg: 'rgba(244, 143, 177, 0.5)', label: 'Pink' },
  orange: { bg: 'rgba(255, 183, 77, 0.5)', label: 'Orange' },
}

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = 'yellow'
