import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInAnonymously: vi.fn(),
  updateUser: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
}))

const cloudMocks = vi.hoisted(() => ({
  createCloudRepository: vi.fn(),
  clearLocalWorkspaceCache: vi.fn(),
  writeWorkspaceCacheOwner: vi.fn(),
}))

vi.mock('../../../src/auth/supabaseClient', () => ({
  getSupabaseConfigError: () => '',
  isSupabaseConfigured: true,
  supabase: {
    auth: authMocks,
    rpc: authMocks.rpc,
  },
}))

vi.mock('../../../src/cloud', () => cloudMocks)

import {
  AuthProvider,
  signInAnonymouslyOnce,
  upgradeGuestAccount,
  useAuth,
} from '../../../src/auth/AuthProvider'

const guestUser = {
  id: 'guest-1',
  is_anonymous: true,
  user_metadata: {},
}

const guestSession = {
  access_token: 'guest-token',
  user: guestUser,
}

const memberSession = {
  access_token: 'member-token',
  user: {
    id: 'user-1',
    email: 'student@example.com',
    user_metadata: { display_name: 'Student' },
  },
}

const AuthProbe = () => {
  const { isAnonymous, loading, user } = useAuth()

  if (loading) {
    return <div>auth loading</div>
  }

  return (
    <div>{`user:${user?.id || 'none'} anonymous:${isAnonymous ? 'yes' : 'no'}`}</div>
  )
}

const renderWithSession = (session: unknown) => {
  authMocks.getSession.mockResolvedValue({ data: { session }, error: null })

  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  )
}

const readLegacyUserData = () => {
  const setItem = localStorage.setItem as unknown as ReturnType<typeof vi.fn>
  const lastCall = setItem.mock.calls
    .filter(([key]) => key === 'userData')
    .pop()

  return lastCall ? JSON.parse(lastCall[1] as string) : null
}

describe('guest sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('creates the anonymous session when none exists', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    authMocks.signInAnonymously.mockResolvedValue({
      data: { session: guestSession, user: guestUser },
      error: null,
    })

    const session = await signInAnonymouslyOnce()

    expect(session).toBe(guestSession)
    expect(authMocks.signInAnonymously).toHaveBeenCalledTimes(1)
  })

  it('reuses an existing session instead of minting a second guest', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: guestSession },
      error: null,
    })

    const session = await signInAnonymouslyOnce()

    expect(session).toBe(guestSession)
    expect(authMocks.signInAnonymously).not.toHaveBeenCalled()
  })

  it('surfaces anonymous sign-in failures through the auth error mapper', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    authMocks.signInAnonymously.mockResolvedValue({
      data: { session: null },
      error: { message: 'Anonymous sign-ins are disabled' },
    })

    await expect(signInAnonymouslyOnce()).rejects.toThrow(
      /anonymous sign-ins are disabled/i,
    )
  })

  it('derives isAnonymous from the session user', async () => {
    renderWithSession(guestSession)

    expect(
      await screen.findByText('user:guest-1 anonymous:yes'),
    ).toBeInTheDocument()
  })

  it('does not mark a real account as anonymous', async () => {
    renderWithSession(memberSession)

    expect(
      await screen.findByText('user:user-1 anonymous:no'),
    ).toBeInTheDocument()
  })

  it('writes guest legacy user data without an email', async () => {
    renderWithSession(guestSession)
    await screen.findByText('user:guest-1 anonymous:yes')

    const userData = readLegacyUserData()
    expect(userData).toEqual({
      id: 'guest-1',
      name: 'Guest',
      role: 'GUEST_ROLE',
    })
    expect('email' in userData).toBe(false)
  })

  it('keeps the admin legacy user data for real accounts', async () => {
    renderWithSession(memberSession)
    await screen.findByText('user:user-1 anonymous:no')

    expect(readLegacyUserData()).toEqual({
      id: 'user-1',
      name: 'Student',
      email: 'student@example.com',
      role: 'ADMIN_ROLE',
    })
  })

  it('claims the workspace cache before upgrading the guest account', async () => {
    const order: string[] = []

    authMocks.getSession.mockResolvedValue({
      data: { session: guestSession },
      error: null,
    })
    cloudMocks.writeWorkspaceCacheOwner.mockImplementation(() => {
      order.push('cache-owner')
    })
    authMocks.updateUser.mockImplementation(async () => {
      order.push('update-user')
      return { data: { user: guestUser }, error: null }
    })
    authMocks.refreshSession.mockResolvedValue({
      data: { session: guestSession },
      error: null,
    })
    authMocks.rpc.mockResolvedValue({ data: null, error: null })

    await upgradeGuestAccount('student@example.com', 'sup3rsecret', 'Student')

    expect(order).toEqual(['cache-owner', 'update-user'])
    expect(cloudMocks.writeWorkspaceCacheOwner).toHaveBeenCalledWith('guest-1')
    expect(authMocks.updateUser).toHaveBeenCalledWith({
      email: 'student@example.com',
      password: 'sup3rsecret',
      data: { display_name: 'Student' },
    })
    expect(authMocks.refreshSession).toHaveBeenCalled()
    expect(authMocks.rpc).toHaveBeenCalledWith('claim_guest_upgrade_grant')
  })

  it('omits the display name payload when none is provided', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: guestSession },
      error: null,
    })
    authMocks.updateUser.mockResolvedValue({
      data: { user: guestUser },
      error: null,
    })
    authMocks.refreshSession.mockResolvedValue({
      data: { session: guestSession },
      error: null,
    })
    authMocks.rpc.mockResolvedValue({ data: null, error: null })

    await upgradeGuestAccount('student@example.com', 'sup3rsecret')

    expect(authMocks.updateUser).toHaveBeenCalledWith({
      email: 'student@example.com',
      password: 'sup3rsecret',
    })
  })

  it('still resolves when the upgrade grant self-heal fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    authMocks.getSession.mockResolvedValue({
      data: { session: guestSession },
      error: null,
    })
    authMocks.updateUser.mockResolvedValue({
      data: { user: guestUser },
      error: null,
    })
    authMocks.refreshSession.mockResolvedValue({
      data: { session: guestSession },
      error: null,
    })
    authMocks.rpc.mockRejectedValue(new Error('rpc offline'))

    await expect(
      upgradeGuestAccount('student@example.com', 'sup3rsecret'),
    ).resolves.toBeUndefined()

    consoleError.mockRestore()
  })

  it('refuses to upgrade a session that is not a guest', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: memberSession },
      error: null,
    })

    await expect(
      upgradeGuestAccount('student@example.com', 'sup3rsecret'),
    ).rejects.toThrow(/guest session/i)

    expect(cloudMocks.writeWorkspaceCacheOwner).not.toHaveBeenCalled()
    expect(authMocks.updateUser).not.toHaveBeenCalled()
  })
})
