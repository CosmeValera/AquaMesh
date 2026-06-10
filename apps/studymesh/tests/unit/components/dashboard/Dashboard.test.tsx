import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import Dashboards from '../../../../src/components/Dasboard/Dashboard'
import * as DashboardProviderModule from '../../../../src/components/Dasboard/DashboardProvider'
import * as WorkspaceActionsModule from '../../../../src/customHooks/useWorkspaceActions'
import * as LayoutProviderModule from '../../../../src/components/Layout/LayoutProvider'
import * as useTopNavBarWidgetsModule from '../../../../src/customHooks/useTopNavBarWidgets'
import { STUDY_GUIDES_STORAGE_KEY } from '../../../../src/studyGuides/storage'

vi.mock('../../../../src/components/Dasboard/DashboardProvider', () => ({
  __esModule: true,
  useDashboards: vi.fn(),
}))

vi.mock('../../../../src/customHooks/useWorkspaceActions', () => ({
  __esModule: true,
  OPEN_CREATE_HUB_EVENT: 'studymesh-open-create-hub',
  OPEN_DASHBOARD_EDITOR_EVENT: 'studymesh-open-dashboard-editor',
  OPEN_WIDGET_EDITOR_EVENT: 'studymesh-open-widget-editor',
  OPEN_STUDY_PATH_EVENT: 'studymesh-open-study-path',
  STARTER_STUDY_PATH_FOLDER_NAME: 'StudyMesh Guide',
  ensureStarterDashboards: vi.fn(),
  useWorkspaceActions: vi.fn(),
}))

vi.mock('../../../../src/components/Layout/LayoutProvider', () => ({
  __esModule: true,
  useLayout: vi.fn(),
}))

vi.mock('../../../../src/customHooks/useTopNavBarWidgets', () => ({
  __esModule: true,
  default: vi.fn(),
}))

vi.mock('../../../../src/components/Layout/Layout', () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-layout-view" />,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../../../src/icons/add.svg', () => ({
  ReactComponent: () => <svg data-testid="add-icon" />,
}))

vi.mock('../../../../src/icons/close.svg', () => ({
  ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="close-icon" {...props} />
  ),
}))

const navigateMock = vi.fn()
const openCreateWidgetMock = vi.fn()
const openCreateDashboardMock = vi.fn()
const openOperationsExampleMock = vi.fn()
const openWidgetMenuMock = vi.fn()

const createStarterStudyPathDashboard = (index: number) => ({
  id: `studymesh-guide-dashboard-${index}`,
  name: `0${index} - StudyMesh Guide ${index}`,
  folder: 'StudyMesh Guide',
  layout: {
    type: 'row',
    children: [
      {
        type: 'tabset',
        children: [
          {
            type: 'tab',
            name: `0${index} - StudyMesh Guide ${index}`,
            component: 'CustomWidget',
            config: {
              customProps: {
                components: [],
              },
            },
          },
        ],
      },
    ],
  },
  createdAt: `2026-05-15T10:0${index}:00.000Z`,
  updatedAt: `2026-05-15T10:0${index}:00.000Z`,
})

const createSavedDashboard = (
  id: string,
  name: string,
  folder = 'Default',
) => ({
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
  isPublic: true,
  createdAt: '2026-05-15T10:00:00.000Z',
  updatedAt: '2026-05-15T10:00:00.000Z',
})

const createStoredStudyGuide = () => ({
  id: 'spanish-b2-guide',
  title: 'Spanish B2 Study Guide',
  folderName: 'Languages',
  studyPath: {
    pathId: 'spanish-b2-guide',
    title: 'Spanish B2 Study Guide',
    folderName: 'Languages',
    selectedIndex: 0,
    dashboards: [
      {
        name: 'Spanish B2 Lesson 1',
        dashboardKey: 'spanish-b2-lesson-1',
        dashboardIndex: 1,
        dashboardCount: 2,
        folderName: 'Languages',
        layout: { type: 'row', children: [] },
      },
      {
        name: 'Spanish B2 Lesson 2',
        dashboardKey: 'spanish-b2-lesson-2',
        dashboardIndex: 2,
        dashboardCount: 2,
        folderName: 'Languages',
        layout: { type: 'row', children: [] },
      },
    ],
  },
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T00:00:00.000Z',
})

const mockPhoneViewport = () => {
  vi.mocked(window.matchMedia).mockImplementation((query) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

const mockDashboardProvider = (
  overrides: Partial<ReturnType<typeof DashboardProviderModule.useDashboards>>,
) => {
  vi.mocked(DashboardProviderModule.useDashboards).mockReturnValue({
    openDashboards: [
      {
        id: 'dash1',
        name: 'Dashboard',
        layout: {
          type: 'row',
          children: [],
        },
      },
    ],
    selectedDashboard: 0,
    setSelectedDashboard: vi.fn(),
    removeDashboard: vi.fn(),
    addDashboard: vi.fn(),
    addDashboards: vi.fn(),
    addStudyPathContainer: vi.fn(),
    updateStudyPathContainer: vi.fn(),
    closeAllDashboards: vi.fn(),
    closeOtherDashboards: vi.fn(),
    closeDashboardsToRight: vi.fn(),
    reorderDashboard: vi.fn(),
    replaceDashboard: vi.fn(),
    updateLayout: vi.fn(),
    updateDashboardLayout: vi.fn(),
    renameDashboard: vi.fn(),
    setDashboardEditing: vi.fn(),
    ...overrides,
  })
}

describe('Dashboards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify([])
      }

      return null
    })
    vi.mocked(WorkspaceActionsModule.useWorkspaceActions).mockReturnValue({
      ensureDashboardAndAddComponent: vi.fn(),
      openCreateWidget: openCreateWidgetMock,
      openCreateDashboard: openCreateDashboardMock,
      openOperationsExample: openOperationsExampleMock,
      openWidgetMenu: openWidgetMenuMock,
    })
    vi.mocked(LayoutProviderModule.useLayout).mockReturnValue({
      ref: { current: null },
      addComponent: vi.fn(),
    })
    vi.mocked(useTopNavBarWidgetsModule.default).mockReturnValue({
      topNavBarWidgets: [],
    })
  })

  it('shows dashboard workflow actions when the selected dashboard is empty', () => {
    mockDashboardProvider({})

    render(<Dashboards />)

    expect(
      screen.getByRole('heading', { name: /open study material/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /customize this page/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /what do you want to learn/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create study guide/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /upload material/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /paste notes/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create quiz/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create flashcards/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /expand on this/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /open existing dashboard/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /advanced dashboard/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /view daily operations example/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /add saved widget/i }),
    ).not.toBeInTheDocument()
  })

  it('shows three recent study material entries by default', async () => {
    const savedDashboards = [
      createSavedDashboard('algebra', 'Algebra Intro', 'Algebra'),
      createSavedDashboard('biology', 'Biology Intro', 'Biology'),
      createSavedDashboard('chemistry', 'Chemistry Intro', 'Chemistry'),
      createSavedDashboard('drama', 'Drama Intro', 'Drama'),
    ]

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    await waitFor(() =>
      expect(screen.getByText('Drama Intro')).toBeInTheDocument(),
    )
    expect(screen.getByText('Chemistry Intro')).toBeInTheDocument()
    expect(screen.getByText('Biology Intro')).toBeInTheDocument()
    expect(screen.queryByText('Algebra Intro')).not.toBeInTheDocument()
  })

  it('uses custom study material selections from empty dashboard settings', async () => {
    const savedDashboards = [
      createSavedDashboard('algebra', 'Algebra Intro', 'Algebra'),
      createSavedDashboard('biology', 'Biology Intro', 'Biology'),
      createSavedDashboard('chemistry', 'Chemistry Intro', 'Chemistry'),
    ]

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      if (key === 'studymesh-empty-dashboard-settings-v1') {
        return JSON.stringify({
          blockOrder: ['creation', 'studyMaterial'],
          showCreationBlock: true,
          studyMaterialMode: 'custom',
          studyMaterialLimit: 3,
          customEntryIds: ['dashboard:biology'],
        })
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    await waitFor(() =>
      expect(screen.getByText('Biology Intro')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Algebra Intro')).not.toBeInTheDocument()
    expect(screen.queryByText('Chemistry Intro')).not.toBeInTheDocument()
    expect(screen.getAllByText('Custom').length).toBeGreaterThan(0)
  })

  it('shows saved Study Guides as one empty dashboard option', async () => {
    const addDashboard = vi.fn()
    const addStudyPathContainer = vi.fn()
    const studyGuide = createStoredStudyGuide()

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify([])
      }

      if (key === STUDY_GUIDES_STORAGE_KEY) {
        return JSON.stringify([studyGuide])
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
      addDashboard,
      addStudyPathContainer,
    })

    render(<Dashboards />)

    const studyGuideButton = await screen.findByRole('button', {
      name: /spanish b2 study guide/i,
    })

    expect(screen.queryByText('Spanish B2 Lesson 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Spanish B2 Lesson 2')).not.toBeInTheDocument()

    fireEvent.click(studyGuideButton)

    expect(addStudyPathContainer).toHaveBeenCalledWith(studyGuide.studyPath)
    expect(addDashboard).not.toHaveBeenCalled()
  })

  it('shows saved Study Guides as one customizer slot option', async () => {
    const studyGuide = createStoredStudyGuide()

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify([])
      }

      if (key === STUDY_GUIDES_STORAGE_KEY) {
        return JSON.stringify([studyGuide])
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    await screen.findByRole('button', {
      name: /spanish b2 study guide/i,
    })

    fireEvent.click(
      screen.getByRole('button', { name: /customize this page/i }),
    )
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: /^study material$/i }),
    )
    fireEvent.click(screen.getByRole('option', { name: /custom/i }))
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: /add to custom/i }),
    )

    expect(
      screen.getByRole('option', { name: /spanish b2 study guide/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Spanish B2 Lesson 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Spanish B2 Lesson 2')).not.toBeInTheDocument()
  })

  it('opens and closes the empty dashboard customizer as a full-page modal', async () => {
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    const cardGrid = screen.getByTestId('empty-dashboard-card-grid')
    expect(cardGrid).toHaveAttribute('data-max-width', '760px')
    expect(
      screen.queryByTestId('empty-dashboard-customizer-settings'),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /customize this page/i }),
    )

    expect(cardGrid).toHaveAttribute('data-max-width', '760px')
    expect(cardGrid).toHaveAttribute(
      'data-desktop-grid-template',
      'minmax(0, 760px)',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByTestId('empty-dashboard-customizer-settings'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create study guide/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /upload material/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: /^study material$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /use empty dashboard layout 1/i,
      }),
    ).toHaveClass('MuiButton-contained')
    expect(
      screen.getByRole('button', {
        name: /use empty dashboard layout 2/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /use empty dashboard layout 3/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^reset$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: /first block/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('slider', { name: /visible items/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('slider', { name: /study material columns/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId('empty-dashboard-customizer-preview'),
    ).toHaveAttribute('data-desktop-grid-template', 'minmax(0, 1fr)')
    expect(
      screen.queryByRole('heading', { name: /what do you want to learn/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: /close customize empty dashboard/i,
      }),
    )

    expect(cardGrid).toHaveAttribute('data-max-width', '760px')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('switches empty dashboard study material settings without first block controls', () => {
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    fireEvent.click(
      screen.getByRole('button', { name: /customize this page/i }),
    )
    expect(
      screen.queryByRole('combobox', { name: /first block/i }),
    ).not.toBeInTheDocument()
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: /^study material$/i }),
    )
    fireEvent.click(screen.getByRole('option', { name: /custom/i }))

    expect(
      screen.getByTestId('empty-dashboard-customizer-preview'),
    ).toHaveAttribute('data-desktop-grid-template', 'minmax(0, 1fr)')
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-settings-v1',
      expect.stringContaining('"studyMaterialMode":"custom"'),
    )
    expect(
      screen.getByRole('slider', { name: /study material columns/i }),
    ).toBeInTheDocument()
  })

  it('reorders and removes custom study material entries from the canvas', async () => {
    const savedDashboards = [
      createSavedDashboard('biology', 'Biology Intro', 'Biology'),
      createSavedDashboard('chemistry', 'Chemistry Intro', 'Chemistry'),
    ]

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      if (key === 'studymesh-empty-dashboard-settings-v1') {
        return JSON.stringify({
          blockOrder: ['creation', 'studyMaterial'],
          showCreationBlock: true,
          studyMaterialMode: 'custom',
          studyMaterialLimit: 20,
          studyMaterialColumns: 1,
          customEntryIds: ['dashboard:biology', 'dashboard:chemistry'],
        })
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    fireEvent.click(
      screen.getByRole('button', { name: /customize this page/i }),
    )
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/move chemistry intro up/i))
    fireEvent.click(screen.getByLabelText(/remove biology intro/i))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-settings-v1',
      expect.stringContaining('"customEntryIds":["dashboard:chemistry"]'),
    )
    await waitFor(() =>
      expect(screen.getAllByText('Chemistry Intro').length).toBeGreaterThan(0),
    )
    expect(screen.queryByText('Biology Intro')).not.toBeInTheDocument()
  })

  it('adds custom study material immediately from the select and saves columns', async () => {
    const savedDashboards = [
      createSavedDashboard('biology', 'Biology Intro', 'Biology'),
      createSavedDashboard('chemistry', 'Chemistry Intro', 'Chemistry'),
    ]

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      if (key === 'studymesh-empty-dashboard-settings-v1') {
        return JSON.stringify({
          blockOrder: ['creation', 'studyMaterial'],
          showCreationBlock: true,
          studyMaterialMode: 'custom',
          studyMaterialLimit: 20,
          studyMaterialColumns: 1,
          customEntryIds: ['dashboard:biology'],
        })
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    fireEvent.click(
      screen.getByRole('button', { name: /customize this page/i }),
    )
    fireEvent.mouseDown(
      screen.getByRole('combobox', {
        name: /add to custom/i,
      }),
    )
    fireEvent.click(screen.getByRole('option', { name: /chemistry intro/i }))
    fireEvent.change(
      screen.getByRole('slider', { name: /study material columns/i }),
      {
        target: { value: 2 },
      },
    )

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-settings-v1',
      expect.stringContaining(
        '"customEntryIds":["dashboard:biology","dashboard:chemistry"]',
      ),
    )
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-settings-v1',
      expect.stringContaining('"studyMaterialColumns":2'),
    )
  })

  it('remembers custom study material columns after switching through recent', () => {
    const savedDashboards = [
      createSavedDashboard('biology', 'Biology Intro', 'Biology'),
      createSavedDashboard('chemistry', 'Chemistry Intro', 'Chemistry'),
    ]

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      if (key === 'studymesh-empty-dashboard-settings-v1') {
        return JSON.stringify({
          blockOrder: ['creation', 'studyMaterial'],
          showCreationBlock: true,
          studyMaterialMode: 'custom',
          studyMaterialLimit: 20,
          studyMaterialColumns: 2,
          customEntryIds: ['dashboard:biology', 'dashboard:chemistry'],
        })
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    fireEvent.click(
      screen.getByRole('button', { name: /customize this page/i }),
    )
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: /^study material$/i }),
    )
    fireEvent.click(screen.getByRole('option', { name: /recent/i }))
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: /^study material$/i }),
    )
    fireEvent.click(screen.getByRole('option', { name: /custom/i }))

    expect(
      screen.getByRole('slider', { name: /study material columns/i }),
    ).toHaveValue('2')
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-settings-v1',
      expect.stringContaining('"studyMaterialColumns":2'),
    )
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-layouts-v1',
      expect.stringContaining('"studyMaterialColumns":2'),
    )
  })

  it('switches and persists empty dashboard layout slots', () => {
    const savedDashboards = [
      createSavedDashboard('biology', 'Biology Intro', 'Biology'),
      createSavedDashboard('chemistry', 'Chemistry Intro', 'Chemistry'),
    ]

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      if (key === 'studymesh-empty-dashboard-active-layout-v1') {
        return '2'
      }

      if (key === 'studymesh-empty-dashboard-layouts-v1') {
        return JSON.stringify({
          1: {
            blockOrder: ['creation', 'studyMaterial'],
            showCreationBlock: true,
            studyMaterialMode: 'custom',
            studyMaterialLimit: 20,
            studyMaterialColumns: 2,
            customEntryIds: ['dashboard:biology', 'dashboard:chemistry'],
          },
          2: {
            blockOrder: ['creation', 'studyMaterial'],
            showCreationBlock: true,
            studyMaterialMode: 'recent',
            studyMaterialLimit: 3,
            studyMaterialColumns: 1,
            customEntryIds: [],
          },
          3: {
            blockOrder: ['creation', 'studyMaterial'],
            showCreationBlock: true,
            studyMaterialMode: 'recent',
            studyMaterialLimit: 3,
            studyMaterialColumns: 1,
            customEntryIds: [],
          },
        })
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    fireEvent.click(
      screen.getByRole('button', { name: /customize this page/i }),
    )
    expect(
      screen.getByRole('button', {
        name: /use empty dashboard layout 2/i,
      }),
    ).toHaveClass('MuiButton-contained')

    fireEvent.click(
      screen.getByRole('button', {
        name: /use empty dashboard layout 1/i,
      }),
    )

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-active-layout-v1',
      '1',
    )
    expect(
      screen.getByRole('slider', { name: /study material columns/i }),
    ).toHaveValue('2')
  })

  it('groups custom study material into editable sections', async () => {
    const savedDashboards = [
      createSavedDashboard('algebra', 'Algebra Intro', 'Algebra'),
      createSavedDashboard('biology', 'Biology Intro', 'Biology'),
      createSavedDashboard('chemistry', 'Chemistry Intro', 'Chemistry'),
    ]

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      if (key === 'studymesh-empty-dashboard-settings-v1') {
        return JSON.stringify({
          blockOrder: ['creation', 'studyMaterial'],
          showCreationBlock: true,
          studyMaterialMode: 'custom',
          studyMaterialLimit: 20,
          studyMaterialColumns: 2,
          customSections: [
            {
              id: 'science',
              name: 'Science',
              entryIds: ['dashboard:biology'],
            },
            {
              id: 'math',
              name: 'Math',
              entryIds: ['dashboard:algebra'],
            },
          ],
        })
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    await waitFor(() => expect(screen.getByText('Science')).toBeInTheDocument())
    expect(screen.getByText('Math')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /customize this page/i }),
    )
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: /active section/i }),
    )
    fireEvent.click(screen.getByRole('option', { name: /science/i }))
    fireEvent.mouseDown(
      screen.getByRole('combobox', {
        name: /add to science/i,
      }),
    )
    fireEvent.click(screen.getByRole('option', { name: /chemistry intro/i }))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-settings-v1',
      expect.stringContaining(
        '"entryIds":["dashboard:biology","dashboard:chemistry"]',
      ),
    )
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-settings-v1',
      expect.stringContaining(
        '"customEntryIds":["dashboard:biology","dashboard:chemistry","dashboard:algebra"]',
      ),
    )

    fireEvent.change(
      screen.getByRole('textbox', { name: /new section name/i }),
      {
        target: { value: 'Review' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-settings-v1',
      expect.stringContaining('"name":"Review"'),
    )
  })

  it('limits custom study material columns to the hard column cap', () => {
    const savedDashboards = Array.from({ length: 5 }, (_, index) =>
      createSavedDashboard(
        `topic-${index + 1}`,
        `Topic ${index + 1}`,
        `Topic ${index + 1}`,
      ),
    )

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      if (key === 'studymesh-empty-dashboard-settings-v1') {
        return JSON.stringify({
          blockOrder: ['creation', 'studyMaterial'],
          showCreationBlock: true,
          studyMaterialMode: 'custom',
          studyMaterialLimit: 20,
          studyMaterialColumns: 5,
          customEntryIds: [
            'dashboard:topic-1',
            'dashboard:topic-2',
            'dashboard:topic-3',
            'dashboard:topic-4',
            'dashboard:topic-5',
          ],
        })
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    fireEvent.click(
      screen.getByRole('button', { name: /customize this page/i }),
    )

    const columnsSlider = screen.getByRole('slider', {
      name: /study material columns/i,
    })
    expect(columnsSlider).toHaveAttribute('max', '4')
    expect(columnsSlider).toHaveValue('4')

    fireEvent.click(screen.getByLabelText(/remove topic 5/i))

    expect(columnsSlider).toHaveAttribute('max', '4')
    expect(columnsSlider).toHaveValue('4')
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-empty-dashboard-settings-v1',
      expect.stringContaining('"studyMaterialColumns":4'),
    )
  })

  it('shows all custom entries and caps columns to selected custom entries', () => {
    const savedDashboards = Array.from({ length: 5 }, (_, index) =>
      createSavedDashboard(
        `topic-${index + 1}`,
        `Topic ${index + 1}`,
        `Topic ${index + 1}`,
      ),
    )

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      if (key === 'studymesh-empty-dashboard-settings-v1') {
        return JSON.stringify({
          blockOrder: ['creation', 'studyMaterial'],
          showCreationBlock: true,
          studyMaterialMode: 'custom',
          studyMaterialLimit: 3,
          studyMaterialColumns: 5,
          customEntryIds: [
            'dashboard:topic-1',
            'dashboard:topic-2',
            'dashboard:topic-3',
            'dashboard:topic-4',
            'dashboard:topic-5',
          ],
        })
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    fireEvent.click(
      screen.getByRole('button', { name: /customize this page/i }),
    )

    const columnsSlider = screen.getByRole('slider', {
      name: /study material columns/i,
    })
    expect(screen.getAllByText('Topic 5').length).toBeGreaterThan(0)
    expect(columnsSlider).toHaveAttribute('max', '4')
    expect(columnsSlider).toHaveValue('4')
  })

  it('refreshes recent study material when saved dashboards change', async () => {
    const savedDashboards = [createSavedDashboard('biology', 'Biology Intro')]

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    expect(screen.queryByText('Chemistry Intro')).not.toBeInTheDocument()

    savedDashboards.push(createSavedDashboard('chemistry', 'Chemistry Intro'))

    act(() => {
      window.dispatchEvent(new Event('studymesh-saved-dashboards-changed'))
    })

    await waitFor(() =>
      expect(screen.getByText('Chemistry Intro')).toBeInTheDocument(),
    )
  })

  it('ignores legacy visible item settings and shows three recent entries', async () => {
    const savedDashboards = Array.from({ length: 6 }, (_, index) =>
      createSavedDashboard(
        `topic-${index + 1}`,
        `Topic ${index + 1}`,
        `Topic ${index + 1}`,
      ),
    )

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(savedDashboards)
      }

      if (key === 'studymesh-empty-dashboard-settings-v1') {
        return JSON.stringify({
          blockOrder: ['creation', 'studyMaterial'],
          showCreationBlock: false,
          studyMaterialMode: 'recent',
          studyMaterialLimit: 6,
          customEntryIds: [],
        })
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    await waitFor(() =>
      expect(screen.getAllByText('Topic 6').length).toBeGreaterThan(0),
    )
    expect(screen.getAllByText('Topic 5').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Topic 4').length).toBeGreaterThan(0)
    expect(screen.queryByText('Topic 3')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /what do you want to learn/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /customize this page/i }),
    ).toBeInTheDocument()
  })

  it('ignores legacy empty dashboard block order settings', () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify([])
      }

      if (key === 'studymesh-empty-dashboard-settings-v1') {
        return JSON.stringify({
          blockOrder: ['studyMaterial', 'creation'],
          showCreationBlock: true,
          studyMaterialMode: 'recent',
          studyMaterialLimit: 3,
          customEntryIds: [],
        })
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    expect(
      screen.getByRole('heading', {
        name: /open study material/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', {
        name: /what do you want to learn/i,
      }),
    ).not.toBeInTheDocument()
  })

  it('falls back to default empty dashboard settings when storage is malformed', () => {
    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify([])
      }

      if (key === 'studymesh-empty-dashboard-settings-v1') {
        return '{bad json'
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    expect(
      screen.getByRole('heading', {
        name: /open study material/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /what do you want to learn/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Recent')).toBeInTheDocument()
  })

  it('opens the default starter Study Guide on first empty workspace load', async () => {
    const addStudyPathContainer = vi.fn()
    const starterDashboards = [
      createStarterStudyPathDashboard(1),
      createStarterStudyPathDashboard(2),
    ]
    const starterStudyGuide = {
      id: 'studymesh-student-knowledge-wiki-a-beginner-s-guide',
      title: "StudyMesh Student Knowledge Wiki: A Beginner's Guide",
      folderName: 'StudyMesh Guide',
      studyPath: {
        pathId: 'studymesh-student-knowledge-wiki-a-beginner-s-guide',
        title: "StudyMesh Student Knowledge Wiki: A Beginner's Guide",
        folderName: 'StudyMesh Guide',
        selectedIndex: 0,
        dashboards: starterDashboards.map((dashboard, index) => ({
          name: dashboard.name,
          layout: dashboard.layout,
          dashboardKey: `studymesh-guide-${index + 1}`,
          dashboardIndex: index + 1,
          dashboardCount: starterDashboards.length,
          folderName: 'StudyMesh Guide',
        })),
      },
      createdAt: '2026-05-15T10:00:00.000Z',
      updatedAt: '2026-05-15T10:00:00.000Z',
    }

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify(starterDashboards)
      }

      if (key === STUDY_GUIDES_STORAGE_KEY) {
        return JSON.stringify([starterStudyGuide])
      }

      return null
    })

    mockDashboardProvider({ addStudyPathContainer })

    render(<Dashboards />)

    await waitFor(() => expect(addStudyPathContainer).toHaveBeenCalled())
    expect(addStudyPathContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        pathId: 'studymesh-student-knowledge-wiki-a-beginner-s-guide',
        title: "StudyMesh Student Knowledge Wiki: A Beginner's Guide",
        dashboards: expect.arrayContaining([
          expect.objectContaining({ name: '01 - StudyMesh Guide 1' }),
          expect.objectContaining({ name: '02 - StudyMesh Guide 2' }),
        ]),
      }),
    )
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-default-study-path-opened-v1',
      'true',
    )
  })

  it('keeps empty dashboard study material reachable on phones', () => {
    mockPhoneViewport()
    mockDashboardProvider({
      openDashboards: [],
      selectedDashboard: -1,
    })

    render(<Dashboards />)

    expect(screen.getByText(/open study material/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /customize this page/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create study guide/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /advanced dashboard/i }),
    ).not.toBeInTheDocument()
  })

  it('allows a single Study Guide tab to close so the provider can restore the empty workspace', () => {
    const removeDashboard = vi.fn()

    mockDashboardProvider({
      removeDashboard,
      openDashboards: [
        {
          id: 'study-path-tab',
          name: 'French B1',
          kind: 'studyPathContainer',
          studyPath: {
            pathId: 'french-b1',
            title: 'French B1',
            folderName: 'French B1',
            selectedIndex: 0,
            dashboards: [
              {
                id: 'lesson-1',
                name: 'Lesson 1',
                layout: { type: 'row', children: [] },
                dashboardKey: 'french-b1-1',
                dashboardIndex: 1,
                dashboardCount: 1,
                folderName: 'French B1',
              },
            ],
          },
        },
      ],
      selectedDashboard: 0,
    })

    render(<Dashboards />)

    fireEvent.click(screen.getByTestId('close-icon'))

    expect(removeDashboard).toHaveBeenCalledWith('study-path-tab')
  })

  it('disables Update in Create Dashboard when the saved dashboard has no changes', () => {
    const savedLayout = {
      type: 'row',
      children: [
        {
          type: 'tabset',
          children: [
            {
              type: 'tab',
              name: 'Pump Widget',
              component: 'CustomWidget',
            },
          ],
        },
      ],
    }

    localStorage.getItem.mockImplementation((key: string) => {
      if (key === 'userData') {
        return JSON.stringify({
          id: 'admin',
          name: 'Admin User',
          role: 'ADMIN_ROLE',
        })
      }

      if (key === 'customDashboards') {
        return JSON.stringify([
          {
            id: 'saved-dashboard-1',
            name: 'Operations',
            layout: savedLayout,
            createdAt: '2026-05-06T00:00:00.000Z',
            updatedAt: '2026-05-06T00:00:00.000Z',
          },
        ])
      }

      return null
    })
    mockDashboardProvider({
      openDashboards: [
        {
          id: 'dash1',
          name: 'Operations',
          layout: savedLayout,
        },
      ],
      selectedDashboard: 0,
    })

    render(<Dashboards />)

    fireEvent.click(
      screen.getByRole('button', { name: /edit dashboard operations/i }),
    )

    expect(screen.getByRole('button', { name: /^update$/i })).toBeDisabled()
  })
})
