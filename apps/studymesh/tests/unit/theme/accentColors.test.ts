import { beforeEach, describe, expect, it } from 'vitest'

import {
  ACCENT_COLOR_STORAGE_KEY,
  accentColorOptions,
  applyAccentCssVariables,
  getAccentColorById,
  readStoredAccentColorId,
  writeStoredAccentColorId,
} from '../../../src/theme/accentColors'

describe('accent color tokens', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('style')
  })

  it('uses blue for first-time users without a stored accent', () => {
    expect(readStoredAccentColorId()).toBe('blue')
  })

  it('falls back to the blue accent for unknown stored values', () => {
    localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, 'missing')

    expect(readStoredAccentColorId()).toBe('blue')
    expect(getAccentColorById('missing')).toEqual(accentColorOptions[0])
  })

  it('persists selected accent color id', () => {
    writeStoredAccentColorId('purple')

    expect(localStorage.setItem).toHaveBeenCalledWith(
      ACCENT_COLOR_STORAGE_KEY,
      'purple',
    )
    localStorage.getItem.mockImplementation((key: string) =>
      key === ACCENT_COLOR_STORAGE_KEY ? 'purple' : null,
    )
    expect(readStoredAccentColorId()).toBe('purple')
  })

  it('updates css variables consumed by scss layouts', () => {
    const accent = getAccentColorById('blue')

    applyAccentCssVariables(accent)

    expect(
      document.documentElement.style.getPropertyValue('--primary-main'),
    ).toBe(accent.main)
    expect(
      document.documentElement.style.getPropertyValue('--primary-light'),
    ).toBe(accent.light)
    expect(
      document.documentElement.style.getPropertyValue('--accent-soft'),
    ).toBe(accent.soft)
    expect(
      document.documentElement.style.getPropertyValue('--accent-surface'),
    ).toBe(accent.surface)
    expect(
      document.documentElement.style.getPropertyValue('--action-hover'),
    ).toBe(`${accent.light}1F`)
  })
})
