import type React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import KnownTopicsPanel from '../../../../src/components/profile/KnownTopicsPanel'
import { KnownTopicsForm } from '../../../../src/components/profile/KnownTopicsForm'
import { InterfaceLanguageProvider } from '../../../../src/language/interfaceLanguage'
import { CONTENT_LANGUAGE_SETTINGS_KEY } from '../../../../src/language/contentLanguage'
import type { InterfaceLanguageCode } from '../../../../src/language/contentLanguage'
import { PROFILE_CONTEXT_STORAGE_KEY } from '../../../../src/profileContext'

describe('KnownTopicsPanel', () => {
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

  it('explains the purpose and invites relevant examples without a wizard', async () => {
    render(<KnownTopicsPanel open onClose={vi.fn()} />)

    expect(
      await screen.findByText(/explains new topics using these/i),
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
  })

  it('saves typed examples as specific knowledge and autosaves without a confirm step', async () => {
    render(<KnownTopicsPanel open onClose={vi.fn()} />)

    fireEvent.change(await screen.findByLabelText(/helpful things you know/i), {
      target: { value: 'Math, Cooking' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(screen.getByText('Math')).toBeInTheDocument()
    expect(screen.getByText('Cooking')).toBeInTheDocument()
    expect(JSON.parse(storage[PROFILE_CONTEXT_STORAGE_KEY])).toMatchObject({
      roles: [],
      broadKnowledge: [],
      specificKnowledge: ['Math', 'Cooking'],
    })
  })

  it('keeps typed draft examples across close and reopen until added', () => {
    const firstRender = render(
      <KnownTopicsForm initialContext={null} onSelectedCountChange={vi.fn()} />,
    )

    fireEvent.change(screen.getByLabelText(/helpful things you know/i), {
      target: { value: 'Math, cooking' },
    })
    firstRender.unmount()

    render(<KnownTopicsForm initialContext={null} onSelectedCountChange={vi.fn()} />)

    expect(screen.getByLabelText(/helpful things you know/i)).toHaveValue(
      'Math, cooking',
    )
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(screen.getByLabelText(/helpful things you know/i)).toHaveValue('')
    expect(
      window.sessionStorage.getItem('studymesh-profile-context-input-draft'),
    ).toBeNull()
  })

  it('moves a picked suggestion out of the suggestion pool and into the saved list', async () => {
    render(<KnownTopicsPanel open onClose={vi.fn()} />)
    await screen.findByLabelText(/helpful things you know/i)

    expect(screen.queryByText('Backend')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Software / IT'))
    expect(await screen.findByText('Backend')).toBeInTheDocument()
    expect(screen.getAllByText('Backend')).toHaveLength(1)

    fireEvent.click(screen.getByText('Backend'))

    expect(JSON.parse(storage[PROFILE_CONTEXT_STORAGE_KEY])).toMatchObject({
      roles: ['software_it'],
      broadKnowledge: ['Backend'],
      specificKnowledge: [],
    })
    // Still a single "Backend" node, now in the saved list (removable) instead
    // of the suggestion pool.
    expect(screen.getAllByText('Backend')).toHaveLength(1)
    expect(screen.getAllByTestId('CancelIcon')).toHaveLength(1)
  })

  it('only allows one area selected at a time', async () => {
    render(<KnownTopicsPanel open onClose={vi.fn()} />)
    await screen.findByLabelText(/helpful things you know/i)

    fireEvent.click(screen.getByText('Software / IT'))
    expect(await screen.findByText('Backend')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Business / Marketing'))
    expect(await screen.findByText('Sales')).toBeInTheDocument()
    expect(screen.queryByText('Backend')).not.toBeInTheDocument()
    expect(JSON.parse(storage[PROFILE_CONTEXT_STORAGE_KEY])).toMatchObject({
      roles: ['business_marketing'],
    })
  })

  it('localizes panel copy and suggestion labels for supported interface languages', async () => {
    const cases: Array<{
      language: InterfaceLanguageCode
      title: RegExp
      label: RegExp
      role: string
      topic: string
    }> = [
      {
        language: 'es',
        title: /explica temas nuevos usando esto/i,
        label: /cosas útiles que conoces/i,
        role: 'Estudiante',
        topic: 'Exámenes',
      },
      {
        language: 'fr',
        title: /explique les nouveaux sujets avec cela/i,
        label: /choses utiles/i,
        role: 'Étudiant',
        topic: 'Examens',
      },
      {
        language: 'de',
        title: /erklärt neue themen damit/i,
        label: /hilfreiche dinge/i,
        role: 'Schüler / Student',
        topic: 'Prüfungen',
      },
    ]

    for (const { language, title, label, role, topic } of cases) {
      storage = {}
      const view = renderWithLanguage(
        language,
        <KnownTopicsPanel open onClose={vi.fn()} />,
      )

      expect(await screen.findByText(title)).toBeInTheDocument()
      expect(screen.getByLabelText(label)).toBeInTheDocument()
      fireEvent.click(screen.getByText(role))
      expect(await screen.findByText(topic)).toBeInTheDocument()

      view.unmount()
      window.sessionStorage.clear()
    }
  })

  it('shows context newest-first without changing saved selection order', async () => {
    render(<KnownTopicsPanel open onClose={vi.fn()} />)

    fireEvent.change(await screen.findByLabelText(/helpful things you know/i), {
      target: { value: 'Zulu, Alpha' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    const visibleTopics = () =>
      screen.getAllByText(/^(Alpha|Zulu)$/).map((item) => item.textContent)

    expect(visibleTopics()).toEqual(['Alpha', 'Zulu'])
    expect(JSON.parse(storage[PROFILE_CONTEXT_STORAGE_KEY])).toMatchObject({
      specificKnowledge: ['Zulu', 'Alpha'],
    })
  })

  it('renders saved broad and specific context as removable chips, excluded from suggestions', async () => {
    storage[PROFILE_CONTEXT_STORAGE_KEY] = JSON.stringify({
      version: 1,
      roles: ['software_it'],
      broadKnowledge: ['Backend'],
      specificKnowledge: ['MinIO', 'S3'],
      confidence: 'self_reported',
      updatedAt: '2026-06-23T00:00:00.000Z',
    })
    render(<KnownTopicsPanel open onClose={vi.fn()} />)

    expect(
      (await screen.findAllByText(/^(Backend|MinIO|S3)$/)).map(
        (item) => item.textContent,
      ),
    ).toEqual(['S3', 'MinIO', 'Backend'])
    fireEvent.click(screen.getAllByTestId('CancelIcon')[0])
    expect(JSON.parse(storage[PROFILE_CONTEXT_STORAGE_KEY])).toMatchObject({
      broadKnowledge: ['Backend'],
      specificKnowledge: ['MinIO'],
    })
  })

  it('shows the progress bar caption against the recommended goal of 5', async () => {
    render(<KnownTopicsPanel open onClose={vi.fn()} />)

    expect(
      await screen.findByText(/add 5 more for better explanations/i),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/helpful things you know/i), {
      target: { value: 'Vue, Ansible, Jenkins, Rundeck' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(
      screen.getByText(/add 1 more for better explanations/i),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/helpful things you know/i), {
      target: { value: 'Valencian' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(screen.getByText(/enough to work with/i)).toBeInTheDocument()
  })

  it('closes the dialog from the Done button', async () => {
    const onClose = vi.fn()
    render(<KnownTopicsPanel open onClose={onClose} />)

    fireEvent.click(await screen.findByRole('button', { name: /^done$/i }))

    expect(onClose).toHaveBeenCalled()
  })
})
