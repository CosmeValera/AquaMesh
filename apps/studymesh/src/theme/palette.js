const lightBase = {
  mode: 'light',
  common: {
    black: '#000000',
    white: '#FFFFFF',
    clear: '#FFFFFF0',
  },
  grey: {
    50: '#F7FAFB',
    100: '#EEF3F5',
    200: '#E1EAED',
    300: '#CBD9DE',
    400: '#A7B8BE',
    500: '#83949A',
    600: '#627278',
    700: '#596569',
    800: '#3D4548',
    900: '#001026',
    A100: '#D3D8D9',
    A200: '#A4AEB2',
    A400: '#596569',
    A700: '#2D3334',
  },
  foreground: {
    primary: '#102A2DDE',
    contrastPrimary: '#102A2DDE',
    secondary: '#173137F2',
    contrastSecondary: '#173137F2',
    disabled: '#2F474DE0',
    contrastDisabled: '#2F474DE0',
  },
  text: {
    primary: '#102A2DDE',
    secondary: '#173137F2',
    disabled: '#2F474DE0',
  },
  background: {
    header: '#FFFFFF',
    barDark: '#CBD9DE',
    barMedium: '#E5ECEF',
    default: '#EEF3F5',
    light: '#F7FAFB',
    paper: '#FFFFFF',
    dialog: '#FFFFFF',
    modal: '#FFFFFF',
  },
  divider: '#102A2D42',
  other: {
    divider: '#102A2D42',
    outlinedBorder: '#102A2D66',
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
    50: '#071414',
    100: '#0A1A1C',
    200: '#102326',
    300: '#183236',
    400: '#304B50',
    500: '#6D858A',
    600: '#90A3A7',
    700: '#B5C4C7',
    800: '#D7E0E2',
    900: '#F4FAFA',
  },
  foreground: {
    primary: '#E8F4F2DE',
    contrastPrimary: '#E8F4F2DE',
    secondary: '#B6CAC6DE',
    contrastSecondary: '#B6CAC6DE',
    disabled: '#E8F4F261',
    contrastDisabled: '#E8F4F261',
  },
  text: {
    primary: '#E8F4F2DE',
    secondary: '#B6CAC6DE',
    disabled: '#E8F4F261',
  },
  background: {
    header: '#071113',
    barDark: '#050B0D',
    barMedium: '#0C181B',
    default: '#050B0D',
    light: '#142529',
    paper: '#0F1D21',
    dialog: '#122428',
    modal: '#122428',
  },
  divider: '#D7E0E233',
  other: {
    divider: '#D7E0E21F',
    outlinedBorder: '#D7E0E23B',
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
  const accentSoft = isDark ? `${accent.main}2E` : accent.soft
  const accentSurface = isDark ? `${accent.main}1A` : accent.surface

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
      active: isDark ? `${accent.main}3D` : `${accent.light}33`,
      contrastActive: isDark ? `${accent.main}3D` : '#FFFFFF7a',
      hover: isDark ? `${accent.main}26` : `${accent.light}24`,
      contrastHover: '#FFFFFF14',
      selected: isDark ? `${accent.main}33` : `${accent.light}33`,
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
