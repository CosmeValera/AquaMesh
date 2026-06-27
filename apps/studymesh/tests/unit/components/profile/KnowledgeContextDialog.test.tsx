import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import KnowledgeContextDialog from '../../../../src/components/profile/KnowledgeContextDialog'

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
  })

  it('shows onboarding skills only after the user picks a broad role', () => {
    const onClose = vi.fn()
    render(
      <KnowledgeContextDialog
        open
        surface="onboarding"
        initialContext={null}
        onClose={onClose}
      />,
    )

    expect(screen.getByText(/what best describes you/i)).toBeInTheDocument()
    expect(screen.getByText("It's recommended to start with 3-5.")).toBeInTheDocument()
    expect(screen.queryByText(/knowledge areas/i)).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/anything else you know well/i),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept/i })).toBeDisabled()

    fireEvent.click(screen.getByText('Software / IT'))
    expect(screen.getByText(/knowledge areas/i)).toBeInTheDocument()
    expect(screen.getByText('Backend')).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/anything else you know well/i),
    ).not.toBeInTheDocument()
    expect(JSON.parse(storage['studymesh-profile-context-v1'])).toMatchObject({
      roles: ['software_it'],
      broadKnowledge: [],
      specificKnowledge: [],
    })

    fireEvent.click(screen.getByText('Backend'))
    expect(JSON.parse(storage['studymesh-profile-context-v1'])).toMatchObject({
      roles: ['software_it'],
      broadKnowledge: ['Backend'],
      specificKnowledge: [],
    })
    expect(screen.getByRole('button', { name: /accept/i })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /accept/i }))

    const saved = JSON.parse(storage['studymesh-profile-context-v1'])
    expect(saved).toMatchObject({
      roles: ['software_it'],
      broadKnowledge: ['Backend'],
      specificKnowledge: [],
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows detailed knowledge controls when editing settings', () => {
    render(
      <KnowledgeContextDialog
        open
        surface="settings"
        initialContext={null}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText(/knowledge areas/i)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/add something else you know/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/3-5|you can skip/i)).not.toBeInTheDocument()
    expect(screen.getByText(/recommended: 5 or more/i)).toBeInTheDocument()
  })

  it('supports multiple roles and Add/Enter knowledge context chips', () => {
    render(
      <KnowledgeContextDialog
        open
        surface="settings"
        initialContext={null}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Software / IT'))
    fireEvent.click(screen.getByText('Finance'))

    expect(screen.getAllByText('Software / IT')).toHaveLength(2)
    expect(screen.getAllByText('Finance')).toHaveLength(2)
    expect(screen.queryByText('Software / IT |')).not.toBeInTheDocument()
    expect(screen.getByText('Backend')).toBeInTheDocument()
    expect(screen.getByText('Investing')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Backend'))
    fireEvent.click(screen.getByRole('button', { name: 'Software / IT' }))
    expect(JSON.parse(storage['studymesh-profile-context-v1'])).toMatchObject({
      roles: ['finance'],
      broadKnowledge: ['Backend'],
      specificKnowledge: [],
    })
    fireEvent.change(screen.getByLabelText(/add something else you know/i), {
      target: { value: 'MinIO' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(screen.getByText('Knowledge context')).toBeInTheDocument()
    expect(screen.getByText('Backend')).toBeInTheDocument()
    expect(screen.getByText('MinIO')).toBeInTheDocument()
    expect(JSON.parse(storage['studymesh-profile-context-v1'])).toMatchObject({
      roles: ['finance'],
      broadKnowledge: ['Backend'],
      specificKnowledge: ['MinIO'],
    })
  })
})
