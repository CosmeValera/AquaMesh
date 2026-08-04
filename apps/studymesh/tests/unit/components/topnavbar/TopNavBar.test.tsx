import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import TopNavBar from '../../../../src/components/topnavbar/TopNavBar'
import * as LayoutProviderModule from '../../../../src/components/Layout/LayoutProvider'
import * as DashboardProviderModule from '../../../../src/components/Dasboard/DashboardProvider'
import { OPEN_STUDY_PATH_EVENT } from '../../../../src/customHooks/useWorkspaceActions'
import { deleteStudyMeshProfile } from '../../../../src/auth/AuthProvider'
import {
  HOSTED_AI_INSUFFICIENT_CREDITS_EVENT,
  QUICK_CREATE_AI_SETTINGS_KEY,
} from '../../../../src/quickCreate/ai'
import { PROFILE_CONTEXT_STORAGE_KEY } from '../../../../src/profileContext'
import { CLOUD_SYNC_STATUS_EVENT } from '../../../../src/cloud/CloudWorkspaceSync'

const KNOWN_TOPICS_PANEL_SEEN_KEY = 'studymesh-known-topics-panel-seen-v1'

const hostedAiStatus = vi.hoisted(() => ({
  available: true,
  accountReady: true,
  introSeen: true,
  studyCredits: 8,
  initialFreeCredits: 30,
  dailyFreeCreditFloor: 7,
  costs: {
    'study-guide': 3,
    'quick-create': 1,
    chat: 1,
    podcast: 1,
  },
}))

vi.mock('../../../../src/components/Layout/LayoutProvider', () => ({
  __esModule: true,
  useLayout: vi.fn(),
}))

vi.mock('../../../../src/components/Dasboard/DashboardProvider', () => ({
  __esModule: true,
  useDashboards: vi.fn(),
}))

// Mock child components
vi.mock('../../../../src/components/Dasboard/DashboardOptionsMenu', () => ({
  __esModule: true,
  default: () => (
    <button type="button" data-testid="dashboard-options-menu">
      Library
    </button>
  ),
}))

vi.mock('../../../../src/components/studyGuides/CreateStudyGuideModal', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="study-path-modal">Study Guide Modal</div> : null,
}))

vi.mock('../../../../src/components/shared/ThemeModeToggle', () => ({
  __esModule: true,
  default: () => <div data-testid="theme-mode-toggle" />,
}))

vi.mock('../../../../src/theme/AccentColorPicker', () => ({
  __esModule: true,
  default: () => <div data-testid="accent-color-picker" />,
}))

// Mock SVG import
vi.mock('../../../../public/logo.svg', () => ({
  ReactComponent: () => <svg data-testid="logo">Logo</svg>,
}))

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../../../src/auth/AuthProvider', () => ({
  deleteStudyMeshProfile: vi.fn(() => Promise.resolve()),
  useAuth: () => ({
    user: { id: 'auth-user', email: 'admin@example.com' },
    session: { access_token: 'test-access-token' },
    loading: false,
    signOut: vi.fn(() => Promise.resolve()),
  }),
}))

vi.mock('../../../../src/components/hostedAi/useHostedAiStatus', () => ({
  useHostedAiStatus: () => ({
    status: hostedAiStatus,
    displayStudyCredits: hostedAiStatus.studyCredits,
    loading: false,
    error: '',
    refresh: vi.fn(),
  }),
}))

const navigateMock = vi.fn()

describe('TopNavBar Component', () => {
  const addDashboardMock = vi.fn()
  const updateDashboardLayoutMock = vi.fn()
  const addComponentMock = vi.fn()
  const openUserMenu = () => {
    fireEvent.click(
      screen.getByRole('button', {
        name: /open user menu/i,
      }),
    )
  }

  // Setup common mocks before each test
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup localStorage mock
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === QUICK_CREATE_AI_SETTINGS_KEY) {
        return JSON.stringify({
          provider: 'gemini',
          apiToken: 'test-token',
          model: 'gemini-test',
        })
      }

      return null
    })

    // Setup useLayout mock
    vi.mocked(LayoutProviderModule.useLayout).mockReturnValue({
      ref: {
        current: {
          props: {
            model: { getActiveTabset: vi.fn(), getFirstTabSet: vi.fn() },
          },
          doAction: vi.fn(),
        },
      },
      addComponent: addComponentMock,
    })

    // Setup useDashboards mock
    vi.mocked(DashboardProviderModule.useDashboards).mockReturnValue({
      openDashboards: [
        {
          id: 'dash1',
          name: 'Dashboard',
          layout: {
            type: 'row',
            children: [
              {
                type: 'tabset',
                children: [
                  {
                    type: 'tab',
                    name: 'Existing Widget',
                    component: 'ExistingWidget',
                  },
                ],
              },
            ],
          },
        },
      ],
      selectedDashboard: 0,
      setSelectedDashboard: vi.fn(),
      removeDashboard: vi.fn(),
      addDashboard: addDashboardMock,
      replaceDashboard: vi.fn(),
      updateLayout: vi.fn(),
      updateDashboardLayout: updateDashboardLayoutMock,
      renameDashboard: vi.fn(),
      editingDashboardIds: [],
      setDashboardEditing: vi.fn(),
      isDashboardEditing: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders correctly with all navigation items', () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    // Verify main elements are rendered
    expect(screen.getByTestId('logo')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-options-menu')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /quick create/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create quick guide/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /advanced/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create widget/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create dashboard/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTitle('Open tutorial')).not.toBeInTheDocument()
    expect(
      screen.queryByTitle('Frequently Asked Questions'),
    ).not.toBeInTheDocument()

    const libraryButton = screen.getByTestId('dashboard-options-menu')
    const userButton = screen.getByRole('button', {
      name: /open user menu/i,
    })

    expect(
      libraryButton.compareDocumentPosition(userButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('keeps Study Guide and Quick Create event entry points available in Local AI mode', async () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === QUICK_CREATE_AI_SETTINGS_KEY) {
        return JSON.stringify({
          provider: 'local',
          apiToken: '',
          model: 'gemini-test',
        })
      }

      return null
    })

    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    act(() => {
      window.dispatchEvent(new Event(OPEN_STUDY_PATH_EVENT))
    })
    expect(await screen.findByText('Study Guide Modal')).toBeInTheDocument()

    expect(screen.getByText('AI: Local')).toBeInTheDocument()
  })

  it('keeps Study Guide and Quick Create entry points available in hosted Carrots mode', async () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === QUICK_CREATE_AI_SETTINGS_KEY) {
        return JSON.stringify({
          provider: 'hosted',
          apiToken: '',
          model: 'gemini-test',
        })
      }

      return null
    })

    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    act(() => {
      window.dispatchEvent(new Event(OPEN_STUDY_PATH_EVENT))
    })

    expect(await screen.findByText('Study Guide Modal')).toBeInTheDocument()
  })

  it('shows compact hosted Carrots balance when hosted mode is selected', async () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === QUICK_CREATE_AI_SETTINGS_KEY) {
        return JSON.stringify({
          provider: 'hosted',
          apiToken: '',
          model: 'gpt-oss-120b',
        })
      }

      return null
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          status: {
            available: true,
            accountReady: true,
            introSeen: true,
            studyCredits: 8,
            initialFreeCredits: 30,
            dailyFreeCreditFloor: 7,
            costs: {
              'study-guide': 3,
              'quick-create': 1,
              chat: 1,
              podcast: 1,
            },
          },
        }),
      }),
    )

    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    expect(await screen.findByText('8')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /open ai mode selector/i }),
    ).toBeInTheDocument()
  })

  it('opens Carrots details from the top bar balance pill', async () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === QUICK_CREATE_AI_SETTINGS_KEY) {
        return JSON.stringify({
          provider: 'hosted',
          apiToken: '',
          model: 'gpt-oss-120b',
        })
      }

      return null
    })

    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: /open ai mode selector/i,
      }),
    )

    expect(
      await screen.findByRole('dialog', { name: /AI Mode/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/quick guide.*3/i)).toBeInTheDocument()
    expect(screen.getByText(/quick create.*1/i)).toBeInTheDocument()
    expect(screen.getByText(/chat.*1/i)).toBeInTheDocument()
    expect(screen.getByText(/podcast.*1/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /buy carrots for 5 eur/i,
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', {
        name: /buy carrots for 10 eur/i,
      }),
    ).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: /buy carrots for 20 eur/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /refresh credits/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /use own api key/i }),
    ).not.toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /ai provider/i }))
    fireEvent.click(
      await screen.findByRole('option', { name: /google local ai/i }),
    )

    expect(screen.queryByText('Carrots')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /buy carrots/i }),
    ).not.toBeInTheDocument()
  })

  it('opens AI Mode with purchase guidance when hosted credits run out', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent(HOSTED_AI_INSUFFICIENT_CREDITS_EVENT),
      )
    })

    expect(
      await screen.findByRole('dialog', { name: /AI Mode/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/you do not have enough carrots/i),
    ).toBeInTheDocument()
  })

  it('opens AI Mode without the warning notice for direct credit pack actions', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent(HOSTED_AI_INSUFFICIENT_CREDITS_EVENT, {
          detail: { showNotice: false },
        }),
      )
    })

    expect(
      await screen.findByRole('dialog', { name: /AI Mode/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/you do not have enough carrots/i),
    ).not.toBeInTheDocument()
  })

  it('shows the active own-key mode in the AI pill', () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === QUICK_CREATE_AI_SETTINGS_KEY) {
        return JSON.stringify({
          provider: 'cerebras',
          apiToken: 'own-cerebras-token',
          model: 'gpt-oss-120b',
        })
      }

      return null
    })

    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    expect(screen.getByText('AI: Cerebras')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /open ai mode selector/i }),
    ).toBeInTheDocument()
  })

  it('renders the RabbitHole logo', () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    expect(screen.getByTestId('logo')).toBeInTheDocument()
  })

  it('keeps appearance controls behind the Appearance option', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    openUserMenu()

    expect(
      await screen.findByRole('menuitem', { name: /^appearance$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /^settings$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /^logout$/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: /user settings/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/light \/ dark mode/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/accent color/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('theme-mode-toggle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('accent-color-picker')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: /^appearance$/i }))

    expect(
      await screen.findByRole('dialog', { name: /^appearance$/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/light \/ dark mode/i)).toBeInTheDocument()
    expect(screen.getByText(/accent color/i)).toBeInTheDocument()
    expect(screen.getByTestId('theme-mode-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('accent-color-picker')).toBeInTheDocument()
  })

  it('opens profile controls from application settings', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    openUserMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /^settings$/i }),
    )

    expect(
      await screen.findByRole('dialog', { name: /application settings/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByLabelText(/user name/i)).toHaveValue('Admin User')
    expect(
      screen.getByRole('button', { name: /save profile/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/workspace notices/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /reset notices/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/danger zone/i)).toBeInTheDocument()
    expect(
      screen.getByText(/permanently delete your rabbithole account/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/profile row/i)).not.toBeInTheDocument()
  })

  it('saves profile name from application settings', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    openUserMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /^settings$/i }),
    )
    fireEvent.change(await screen.findByLabelText(/user name/i), {
      target: { value: 'Cosme Valera' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'userData',
      JSON.stringify({
        id: 'admin',
        name: 'Cosme Valera',
        role: 'ADMIN_ROLE',
      }),
    )
    expect(screen.getByText('Profile saved.')).toBeInTheDocument()
  })

  it('requires a second confirmation before deleting RabbitHole account data', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    openUserMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /^settings$/i }),
    )
    fireEvent.change(await screen.findByLabelText(/type delete to confirm/i), {
      target: { value: 'DELETE' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /delete rabbithole account/i }),
    )

    expect(
      await screen.findByRole('dialog', {
        name: /delete rabbithole account data/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/synced quick guides/i)).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: /i understand, delete my account data/i,
      }),
    )

    await waitFor(() =>
      expect(deleteStudyMeshProfile).toHaveBeenCalledWith('auth-user'),
    )
  })

  it('navigates to the landing page when logout is clicked', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    // Click on the user menu button (avatar)
    const userButton = screen.getByRole('button', {
      name: /open user menu/i,
    })
    fireEvent.click(userButton)

    // Click on logout option in the menu
    await waitFor(() => {
      fireEvent.click(screen.getByText('Logout'))
    })

    // Verify navigation to login page
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true }),
    )
  })

  describe('known-topics pill and panel', () => {
    let storage: Record<string, string>

    beforeEach(() => {
      storage = {
        userData: JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        }),
      }
      localStorage.getItem.mockImplementation(
        (key: string) => storage[key] ?? null,
      )
      localStorage.setItem.mockImplementation(
        (key: string, value: string) => {
          storage[key] = value
        },
      )
    })

    afterEach(() => {
      window.history.pushState({}, '', '/')
    })

    const renderAtStudyGuides = () => {
      window.history.pushState({}, '', '/study-guides')
      return render(
        <BrowserRouter>
          <TopNavBar />
        </BrowserRouter>,
      )
    }

    const dispatchCloudSynced = () => {
      act(() => {
        window.dispatchEvent(
          new CustomEvent(CLOUD_SYNC_STATUS_EVENT, {
            detail: { status: 'synced' },
          }),
        )
      })
    }

    it('shows the current known-topics count and opens the panel from the pill', async () => {
      storage[PROFILE_CONTEXT_STORAGE_KEY] = JSON.stringify({
        version: 1,
        roles: [],
        broadKnowledge: [],
        specificKnowledge: ['Cooking', 'Docker'],
        confidence: 'self_reported',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
      renderAtStudyGuides()

      const pillButton = screen.getByRole('button', {
        name: /what you already know/i,
      })
      expect(pillButton).toHaveTextContent('2')

      fireEvent.click(pillButton)

      expect(
        await screen.findByRole('heading', {
          name: /what you already know/i,
        }),
      ).toBeInTheDocument()
      expect(
        screen.getByLabelText(/helpful things you know/i),
      ).toBeInTheDocument()
    })

    it('auto-opens the panel once on the guide library when the user has no topics', async () => {
      renderAtStudyGuides()

      dispatchCloudSynced()

      expect(
        await screen.findByRole('heading', {
          name: /what you already know/i,
        }),
      ).toBeInTheDocument()
      await waitFor(() => {
        expect(storage[KNOWN_TOPICS_PANEL_SEEN_KEY]).toBe('1')
      })
    })

    it('does not auto-open once the panel has already been seen', async () => {
      storage[KNOWN_TOPICS_PANEL_SEEN_KEY] = '1'
      renderAtStudyGuides()

      dispatchCloudSynced()

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /what you already know/i }),
        ).not.toBeInTheDocument()
      })
    })

    it('does not auto-open outside the guide library even with zero topics', () => {
      render(
        <BrowserRouter>
          <TopNavBar />
        </BrowserRouter>,
      )

      dispatchCloudSynced()

      expect(
        screen.queryByRole('heading', { name: /what you already know/i }),
      ).not.toBeInTheDocument()
      expect(storage[KNOWN_TOPICS_PANEL_SEEN_KEY]).toBeUndefined()
    })
  })
})
