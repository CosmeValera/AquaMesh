import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsDialog from '../../../../src/components/settings/SettingsDialog'
import { InterfaceLanguageProvider } from '../../../../src/language/interfaceLanguage'

describe('SettingsDialog', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {}
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage[key] ?? null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value
      },
    )
  })

  it('updates the open settings dialog when switching to French and German', () => {
    render(
      <InterfaceLanguageProvider>
        <SettingsDialog open onClose={vi.fn()} />
      </InterfaceLanguageProvider>,
    )

    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: 'Interface language' }),
    )
    fireEvent.click(screen.getByRole('option', { name: 'Français' }))

    expect(screen.getByText("Paramètres de l'application")).toBeInTheDocument()
    expect(screen.getByText('Guide de bienvenue')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument()

    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: "Langue de l'interface" }),
    )
    fireEvent.click(screen.getByRole('option', { name: 'Deutsch' }))

    expect(screen.getByText('Anwendungseinstellungen')).toBeInTheDocument()
    expect(screen.getByText('Willkommensleitfaden')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Schließen' }),
    ).toBeInTheDocument()
  })
})
