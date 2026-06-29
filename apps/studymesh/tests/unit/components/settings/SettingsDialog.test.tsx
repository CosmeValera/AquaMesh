import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsDialog from '../../../../src/components/settings/SettingsDialog'
import { InterfaceLanguageProvider } from '../../../../src/language/interfaceLanguage'
import { PROFILE_CONTEXT_STORAGE_KEY } from '../../../../src/profileContext'

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

  it('shows all explanation context skills and no reset action', () => {
    storage[PROFILE_CONTEXT_STORAGE_KEY] = JSON.stringify({
      version: 1,
      roles: ['software_it'],
      broadKnowledge: [
        'Backend',
        'Databases',
        'Cloud',
        'APIs',
        'Testing',
        'DevOps',
        'Security',
        'Frontend',
      ],
      specificKnowledge: ['MinIO', 'S3', 'Databases'],
      confidence: 'self_reported',
      updatedAt: '2026-06-23T00:00:00.000Z',
    })

    render(<SettingsDialog open onClose={vi.fn()} />)

    expect(screen.getByText('Role: Software / IT')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /reset/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('MinIO')).toBeInTheDocument()
    expect(screen.getByText('S3')).toBeInTheDocument()
    expect(screen.getByText('Frontend')).toBeInTheDocument()
    expect(screen.getByText('Security')).toBeInTheDocument()
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
