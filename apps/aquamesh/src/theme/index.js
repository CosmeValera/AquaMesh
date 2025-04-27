import { createTheme } from '@mui/material/styles'

import palette from './palette'
import typography from './typography'

const theme = createTheme({
  palette,
  typography,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.background.barMedium,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: palette.common.black },
        arrow: { color: palette.common.black },
      },
    },
  },
})

export default theme
