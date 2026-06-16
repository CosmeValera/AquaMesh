const lightBase = {
  mode: 'light',
  common: {
    black: '#000000',
    white: '#FFFFFF',
    clear: '#FFFFFF0',
  },
  grey: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    A100: '#E2E8F0',
    A200: '#CBD5E1',
    A400: '#64748B',
    A700: '#334155',
  },
  foreground: {
    primary: '#111827',
    contrastPrimary: '#111827',
    secondary: '#475569',
    contrastSecondary: '#475569',
    disabled: '#94A3B8',
    contrastDisabled: '#94A3B8',
  },
  text: {
    primary: '#111827',
    secondary: '#475569',
    disabled: '#94A3B8',
  },
  background: {
    header: '#FFFFFF',
    barDark: '#E2E8F0',
    barMedium: '#F1F5F9',
    default: '#F6F8FA',
    light: '#F8FAFC',
    paper: '#FFFFFF',
    dialog: '#FFFFFF',
    modal: '#FFFFFF',
  },
  divider: '#D7DEE8',
  other: {
    divider: '#D7DEE8',
    outlinedBorder: '#CBD5E1',
    backdropOverlay: '#00000080',
    filledInputBackground: '#00000017',
    standardInputLine: '#0000006B',
    snackbar: '#2D3334',
  },
}

const darkBase = {
  ...lightBase,
  mode: 'dark',
  grey: {
    ...lightBase.grey,
    50: '#020617',
    100: '#0B1120',
    200: '#111827',
    300: '#1F2937',
    400: '#374151',
    500: '#64748B',
    600: '#94A3B8',
    700: '#CBD5E1',
    800: '#E5E7EB',
    900: '#F8FAFC',
  },
  foreground: {
    primary: '#F3F4F6',
    contrastPrimary: '#F3F4F6',
    secondary: '#A7B0BF',
    contrastSecondary: '#A7B0BF',
    disabled: '#64748B',
    contrastDisabled: '#64748B',
  },
  text: {
    primary: '#F3F4F6',
    secondary: '#A7B0BF',
    disabled: '#64748B',
  },
  background: {
    header: '#111827',
    barDark: '#020617',
    barMedium: '#0F172A',
    default: '#070B12',
    light: '#101722',
    paper: '#111827',
    dialog: '#151E2B',
    modal: '#151E2B',
  },
  divider: '#334155',
  other: {
    divider: '#334155',
    outlinedBorder: '#475569',
    backdropOverlay: '#000000B3',
    filledInputBackground: '#FFFFFF14',
    standardInputLine: '#FFFFFF70',
    snackbar: '#E8F4F2',
  },
}

const createSeverityPalette = (mode) =>
  mode === 'dark'
    ? {
        critical: { main: '#FF8A80', light: '#FFDAD6', dark: '#E35D52' },
        serious: { main: '#FFB46A', light: '#FFD8AD', dark: '#F28A2A' },
        caution: {
          main: '#FBE86A',
          light: '#FFF3A8',
          dark: '#DCC02B',
          contrastText: '#211C00',
        },
        normal: { main: '#7DDB85', light: '#BDF1C1', dark: '#44AF4E' },
        off: { main: '#87979B', light: '#BAC6C9', dark: '#5D6C70' },
      }
    : {
        critical: { main: '#E31B0C', light: '#F88078', dark: '#BA1408' },
        serious: { main: '#ED6C02', light: '#FFB547', dark: '#BB5A00' },
        caution: {
          main: '#FBE20E',
          light: '#FDF082',
          dark: '#B4A203',
          contrastText: '#00000099',
        },
        normal: { main: '#299E2E', light: '#7BC67E', dark: '#3B873E' },
        off: { main: '#9EA7AD', light: '#D6D9DC', dark: '#6A7177' },
      }

const createPalette = (accent, mode = 'light') => {
  const isDark = mode === 'dark'
  const base = isDark ? darkBase : lightBase
  const accentSoft = isDark ? `${accent.main}24` : `${accent.main}14`
  const accentSurface = isDark ? `${accent.main}16` : `${accent.main}0D`

  return {
    ...base,
    brand: {
      primary: accent.main,
    },
    primary: {
      main: isDark ? accent.light : accent.main,
      light: isDark ? accent.surface : accent.light,
      dark: isDark ? accent.main : accent.dark,
      contrastText: isDark ? '#04211D' : accent.contrastText,
    },
    secondary: {
      main: accentSoft,
      light: accentSurface,
      dark: isDark ? accent.light : accent.light,
      contrastText: isDark ? '#E8F4F2DE' : accent.dark,
    },
    ...createSeverityPalette(mode),
    standby: {
      main: isDark ? accent.light : accent.main,
      light: isDark ? accent.surface : accent.light,
      dark: isDark ? accent.main : accent.dark,
    },
    background: {
      ...base.background,
      accentSoft,
      accentSurface,
    },
    action: {
      active: base.text.primary,
      contrastActive: isDark ? `${accent.main}3D` : '#FFFFFF7a',
      hover: isDark ? '#FFFFFF0A' : '#0F172A0A',
      contrastHover: '#FFFFFF14',
      selected: isDark ? `${accent.main}24` : `${accent.main}12`,
      contrastSelected: isDark ? `${accent.main}33` : '#FFFFFF29',
      disabled: isDark ? '#FFFFFF3D' : '#00000042',
      contrastDisabled: '#FFFFFF42',
    },
    tabs: {
      background: isDark ? `${accent.main}1F` : '#FFFFFF14',
    },
  }
}

export default createPalette
