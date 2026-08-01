/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import GuestQuickGuidePage from '../../../../src/components/guest/GuestQuickGuidePage'
import { HOSTED_AI_GUEST_LIMIT_EVENT } from '../../../../src/quickCreate/ai'
import type { HostedAiStatus } from '../../../../src/quickCreate/ai'

interface StubModalProps {
  autoGenerateRequest?: { id: number; prompt: string }
  onBeforeGenerate?: () => void | Promise<void>
  onCreatePath: (payload: { dashboards: unknown[] }) => void
}

const stub = vi.hoisted(() => ({
  modalProps: null as unknown,
  events: [] as string[],
  guides: [] as Array<{ id: string; title: string }>,
  status: null as unknown,
  user: null as unknown,
  isAnonymous: false,
}))

const signInAnonymouslyMock = vi.hoisted(() =>
  vi.fn(async () => {
    stub.events.push('sign-in')
    stub.user = { id: 'guest-user' }
    stub.isAnonymous = true
    return { user: { id: 'guest-user' } }
  }),
)
const upgradeGuestAccountMock = vi.hoisted(() => vi.fn(async () => undefined))
const saveMock = vi.hoisted(() =>
  vi.fn((record: { id: string }) => ({ ...record })),
)

vi.mock('../../../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: stub.user,
    session: null,
    loading: false,
    isAnonymous: stub.isAnonymous,
    signInAnonymously: signInAnonymouslyMock,
    upgradeGuestAccount: upgradeGuestAccountMock,
  }),
}))

vi.mock('../../../../src/components/hostedAi/useHostedAiStatus', () => ({
  useHostedAiStatus: () => ({
    status: stub.status,
    displayStudyCredits: null,
    loading: false,
    error: '',
    refresh: vi.fn(),
  }),
}))

vi.mock('../../../../src/studyGuides/storage', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/studyGuides/storage')
  >('../../../../src/studyGuides/storage')

  return {
    ...actual,
    StudyGuideStorage: {
      ...actual.StudyGuideStorage,
      save: saveMock,
      getSummaries: () => stub.guides,
    },
  }
})

vi.mock('../../../../src/studyGuides/createFromModalPayload', () => ({
  createStudyGuideFromModalPayload: vi.fn(() => ({
    dashboards: [],
    studyPath: null,
    record: { id: 'guest-guide-1', title: 'Database indexes' },
  })),
}))

// Stands in for the real modal contract: it awaits onBeforeGenerate before it
// starts generating, so the order the page relies on stays observable here.
vi.mock(
  '../../../../src/components/studyGuides/CreateStudyGuideModal',
  async () => {
    const react = await vi.importActual<typeof import('react')>('react')

    return {
      __esModule: true,
      default: (props: StubModalProps) => {
        stub.modalProps = props
        react.useEffect(() => {
          if (!props.autoGenerateRequest) {
            return
          }

          void (async () => {
            await props.onBeforeGenerate?.()
            stub.events.push('generate')
          })()
        }, [props.autoGenerateRequest?.id])

        return react.createElement('div', {
          'data-testid': 'create-study-guide-modal',
        })
      },
    }
  },
)

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderGuestPage = () =>
  render(
    <MemoryRouter initialEntries={['/try']}>
      <Routes>
        <Route
          path="/try"
          element={
            <>
              <GuestQuickGuidePage />
              <LocationProbe />
            </>
          }
        />
        <Route path="/study-guides" element={<LocationProbe />} />
        <Route path="/workspace/:studyGuideId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )

const getModalProps = () => stub.modalProps as StubModalProps

describe('GuestQuickGuidePage', () => {
  beforeEach(() => {
    stub.modalProps = null
    stub.events = []
    stub.guides = []
    stub.status = null
    stub.user = null
    stub.isAnonymous = false
    signInAnonymouslyMock.mockClear()
    saveMock.mockClear()
  })

  it('shows the full free allowance before a guest session exists', () => {
    renderGuestPage()

    expect(
      screen.getByText('3 of 3 free Quick Guides left'),
    ).toBeInTheDocument()
  })

  it('shows the remaining allowance reported for the guest session', () => {
    stub.user = { id: 'guest-user' }
    stub.isAnonymous = true
    stub.status = {
      guest: { allowed: 3, used: 2, remaining: 1 },
    } as unknown as HostedAiStatus

    renderGuestPage()

    expect(
      screen.getByText('1 of 3 free Quick Guides left'),
    ).toBeInTheDocument()
  })

  it('establishes the guest session before generation runs', async () => {
    renderGuestPage()

    fireEvent.change(
      screen.getByRole('textbox', { name: /what do you want to learn/i }),
      { target: { value: 'Teach me database indexes' } },
    )
    fireEvent.click(
      screen.getByRole('button', { name: /build my quick guide/i }),
    )

    await waitFor(() => {
      expect(stub.events).toEqual(['sign-in', 'generate'])
    })
    expect(signInAnonymouslyMock).toHaveBeenCalledTimes(1)
    expect(getModalProps().autoGenerateRequest?.prompt).toBe(
      'Teach me database indexes',
    )
  })

  it('never signs a visitor in on page view alone', () => {
    renderGuestPage()

    expect(signInAnonymouslyMock).not.toHaveBeenCalled()
  })

  it('saves the generated guide and opens it in the workspace', async () => {
    renderGuestPage()

    await act(async () => {
      getModalProps().onCreatePath({ dashboards: [] })
    })

    expect(saveMock).toHaveBeenCalledWith({
      id: 'guest-guide-1',
      title: 'Database indexes',
    })
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/workspace/guest-guide-1',
    )
  })

  it('swaps the create panel for the upgrade panel on the guest limit event', async () => {
    renderGuestPage()

    expect(
      screen.getByRole('button', { name: /build my quick guide/i }),
    ).toBeInTheDocument()

    await act(async () => {
      window.dispatchEvent(new CustomEvent(HOSTED_AI_GUEST_LIMIT_EVENT))
    })

    expect(
      screen.getByText(/you've used your 3 free quick guides/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create free account/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /build my quick guide/i }),
    ).not.toBeInTheDocument()
  })

  it('lists the guest guides so a returning visitor can reopen them', () => {
    stub.user = { id: 'guest-user' }
    stub.isAnonymous = true
    stub.guides = [{ id: 'guest-guide-9', title: 'Bottlenecks' }]

    renderGuestPage()

    expect(screen.getByText('Bottlenecks')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^open$/i }))

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/workspace/guest-guide-9',
    )
  })

  it('redirects a signed-in account away from the guest page', () => {
    stub.user = { id: 'real-user' }
    stub.isAnonymous = false

    renderGuestPage()

    expect(screen.getByTestId('location')).toHaveTextContent('/study-guides')
    expect(
      screen.queryByRole('button', { name: /build my quick guide/i }),
    ).not.toBeInTheDocument()
  })
})
