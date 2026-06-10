/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'

import AiModeDialog from '../../../../src/components/hostedAi/AiModeDialog'
import { createStudyMeshTheme } from '../../../../src/theme'

vi.mock('../../../../src/components/hostedAi/HostedAiSettingsPanel', () => ({
  default: () => <div data-testid="hosted-ai-settings-panel" />,
}))

const renderDialog = (mode: 'light' | 'dark') => {
  const theme = createStudyMeshTheme(mode)

  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AiModeDialog open onClose={vi.fn()} />
    </ThemeProvider>,
  )
}

describe('AiModeDialog contrast controls', () => {
  it.each(['light', 'dark'] as const)(
    'renders close and select caret controls in %s mode',
    (mode) => {
      renderDialog(mode)

      expect(
        screen.getByRole('button', { name: /close ai mode/i }),
      ).toBeInTheDocument()
      expect(screen.getByLabelText(/ai provider/i)).toBeInTheDocument()
      expect(document.querySelector('.MuiSelect-icon')).toBeInTheDocument()
    },
  )
})
