export type AccentColorId =
  | 'studymesh'
  | 'aquamesh'
  | 'blue'
  | 'purple'
  | 'orange'
  | 'rose'
  | 'slate'

export interface AccentColorOption {
  id: AccentColorId
  name: string
  main: string
  light: string
  dark: string
  contrastText: string
  soft: string
  surface: string
}

export const ACCENT_COLOR_STORAGE_KEY = 'studymesh-accent-color'
const LEGACY_ACCENT_COLOR_STORAGE_KEY = 'aquamesh-accent-color'

export const accentColorOptions: AccentColorOption[] = [
  {
    id: 'blue',
    name: 'Ocean blue',
    main: '#1976D2',
    light: '#42A5F5',
    dark: '#0D47A1',
    contrastText: '#FFFFFF',
    soft: '#E3F2FD',
    surface: '#F1F8FF',
  },
  {
    id: 'studymesh',
    name: 'Study green',
    main: '#007C66',
    light: '#00C49A',
    dark: '#005A49',
    contrastText: '#FFFFFF',
    soft: '#E2F7F2',
    surface: '#F0FBF8',
  },
  {
    id: 'purple',
    name: 'Signal purple',
    main: '#7B1FA2',
    light: '#BA68C8',
    dark: '#4A148C',
    contrastText: '#FFFFFF',
    soft: '#F3E5F5',
    surface: '#FBF4FC',
  },
  {
    id: 'orange',
    name: 'Beacon orange',
    main: '#EF6C00',
    light: '#FFB74D',
    dark: '#E65100',
    contrastText: '#FFFFFF',
    soft: '#FFF3E0',
    surface: '#FFF9F0',
  },
  {
    id: 'rose',
    name: 'Coral rose',
    main: '#C2185B',
    light: '#F06292',
    dark: '#880E4F',
    contrastText: '#FFFFFF',
    soft: '#FCE4EC',
    surface: '#FFF3F7',
  },
  {
    id: 'slate',
    name: 'Slate',
    main: '#455A64',
    light: '#90A4AE',
    dark: '#263238',
    contrastText: '#FFFFFF',
    soft: '#ECEFF1',
    surface: '#F7F9FA',
  },
]

export const defaultAccentColorId: AccentColorId = 'blue'

export const getAccentColorById = (id?: string | null): AccentColorOption => {
  return (
    accentColorOptions.find((option) => option.id === id) ??
    accentColorOptions[0]
  )
}

export const readStoredAccentColorId = (): AccentColorId => {
  if (typeof window === 'undefined') {
    return defaultAccentColorId
  }

  const storedAccent =
    window.localStorage.getItem(ACCENT_COLOR_STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_ACCENT_COLOR_STORAGE_KEY)
  const normalizedAccent = storedAccent === 'aquamesh' ? 'studymesh' : storedAccent
  return getAccentColorById(normalizedAccent).id
}

export const writeStoredAccentColorId = (accentColorId: AccentColorId) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, accentColorId)
}

export const applyAccentCssVariables = (accent: AccentColorOption) => {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.style.setProperty('--primary-main', accent.main)
  root.style.setProperty('--primary-light', accent.light)
  root.style.setProperty('--primary-dark', accent.dark)
  root.style.setProperty('--secondary-main', accent.main)
  root.style.setProperty('--secondary-light', accent.light)
  root.style.setProperty('--secondary-dark', accent.dark)
  root.style.setProperty('--accent-soft', accent.soft)
  root.style.setProperty('--accent-surface', accent.surface)
  root.style.setProperty('--action-active', `${accent.light}33`)
  root.style.setProperty('--action-hover', `${accent.light}1F`)
  root.style.setProperty('--action-selected', `${accent.light}24`)
}
