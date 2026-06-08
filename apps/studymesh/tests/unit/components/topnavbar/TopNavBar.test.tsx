import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import TopNavBar from '../../../../src/components/topnavbar/TopNavBar'
import * as useTopNavBarWidgetsModule from '../../../../src/customHooks/useTopNavBarWidgets'
import * as LayoutProviderModule from '../../../../src/components/Layout/LayoutProvider'
import * as DashboardProviderModule from '../../../../src/components/Dasboard/DashboardProvider'
import {
  OPEN_DASHBOARD_EDITOR_EVENT,
  OPEN_STUDY_PACK_EVENT,
  OPEN_STUDY_PATH_EVENT,
} from '../../../../src/customHooks/useWorkspaceActions'
import { STUDYMESH_ONBOARDING_RESET_EVENT } from '../../../../src/components/onboarding/onboardingEvents'
import { STUDY_PACK_AI_SETTINGS_KEY } from '../../../../src/studyPack/ai'
import { STUDY_CREDITS_LABEL } from '../../../../src/studyPack/ai/hostedCredits'

const hostedAiStatus = vi.hoisted(() => ({
  available: true,
  accountReady: true,
  introSeen: true,
  studyCredits: 8,
  dailyFreeCredits: 2,
  initialFreeCredits: 10,
  costs: {
    'study-guide': 2,
    'quick-create': 1,
    chat: 1,
  },
}))

// Mock custom hooks and providers
vi.mock('../../../../src/customHooks/useTopNavBarWidgets', () => ({
  __esModule: true,
  default: vi.fn(),
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

vi.mock('../../../../src/components/WidgetEditor/WidgetEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="widget-editor">Widget Editor</div>,
}))

vi.mock('../../../../src/components/studyPack/CreateStudyPackModal', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="study-pack-modal">Study Pack Modal</div> : null,
}))

vi.mock('../../../../src/components/studyPack/CreateStudyPathModal', () => ({
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

// Mock useWidgetManager hook
vi.mock(
  '../../../../src/components/WidgetEditor/hooks/useWidgetManager',
  () => ({
    __esModule: true,
    default: () => ({
      widgets: [],
      isWidgetManagementOpen: false,
      openWidgetManagement: vi.fn(),
      closeWidgetManagement: vi.fn(),
      previewWidget: vi.fn(),
      editWidget: vi.fn(),
      deleteWidget: vi.fn(),
    }),
  }),
)

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../../../src/auth/AuthProvider', () => ({
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
    loading: false,
    error: '',
    refresh: vi.fn(),
    markIntroSeen: vi.fn(),
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

      if (key === STUDY_PACK_AI_SETTINGS_KEY) {
        return JSON.stringify({
          provider: 'gemini',
          apiToken: 'test-token',
          model: 'gemini-test',
        })
      }

      return null
    })

    // Setup useTopNavBarWidgets mock
    vi.mocked(useTopNavBarWidgetsModule.default).mockReturnValue({
      topNavBarWidgets: [
        {
          name: 'Standard Widgets',
          items: [
            { name: 'Chart Widget', component: 'ChartWidget' },
            { name: 'Data Table', component: 'DataTable' },
          ],
        },
        {
          name: 'Custom Widgets',
          items: [
            {
              name: 'My Custom Widget',
              component: 'CustomWidget',
              customProps: { widgetId: '123' },
            },
          ],
        },
      ],
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
      screen.queryByRole('button', { name: /create from notes/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create study guide/i }),
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

  it('keeps Study Guide and Create From Notes event entry points available in Basic fallback mode', async () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === STUDY_PACK_AI_SETTINGS_KEY) {
        return JSON.stringify({
          provider: 'basic',
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

    act(() => {
      window.dispatchEvent(new Event(OPEN_STUDY_PACK_EVENT))
    })
    expect(await screen.findByTestId('study-pack-modal')).toBeInTheDocument()
  })

  it('keeps Study Guide and Create From Notes entry points available in hosted Study Credits mode', async () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === STUDY_PACK_AI_SETTINGS_KEY) {
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
      window.dispatchEvent(new Event(OPEN_STUDY_PACK_EVENT))
    })

    expect(await screen.findByText('Study Guide Modal')).toBeInTheDocument()
    expect(await screen.findByTestId('study-pack-modal')).toBeInTheDocument()
  })

  it('shows compact hosted Study Credits balance when hosted mode is selected', async () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === STUDY_PACK_AI_SETTINGS_KEY) {
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
            dailyFreeCredits: 2,
            initialFreeCredits: 10,
            costs: {
              'study-guide': 2,
              'quick-create': 1,
              chat: 1,
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
      screen.getByRole('button', { name: `Open ${STUDY_CREDITS_LABEL}` }),
    ).toBeInTheDocument()
  })

  it('opens Study Credits details from the top bar balance pill', async () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === STUDY_PACK_AI_SETTINGS_KEY) {
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
        name: `Open ${STUDY_CREDITS_LABEL}`,
      }),
    )

    expect(
      await screen.findByRole('dialog', { name: /Study Credits/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/study guide.*2/i)).toBeInTheDocument()
    expect(screen.getByText(/quick create.*1/i)).toBeInTheDocument()
    expect(screen.getByText(/chat.*1/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /buy 250 credits for 5 eur.*most popular/i,
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', {
        name: /buy 1200 credits for 20 eur.*best value/i,
      }),
    ).toBeEnabled()
  })

  it('hides the Study Credits pill when the active provider uses an own API key', () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === STUDY_PACK_AI_SETTINGS_KEY) {
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

    expect(
      screen.queryByRole('button', { name: `Open ${STUDY_CREDITS_LABEL}` }),
    ).not.toBeInTheDocument()
  })

  it('renders the StudyMesh logo', () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    expect(screen.getByTestId('logo')).toBeInTheDocument()
  })

  it('opens Create Widget when Create Widget button is clicked', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    openUserMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /create widget/i }),
    )

    expect(await screen.findByTestId('widget-editor')).toBeInTheDocument()
  })

  it('dispatches the dashboard builder event when Create Dashboard is clicked', async () => {
    const dashboardEditorListener = vi.fn()
    window.addEventListener(
      OPEN_DASHBOARD_EDITOR_EVENT,
      dashboardEditorListener,
    )

    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    openUserMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /create dashboard/i }),
    )

    expect(dashboardEditorListener).toHaveBeenCalledTimes(1)
    window.removeEventListener(
      OPEN_DASHBOARD_EDITOR_EVENT,
      dashboardEditorListener,
    )
  })

  it('disables Advanced for viewers without opening its menu', () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'viewer',
          name: 'Viewer User',
          role: 'VIEWER_ROLE',
        })
      }

      if (key === STUDY_PACK_AI_SETTINGS_KEY) {
        return JSON.stringify({
          provider: 'gemini',
          apiToken: 'test-token',
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

    fireEvent.click(
      screen.getByRole('button', {
        name: /open user menu/i,
      }),
    )

    expect(
      screen.getByRole('menuitem', { name: /create dashboard/i }),
    ).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByRole('menuitem', { name: /create widget/i }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('opens Create From Notes from the workspace event without opening Widget or Dashboard', async () => {
    const dashboardEditorListener = vi.fn()
    const studyPackListener = vi.fn()
    window.addEventListener(
      OPEN_DASHBOARD_EDITOR_EVENT,
      dashboardEditorListener,
    )
    window.addEventListener(OPEN_STUDY_PACK_EVENT, studyPackListener)

    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    act(() => {
      window.dispatchEvent(new Event(OPEN_STUDY_PACK_EVENT))
    })

    expect(studyPackListener).toHaveBeenCalledTimes(1)
    expect(dashboardEditorListener).not.toHaveBeenCalled()
    expect(await screen.findByTestId('study-pack-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('widget-editor')).not.toBeInTheDocument()

    window.removeEventListener(
      OPEN_DASHBOARD_EDITOR_EVENT,
      dashboardEditorListener,
    )
    window.removeEventListener(OPEN_STUDY_PACK_EVENT, studyPackListener)
  })

  it('replays the workspace tutorial from application settings', async () => {
    const resetListener = vi.fn()
    window.addEventListener(STUDYMESH_ONBOARDING_RESET_EVENT, resetListener)

    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /open user menu/i,
      }),
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /^settings$/i }),
    )
    fireEvent.click(await screen.findByRole('button', { name: /^replay$/i }))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-workspace-onboarding-v1',
      JSON.stringify({
        status: 'active',
        stepId: 'create-dashboard',
      }),
    )
    expect(resetListener).toHaveBeenCalledTimes(1)

    window.removeEventListener(STUDYMESH_ONBOARDING_RESET_EVENT, resetListener)
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
})
