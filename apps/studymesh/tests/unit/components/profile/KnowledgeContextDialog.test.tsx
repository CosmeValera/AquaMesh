import type React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import KnowledgeContextDialog from '../../../../src/components/profile/KnowledgeContextDialog'
import { InterfaceLanguageProvider } from '../../../../src/language/interfaceLanguage'
import { CONTENT_LANGUAGE_SETTINGS_KEY } from '../../../../src/language/contentLanguage'
import type { InterfaceLanguageCode } from '../../../../src/language/contentLanguage'

describe('KnowledgeContextDialog', () => {
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
    window.sessionStorage.clear()
  })

  const renderWithLanguage = (
    language: InterfaceLanguageCode,
    element: React.ReactElement,
  ) => {
    storage[CONTENT_LANGUAGE_SETTINGS_KEY] = JSON.stringify({
      interfaceLanguage: language,
      defaultContentLanguage: language,
      autoDetectAiLanguage: true,
    })

    return render(
      <InterfaceLanguageProvider>{element}</InterfaceLanguageProvider>,
    )
  }

  it('explains the purpose and invites relevant examples without a wizard', () => {
    render(
      <KnowledgeContextDialog
        open
        surface="onboarding"
        initialContext={null}
        onClose={vi.fn()}
      />,
    )

    expect(
      screen.getByText(
        /explain new topics using things you already understand/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/relevant to the Quick Guides you create/i),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(/helpful things you know/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Math, biology, football, cooking, music/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Valencian|Docker|LEGO/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /next/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/step 1 of 3/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept/i })).toBeDisabled()
  })

  it('saves typed examples in onboarding as specific knowledge', () => {
    const onClose = vi.fn()
    render(
      <KnowledgeContextDialog
        open
        surface="onboarding"
        initialContext={null}
        onClose={onClose}
      />,
    )

    fireEvent.change(screen.getByLabelText(/helpful things you know/i), {
      target: { value: 'Math, Cooking' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(screen.getByText('Math')).toBeInTheDocument()
    expect(screen.getByText('Cooking')).toBeInTheDocument()
    expect(JSON.parse(storage['studymesh-profile-context-v1'])).toMatchObject({
      roles: [],
      broadKnowledge: [],
      specificKnowledge: ['Math', 'Cooking'],
    })

    fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps typed draft examples across close and reopen until added', () => {
    const firstRender = render(
      <KnowledgeContextDialog
        open
        surface="settings"
        initialContext={null}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/helpful things you know/i), {
      target: { value: 'Math, cooking' },
    })
    firstRender.unmount()

    render(
      <KnowledgeContextDialog
        open
        surface="settings"
        initialContext={null}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/helpful things you know/i)).toHaveValue(
      'Math, cooking',
    )
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(screen.getByLabelText(/helpful things you know/i)).toHaveValue('')
    expect(
      window.sessionStorage.getItem(
        'studymesh-profile-context-input-draft-settings',
      ),
    ).toBeNull()
  })

  it('keeps study/work suggestions optional and role-scoped', () => {
    render(
      <KnowledgeContextDialog
        open
        surface="settings"
        initialContext={null}
        onClose={vi.fn()}
      />,
    )

    expect(
      screen.queryByText(/suggested familiar areas/i),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/optional: show suggestions/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Software / IT'))
    expect(screen.getByText(/suggested familiar areas/i)).toBeInTheDocument()
    expect(screen.getByText('Backend')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Backend'))
    expect(JSON.parse(storage['studymesh-profile-context-v1'])).toMatchObject({
      roles: ['software_it'],
      broadKnowledge: ['Backend'],
      specificKnowledge: [],
    })
  })

  it('localizes modal copy and suggestion labels for supported interface languages', () => {
    const cases: Array<{
      language: InterfaceLanguageCode
      title: RegExp
      label: RegExp
      role: string
      topic: string
      close: RegExp
      accept: RegExp
    }> = [
      {
        language: 'es',
        title: /contexto personal de explicación/i,
        label: /cosas útiles que conoces/i,
        role: 'Estudiante',
        topic: 'Exámenes',
        close: /^cerrar$/i,
        accept: /^aceptar$/i,
      },
      {
        language: 'fr',
        title: /contexte personnel/i,
        label: /choses utiles/i,
        role: 'Étudiant',
        topic: 'Examens',
        close: /^fermer$/i,
        accept: /^accepter$/i,
      },
      {
        language: 'de',
        title: /persönlicher erklärungskontext/i,
        label: /hilfreiche dinge/i,
        role: 'Schüler / Student',
        topic: 'Prüfungen',
        close: /^schließen$/i,
        accept: /^akzeptieren$/i,
      },
    ]

    cases.forEach(({ language, title, label, role, topic, close, accept }) => {
      const view = renderWithLanguage(
        language,
        <KnowledgeContextDialog
          open
          surface="settings"
          initialContext={null}
          onClose={vi.fn()}
        />,
      )

      expect(screen.getByText(title)).toBeInTheDocument()
      expect(screen.getByLabelText(label)).toBeInTheDocument()
      fireEvent.click(screen.getByText(role))
      expect(screen.getByText(topic)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: close })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: accept })).toBeInTheDocument()

      view.unmount()
      window.sessionStorage.clear()
    })
  })

  it('shows context newest-first without changing saved selection order', () => {
    render(
      <KnowledgeContextDialog
        open
        surface="settings"
        initialContext={null}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/helpful things you know/i), {
      target: { value: 'Zulu, Alpha' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    const visibleTopics = () =>
      screen.getAllByText(/^(Alpha|Zulu)$/).map((item) => item.textContent)

    expect(visibleTopics()).toEqual(['Alpha', 'Zulu'])
    expect(
      screen.queryByRole('combobox', { name: /sort knowledge context/i }),
    ).not.toBeInTheDocument()
    expect(JSON.parse(storage['studymesh-profile-context-v1'])).toMatchObject({
      specificKnowledge: ['Zulu', 'Alpha'],
    })
  })

  it('renders saved broad and specific context as removable chips', () => {
    const initialContext = {
      version: 1 as const,
      roles: ['software_it' as const],
      broadKnowledge: ['Backend'],
      specificKnowledge: ['MinIO', 'S3'],
      confidence: 'self_reported' as const,
      updatedAt: '2026-06-23T00:00:00.000Z',
    }
    render(
      <KnowledgeContextDialog
        open
        surface="settings"
        initialContext={initialContext}
        onClose={vi.fn()}
      />,
    )

    expect(
      screen
        .getAllByText(/^(Backend|MinIO|S3)$/)
        .map((item) => item.textContent),
    ).toEqual(['S3', 'MinIO', 'Backend', 'Backend'])
    fireEvent.click(screen.getAllByTestId('CancelIcon')[0])
    expect(JSON.parse(storage['studymesh-profile-context-v1'])).toMatchObject({
      broadKnowledge: ['Backend'],
      specificKnowledge: ['MinIO'],
    })
  })
})
