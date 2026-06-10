/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'

import ThemeModeToggle from '../../../src/components/shared/ThemeModeToggle'
import { createStudyMeshTheme, THEME_STORAGE_KEY } from '../../../src/theme'
import {
  ThemeModeProvider,
  useThemeMode,
} from '../../../src/theme/ThemeModeContext'

const Probe = () => {
  const { mode } = useThemeMode()
  const theme = React.useMemo(() => createStudyMeshTheme(mode), [mode])

  return (
    <ThemeProvider theme={theme}>
      <span data-testid="theme-mode">{mode}</span>
      <ThemeModeToggle />
    </ThemeProvider>
  )
}

describe('ThemeModeProvider', () => {
  it('uses the saved user preference and persists toggles', () => {
    vi.mocked(window.localStorage.getItem).mockImplementation((key) =>
      key === THEME_STORAGE_KEY ? 'dark' : null,
    )

    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    )

    expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark')

    fireEvent.click(screen.getByRole('button', { name: /switch to light/i }))

    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      THEME_STORAGE_KEY,
      'light',
    )
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('light')
  })

  it('falls back to light mode when no user preference exists', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    )

    expect(screen.getByTestId('theme-mode')).toHaveTextContent('light')
  })
})

const expandHex = (hex: string) => {
  const normalized = hex.replace('#', '')
  if (normalized.length === 6 || normalized.length === 8) {
    return normalized
  }

  return normalized
    .split('')
    .map((character) => `${character}${character}`)
    .join('')
}

const hexToRgba = (hex: string) => {
  const expanded = expandHex(hex)
  const red = parseInt(expanded.slice(0, 2), 16)
  const green = parseInt(expanded.slice(2, 4), 16)
  const blue = parseInt(expanded.slice(4, 6), 16)
  const alpha =
    expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1

  return { red, green, blue, alpha }
}

const blend = (foreground: string, background: string) => {
  const fg = hexToRgba(foreground)
  const bg = hexToRgba(background)
  const mix = (front: number, back: number) =>
    Math.round(front * fg.alpha + back * (1 - fg.alpha))

  return {
    red: mix(fg.red, bg.red),
    green: mix(fg.green, bg.green),
    blue: mix(fg.blue, bg.blue),
  }
}

const luminance = (color: ReturnType<typeof blend>) => {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const value = channel / 255
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4)
  })

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

const contrastRatio = (foreground: string, background: string) => {
  const foregroundLuminance = luminance(blend(foreground, background))
  const backgroundLuminance = luminance(blend(background, '#ffffff'))
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

describe('createStudyMeshTheme icon contrast', () => {
  it.each(['light', 'dark'] as const)(
    'uses high-contrast action icons in %s mode',
    (mode) => {
      const theme = createStudyMeshTheme(mode)
      const iconButtonOverrides =
        theme.components?.MuiIconButton?.styleOverrides || {}
      const selectOverrides = theme.components?.MuiSelect?.styleOverrides || {}

      expect(theme.palette.action.active).toBe(theme.palette.text.primary)
      expect(
        contrastRatio(
          theme.palette.action.active,
          theme.palette.background.dialog,
        ),
      ).toBeGreaterThanOrEqual(4.5)
      expect(iconButtonOverrides.root).toMatchObject({
        color: theme.palette.text.primary,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
      })
      expect(selectOverrides.icon).toMatchObject({
        color: theme.palette.text.primary,
      })
    },
  )
})
