import { useCallback, useEffect, useState } from 'react'

const CHECKLIST_STATE_STORAGE_KEY = 'studymesh-checklist-state-v1'

type StoredChecklistState = Record<string, Record<string, boolean>>

const hashValue = (value: string): string => {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(36)
}

const normalizePart = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')

const readStoredChecklistState = (): StoredChecklistState => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const rawValue = window.localStorage.getItem(CHECKLIST_STATE_STORAGE_KEY)
    const parsedValue = rawValue ? JSON.parse(rawValue) : {}
    return parsedValue &&
      typeof parsedValue === 'object' &&
      !Array.isArray(parsedValue)
      ? (parsedValue as StoredChecklistState)
      : {}
  } catch {
    return {}
  }
}

const writeStoredChecklistState = (state: StoredChecklistState): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      CHECKLIST_STATE_STORAGE_KEY,
      JSON.stringify(state),
    )
  } catch {
    // Local storage is best-effort; checklist completion should not break study.
  }
}

export const createChecklistScopeId = (parts: unknown[]): string =>
  hashValue(parts.map(normalizePart).filter(Boolean).join('|'))

export const createChecklistItemKey = (text: string, index: number): string =>
  `${index}:${hashValue(normalizePart(text).toLowerCase())}`

export const usePersistentChecklistState = (scopeId: string) => {
  const [items, setItems] = useState<Record<string, boolean>>(() => {
    if (!scopeId) {
      return {}
    }

    return readStoredChecklistState()[scopeId] || {}
  })

  useEffect(() => {
    if (!scopeId) {
      setItems({})
      return
    }

    setItems(readStoredChecklistState()[scopeId] || {})
  }, [scopeId])

  const isChecked = useCallback(
    (itemKey: string, defaultChecked = false): boolean =>
      Object.prototype.hasOwnProperty.call(items, itemKey)
        ? items[itemKey]
        : defaultChecked,
    [items],
  )

  const setChecked = useCallback(
    (itemKey: string, checked: boolean) => {
      if (!scopeId || !itemKey) {
        return
      }

      setItems((currentItems) => {
        const nextItems = {
          ...currentItems,
          [itemKey]: checked,
        }
        const storedState = readStoredChecklistState()
        writeStoredChecklistState({
          ...storedState,
          [scopeId]: nextItems,
        })
        return nextItems
      })
    },
    [scopeId],
  )

  return { isChecked, setChecked }
}
