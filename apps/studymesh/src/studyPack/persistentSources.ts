export type PersistentSourceType = 'text' | 'image' | 'pdf' | 'pptx' | 'dashboard'

export interface PersistentSourceText {
  id: string
  type: 'text'
  content: string
  label: string
  createdAt: string
}

export interface PersistentSourceImage {
  id: string
  type: 'image'
  mimeType: string
  data: string // base64
  label: string
  createdAt: string
}

export interface PersistentSourcePdf {
  id: string
  type: 'pdf'
  name: string
  data: string // base64
  label: string
  createdAt: string
}

export interface PersistentSourcePptx {
  id: string
  type: 'pptx'
  name: string
  data: string // base64
  label: string
  createdAt: string
}

export interface PersistentSourceDashboard {
  id: string
  type: 'dashboard'
  dashboardId: string
  label: string
  createdAt: string
}

export type PersistentSource =
  | PersistentSourceText
  | PersistentSourceImage
  | PersistentSourcePdf
  | PersistentSourcePptx
  | PersistentSourceDashboard

export interface PersistentSourcesSettings {
  sources: PersistentSource[]
  enabled: boolean
}

const PERSISTENT_SOURCES_KEY = 'studymesh-persistent-sources-v1'

const defaultSettings: PersistentSourcesSettings = {
  sources: [],
  enabled: true,
}

export const readPersistentSourcesSettings =
  (): PersistentSourcesSettings => {
    if (typeof window === 'undefined') {
      return defaultSettings
    }

    try {
      const stored = window.localStorage.getItem(PERSISTENT_SOURCES_KEY)
      if (!stored) {
        return defaultSettings
      }

      const parsed = JSON.parse(stored) as Partial<PersistentSourcesSettings>
      return {
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      }
    } catch {
      return defaultSettings
    }
  }

export const savePersistentSourcesSettings = (
  settings: PersistentSourcesSettings,
) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      PERSISTENT_SOURCES_KEY,
      JSON.stringify(settings),
    )
  } catch (error) {
    console.error('Failed to save persistent sources settings', error)
  }
}

export const addPersistentSource = (source: PersistentSource) => {
  const settings = readPersistentSourcesSettings()
  settings.sources.push(source)
  savePersistentSourcesSettings(settings)
}

export const removePersistentSource = (id: string) => {
  const settings = readPersistentSourcesSettings()
  settings.sources = settings.sources.filter((s) => s.id !== id)
  savePersistentSourcesSettings(settings)
}

export const clearPersistentSources = () => {
  savePersistentSourcesSettings({ ...defaultSettings, sources: [] })
}

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.readAsDataURL(file)
  })

export const createPersistentSourceText = (
  content: string,
  label: string,
): PersistentSourceText => ({
  id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: 'text',
  content,
  label,
  createdAt: new Date().toISOString(),
})

export const createPersistentSourceImage = async (
  file: File,
  label: string,
): Promise<PersistentSourceImage> => {
  const data = await fileToBase64(file)
  return {
    id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    mimeType: file.type,
    data,
    label,
    createdAt: new Date().toISOString(),
  }
}

export const createPersistentSourcePdf = async (
  file: File,
  label: string,
): Promise<PersistentSourcePdf> => {
  const data = await fileToBase64(file)
  return {
    id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'pdf',
    name: file.name,
    data,
    label,
    createdAt: new Date().toISOString(),
  }
}

export const createPersistentSourcePptx = async (
  file: File,
  label: string,
): Promise<PersistentSourcePptx> => {
  const data = await fileToBase64(file)
  return {
    id: `pptx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'pptx',
    name: file.name,
    data,
    label,
    createdAt: new Date().toISOString(),
  }
}

export const createPersistentSourceDashboard = (
  dashboardId: string,
  label: string,
): PersistentSourceDashboard => ({
  id: `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: 'dashboard',
  dashboardId,
  label,
  createdAt: new Date().toISOString(),
})

export const getPersistentSourceLabel = (source: PersistentSource): string => {
  if (source.type === 'dashboard') {
    return source.label
  }

  if (source.type === 'text') {
    return source.label || source.content.slice(0, 50)
  }

  if (source.type === 'image') {
    return source.label || 'Image'
  }

  return source.label || source.name
}
