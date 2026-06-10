import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SavedDashboardsDialog from '../../../../src/components/Dasboard/DashboardLibrary'

vi.mock('../../../../src/components/Dasboard/DashboardProvider', () => ({
  useDashboards: () => ({
    addDashboard: vi.fn(),
  }),
}))

vi.mock('../../../../src/customHooks/useWorkspaceActions', () => ({
  ensureStarterDashboards: vi.fn(),
}))

const createDashboard = (id: string, name: string, folder = 'Biology') => ({
  id,
  name,
  folder,
  layout: {
    type: 'row',
    children: [
      {
        type: 'tabset',
        children: [
          {
            type: 'tab',
            name,
            component: 'CustomWidget',
          },
        ],
      },
    ],
  },
  description: 'Saved dashboard',
  tags: ['quick-create'],
  isPublic: true,
  createdAt: '2026-05-19T10:00:00.000Z',
  updatedAt: '2026-05-19T10:00:00.000Z',
})

const createMemoryStorage = () => {
  const store = new Map<string, string>()

  vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
    store.has(key) ? store.get(key)! : null,
  )
  vi.mocked(localStorage.setItem).mockImplementation(
    (key: string, value: string) => {
      store.set(key, value)
    },
  )
  vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
    store.delete(key)
  })
  vi.mocked(localStorage.clear).mockImplementation(() => store.clear())

  return store
}

describe('DashboardLibrary bulk actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets admins choose which items delete all removes', async () => {
    const storage = createMemoryStorage()
    storage.set(
      'userData',
      JSON.stringify({ id: 'admin', name: 'Admin', role: 'ADMIN_ROLE' }),
    )
    storage.set(
      'customDashboards',
      JSON.stringify([
        createDashboard('biology-1', 'Cell Structure'),
        createDashboard('biology-2', 'Genetics Review'),
      ]),
    )

    render(<SavedDashboardsDialog open onClose={vi.fn()} />)

    expect(await screen.findByText('Cell Structure')).toBeInTheDocument()
    expect(screen.getByText('Genetics Review')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /delete all/i }))

    expect(
      await screen.findByText('Delete all library items'),
    ).toBeInTheDocument()
    const deleteDialog = screen.getByRole('dialog', {
      name: /delete all library items/i,
    })
    expect(within(deleteDialog).getByText('Cell Structure')).toBeInTheDocument()
    expect(
      within(deleteDialog).getByText('Genetics Review'),
    ).toBeInTheDocument()

    fireEvent.click(
      within(deleteDialog).getByRole('checkbox', { name: /select genetics/i }),
    )
    fireEvent.click(
      within(deleteDialog).getByRole('button', { name: /delete selected/i }),
    )

    await waitFor(() => {
      expect(screen.queryByText('Cell Structure')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Genetics Review')).toBeInTheDocument()
    expect(JSON.parse(storage.get('customDashboards') || 'null')).toEqual([
      expect.objectContaining({ id: 'biology-2', name: 'Genetics Review' }),
    ])
  })

  it('lets admins delete a folder after choosing exact folder items', async () => {
    const storage = createMemoryStorage()
    storage.set(
      'userData',
      JSON.stringify({ id: 'admin', name: 'Admin', role: 'ADMIN_ROLE' }),
    )
    storage.set(
      'customDashboards',
      JSON.stringify([
        createDashboard('biology-1', 'Cell Structure', 'Biology'),
        createDashboard('biology-2', 'Genetics Review', 'Biology'),
        createDashboard('history-1', 'Roman Empire', 'History'),
      ]),
    )

    render(<SavedDashboardsDialog open onClose={vi.fn()} />)

    expect(await screen.findByText('Cell Structure')).toBeInTheDocument()
    expect(screen.getByText('Roman Empire')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /delete biology folder items/i }),
    )

    const deleteDialog = await screen.findByRole('dialog', {
      name: /delete biology/i,
    })
    expect(within(deleteDialog).getByText('Cell Structure')).toBeInTheDocument()
    expect(
      within(deleteDialog).getByText('Genetics Review'),
    ).toBeInTheDocument()
    expect(
      within(deleteDialog).queryByText('Roman Empire'),
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(deleteDialog).getByRole('checkbox', { name: /select genetics/i }),
    )
    fireEvent.click(
      within(deleteDialog).getByRole('button', { name: /delete selected/i }),
    )

    await waitFor(() => {
      expect(screen.queryByText('Cell Structure')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Genetics Review')).toBeInTheDocument()
    expect(screen.getByText('Roman Empire')).toBeInTheDocument()
  })
})
