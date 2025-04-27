// IDEA (re-)use css variables here
const palette = {
  brand: {
    primary: '#009879',
  },
  common: {
    black: '#000000',
    white: '#FFFFFF',
    clear: '#FFFFFF0',
  },
  primary: {
    main: '#00C49A',
    light: '#4ADCBE',
    dark: '#007C66',
  },
  secondary: {
    main: '#009879',
    light: '#00C49A',
    dark: '#007C66',
  },
  grey: {
    50: '#F9FAFA',
    100: '#F4F5F6',
    200: '#ECEEEF',
    300: '#DEE2E3',
    400: '#B7C0C2',
    500: '#96A2A6',
    600: '#6C7A7F',
    700: '#596569',
    800: '#3D4548',
    900: '#001026',
    A100: '#D3D8D9',
    A200: '#A4AEB2',
    A400: '#596569',
    A700: '#2D3334',
  },
  critical: {
    main: '#E31B0C',
    light: '#F88078',
    dark: '#BA1408',
  },
  serious: {
    main: '#ED6C02',
    light: '#FFB547',
    dark: '#BB5A00',
  },
  caution: {
    main: '#FBE20E',
    light: '#FDF082',
    dark: '#B4A203',
    contrastText: '#00000099',
  },
  normal: {
    main: '#299E2E',
    light: '#7BC67E',
    dark: '#3B873E',
  },
  standby: {
    main: '#009879',
    light: '#00C49A',
    dark: '#007C66',
  },
  off: {
    main: '#9EA7AD',
    light: '#D6D9DC',
    dark: '#6A7177',
  },
  // REVIEW add these colors after creating the theme, so we can reference
  // their bases
  foreground: {
    primary: '#ffffffdf',
    contrastPrimary: '#FFFFFFde',
    secondary: '#ffffff9a',
    contrastSecondary: '#FFFFFF99',
    disabled: '#00102661',
    contrastDisabled: '#FFFFFF61',
  },
  background: {
    header: '#005A49',
    barDark: '#003D31',
    barMedium: '#005A49',
    default: '#006B58',
    light: '#FFFFFF14',
    paper: '#008368',
    dialog: '#006B58',
    modal: '#005A49',
  },
  action: {
    active: '#00C49A47',
    contrastActive: '#FFFFFF7a',
    hover: '#4ADCBE48',
    contrastHover: '#FFFFFF14',
    selected: '#00C49A29',
    contrastSelected: '#FFFFFF29',
    disabled: '#00000042',
    contrastDisabled: '#FFFFFF42',
  },
  tabs: {
    background: '#FFFFFF14',
  },
  other: {
    divider: '#0000001F',
    outlinedBorder: '#0000003B',
    backdropOverlay: '#00000080',
    filledInputBackground: '#00000017',
    standardInputLine: '#0000006B',
    snackbar: '#2D3334',
  },
}

export default palette
