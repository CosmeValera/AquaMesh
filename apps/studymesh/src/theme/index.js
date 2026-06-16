import { alpha, createTheme } from '@mui/material/styles'

import createPalette from './palette'
import { defaultAccentColorId, getAccentColorById } from './accentColors'
import typography from './typography'

export const THEME_STORAGE_KEY = 'studymesh-theme-mode'
const LEGACY_THEME_STORAGE_KEY = 'aquamesh-theme-mode'

if (
  typeof window !== 'undefined' &&
  window.localStorage.getItem(THEME_STORAGE_KEY) === null
) {
  const legacyMode = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
  if (legacyMode !== null) {
    window.localStorage.setItem(THEME_STORAGE_KEY, legacyMode)
  }
}

const createCssVariables = (themePalette, mode) => ({
  colorScheme: mode,
  '--common-black': themePalette.common.black,
  '--common-white': themePalette.common.white,
  '--common-clear': themePalette.common.clear,
  '--foreground-primary': themePalette.foreground.primary,
  '--foreground-contrast-primary': themePalette.foreground.contrastPrimary,
  '--foreground-secondary': themePalette.foreground.secondary,
  '--foreground-contrast-secondary': themePalette.foreground.contrastSecondary,
  '--foreground-disabled': themePalette.foreground.disabled,
  '--foreground-contrast-disabled': themePalette.foreground.contrastDisabled,
  '--background-default': themePalette.background.default,
  '--background-paper': themePalette.background.paper,
  '--background-header': themePalette.background.header,
  '--background-bar-dark': themePalette.background.barDark,
  '--background-bar-medium': themePalette.background.barMedium,
  '--background-medium': themePalette.background.barMedium,
  '--background-light': themePalette.background.light,
  '--background-accent-soft': themePalette.background.accentSoft,
  '--background-accent-surface': themePalette.background.accentSurface,
  '--surface-ground': themePalette.background.default,
  '--surface-section': themePalette.background.barMedium,
  '--surface-card': themePalette.background.paper,
  '--surface-overlay': themePalette.background.paper,
  '--surface-border': themePalette.divider,
  '--surface-hover': themePalette.action.hover,
  '--surface-0': themePalette.background.paper,
  '--surface-50': themePalette.background.default,
  '--surface-100': themePalette.background.barMedium,
  '--surface-200': themePalette.background.barDark,
  '--surface-700': themePalette.grey[700],
  '--surface-800': themePalette.grey[800],
  '--surface-900': themePalette.grey[900],
  '--text-color': themePalette.text.primary,
  '--text-color-secondary': themePalette.text.secondary,
  '--primary-main': themePalette.primary.main,
  '--primary-light': themePalette.primary.light,
  '--primary-dark': themePalette.primary.dark,
  '--primary-color': themePalette.primary.main,
  '--primary-color-text': themePalette.primary.contrastText,
  '--secondary-main': themePalette.secondary.main,
  '--secondary-light': themePalette.secondary.light,
  '--secondary-dark': themePalette.secondary.dark,
  '--accent-soft': themePalette.background.accentSoft,
  '--accent-surface': themePalette.background.accentSurface,
  '--grey-50': themePalette.grey[50],
  '--grey-100': themePalette.grey[100],
  '--grey-200': themePalette.grey[200],
  '--grey-300': themePalette.grey[300],
  '--grey-400': themePalette.grey[400],
  '--grey-500': themePalette.grey[500],
  '--grey-600': themePalette.grey[600],
  '--grey-700': themePalette.grey[700],
  '--grey-800': themePalette.grey[800],
  '--grey-900': themePalette.grey[900],
  '--action-active': themePalette.action.active,
  '--action-contrast-active': themePalette.action.contrastActive,
  '--action-hover': themePalette.action.hover,
  '--action-contrast-hover': themePalette.action.contrastHover,
  '--action-selected': themePalette.action.selected,
  '--action-contrast-selected': themePalette.action.contrastSelected,
  '--action-disabled': themePalette.action.disabled,
  '--action-contrast-disabled': themePalette.action.contrastDisabled,
  '--tabs-background': themePalette.tabs.background,
  '--other-divider': themePalette.other.divider,
  '--other-outlined-border': themePalette.other.outlinedBorder,
  '--other-backdrop-overlay': themePalette.other.backdropOverlay,
  '--other-filled-input-background': themePalette.other.filledInputBackground,
  '--other-standard-input-line': themePalette.other.standardInputLine,
  '--other-snackbar': themePalette.other.snackbar,
})

export const createStudyMeshTheme = (
  mode = 'light',
  accentColorId = defaultAccentColorId,
) => {
  const themePalette = createPalette(getAccentColorById(accentColorId), mode)
  const isDark = mode === 'dark'
  const cssVariables = createCssVariables(themePalette, mode)
  const iconButtonHoverBackground = alpha(
    themePalette.primary.main,
    isDark ? 0.18 : 0.1,
  )
  const iconButtonPaletteState = (color) => ({
    color,
    borderColor: 'transparent',
    '&:hover': {
      backgroundColor: iconButtonHoverBackground,
      borderColor: alpha(color, isDark ? 0.52 : 0.42),
      color,
    },
  })

  return createTheme({
    palette: themePalette,
    typography,
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': cssVariables,
          body: {
            ...cssVariables,
            backgroundColor: themePalette.background.default,
            color: themePalette.text.primary,
            transition: 'background-color 180ms ease, color 180ms ease',
          },
          '#root': {
            minHeight: '100dvh',
            backgroundColor: themePalette.background.default,
          },
          '::selection': {
            backgroundColor: alpha(themePalette.primary.main, 0.35),
          },
          'input::placeholder, textarea::placeholder': {
            color: themePalette.text.disabled,
            opacity: isDark ? 0.72 : 0.86,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: themePalette.common.black },
          arrow: { color: themePalette.common.black },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 12,
          },
        },
      },
      MuiAppBar: {
        defaultProps: {
          color: 'default',
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: themePalette.background.dialog,
            color: themePalette.text.primary,
            borderRadius: 16,
            border: `1px solid ${themePalette.divider}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: themePalette.background.paper,
            color: themePalette.text.primary,
            borderColor: themePalette.divider,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            borderRadius: 10,
            border: `1px solid ${themePalette.divider}`,
            boxShadow: isDark
              ? '0 18px 44px rgba(0,0,0,0.42)'
              : '0 16px 36px rgba(15,23,42,0.12)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            minHeight: 36,
            fontWeight: 500,
          },
          containedPrimary: {
            color: themePalette.primary.contrastText,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
          outlined: {
            borderColor: themePalette.divider,
            color: themePalette.text.primary,
            '&:hover': {
              borderColor: themePalette.text.secondary,
              backgroundColor: themePalette.action.hover,
            },
          },
          text: {
            color: themePalette.text.primary,
            '&:hover': {
              backgroundColor: themePalette.action.hover,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: themePalette.text.primary,
            backgroundColor: 'transparent',
            border: '1px solid transparent',
            borderColor: 'transparent',
            borderRadius: 8,
            '&:hover': {
              backgroundColor: themePalette.action.hover,
              borderColor: themePalette.divider,
              color: themePalette.text.primary,
            },
            '&.Mui-focusVisible': {
              outline: `2px solid ${alpha(themePalette.primary.main, 0.48)}`,
              outlineOffset: 2,
            },
            '&.Mui-disabled': {
              color: themePalette.text.disabled,
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            },
          },
          colorPrimary: iconButtonPaletteState(themePalette.primary.main),
          colorSecondary: iconButtonPaletteState(themePalette.secondary.dark),
          colorError: iconButtonPaletteState(themePalette.critical.main),
          colorInfo: iconButtonPaletteState(themePalette.primary.main),
          colorSuccess: iconButtonPaletteState(themePalette.normal.main),
          colorWarning: iconButtonPaletteState(themePalette.serious.main),
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: {
            color: themePalette.text.primary,
            '&.MuiSelect-iconOpen': {
              color: themePalette.text.primary,
            },
            '&.Mui-disabled': {
              color: themePalette.text.disabled,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: isDark
              ? alpha(themePalette.common.white, 0.03)
              : undefined,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: themePalette.primary.main,
              borderWidth: 1,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 500,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 36,
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 36,
          },
        },
      },
    },
  })
}

export const createAquaMeshTheme = createStudyMeshTheme

export default createStudyMeshTheme()
