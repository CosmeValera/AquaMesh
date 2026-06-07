import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../../../src/auth/supabaseClient', () => ({
  getSupabaseConfigError: () => '',
  isSupabaseConfigured: true,
  supabase: {
    auth: authMocks,
    from: authMocks.from,
    rpc: authMocks.rpc,
  },
}))

import {
  AuthProvider,
  RequireAuth,
  deleteStudyMeshProfile,
} from '../../../src/auth/AuthProvider'

const LocationProbe = ({ onChange }: { onChange: (path: string) => void }) => {
  const location = useLocation()
  onChange(`${location.pathname}${location.search}`)
  return null
}

const renderProtectedWorkspace = (
  initialPath = '/workspace',
  onLocationChange: (path: string) => void = () => {},
) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <LocationProbe onChange={onLocationChange} />
        <Routes>
          <Route
            path="/workspace"
            element={
              <RequireAuth>
                <div>Workspace loaded</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )

describe('RequireAuth route guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('renders protected workspace content when a Supabase session exists', async () => {
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          user: {
            id: 'user-1',
            email: 'student@example.com',
            user_metadata: { display_name: 'Student' },
          },
        },
      },
      error: null,
    })

    renderProtectedWorkspace()

    expect(await screen.findByText('Workspace loaded')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('redirects logged-out users to login with the original workspace path', async () => {
    let currentPath = ''

    authMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    renderProtectedWorkspace(
      '/workspace?action=create-from-notes',
      (path) => {
        currentPath = path
      },
    )

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(currentPath).toContain('/login')
    expect(currentPath).toContain(
      'redirect=%2Fworkspace%3Faction%3Dcreate-from-notes',
    )
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      'userData',
      expect.any(String),
    )
  })

  it('shows an auth loading state before deciding whether to redirect', async () => {
    authMocks.getSession.mockReturnValue(new Promise(() => {}))

    renderProtectedWorkspace()

    expect(screen.getByText(/loading studymesh/i)).toBeInTheDocument()
    expect(screen.queryByText('Workspace loaded')).not.toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(authMocks.getSession).toHaveBeenCalled()
    })
  })

  it('deletes only the signed-in StudyMesh profile row', async () => {
    authMocks.rpc.mockResolvedValue({ data: 1, error: null })
    authMocks.signOut.mockResolvedValue({ error: null })

    await deleteStudyMeshProfile('user-1')

    expect(authMocks.rpc).toHaveBeenCalledWith('delete_own_profile')
    expect(authMocks.signOut).toHaveBeenCalled()
    expect(localStorage.removeItem).toHaveBeenCalledWith('userData')
  })

  it('does not sign out when StudyMesh profile deletion fails', async () => {
    authMocks.rpc.mockResolvedValue({ data: 0, error: null })
    authMocks.signOut.mockResolvedValue({ error: null })

    await expect(deleteStudyMeshProfile('user-1')).rejects.toThrow(
      /delete_own_profile/i,
    )

    expect(authMocks.signOut).not.toHaveBeenCalled()
  })
})
